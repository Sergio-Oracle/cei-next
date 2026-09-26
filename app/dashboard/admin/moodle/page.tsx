'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import api from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'

/* Page Administration → Moodle (phase 2 de la feuille de route CEI–UNCHK).
   Plateformes Moodle ajoutées sans code, correspondance cours ↔ EC, et
   synchronisation cours par cours (simulation puis application) avec les
   mêmes règles que la connexion SSO. */

const ACCENT = '#3b82f6'
const DANGER = '#ef4444'

interface Diagnosis { ok: boolean; problems?: string[]; warnings?: string[]; reminder?: string; site?: { sitename?: string; release?: string; functions_count?: number } }
interface Instance {
  id: number; name: string; base_url: string; token_hint: string
  pole_id: number | null; pole_code: string | null; is_active: boolean
  last_check_at: string | null; last_check_ok: boolean | null; last_check: Diagnosis | null
}
interface Pole { id: number; code: string; name: string }
interface Mapping {
  matched: { instance_id: number; instance: string; shortname: string; fullname: string; ec_code: string; ue_code: string | null }[]
  moodle_courses_without_ec: { instance: string; shortname: string; fullname: string }[]
  ecs_without_moodle_course: string[]
  duplicate_codes: Record<string, string[]>
  errors: { instance: string; error: string }[]
  counts: Record<string, number>
}
interface CourseResult {
  ec_code: string; ue_code?: string | null; instance?: string; error?: string
  teachers?: { moodle: number; created: number; upgraded: number; assignments_added: number; other_role: { email: string; role: string }[]
               created_emails: string[]; upgraded_emails: string[] }
  students?: { moodle: number; created: number; enrollments_added: number; already_enrolled: number; formation_filled: number; other_role: number
               without_formation: Record<string, string[]>; formations_created: string[]; created_emails: string[]; enrolled_emails: string[]; formation_filled_emails: string[] }
}

interface StructureReport {
  instance_id: number; instance: string; error?: string
  formations?: string[]; formations_renamed?: string[]; semesters?: string[]; ues?: string[]; ecs?: string[]
  ue_links?: number; skipped?: { code: string; reason: string }[]
}

const inputStyle: React.CSSProperties = { width: '100%', padding: '9px 12px', border: '1.5px solid var(--border)', borderRadius: 9, fontSize: 15.5, background: 'var(--surface)', color: 'var(--text)', boxSizing: 'border-box' }
const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }
const cardHead: React.CSSProperties = { padding: '16px 22px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }

function Button({ children, onClick, disabled, variant = 'primary', title }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; variant?: 'primary' | 'ghost' | 'danger'; title?: string }) {
  const styles: Record<string, React.CSSProperties> = {
    primary: { background: ACCENT, color: 'white', border: 'none' },
    ghost:   { background: 'transparent', color: 'var(--text)', border: '1.5px solid var(--border)' },
    danger:  { background: 'transparent', color: DANGER, border: `1.5px solid ${DANGER}` },
  }
  return (
    <button type="button" title={title} onClick={onClick} disabled={disabled}
      style={{ ...styles[variant], padding: '8px 16px', borderRadius: 9, fontSize: 15, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? .55 : 1, display: 'inline-flex', alignItems: 'center', gap: 7 }}>
      {children}
    </button>
  )
}

function StatusPill({ inst }: { inst: Instance }) {
  let label = 'Non testée', color = 'var(--text-muted)', bg = 'var(--border)'
  if (!inst.is_active) { label = 'Suspendue'; color = 'var(--text-muted)'; bg = 'var(--border)' }
  else if (inst.last_check_ok === true) { label = 'Prête'; color = '#1d4ed8'; bg = '#dbeafe' }
  else if (inst.last_check_ok === false) { label = 'À régler'; color = '#b91c1c'; bg = '#fee2e2' }
  return <span style={{ fontSize: 13, fontWeight: 700, padding: '3px 10px', borderRadius: 99, color, background: bg, whiteSpace: 'nowrap' }}>{label}</span>
}

