'use client'

import { useEffect, useState, useCallback } from 'react'
import api from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'

/* ── Types ──────────────────────────────────────────────────────────────────── */
interface EC {
  id: number; code: string; name: string
  coefficient: number; cm?: number; td?: number; tp?: number; tpe?: number; vht?: number
  is_active: boolean; assigned_professor?: string
}
interface UE {
  id: number; code: string; name: string; credits: number; is_active: boolean; ecs: EC[]
}
interface Semester {
  id: number; number: number; name?: string; total_credits: number; is_active: boolean; ues: UE[]
}
interface Formation {
  id: number; code: string; name: string; level?: string; department?: string
  description?: string; is_active: boolean; semesters: Semester[]
}

type ModalKind =
  | 'create_formation' | 'edit_formation'
  | 'create_semester'  | 'edit_semester'
  | 'create_ue'        | 'edit_ue'
  | 'create_ec'        | 'edit_ec'
  | 'import_csv'

interface ModalState {
  kind: ModalKind
  item?: any
  formationId?: number
  semesterId?: number
  ueId?: number
}

/* ── Overlay ────────────────────────────────────────────────────────────────── */
function ModalOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={onClose}>
      <div style={{ background: 'var(--surface)', borderRadius: 16, padding: 32, width: '100%', maxWidth: 560, maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,.18)' }}
        onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}

/* ── Small button ───────────────────────────────────────────────────────────── */
const Btn = ({ color, onClick, children, title }: { color: string; onClick: () => void; children: React.ReactNode; title?: string }) => (
  <button title={title} onClick={onClick}
    style={{ padding: '5px 12px', borderRadius: 7, border: 'none', background: color, color: 'white', cursor: 'pointer', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 600 }}>
    {children}
  </button>
)