function DiagnosisBox({ d }: { d: Diagnosis }) {
  return (
    <div style={{ fontSize: 14.5, display: 'grid', gap: 6, padding: '10px 14px', borderRadius: 10, background: d.ok ? '#eff6ff' : '#fef2f2', border: `1px solid ${d.ok ? '#bfdbfe' : '#fecaca'}` }}>
      {d.site && <div style={{ color: 'var(--text-muted)' }}>{d.site.sitename} · Moodle {d.site.release} · {d.site.functions_count} fonctions autorisées</div>}
      {d.ok && <div style={{ color: '#1d4ed8', fontWeight: 600 }}><i className="fas fa-check-circle" style={{ marginRight: 6 }} />Plateforme prête pour CEI</div>}
      {(d.problems || []).map((p, i) => <div key={i} style={{ color: '#b91c1c' }}><i className="fas fa-circle-exclamation" style={{ marginRight: 6 }} />{p}</div>)}
      {(d.warnings || []).map((w, i) => <div key={i} style={{ color: 'var(--text-muted)' }}><i className="fas fa-circle-info" style={{ marginRight: 6 }} />{w}</div>)}
      {d.reminder && <div style={{ color: 'var(--text-muted)', fontSize: 13.5 }}>{d.reminder}</div>}
    </div>
  )
}

const emptyForm = { name: '', base_url: '', token: '', pole_id: '' as string }

export default function AdminMoodlePage() {
  const { success, error } = useToast()
  const [instances, setInstances] = useState<Instance[]>([])
  const [poles, setPoles] = useState<Pole[]>([])
  const [loading, setLoading] = useState(true)
  const [disabled, setDisabled] = useState(false)

  const [formOpen, setFormOpen] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [formDiagnosis, setFormDiagnosis] = useState<Diagnosis | null>(null)
  const [testing, setTesting] = useState<number | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null)

  const [mapping, setMapping] = useState<Mapping | null>(null)
  const [mappingLoading, setMappingLoading] = useState(false)

  const [syncInstance, setSyncInstance] = useState<string>('')
  const [running, setRunning] = useState<null | 'dry' | 'apply'>(null)
  const [progress, setProgress] = useState({ done: 0, total: 0, current: '' })
  const [results, setResults] = useState<CourseResult[]>([])
  const [lastMode, setLastMode] = useState<null | 'dry' | 'apply'>(null)
  const [confirmApply, setConfirmApply] = useState(false)
  const [structRunning, setStructRunning] = useState<null | 'dry' | 'apply'>(null)
  const [structResult, setStructResult] = useState<{ dry_run: boolean; instances: StructureReport[] } | null>(null)
  const [confirmStruct, setConfirmStruct] = useState(false)
  const stopRef = useRef(false)

  const loadInstances = useCallback(async () => {
    try {
      const res = await api.get<{ instances: Instance[] }>('/api/admin/moodle/instances')
      setInstances(res.instances || [])
      setDisabled(false)
    } catch (e: any) {
      if (String(e.message || '').includes('désactivée')) setDisabled(true)
      else error(e.message || 'Chargement des plateformes impossible')
    } finally { setLoading(false) }
  }, []) // eslint-disable-line

  const loadMapping = useCallback(async () => {
    setMappingLoading(true)
    try { setMapping(await api.get<Mapping>('/api/admin/moodle/courses')) }
    catch (e: any) { error(e.message || 'Correspondance indisponible') }
    finally { setMappingLoading(false) }
  }, []) // eslint-disable-line

  useEffect(() => {
    loadInstances()
    api.get<Pole[]>('/api/poles').then(r => setPoles(Array.isArray(r) ? r : [])).catch(() => {})
  }, [loadInstances])

  useEffect(() => { if (instances.some(i => i.is_active)) loadMapping() }, [instances, loadMapping])

  /* ── Plateformes ── */
  function openAdd() { setEditId(null); setForm(emptyForm); setFormDiagnosis(null); setFormOpen(true) }
  function openEdit(i: Instance) {
    setEditId(i.id); setForm({ name: i.name, base_url: i.base_url, token: '', pole_id: i.pole_id ? String(i.pole_id) : '' })
    setFormDiagnosis(null); setFormOpen(true)
  }

  async function saveInstance() {
    if (!form.name.trim() || !form.base_url.trim() || (!editId && !form.token.trim())) {
      error(editId ? 'Nom et adresse requis' : 'Nom, adresse et token requis'); return
    }
    setSaving(true); setFormDiagnosis(null)
    const body: any = { name: form.name.trim(), base_url: form.base_url.trim(), pole_id: form.pole_id ? Number(form.pole_id) : null }
    if (form.token.trim()) body.token = form.token.trim()
    try {
      const res = editId
        ? await api.put<{ instance: Instance; diagnosis: Diagnosis | null }>(`/api/admin/moodle/instances/${editId}`, body)
        : await api.post<{ instance: Instance; diagnosis: Diagnosis }>('/api/admin/moodle/instances', body)
      if (res.diagnosis) setFormDiagnosis(res.diagnosis)
      if (!res.diagnosis || res.diagnosis.ok) setFormOpen(false)
      success(editId ? 'Plateforme modifiée' : 'Plateforme ajoutée')
      await loadInstances()
    } catch (e: any) { error(e.message || 'Enregistrement impossible') }
    finally { setSaving(false) }
  }

  async function testInstance(id: number) {
    setTesting(id)
    try {
      const res = await api.post<{ diagnosis: Diagnosis }>(`/api/admin/moodle/instances/${id}/test`)
      res.diagnosis.ok ? success('Plateforme prête') : error('Des réglages manquent dans Moodle')
      await loadInstances()
    } catch (e: any) { error(e.message || 'Test impossible') }
    finally { setTesting(null) }
  }

  async function toggleActive(i: Instance) {
    try {
      await api.put(`/api/admin/moodle/instances/${i.id}`, { is_active: !i.is_active })
      success(i.is_active ? 'Plateforme suspendue' : 'Plateforme réactivée')
      await loadInstances()
    } catch (e: any) { error(e.message || 'Modification impossible') }
  }

  async function deleteInstance(id: number) {
    try {
      await api.delete(`/api/admin/moodle/instances/${id}`)
      success('Plateforme supprimée'); setConfirmDelete(null)
      await loadInstances()
    } catch (e: any) { error(e.message || 'Suppression impossible') }
  }

  /* ── Maquette depuis Moodle ── */
  async function runStructure(mode: 'dry' | 'apply') {
    setConfirmStruct(false); setStructRunning(mode)
    try {
      const r = await api.aiPost<{ dry_run: boolean; instances: StructureReport[] }>('/api/admin/moodle/sync/structure',
        { dry_run: mode === 'dry', ...(syncInstance ? { instance_id: Number(syncInstance) } : {}) })
      setStructResult(r)
      if (mode === 'apply') { success('Maquette complétée depuis Moodle'); setResults([]); setLastMode(null); loadMapping() }
    } catch (e: any) { error(e.message || 'Création de la maquette impossible') }
    finally { setStructRunning(null) }
  }
  const structTotals = (structResult?.instances || []).reduce((t, r) => ({
    formations: t.formations + (r.formations?.length || 0), renamed: t.renamed + (r.formations_renamed?.length || 0),
    semesters: t.semesters + (r.semesters?.length || 0), ues: t.ues + (r.ues?.length || 0), ecs: t.ecs + (r.ecs?.length || 0),
    links: t.links + (r.ue_links || 0),
  }), { formations: 0, renamed: 0, semesters: 0, ues: 0, ecs: 0, links: 0 })
  const structNothing = structResult && Object.values(structTotals).every(n => n === 0)

  /* ── Synchronisation ── */
  const courses = (mapping?.matched || []).filter(c => !syncInstance || String(c.instance_id) === syncInstance)

  async function runSync(mode: 'dry' | 'apply') {
    if (!courses.length) return
    setConfirmApply(false); stopRef.current = false
    setRunning(mode); setResults([]); setLastMode(mode)
    setProgress({ done: 0, total: courses.length, current: '' })
    const acc: CourseResult[] = []
    for (let i = 0; i < courses.length; i++) {
      if (stopRef.current) break
      const c = courses[i]
      setProgress({ done: i, total: courses.length, current: c.ec_code })
      try {
        const r = await api.aiPost<CourseResult>('/api/admin/moodle/sync/course', { ec_code: c.ec_code, instance_id: c.instance_id, dry_run: mode === 'dry' })
        acc.push({ ...r, instance: c.instance })
      } catch (e: any) {
        acc.push({ ec_code: c.ec_code, instance: c.instance, error: e.message || 'Erreur' })
      }
      setResults([...acc])
    }
    setProgress(p => ({ ...p, done: acc.length, current: '' }))
    setRunning(null)
    if (stopRef.current) error(`Arrêtée après ${acc.length} cours sur ${courses.length}`)
    else if (mode === 'apply') success('Synchronisation terminée')
    else success('Simulation terminée : rien n’a été modifié')
    if (mode === 'apply') loadMapping()
  }

  // Bilan dédoublonné : en simulation, un même étudiant absent de CEI apparaît
  // dans chacun de ses cours, et plusieurs EC partagent la même UE — on compte
  // des personnes (et des couples UE + personne), pas des lignes de cours.
  const totals = (() => {
    const tCreated = new Set<string>(), tUpgraded = new Set<string>(), sCreated = new Set<string>()
    const sEnroll = new Set<string>(), sFormation = new Set<string>()
    const otherTeachers = new Map<string, string>(), noFormation: Record<string, Set<string>> = {}, formationsCreated = new Set<string>()
    let tAssign = 0, otherStudents = 0, errors = 0
    for (const r of results) {
      if (r.error) { errors++; continue }
      r.teachers?.created_emails?.forEach(e => tCreated.add(e))
      r.teachers?.upgraded_emails?.forEach(e => tUpgraded.add(e))
      tAssign += r.teachers?.assignments_added || 0
      r.teachers?.other_role?.forEach(o => otherTeachers.set(o.email, o.role))
      r.students?.created_emails?.forEach(e => sCreated.add(e))
      r.students?.enrolled_emails?.forEach(e => sEnroll.add(`${r.ue_code}|${e}`))
      r.students?.formation_filled_emails?.forEach(e => sFormation.add(e))
      r.students?.formations_created?.forEach(c => formationsCreated.add(c))
      otherStudents += r.students?.other_role || 0
      for (const [d, emails] of Object.entries(r.students?.without_formation || {})) {
        noFormation[d] = noFormation[d] || new Set(); emails.forEach(e => noFormation[d].add(e))
      }
    }
    return { tCreated: tCreated.size, tUpgraded: tUpgraded.size, tAssign, sCreated: sCreated.size, sEnroll: sEnroll.size,
             sFormation: sFormation.size, otherStudents, errors, otherTeachers, formationsCreated: [...formationsCreated].sort(),
             noFormation: Object.fromEntries(Object.entries(noFormation).map(([d, s]) => [d, s.size])) as Record<string, number> }
  })()

  const isDry = lastMode === 'dry'
  const summary: [string, number][] = [
    [isDry ? 'Enseignants à créer' : 'Enseignants créés', totals.tCreated],
    [isDry ? 'Étudiants CEI à promouvoir professeur' : 'Étudiants promus professeur', totals.tUpgraded],
    [isDry ? 'Affectations EC à ajouter' : 'Affectations EC ajoutées', totals.tAssign],
    [isDry ? 'Étudiants à créer' : 'Étudiants créés', totals.sCreated],
    [isDry ? 'Inscriptions UE à ajouter' : 'Inscriptions UE ajoutées', totals.sEnroll],
    [isDry ? 'Formations à compléter' : 'Formations complétées', totals.sFormation],
  ]

  /* ── Rendu ── */
  return (
    <div style={{ display: 'grid', gap: 22 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 10 }}>
          <i className="fas fa-graduation-cap" style={{ color: 'var(--primary)' }} /> Moodle
        </h2>
        <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 16.5 }}>
          Plateformes Moodle de l&apos;UNCHK reliées à CEI : comptes, rôles, affectations EC et inscriptions synchronisés cours par cours.
        </p>
      </div>

      {disabled && (
        <div style={{ ...card, padding: 20, color: 'var(--text-muted)' }}>
          La synchronisation Moodle est désactivée sur ce serveur (variable <code>MOODLE_SYNC_ENABLED</code>).
        </div>
      )}

      {!disabled && (
        <>
          {/* ── Plateformes ── */}
          <section style={card}>
            <div style={cardHead}>
              <h3 style={{ margin: 0, fontSize: 18.5, fontWeight: 700 }}><i className="fas fa-server" style={{ color: ACCENT, marginRight: 8 }} />Plateformes</h3>
              {!formOpen && <Button onClick={openAdd}><i className="fas fa-plus" /> Ajouter une plateforme</Button>}
            </div>
            <div style={{ padding: '16px 22px', display: 'grid', gap: 14 }}>
              {formOpen && (
                <div style={{ border: '1.5px solid var(--border)', borderRadius: 12, padding: 16, display: 'grid', gap: 12 }}>
                  <div style={{ fontWeight: 700 }}>{editId ? 'Modifier la plateforme' : 'Nouvelle plateforme'}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                    <label style={{ display: 'grid', gap: 5, fontSize: 14.5, fontWeight: 600 }}>Nom
                      <input id="moodle-name" style={inputStyle} value={form.name} placeholder="Ex : Moodle SEJA" onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                    </label>
                    <label style={{ display: 'grid', gap: 5, fontSize: 14.5, fontWeight: 600 }}>Adresse
                      <input id="moodle-url" style={inputStyle} value={form.base_url} placeholder="https://moodle.unchk.sn" onChange={e => setForm(f => ({ ...f, base_url: e.target.value }))} />
                    </label>
                    <label style={{ display: 'grid', gap: 5, fontSize: 14.5, fontWeight: 600 }}>Token du service « CEI Sync »
                      <input id="moodle-token" type="password" autoComplete="off" style={inputStyle} value={form.token}
                        placeholder={editId ? 'Laisser vide pour garder le token actuel' : 'Token du compte cei-integration'}
                        onChange={e => setForm(f => ({ ...f, token: e.target.value }))} />
                    </label>
                    <label style={{ display: 'grid', gap: 5, fontSize: 14.5, fontWeight: 600 }}>Pôle (facultatif)
                      <select id="moodle-pole" style={inputStyle} value={form.pole_id} onChange={e => setForm(f => ({ ...f, pole_id: e.target.value }))}>
                        <option value="">Aucun</option>
                        {poles.map(p => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
                      </select>
                    </label>
                  </div>
                  <div style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>La connexion est vérifiée avant l&apos;enregistrement. Le token est chiffré et ne sera plus jamais affiché.</div>
                  {formDiagnosis && <DiagnosisBox d={formDiagnosis} />}
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <Button onClick={saveInstance} disabled={saving}>
                      <i className={`fas ${saving ? 'fa-spinner fa-spin' : 'fa-check'}`} /> {saving ? 'Vérification…' : 'Vérifier et enregistrer'}
                    </Button>
                    <Button variant="ghost" onClick={() => { setFormOpen(false); setFormDiagnosis(null) }}>{formDiagnosis && !formDiagnosis.ok ? 'Fermer' : 'Annuler'}</Button>
                  </div>
                </div>
              )}

              {loading ? (
                <div style={{ color: 'var(--text-muted)' }}><i className="fas fa-spinner fa-spin" /> Chargement…</div>
              ) : instances.length === 0 ? (
                <div style={{ color: 'var(--text-muted)' }}>Aucune plateforme. Ajoutez le premier Moodle avec son adresse et le token du service « CEI Sync ».</div>
              ) : instances.map(i => (
                <div key={i.id} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', display: 'grid', gap: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                    <div style={{ display: 'grid', gap: 3, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <strong style={{ fontSize: 16.5 }}>{i.name}</strong><StatusPill inst={i} />
                        {i.pole_code && <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Pôle {i.pole_code}</span>}
                      </div>
                      <div style={{ fontSize: 14, color: 'var(--text-muted)', wordBreak: 'break-all' }}>{i.base_url} · token {i.token_hint}</div>
                      {i.last_check_at && <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Dernier test : {new Date(i.last_check_at).toLocaleString('fr-FR')}</div>}
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <Button variant="ghost" onClick={() => testInstance(i.id)} disabled={testing === i.id}>
                        <i className={`fas ${testing === i.id ? 'fa-spinner fa-spin' : 'fa-stethoscope'}`} /> Tester
                      </Button>
                      <Button variant="ghost" onClick={() => openEdit(i)}><i className="fas fa-pen" /> Modifier</Button>
                      <Button variant="ghost" onClick={() => toggleActive(i)}>
                        <i className={`fas ${i.is_active ? 'fa-pause' : 'fa-play'}`} /> {i.is_active ? 'Suspendre' : 'Réactiver'}
                      </Button>
                      {confirmDelete === i.id ? (
                        <>
                          <Button variant="danger" onClick={() => deleteInstance(i.id)}><i className="fas fa-trash" /> Confirmer la suppression</Button>
                          <Button variant="ghost" onClick={() => setConfirmDelete(null)}>Annuler</Button>
                        </>
                      ) : (
                        <Button variant="danger" onClick={() => setConfirmDelete(i.id)} title="Supprimer"><i className="fas fa-trash" /></Button>
                      )}
                    </div>
                  </div>
                  {i.last_check && !i.last_check.ok && <DiagnosisBox d={i.last_check} />}
                </div>
              ))}
            </div>
          </section>

          {/* ── Correspondance ── */}
          {instances.some(i => i.is_active) && (
            <section style={card}>
              <div style={cardHead}>
                <h3 style={{ margin: 0, fontSize: 18.5, fontWeight: 700 }}><i className="fas fa-link" style={{ color: ACCENT, marginRight: 8 }} />Correspondance cours Moodle ↔ EC CEI</h3>
                <Button variant="ghost" onClick={loadMapping} disabled={mappingLoading}><i className={`fas ${mappingLoading ? 'fa-spinner fa-spin' : 'fa-rotate'}`} /> Actualiser</Button>
              </div>
              <div style={{ padding: '16px 22px', display: 'grid', gap: 12 }}>
                <p style={{ margin: 0, fontSize: 14.5, color: 'var(--text-muted)' }}>Un cours Moodle est relié à un EC quand son nom abrégé est égal au code de l&apos;EC (exemple : AES1111).</p>
                {!mapping ? (
                  <div style={{ color: 'var(--text-muted)' }}><i className="fas fa-spinner fa-spin" /> Lecture des cours Moodle…</div>
                ) : (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
                      {[
                        ['Cours reliés à un EC', mapping.counts.matched],
                        ['Cours Moodle sans EC CEI', mapping.counts.moodle_courses_without_ec],
                        ['EC CEI sans cours Moodle', mapping.counts.ecs_without_moodle_course],
                        ['Codes présents sur plusieurs plateformes', mapping.counts.duplicate_codes],
                      ].map(([label, n]) => (
                        <div key={label as string} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px' }}>
                          <div style={{ fontSize: 24, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{n}</div>
                          <div style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>{label}</div>
                        </div>
                      ))}
                    </div>
                    {mapping.errors.map((e, k) => <div key={k} style={{ color: '#b91c1c', fontSize: 14.5 }}><i className="fas fa-circle-exclamation" /> {e.instance} : {e.error}</div>)}
                    {mapping.moodle_courses_without_ec.length > 0 && (
                      <details><summary style={{ cursor: 'pointer', fontSize: 14.5 }}>Cours Moodle sans EC CEI ({mapping.moodle_courses_without_ec.length}) : voir « Maquette depuis Moodle » ci-dessous</summary>
                        <div style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 8, lineHeight: 1.8 }}>
                          {mapping.moodle_courses_without_ec.map(c => `${c.shortname} (${c.instance})`).join(' · ')}
                        </div>
                      </details>
                    )}
                    {mapping.ecs_without_moodle_course.length > 0 && (
                      <details><summary style={{ cursor: 'pointer', fontSize: 14.5 }}>EC CEI sans cours Moodle ({mapping.ecs_without_moodle_course.length})</summary>
                        <div style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 8, lineHeight: 1.8 }}>{mapping.ecs_without_moodle_course.join(' · ')}</div>
                      </details>
                    )}
                    {Object.keys(mapping.duplicate_codes).length > 0 && (
                      <div style={{ fontSize: 14.5, color: '#b91c1c' }}>
                        <i className="fas fa-triangle-exclamation" /> Codes présents sur plusieurs plateformes (seule la première est utilisée) :{' '}
                        {Object.entries(mapping.duplicate_codes).map(([code, names]) => `${code} (${names.join(', ')})`).join(' · ')}
                      </div>
                    )}
                  </>
                )}
              </div>
            </section>
          )}

          {/* ── Maquette depuis Moodle ── */}
          {mapping && (
            <section style={card}>
              <div style={cardHead}>
                <h3 style={{ margin: 0, fontSize: 18.5, fontWeight: 700 }}><i className="fas fa-sitemap" style={{ color: ACCENT, marginRight: 8 }} />Maquette depuis Moodle</h3>
                {mapping.counts.moodle_courses_without_ec > 0 && (
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#92400e', background: '#fef3c7', padding: '3px 10px', borderRadius: 99 }}>
                    {mapping.counts.moodle_courses_without_ec} cours Moodle sans EC
                  </span>
                )}
              </div>
              <div style={{ padding: '16px 22px', display: 'grid', gap: 14 }}>
                <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14.5, color: 'var(--text-muted)', display: 'grid', gap: 4 }}>
                  <li>Les catégories Moodle (Formation › Licence › Semestre › UE) servent à créer les formations, semestres, UE et EC qui manquent dans CEI. À faire avant la synchronisation.</li>
                  <li>Moodle ne connaît ni crédits, ni coefficients, ni CC/EX : les éléments créés sont marqués « à confirmer » dans la Maquette, et les relevés de notes restent bloqués pour eux jusqu&apos;à l&apos;import de la maquette Excel officielle, qui les complète.</li>
                  <li>Rien n&apos;est supprimé. Les examens, sujets et suggestions fonctionnent dès la création.</li>
                </ul>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <Button onClick={() => runStructure('dry')} disabled={!!structRunning || !!running}>
                    <i className={`fas ${structRunning === 'dry' ? 'fa-spinner fa-spin' : 'fa-magnifying-glass'}`} /> Simuler
                  </Button>
                  {!confirmStruct ? (
                    <Button variant="ghost" onClick={() => setConfirmStruct(true)} disabled={!!structRunning || !!running}><i className="fas fa-check-double" /> Appliquer…</Button>
                  ) : (
                    <>
                      <Button onClick={() => runStructure('apply')}><i className="fas fa-check-double" /> Confirmer la création{syncInstance ? '' : ' (toutes les plateformes)'}</Button>
                      <Button variant="ghost" onClick={() => setConfirmStruct(false)}>Annuler</Button>
                    </>
                  )}
                  {structRunning === 'apply' && <span style={{ fontSize: 14.5, color: 'var(--text-muted)', alignSelf: 'center' }}><i className="fas fa-spinner fa-spin" /> Création en cours…</span>}
                </div>

                {structResult && (
                  <div style={{ display: 'grid', gap: 10 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 600 }}>
                      {structNothing ? 'La maquette CEI couvre déjà tous les cours Moodle de la maquette : rien à créer.'
                        : structResult.dry_run ? 'Simulation — rien n’a été modifié :' : 'Créé dans CEI :'}
                    </div>
                    {!structNothing && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
                        {([['Formations', structTotals.formations], ['Formations renommées', structTotals.renamed], ['Semestres', structTotals.semesters],
                           ['UE', structTotals.ues], ['EC', structTotals.ecs], ['UE reliées à leur catégorie', structTotals.links]] as [string, number][]).map(([label, n]) => (
                          <div key={label} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px' }}>
                            <div style={{ fontSize: 22, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{n}</div>
                            <div style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>{label}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    {structResult.instances.map(r => (
                      <div key={r.instance_id} style={{ display: 'grid', gap: 6, fontSize: 14 }}>
                        {structResult.instances.length > 1 && <strong>{r.instance}</strong>}
                        {r.error && <div style={{ color: '#b91c1c' }}><i className="fas fa-circle-exclamation" /> {r.error}</div>}
                        {([['Formations', r.formations], ['Formations renommées', r.formations_renamed], ['Semestres', r.semesters], ['UE', r.ues], ['EC', r.ecs]] as [string, string[] | undefined][])
                          .filter(([, list]) => list && list.length > 0).map(([label, list]) => (
                          <details key={label}><summary style={{ cursor: 'pointer' }}>{label} ({list!.length})</summary>
                            <div style={{ color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.8 }}>{list!.join(' · ')}</div>
                          </details>
                        ))}
                        {r.skipped && r.skipped.length > 0 && (
                          <details><summary style={{ cursor: 'pointer' }}>Cours laissés de côté ({r.skipped.length})</summary>
                            <div style={{ color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.8 }}>{r.skipped.map(x => `${x.code} : ${x.reason}`).join(' · ')}</div>
                          </details>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* ── Synchronisation ── */}
          {mapping && mapping.counts.matched > 0 && (
            <section style={card}>
              <div style={cardHead}>
                <h3 style={{ margin: 0, fontSize: 18.5, fontWeight: 700 }}><i className="fas fa-rotate" style={{ color: ACCENT, marginRight: 8 }} />Synchronisation</h3>
              </div>
              <div style={{ padding: '16px 22px', display: 'grid', gap: 14 }}>
                <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14.5, color: 'var(--text-muted)', display: 'grid', gap: 4 }}>
                  <li>Enseignants du cours : compte professeur créé s&apos;il manque, compte étudiant promu professeur, affectation à l&apos;EC.</li>
                  <li>Étudiants : compte créé s&apos;il manque, formation reprise du département Moodle, inscription à l&apos;UE.</li>
                  <li>Uniquement des ajouts : aucun compte supprimé, aucune inscription retirée, aucun autre rôle modifié. Les comptes créés se connectent avec « Se connecter avec UNCHK ».</li>
                </ul>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                  <select id="sync-instance" style={{ ...inputStyle, width: 'auto', minWidth: 220 }} value={syncInstance} disabled={!!running}
                    onChange={e => { setSyncInstance(e.target.value); setResults([]); setLastMode(null) }}>
                    <option value="">Toutes les plateformes</option>
                    {instances.filter(i => i.is_active).map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                  </select>
                  <span style={{ fontSize: 14.5, color: 'var(--text-muted)' }}>{courses.length} cours · environ {Math.max(1, Math.round(courses.length * 8 / 60))} min</span>
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <Button onClick={() => runSync('dry')} disabled={!!running || !courses.length}><i className="fas fa-magnifying-glass" /> Simuler</Button>
                  {!confirmApply ? (
                    <Button variant="ghost" onClick={() => setConfirmApply(true)} disabled={!!running || !courses.length}><i className="fas fa-check-double" /> Appliquer…</Button>
                  ) : (
                    <>
                      <Button onClick={() => runSync('apply')}><i className="fas fa-check-double" /> Confirmer l&apos;application sur {courses.length} cours</Button>
                      <Button variant="ghost" onClick={() => setConfirmApply(false)}>Annuler</Button>
                    </>
                  )}
                  {running && <Button variant="ghost" onClick={() => { stopRef.current = true }}><i className="fas fa-stop" /> Arrêter après ce cours</Button>}
                </div>

                {(running || results.length > 0) && (
                  <div style={{ display: 'grid', gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14.5 }}>
                      <span>{running ? `${running === 'dry' ? 'Simulation' : 'Application'} en cours${progress.current ? ` : ${progress.current}` : ''}` : (isDry ? 'Simulation terminée — rien n’a été modifié' : 'Synchronisation terminée')}</span>
                      <span style={{ fontVariantNumeric: 'tabular-nums' }}>{results.length} / {progress.total || courses.length}</span>
                    </div>
                    <div style={{ height: 8, borderRadius: 99, background: 'var(--border)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${(results.length / Math.max(1, progress.total || courses.length)) * 100}%`, background: ACCENT, transition: 'width .3s' }} />
                    </div>
                  </div>
                )}

                {results.length > 0 && (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10 }}>
                      {summary.map(([label, n]) => (
                        <div key={label} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px' }}>
                          <div style={{ fontSize: 22, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{n}</div>
                          <div style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>{label}</div>
                        </div>
                      ))}
                    </div>
                    {totals.formationsCreated.length > 0 && (
                      <div style={{ fontSize: 14.5 }}>
                        <i className="fas fa-circle-info" style={{ color: ACCENT }} /> {isDry ? 'Formations qui seront créées automatiquement' : 'Formations créées automatiquement'} pour des départements Moodle absents de la maquette :{' '}
                        <strong>{totals.formationsCreated.join(', ')}</strong>. Niveau et pôle repris du cours suivi ; leur nom complet peut être complété plus tard dans la maquette, sans rien bloquer.
                      </div>
                    )}
                    {Object.keys(totals.noFormation).length > 0 && (
                      <div style={{ fontSize: 14.5, color: 'var(--text-muted)' }}>
                        Étudiants sans département renseigné dans Moodle (formation laissée vide) :{' '}
                        {Object.entries(totals.noFormation).map(([d, n]) => `${d} : ${n}`).join(' · ')}.
                      </div>
                    )}
                    {totals.otherTeachers.size > 0 && (
                      <div style={{ fontSize: 14.5 }}>
                        <i className="fas fa-circle-info" style={{ color: ACCENT }} /> Enseignants Moodle ayant un autre rôle dans CEI (non modifiés) :{' '}
                        {[...totals.otherTeachers.entries()].map(([e, r]) => `${e} (${r})`).join(' · ')}
                      </div>
                    )}
                    {totals.otherStudents > 0 && (
                      <div style={{ fontSize: 14.5, color: 'var(--text-muted)' }}>{totals.otherStudents} inscription(s) Moodle d&apos;étudiants ayant un autre rôle dans CEI, laissées de côté.</div>
                    )}
                    {totals.errors > 0 && <div style={{ fontSize: 14.5, color: '#b91c1c' }}><i className="fas fa-circle-exclamation" /> {totals.errors} cours en erreur (voir le détail ci-dessous).</div>}

                    {isDry && results.length > 1 && (
                      <div style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>
                        Le bilan compte chaque personne une seule fois. Dans le tableau, en simulation, un même étudiant absent de CEI apparaît dans chacun de ses cours.
                      </div>
                    )}
                    <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 10 }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, minWidth: 640 }}>
                        <thead>
                          <tr style={{ background: 'var(--background, #f8fafc)', textAlign: 'left' }}>
                            {['EC', 'Plateforme', 'Enseignants', 'Affectations', 'Étudiants Moodle', 'Comptes créés', 'Inscriptions ajoutées'].map(h => <th key={h} style={{ padding: '8px 12px', fontWeight: 700 }}>{h}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {results.map(r => (
                            <tr key={r.ec_code} style={{ borderTop: '1px solid var(--border)' }}>
                              <td style={{ padding: '7px 12px', fontFamily: 'monospace', fontWeight: 700 }}>{r.ec_code}</td>
                              <td style={{ padding: '7px 12px', color: 'var(--text-muted)' }}>{r.instance}</td>
                              {r.error ? (
                                <td colSpan={5} style={{ padding: '7px 12px', color: '#b91c1c' }}>{r.error}</td>
                              ) : (
                                <>
                                  <td style={{ padding: '7px 12px', fontVariantNumeric: 'tabular-nums' }}>{r.teachers?.moodle} ({(r.teachers?.created || 0) + (r.teachers?.upgraded || 0)} nouveaux)</td>
                                  <td style={{ padding: '7px 12px', fontVariantNumeric: 'tabular-nums' }}>{r.teachers?.assignments_added}</td>
                                  <td style={{ padding: '7px 12px', fontVariantNumeric: 'tabular-nums' }}>{r.students?.moodle}</td>
                                  <td style={{ padding: '7px 12px', fontVariantNumeric: 'tabular-nums' }}>{(r.teachers?.created || 0) + (r.students?.created || 0)}</td>
                                  <td style={{ padding: '7px 12px', fontVariantNumeric: 'tabular-nums' }}>{r.students?.enrollments_added}</td>
                                </>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