/* ═══════════════════════════════════════════════════════════════════════════ */
export default function AdminFormationsPage() {
  const { success, error } = useToast()
  const [formations, setFormations] = useState<Formation[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<ModalState | null>(null)
  const [form, setForm] = useState<any>({})
  const [submitting, setSubmitting] = useState(false)
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<any>(null)

  /* ── Load all data ────────────────────────────────────────────────────────── */
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const raw = await api.get<any>('/api/formations')
      const flist: any[] = Array.isArray(raw) ? raw : raw.formations ?? []
      const full = await Promise.all(flist.map(async (f: any) => {
        const rawSem = await api.get<any>(`/api/formations/${f.id}/semesters`)
        const semList: any[] = Array.isArray(rawSem) ? rawSem : rawSem.semesters ?? []
        const semesters = await Promise.all(semList.map(async (s: any) => {
          const rawUe = await api.get<any>(`/api/semesters/${s.id}/ues`)
          const ueList: any[] = Array.isArray(rawUe) ? rawUe : rawUe.ues ?? []
          const ues = await Promise.all(ueList.map(async (u: any) => {
            const rawEc = await api.get<any>(`/api/ues/${u.id}/ecs`)
            const ecList: any[] = Array.isArray(rawEc) ? rawEc : rawEc.ecs ?? []
            return { ...u, ecs: ecList }
          }))
          return { ...s, ues }
        }))
        return { ...f, semesters }
      }))
      setFormations(full)
    } catch { error('Erreur chargement maquette') }
    finally { setLoading(false) }
  }, []) // eslint-disable-line

  useEffect(() => { load() }, [load])

  /* ── Field helpers — called as functions, NOT as <Components /> ─────────── */
  const inp = (key: string, label: string, opts?: { type?: string; placeholder?: string; min?: number; max?: number }) => (
    <div className="form-group" key={key}>
      <label style={{ fontWeight: 600, fontSize: 13, marginBottom: 6, display: 'block' }}>{label}</label>
      <input type={opts?.type || 'text'} className="form-control" placeholder={opts?.placeholder}
        min={opts?.min} max={opts?.max} autoComplete="off"
        value={form[key] ?? (opts?.type === 'number' ? 0 : '')}
        onChange={e => setForm((p: any) => ({ ...p, [key]: opts?.type === 'number' ? Number(e.target.value) : e.target.value }))}
        style={{ width: '100%', padding: '10px 14px', border: '1.5px solid var(--border)', borderRadius: 10, fontSize: 14, background: 'var(--surface)', color: 'var(--text)', outline: 'none', boxSizing: 'border-box' }} />
    </div>
  )

  const chk = (key: string, label: string) => (
    <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
      <input type="checkbox" id={`chk-${key}`} checked={!!form[key]}
        onChange={e => setForm((p: any) => ({ ...p, [key]: e.target.checked }))}
        style={{ width: 16, height: 16, cursor: 'pointer' }} />
      <label htmlFor={`chk-${key}`} style={{ margin: 0, fontSize: 14, cursor: 'pointer' }}>{label}</label>
    </div>
  )

  /* ── Modal form content (called as function) ─────────────────────────────── */
  function modalBody() {
    if (!modal) return null
    switch (modal.kind) {
      case 'create_formation': case 'edit_formation': return (<>
        {inp('code', 'Code *', { placeholder: 'Ex: M2-TELCO' })}
        {inp('name', 'Nom *', { placeholder: 'Ex: Master 2 Télécommunications' })}
        {inp('level', 'Niveau', { placeholder: 'Ex: Master 2, Licence 3' })}
        {inp('department', 'Département', { placeholder: 'Ex: Génie Électrique' })}
        <div className="form-group">
          <label style={{ fontWeight: 600, fontSize: 13, marginBottom: 6, display: 'block' }}>Description</label>
          <textarea className="form-control" rows={3} value={form.description ?? ''}
            onChange={e => setForm((p: any) => ({ ...p, description: e.target.value }))}
            style={{ width: '100%', padding: '10px 14px', border: '1.5px solid var(--border)', borderRadius: 10, fontSize: 14, background: 'var(--surface)', color: 'var(--text)', resize: 'vertical', boxSizing: 'border-box' }} />
        </div>
        {modal.kind === 'edit_formation' && chk('is_active', 'Formation active')}
      </>)
      case 'create_semester': case 'edit_semester': return (<>
        {inp('number', 'Numéro *', { type: 'number', min: 1, max: 12, placeholder: 'Ex: 1' })}
        {inp('name', 'Nom', { placeholder: 'Ex: Semestre 1' })}
        {inp('total_credits', 'Crédits totaux', { type: 'number', min: 1 })}
        {modal.kind === 'edit_semester' && chk('is_active', 'Semestre actif')}
      </>)
      case 'create_ue': case 'edit_ue': return (<>
        {inp('code', 'Code *', { placeholder: 'Ex: UE11' })}
        {inp('name', 'Nom *', { placeholder: 'Ex: Systèmes de Communication' })}
        {inp('credits', 'Crédits', { type: 'number', min: 1 })}
        {modal.kind === 'edit_ue' && chk('is_active', 'UE active')}
      </>)
      case 'create_ec': case 'edit_ec': return (<>
        {inp('code', 'Code *', { placeholder: 'Ex: EC111' })}
        {inp('name', 'Nom *', { placeholder: "Ex: Théorie de l'Information" })}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
          {inp('cm', 'CM (h)', { type: 'number', min: 0 })}
          {inp('td', 'TD (h)', { type: 'number', min: 0 })}
          {inp('tp', 'TP (h)', { type: 'number', min: 0 })}
          {inp('tpe', 'TPE (h)', { type: 'number', min: 0 })}
          {inp('vht', 'VHT (h)', { type: 'number', min: 0 })}
          {inp('coefficient', 'Coefficient', { type: 'number', min: 1 })}
        </div>
        {modal.kind === 'edit_ec' && chk('is_active', 'EC actif')}
      </>)
      default: return null
    }
  }

  function modalTitle() {
    if (!modal) return ''
    const isCreate = modal.kind.startsWith('create')
    const labels: Record<string, string> = { formation: 'une Formation', semester: 'un Semestre', ue: 'une UE', ec: 'un EC' }
    const entity = modal.kind.replace('create_', '').replace('edit_', '')
    return `${isCreate ? 'Créer' : 'Modifier'} ${labels[entity] || entity}`
  }

  /* ── Submit ───────────────────────────────────────────────────────────────── */
  async function handleSubmit() {
    if (!modal) return
    setSubmitting(true)
    try {
      const body = { ...form }
      let endpoint = ''; let method = 'POST'
      switch (modal.kind) {
        case 'create_formation': endpoint = '/api/admin/formations'; break
        case 'edit_formation':   endpoint = `/api/admin/formations/${modal.item.id}`; method = 'PUT'; break
        case 'create_semester':  endpoint = '/api/admin/semesters'; body.formation_id = modal.formationId; break
        case 'edit_semester':    endpoint = `/api/admin/semesters/${modal.item.id}`; method = 'PUT'; break
        case 'create_ue':        endpoint = '/api/admin/ues'; body.semester_id = modal.semesterId; break
        case 'edit_ue':          endpoint = `/api/admin/ues/${modal.item.id}`; method = 'PUT'; break
        case 'create_ec':        endpoint = '/api/admin/ecs'; body.ue_id = modal.ueId; break
        case 'edit_ec':          endpoint = `/api/admin/ecs/${modal.item.id}`; method = 'PUT'; break
      }
      await (method === 'PUT' ? api.put(endpoint, body) : api.post(endpoint, body))
      success('Enregistré avec succès')
      setModal(null)
      load()
    } catch (e: any) { error(e.message || 'Erreur') }
    finally { setSubmitting(false) }
  }

  async function del(endpoint: string, msg: string) {
    if (!confirm(msg)) return
    try { await api.delete(endpoint); success('Supprimé'); load() }
    catch (e: any) { error(e.message || 'Erreur suppression') }
  }

  /* ── CSV ──────────────────────────────────────────────────────────────────── */
  async function downloadCsvTemplate() {
    try {
      const blob = await api.blob('/api/admin/maquette/csv-template')
      const url = URL.createObjectURL(blob)
      Object.assign(document.createElement('a'), { href: url, download: `template_maquette_${new Date().toISOString().split('T')[0]}.csv` }).click()
      URL.revokeObjectURL(url); success('Template téléchargé')
    } catch { error('Impossible de télécharger le template') }
  }

  async function handleImportCsv() {
    if (!csvFile) { error('Sélectionnez un fichier CSV'); return }
    setImporting(true)
    const fd = new FormData(); fd.append('file', csvFile)
    try {
      const res = await api.upload<any>('/api/admin/maquette/import-csv', fd)
      setImportResult(res)
      const { formations: f = 0, semesters: s = 0, ues: u = 0, ecs: e = 0 } = res.created || {}
      success(`Import réussi — Formations: ${f}, Semestres: ${s}, UEs: ${u}, ECs: ${e}`)
      setTimeout(() => { setModal(null); load() }, 2000)
    } catch (e: any) { error(e.message) }
    finally { setImporting(false) }
  }

  /* ── Open helpers ─────────────────────────────────────────────────────────── */
  function openCreate(kind: ModalKind, extra?: Partial<ModalState>) {
    const defaults: Record<string, any> = {
      create_semester: { number: 1, total_credits: 30 },
      create_ue: { credits: 6 },
      create_ec: { cm: 0, td: 0, tp: 0, tpe: 0, vht: 0, coefficient: 1 },
    }
    setForm(defaults[kind] ?? {})
    setModal({ kind, ...extra })
  }

  function openEdit(kind: ModalKind, item: any) {
    setForm({ ...item }); setModal({ kind, item })
  }

  /* ── Render ───────────────────────────────────────────────────────────────── */
  return (
    <div>
      {/* Page header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 10 }}>
          <i className="fas fa-layer-group" style={{ color: 'var(--primary)' }} />
          Maquette Pédagogique — Gestion Complète
        </h2>
        <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 14 }}>Gérez les formations, semestres, UEs et ECs</p>
      </div>

      {/* Info box */}
      <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12, padding: '14px 18px', marginBottom: 28, fontSize: 13 }}>
        <strong style={{ color: '#1d4ed8' }}><i className="fas fa-circle-info" style={{ marginRight: 7 }} />Important :</strong>
        <span style={{ color: '#1e40af' }}> Pour lier des sujets à des ECs, créez d'abord :</span>
        <ol style={{ margin: '8px 0 0 20px', color: '#1e40af', lineHeight: 2 }}>
          <li>Une Formation</li>
          <li>Un Semestre <em>(bouton Semestre)</em></li>
          <li>Une UE <em>(bouton UE)</em></li>
          <li>Un EC <em>(bouton EC)</em></li>
        </ol>
      </div>

      {/* Section Formations */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
        {/* Card header */}
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <i className="fas fa-university" style={{ color: 'var(--primary)' }} /> Formations
          </h3>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => openCreate('create_formation')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 18px', borderRadius: 10, border: 'none', background: '#3b82f6', color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
              <i className="fas fa-plus" /> Nouvelle Formation
            </button>
            <button onClick={() => { setModal({ kind: 'import_csv' }); setCsvFile(null); setImportResult(null) }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 18px', borderRadius: 10, border: 'none', background: '#10b981', color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
              <i className="fas fa-file-csv" /> Import CSV Bulk
            </button>
          </div>
        </div>

        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 48 }}>
              <i className="fas fa-spinner fa-spin" style={{ fontSize: 32, color: 'var(--primary)' }} />
            </div>
          ) : formations.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
              <i className="fas fa-inbox" style={{ fontSize: 32, display: 'block', marginBottom: 10 }} />
              Aucune formation créée
            </div>
          ) : formations.map(f => (
            /* ── Formation block ── */
            <div key={f.id} style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,.05)' }}>
              {/* Formation header — blue */}
              <div style={{ background: 'linear-gradient(135deg,#3b82f6,#2563eb)', color: 'white', padding: '16px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <i className="fas fa-graduation-cap" />
                    {f.code} — {f.name}
                  </div>
                  <div style={{ fontSize: 12, opacity: .82, marginTop: 3 }}>{[f.level, f.department].filter(Boolean).join(' | ')}</div>
                  <div style={{ fontSize: 11, opacity: .68, marginTop: 2 }}>
                    <i className="fas fa-book" style={{ marginRight: 4 }} />{f.semesters.length} semestre(s)
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Btn color="rgba(255,255,255,.2)" onClick={() => openEdit('edit_formation', f)} title="Modifier">
                    <i className="fas fa-pen" />
                  </Btn>
                  <Btn color="#10b981" onClick={() => openCreate('create_semester', { formationId: f.id })}>
                    <i className="fas fa-plus" /> Semestre
                  </Btn>
                  <Btn color="#ef4444" onClick={() => del(`/api/admin/formations/${f.id}`, 'Supprimer cette formation et tous ses semestres/UEs/ECs ?')} title="Supprimer">
                    <i className="fas fa-trash" />
                  </Btn>
                </div>
              </div>

              {/* Semesters */}
              <div style={{ padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                {f.semesters.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>
                    <i className="fas fa-inbox" style={{ marginRight: 6 }} />Aucun semestre — cliquez "+ Semestre" pour commencer
                  </p>
                ) : f.semesters.map(s => (
                  <div key={s.id} style={{ border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
                    {/* Semester header */}
                    <div style={{ background: '#f8fafc', padding: '11px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0' }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>
                        <i className="fas fa-calendar-alt" style={{ marginRight: 7, color: '#3b82f6' }} />
                        Semestre {s.number}{s.name ? ` — ${s.name}` : ''}
                        <span style={{ color: '#64748b', marginLeft: 12, fontWeight: 400, fontSize: 13 }}>
                          <i className="fas fa-star" style={{ marginRight: 4, color: '#f59e0b' }} />{s.total_credits} crédits
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: 7 }}>
                        <Btn color="#3b82f6" onClick={() => openEdit('edit_semester', s)} title="Modifier"><i className="fas fa-pen" /></Btn>
                        <Btn color="#10b981" onClick={() => openCreate('create_ue', { semesterId: s.id })}><i className="fas fa-plus" /> UE</Btn>
                        <Btn color="#ef4444" onClick={() => del(`/api/admin/semesters/${s.id}`, 'Supprimer ce semestre et toutes ses UEs/ECs ?')} title="Supprimer"><i className="fas fa-trash" /></Btn>
                      </div>
                    </div>

                    {/* UEs */}
                    <div style={{ padding: '12px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {s.ues.length === 0 ? (
                        <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>
                          <i className="fas fa-inbox" style={{ marginRight: 6 }} />Aucune UE
                        </p>
                      ) : s.ues.map(u => (
                        <div key={u.id} style={{ borderLeft: '4px solid #10b981', background: '#fafcff', borderRadius: '0 10px 10px 0', border: '1px solid #e2e8f0', borderLeftWidth: 4, borderLeftColor: '#10b981' }}>
                          {/* UE header */}
                          <div style={{ padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ fontSize: 13, color: '#0f172a' }}>
                              <i className="fas fa-book-open" style={{ marginRight: 6, color: '#10b981' }} />
                              <strong>{u.code}</strong> — {u.name}
                              <span style={{ color: '#64748b', marginLeft: 10, fontSize: 12 }}>
                                <i className="fas fa-award" style={{ marginRight: 3, color: '#f59e0b' }} />{u.credits} crédits
                              </span>
                            </div>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <Btn color="#3b82f6" onClick={() => openEdit('edit_ue', u)} title="Modifier"><i className="fas fa-pen" /></Btn>
                              <Btn color="#10b981" onClick={() => openCreate('create_ec', { ueId: u.id })}><i className="fas fa-plus" /> EC</Btn>
                              <Btn color="#ef4444" onClick={() => del(`/api/admin/ues/${u.id}`, 'Supprimer cette UE et tous ses ECs ?')} title="Supprimer"><i className="fas fa-trash" /></Btn>
                            </div>
                          </div>

                          {/* ECs */}
                          {u.ecs.length > 0 && (
                            <div style={{ padding: '0 14px 12px', display: 'flex', flexDirection: 'column', gap: 7 }}>
                              {u.ecs.map(ec => (
                                <div key={ec.id} style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 9, padding: '9px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <div>
                                    <span style={{ fontSize: 13, fontWeight: 700, color: '#78350f' }}>{ec.code}</span>
                                    <span style={{ fontSize: 13, color: '#92400e' }}> — {ec.name}</span>
                                    <div style={{ fontSize: 11, color: '#b45309', marginTop: 2 }}>
                                      CM: {ec.cm || 0}h | TD: {ec.td || 0}h | TP: {ec.tp || 0}h | Coef: {ec.coefficient}
                                      {ec.assigned_professor && (
                                        <span style={{ color: '#059669', marginLeft: 10 }}>
                                          <i className="fas fa-user-tie" style={{ marginRight: 3 }} />{ec.assigned_professor}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                                    <Btn color="#3b82f6" onClick={() => openEdit('edit_ec', ec)} title="Modifier"><i className="fas fa-pen" /></Btn>
                                    <Btn color="#ef4444" onClick={() => del(`/api/admin/ecs/${ec.id}`, 'Supprimer cet EC ?')} title="Supprimer"><i className="fas fa-trash" /></Btn>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ══ Modal Formulaire ══════════════════════════════════════════════════ */}
      {modal && modal.kind !== 'import_csv' && (
        <ModalOverlay onClose={() => setModal(null)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22, paddingBottom: 18, borderBottom: '1px solid var(--border)' }}>
            <div style={{ width: 42, height: 42, borderRadius: 11, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className={`fas ${modal.kind.startsWith('create') ? 'fa-plus' : 'fa-pen'}`} style={{ color: '#3b82f6', fontSize: 16 }} />
            </div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{modalTitle()}</h3>
          </div>
          {modalBody()}
          <div style={{ display: 'flex', gap: 10, marginTop: 24, paddingTop: 18, borderTop: '1px solid var(--border)' }}>
            <button onClick={handleSubmit} disabled={submitting}
              style={{ padding: '10px 26px', borderRadius: 10, border: 'none', background: '#3b82f6', color: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>
              <i className={`fas ${submitting ? 'fa-spinner fa-spin' : 'fa-check'}`} style={{ marginRight: 7 }} />
              {submitting ? 'Enregistrement…' : 'Enregistrer'}
            </button>
            <button onClick={() => setModal(null)}
              style={{ padding: '10px 22px', borderRadius: 10, border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--text)', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
              Annuler
            </button>
          </div>
        </ModalOverlay>
      )}

      {/* ══ Modal Import CSV ═════════════════════════════════════════════════ */}
      {modal?.kind === 'import_csv' && (
        <ModalOverlay onClose={() => setModal(null)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, paddingBottom: 18, borderBottom: '1px solid var(--border)' }}>
            <div style={{ width: 42, height: 42, borderRadius: 11, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fas fa-file-import" style={{ color: '#10b981', fontSize: 17 }} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Import Bulk Maquette</h3>
              <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>Importez formations, semestres, UEs et ECs via CSV</p>
            </div>
          </div>

          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '12px 16px', marginBottom: 18, fontSize: 13 }}>
            <strong style={{ color: '#1d4ed8' }}>Instructions :</strong>
            <ol style={{ margin: '8px 0 0 18px', color: '#1e40af', lineHeight: 1.9 }}>
              <li>Téléchargez le template CSV</li>
              <li>Remplissez ligne par ligne : formations, semestres, UEs, ECs</li>
              <li>Respectez l'ordre hiérarchique</li>
              <li>Uploadez le fichier</li>
            </ol>
          </div>

          <button onClick={downloadCsvTemplate}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 18px', borderRadius: 10, border: 'none', background: '#06b6d4', color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 700, marginBottom: 18 }}>
            <i className="fas fa-download" /> Télécharger Template CSV
          </button>

          <div className="form-group">
            <label style={{ fontWeight: 600, fontSize: 13, marginBottom: 6, display: 'block' }}>Fichier CSV *</label>
            <input type="file" accept=".csv"
              style={{ width: '100%', fontSize: 14, padding: '8px 0' }}
              onChange={e => { setCsvFile(e.target.files?.[0] || null); setImportResult(null) }} />
          </div>

          {importResult?.created && (
            <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 10, padding: 14, marginBottom: 14, fontSize: 13 }}>
              <strong style={{ color: '#166534' }}><i className="fas fa-check-circle" style={{ marginRight: 5 }} />Import réussi !</strong>
              <div style={{ marginTop: 5, color: '#166534' }}>
                Formations: {importResult.created.formations || 0} · Semestres: {importResult.created.semesters || 0} · UEs: {importResult.created.ues || 0} · ECs: {importResult.created.ecs || 0}
              </div>
              {importResult.errors?.length > 0 && (
                <ul style={{ margin: '8px 0 0 16px', color: '#92400e', fontSize: 12 }}>
                  {importResult.errors.map((e: string, i: number) => <li key={i}>{e}</li>)}
                </ul>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, paddingTop: 8 }}>
            <button onClick={handleImportCsv} disabled={importing || !csvFile}
              style={{ padding: '10px 24px', borderRadius: 10, border: 'none', background: '#10b981', color: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 700, opacity: !csvFile ? .5 : 1 }}>
              <i className={`fas ${importing ? 'fa-spinner fa-spin' : 'fa-upload'}`} style={{ marginRight: 7 }} />
              {importing ? 'Import en cours…' : 'Importer'}
            </button>
            <button onClick={() => setModal(null)}
              style={{ padding: '10px 22px', borderRadius: 10, border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--text)', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
              Annuler
            </button>
          </div>
        </ModalOverlay>
      )}
    </div>
  )
}
