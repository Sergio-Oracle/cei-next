'use client'

import { useEffect, useState, useCallback } from 'react'
import api from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'

/* ── Types ──────────────────────────────────────────────────────────────────── */
interface Pole {
  id: number; code: string; name: string; description?: string; is_active: boolean; formations_count: number
}
interface EC {
  id: number; code: string; name: string
  coefficient: number; cm?: number; td?: number; tp?: number; tpe?: number; vht?: number
  cc_percentage?: number; ex_percentage?: number; is_active: boolean; assigned_professor?: string
}
interface UE {
  id: number; code: string; name: string; credits: number; ue_type?: string; is_active: boolean; ecs: EC[]
}
interface Semester {
  id: number; number: number; name?: string; total_credits: number; is_active: boolean; ues: UE[]
}
interface Formation {
  id: number; code: string; name: string; level?: string; department?: string
  description?: string; pole_id?: number; pole_code?: string; pole_name?: string
  is_active: boolean; semesters: Semester[]
}

type ModalKind =
  | 'manage_poles'
  | 'create_formation' | 'edit_formation'
  | 'create_semester'  | 'edit_semester'
  | 'create_ue'        | 'edit_ue'
  | 'create_ec'        | 'edit_ec'
  | 'import_csv'
  | 'import_excel'

interface ModalState {
  kind: ModalKind
  item?: any
  formationId?: number
  semesterId?: number
  ueId?: number
}

/* ── Overlay ────────────────────────────────────────────────────────────────── */
function ModalOverlay({ children, onClose, wide }: { children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={onClose}>
      <div style={{ background: 'var(--surface)', borderRadius: 16, padding: 32, width: '100%', maxWidth: wide ? 780 : 560, maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,.18)' }}
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

const POLE_COLORS: Record<string, string> = {
  STN:  '#2563eb',
  LSHE: '#10b981',
  SEJA: '#f59e0b',
}
function poleColor(code?: string) { return POLE_COLORS[code || ''] || '#3b82f6' }

/* ═══════════════════════════════════════════════════════════════════════════ */
export default function AdminFormationsPage() {
  const { success, error } = useToast()
  const [formations, setFormations] = useState<Formation[]>([])
  const [poles, setPoles] = useState<Pole[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<ModalState | null>(null)
  const [form, setForm] = useState<any>({})
  const [submitting, setSubmitting] = useState(false)
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<any>(null)

  // Import Excel maquette (format réel école — UE/EC avec CC/EX imbriqués)
  const [excelSemesterId, setExcelSemesterId] = useState('')
  const [excelFile, setExcelFile] = useState<File | null>(null)
  const [excelPreview, setExcelPreview] = useState<any>(null)
  const [excelBusy, setExcelBusy] = useState(false)
  // Pour la gestion inline des pôles
  const [poleForm, setPoleForm] = useState({ code: '', name: '', description: '' })
  const [poleSubmitting, setPoleSubmitting] = useState(false)
  // Création d'un pôle directement depuis la modale "Créer une Formation" —
  // évite de devoir fermer la modale pour aller créer le pôle ailleurs
  const [inlinePoleOpen, setInlinePoleOpen] = useState(false)
  const [inlinePoleForm, setInlinePoleForm] = useState({ code: '', name: '', description: '' })
  const [inlinePoleBusy, setInlinePoleBusy] = useState(false)

  async function createInlinePole() {
    if (!inlinePoleForm.code || !inlinePoleForm.name) { error('Code et nom du pôle requis'); return }
    setInlinePoleBusy(true)
    try {
      const res = await api.post<Pole>('/api/admin/poles', inlinePoleForm)
      success(`Pôle ${inlinePoleForm.code} créé`)
      await loadPoles()
      setForm((p: any) => ({ ...p, pole_id: res.id }))
      setInlinePoleForm({ code: '', name: '', description: '' })
      setInlinePoleOpen(false)
    } catch (e: any) { error(e.message || 'Erreur lors de la création du pôle') }
    finally { setInlinePoleBusy(false) }
  }

  /* ── Load all data ────────────────────────────────────────────────────────── */
  const loadPoles = useCallback(async () => {
    try {
      const data = await api.get<Pole[]>('/api/poles')
      setPoles(Array.isArray(data) ? data : [])
    } catch { /* silent */ }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [rawPoles, rawForms] = await Promise.all([
        api.get<Pole[]>('/api/poles').catch(() => []),
        api.get<any>('/api/formations'),
      ])
      setPoles(Array.isArray(rawPoles) ? rawPoles : [])
      const flist: any[] = Array.isArray(rawForms) ? rawForms : rawForms.formations ?? []
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

  /* ── Field helpers ────────────────────────────────────────────────────────── */
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

  const sel = (key: string, label: string, options: { value: string | number; label: string }[]) => (
    <div className="form-group" key={key}>
      <label style={{ fontWeight: 600, fontSize: 13, marginBottom: 6, display: 'block' }}>{label}</label>
      <select value={form[key] ?? ''}
        onChange={e => setForm((p: any) => ({ ...p, [key]: e.target.value === '' ? null : (typeof options[0]?.value === 'number' ? Number(e.target.value) : e.target.value) }))}
        style={{ width: '100%', padding: '10px 14px', border: '1.5px solid var(--border)', borderRadius: 10, fontSize: 14, background: 'var(--surface)', color: 'var(--text)', outline: 'none', boxSizing: 'border-box' }}>
        <option value="">— Sélectionner —</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
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

  /* ── Modal form content ───────────────────────────────────────────────────── */
  function modalBody() {
    if (!modal) return null
    switch (modal.kind) {
      case 'create_formation': case 'edit_formation': return (<>
        <div className="form-group">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <label style={{ fontWeight: 600, fontSize: 13 }}>Pôle</label>
            <button type="button" onClick={() => setInlinePoleOpen(o => !o)}
              style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              <i className={`fas ${inlinePoleOpen ? 'fa-xmark' : 'fa-plus'}`} /> {inlinePoleOpen ? 'Annuler' : 'Nouveau pôle'}
            </button>
          </div>
          {inlinePoleOpen ? (
            <div style={{ border: '1.5px dashed var(--border)', borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
              <input placeholder="Code (ex: STN)" value={inlinePoleForm.code}
                onChange={e => setInlinePoleForm(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                style={{ padding: '8px 12px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 13, background: 'var(--surface)', color: 'var(--text)' }} />
              <input placeholder="Nom du pôle" value={inlinePoleForm.name}
                onChange={e => setInlinePoleForm(p => ({ ...p, name: e.target.value }))}
                style={{ padding: '8px 12px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 13, background: 'var(--surface)', color: 'var(--text)' }} />
              <button type="button" onClick={createInlinePole} disabled={inlinePoleBusy || !inlinePoleForm.code || !inlinePoleForm.name}
                style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: (!inlinePoleForm.code || !inlinePoleForm.name) ? .5 : 1 }}>
                <i className={`fas ${inlinePoleBusy ? 'fa-spinner fa-spin' : 'fa-check'}`} style={{ marginRight: 6 }} />
                {inlinePoleBusy ? 'Création…' : 'Créer et sélectionner ce pôle'}
              </button>
            </div>
          ) : (
            <select value={form.pole_id ?? ''}
              onChange={e => setForm((p: any) => ({ ...p, pole_id: e.target.value === '' ? null : Number(e.target.value) }))}
              style={{ width: '100%', padding: '10px 14px', border: '1.5px solid var(--border)', borderRadius: 10, fontSize: 14, background: 'var(--surface)', color: 'var(--text)', outline: 'none', boxSizing: 'border-box' }}>
              <option value="">— Sélectionner —</option>
              {poles.map(p => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
            </select>
          )}
        </div>
        {inp('code', 'Code *', { placeholder: 'Ex: L1-SOCIO' })}
        {inp('name', 'Nom *', { placeholder: 'Ex: Licence Sociologie' })}
        {inp('level', 'Niveau', { placeholder: 'Ex: Licence 1, Master 2' })}
        {inp('department', 'Département', { placeholder: 'Ex: Sciences Humaines' })}
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
        {inp('code', 'Code *', { placeholder: 'Ex: SOCIO111' })}
        {inp('name', 'Nom *', { placeholder: 'Ex: Sociologie et Anthropologie' })}
        {inp('credits', 'Crédits', { type: 'number', min: 1 })}
        {sel('ue_type', 'Type', [
          { value: 'obligatoire', label: 'Obligatoire' },
          { value: 'optionnel', label: 'Optionnel' },
        ])}
        {modal.kind === 'edit_ue' && chk('is_active', 'UE active')}
      </>)
      case 'create_ec': case 'edit_ec': return (<>
        {inp('code', 'Code *', { placeholder: 'Ex: SOCIO1111' })}
        {inp('name', 'Nom *', { placeholder: "Ex: Introduction à la sociologie" })}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
          {inp('cm', 'CM (h)', { type: 'number', min: 0 })}
          {inp('td', 'TD (h)', { type: 'number', min: 0 })}
          {inp('tp', 'TP (h)', { type: 'number', min: 0 })}
          {inp('tpe', 'TPE (h)', { type: 'number', min: 0 })}
          {inp('vht', 'VHT (h)', { type: 'number', min: 0 })}
          {inp('coefficient', 'Coefficient', { type: 'number', min: 1 })}
        </div>
        <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 10, padding: '12px 16px', marginTop: 4 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#0369a1', marginBottom: 10 }}>
            <i className="fas fa-percentage" style={{ marginRight: 6 }} />Modalité d'évaluation
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {inp('cc_percentage', 'CC % (contrôle continu)', { type: 'number', min: 0, max: 100 })}
            {inp('ex_percentage', 'EX % (examen final)', { type: 'number', min: 0, max: 100 })}
          </div>
          <p style={{ margin: 0, fontSize: 11, color: '#0284c7' }}>CC% + EX% doivent totalisé 100%</p>
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

  /* ── Pôle creation inline ─────────────────────────────────────────────────── */
  async function createPole() {
    if (!poleForm.code || !poleForm.name) { error('Code et nom requis'); return }
    setPoleSubmitting(true)
    try {
      await api.post('/api/admin/poles', poleForm)
      success(`Pôle ${poleForm.code} créé`)
      setPoleForm({ code: '', name: '', description: '' })
      loadPoles()
      load()
    } catch (e: any) { error(e.message || 'Erreur') }
    finally { setPoleSubmitting(false) }
  }

  async function deletePole(id: number, code: string) {
    if (!confirm(`Désactiver le pôle ${code} ?`)) return
    try { await api.delete(`/api/admin/poles/${id}`); success('Pôle désactivé'); load() }
    catch (e: any) { error(e.message || 'Erreur') }
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

  async function downloadExcelTemplate() {
    try {
      const blob = await api.blob('/api/admin/maquette/excel-template')
      const url = URL.createObjectURL(blob)
      Object.assign(document.createElement('a'), { href: url, download: `template_maquette_excel_${new Date().toISOString().split('T')[0]}.xlsx` }).click()
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

  async function handleExcelPreview() {
    if (!excelSemesterId) { error('Sélectionnez le semestre cible'); return }
    if (!excelFile) { error('Sélectionnez un fichier Excel'); return }
    setExcelBusy(true)
    const fd = new FormData()
    fd.append('semester_id', excelSemesterId)
    fd.append('file', excelFile)
    try {
      const res = await api.upload<any>('/api/admin/maquette/import-excel-preview', fd)
      setExcelPreview(res)
    } catch (e: any) { error(e.message) }
    finally { setExcelBusy(false) }
  }

  async function handleExcelConfirm() {
    if (!excelPreview) return
    setExcelBusy(true)
    try {
      const res = await api.post<any>('/api/admin/maquette/import-excel-confirm', {
        semester_id: excelPreview.semester_id, ues: excelPreview.ues,
      })
      success(`Import réussi — UEs créées: ${res.created_ues}, ECs créés: ${res.created_ecs}${res.skipped_existing ? `, ${res.skipped_existing} EC(s) déjà existant(s) ignoré(s)` : ''}`)
      setModal(null); setExcelPreview(null); setExcelFile(null); setExcelSemesterId('')
      load()
    } catch (e: any) { error(e.message) }
    finally { setExcelBusy(false) }
  }

  /* ── Open helpers ─────────────────────────────────────────────────────────── */
  function openCreate(kind: ModalKind, extra?: Partial<ModalState>) {
    const defaults: Record<string, any> = {
      create_semester: { number: 1, total_credits: 30 },
      create_ue: { credits: 6, ue_type: 'obligatoire' },
      create_ec: { cm: 0, td: 0, tp: 0, tpe: 0, vht: 0, coefficient: 1, cc_percentage: 40, ex_percentage: 60 },
    }
    setForm(defaults[kind] ?? {})
    setModal({ kind, ...extra })
    setInlinePoleOpen(false); setInlinePoleForm({ code: '', name: '', description: '' })
  }

  function openEdit(kind: ModalKind, item: any) {
    setForm({ ...item }); setModal({ kind, item })
    setInlinePoleOpen(false); setInlinePoleForm({ code: '', name: '', description: '' })
  }

  /* ── Group formations by pôle ─────────────────────────────────────────────── */
  const formationsByPole: { pole: Pole | null; formations: Formation[] }[] = []
  const assigned = new Set<number>()
  for (const pole of poles) {
    const pf = formations.filter(f => f.pole_id === pole.id)
    if (pf.length > 0) { formationsByPole.push({ pole, formations: pf }); pf.forEach(f => assigned.add(f.id)) }
  }
  const unassigned = formations.filter(f => !assigned.has(f.id))
  if (unassigned.length > 0) formationsByPole.push({ pole: null, formations: unassigned })

  const allSemesters = formations.flatMap(f => f.semesters.map(s => ({
    id: s.id, label: `${f.name} — ${s.name || `Semestre ${s.number}`}`,
  })))

  /* ── Render ───────────────────────────────────────────────────────────────── */
  return (
    <div>
      {/* Page header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 10 }}>
          <i className="fas fa-layer-group" style={{ color: 'var(--primary)' }} />
          Maquette Pédagogique — UNCHK
        </h2>
        <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 14 }}>
          Gérez la hiérarchie : <strong>Pôle → Formation → Semestre → UE → EC</strong>
        </p>
      </div>

      {/* ══ Section Pôles ══════════════════════════════════════════════════════ */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, marginBottom: 24, overflow: 'hidden' }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <i className="fas fa-sitemap" style={{ color: '#2563eb' }} /> Pôles UNCHK
          </h3>
        </div>
        <div style={{ padding: '16px 24px' }}>
          {/* Liste des pôles */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
            {poles.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Aucun pôle créé</p>
            ) : poles.map(p => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: poleColor(p.code) + '18', border: `1.5px solid ${poleColor(p.code)}40`, borderRadius: 12, padding: '8px 16px' }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: poleColor(p.code) }} />
                <div>
                  <div style={{ fontWeight: 800, fontSize: 13, color: poleColor(p.code) }}>{p.code}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.name} · {p.formations_count} formation(s)</div>
                </div>
                <button onClick={() => deletePole(p.id, p.code)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 13, padding: 2 }} title="Désactiver">
                  <i className="fas fa-times" />
                </button>
              </div>
            ))}
          </div>

          {/* Formulaire création pôle */}
          <div style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: 12, padding: '14px 18px' }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, color: '#475569' }}>
              <i className="fas fa-plus" style={{ marginRight: 6 }} />Créer un nouveau pôle
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 2fr auto', gap: 10, alignItems: 'center' }}>
              <input placeholder="Code (ex: STN)" value={poleForm.code}
                onChange={e => setPoleForm(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                style={{ padding: '8px 12px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 13, background: 'var(--surface)', color: 'var(--text)' }} />
              <input placeholder="Nom du pôle" value={poleForm.name}
                onChange={e => setPoleForm(p => ({ ...p, name: e.target.value }))}
                style={{ padding: '8px 12px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 13, background: 'var(--surface)', color: 'var(--text)' }} />
              <input placeholder="Description (optionnel)" value={poleForm.description}
                onChange={e => setPoleForm(p => ({ ...p, description: e.target.value }))}
                style={{ padding: '8px 12px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 13, background: 'var(--surface)', color: 'var(--text)' }} />
              <button onClick={createPole} disabled={poleSubmitting || !poleForm.code || !poleForm.name}
                style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#2563eb', color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 700, opacity: (!poleForm.code || !poleForm.name) ? .5 : 1 }}>
                <i className={`fas ${poleSubmitting ? 'fa-spinner fa-spin' : 'fa-check'}`} style={{ marginRight: 5 }} />
                Créer
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ══ Section Formations ══════════════════════════════════════════════════ */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
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
              <i className="fas fa-file-csv" /> Import CSV
            </button>
            <button onClick={() => { setModal({ kind: 'import_excel' }); setExcelFile(null); setExcelPreview(null); setExcelSemesterId('') }}
              title="Importer UE/EC depuis un fichier Excel au format officiel de l'établissement (dans un semestre déjà créé)"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 18px', borderRadius: 10, border: 'none', background: '#0891b2', color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
              <i className="fas fa-file-excel" /> Importer Excel (UE/EC)
            </button>
          </div>
        </div>

        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 28 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 48 }}>
              <i className="fas fa-spinner fa-spin" style={{ fontSize: 32, color: 'var(--primary)' }} />
            </div>
          ) : formations.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
              <i className="fas fa-inbox" style={{ fontSize: 32, display: 'block', marginBottom: 10 }} />
              Aucune formation créée
            </div>
          ) : formationsByPole.map(({ pole, formations: pfs }, gi) => (
            /* ── Groupe par Pôle ── */
            <div key={gi}>
              {/* Pôle header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div style={{ width: 4, height: 20, borderRadius: 2, background: poleColor(pole?.code) }} />
                <span style={{ fontWeight: 800, fontSize: 15, color: poleColor(pole?.code) }}>
                  {pole ? `Pôle ${pole.code} — ${pole.name}` : 'Sans pôle'}
                </span>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {pfs.map(f => (
                  /* ── Formation block ── */
                  <div key={f.id} style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,.05)' }}>
                    {/* Formation header */}
                    <div style={{ background: poleColor(f.pole_code), color: 'white', padding: '16px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                          <i className="fas fa-graduation-cap" />
                          {f.code} — {f.name}
                        </div>
                        <div style={{ fontSize: 12, opacity: .82, marginTop: 3 }}>
                          {[f.level, f.department].filter(Boolean).join(' | ')}
                        </div>
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
                          <i className="fas fa-inbox" style={{ marginRight: 6 }} />Aucun semestre — cliquez &quot;+ Semestre&quot;
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
                              <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>Aucune UE</p>
                            ) : s.ues.map(u => (
                              <div key={u.id} style={{ borderLeft: '4px solid #10b981', background: '#fafcff', borderRadius: '0 10px 10px 0', border: '1px solid #e2e8f0', borderLeftWidth: 4, borderLeftColor: '#10b981' }}>
                                <div style={{ padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <div style={{ fontSize: 13, color: '#0f172a' }}>
                                    <i className="fas fa-book-open" style={{ marginRight: 6, color: '#10b981' }} />
                                    <strong>{u.code}</strong> — {u.name}
                                    <span style={{ color: '#64748b', marginLeft: 10, fontSize: 12 }}>
                                      <i className="fas fa-award" style={{ marginRight: 3, color: '#f59e0b' }} />{u.credits} crédits
                                    </span>
                                    {u.ue_type && (
                                      <span style={{
                                        marginLeft: 8, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 12,
                                        background: u.ue_type === 'obligatoire' ? '#dbeafe' : '#fef9c3',
                                        color: u.ue_type === 'obligatoire' ? '#1d4ed8' : '#a16207'
                                      }}>
                                        {u.ue_type === 'obligatoire' ? 'Obligatoire' : 'Optionnel'}
                                      </span>
                                    )}
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
                                          <div style={{ fontSize: 11, color: '#b45309', marginTop: 3, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                                            <span>Coef: {ec.coefficient}</span>
                                            {(ec.cm || 0) > 0 && <span>CM: {ec.cm}h</span>}
                                            {(ec.td || 0) > 0 && <span>TD: {ec.td}h</span>}
                                            {(ec.tp || 0) > 0 && <span>TP: {ec.tp}h</span>}
                                            <span style={{ background: '#dbeafe', color: '#1d4ed8', padding: '1px 7px', borderRadius: 8, fontWeight: 700 }}>
                                              CC:{ec.cc_percentage ?? 40}% / EX:{ec.ex_percentage ?? 60}%
                                            </span>
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
          ))}
        </div>
      </div>

      {/* ══ Modal Formulaire ══════════════════════════════════════════════════ */}
      {modal && !['import_csv', 'manage_poles'].includes(modal.kind) && (
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
              <li>Respectez l&apos;ordre hiérarchique</li>
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

      {/* ══ Modal Import Excel (format officiel école) ══════════════════════════ */}
      {modal?.kind === 'import_excel' && (
        <ModalOverlay onClose={() => setModal(null)} wide>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, paddingBottom: 18, borderBottom: '1px solid var(--border)' }}>
            <div style={{ width: 42, height: 42, borderRadius: 11, background: '#ecfeff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fas fa-file-excel" style={{ color: '#0891b2', fontSize: 17 }} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Importer UE/EC — Excel officiel</h3>
              <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
                Fichier au format réel de l&apos;établissement (colonnes Code/Nom/Crédit/Type UE puis Code/Nom/Coef EC, pourcentages CC/EX entre crochets dans le nom de l&apos;EC)
              </p>
            </div>
          </div>

          {!excelPreview ? (
            <>
              <button onClick={downloadExcelTemplate}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 18px', borderRadius: 10, border: 'none', background: '#06b6d4', color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 700, marginBottom: 18 }}>
                <i className="fas fa-download" /> Télécharger Template Excel
              </button>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <label style={{ fontWeight: 600, fontSize: 13 }}>Semestre cible *</label>
                  <button type="button" onClick={() => openCreate('create_formation')}
                    style={{ background: 'none', border: 'none', color: '#0891b2', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <i className="fas fa-plus" /> Créer une formation
                  </button>
                </div>
                <select className="form-control" value={excelSemesterId} onChange={e => setExcelSemesterId(e.target.value)}>
                  <option value="">— Sélectionner le semestre où importer —</option>
                  {allSemesters.map(s => <option key={s.id} value={String(s.id)}>{s.label}</option>)}
                </select>
                {allSemesters.length === 0 && (
                  <p style={{ fontSize: 12, color: '#b45309', marginTop: 6 }}>
                    Aucun semestre disponible — créez d&apos;abord une formation (le pôle peut être créé dans la foulée) puis un semestre, via le bouton ci-dessus ou &quot;+ Semestre&quot; sur la formation.
                  </p>
                )}
              </div>
              <div className="form-group" style={{ marginBottom: 8 }}>
                <label style={{ fontWeight: 600, fontSize: 13, marginBottom: 6, display: 'block' }}>Fichier Excel (.xlsx) *</label>
                <input type="file" accept=".xlsx,.xls" style={{ width: '100%', fontSize: 14, padding: '8px 0' }}
                  onChange={e => setExcelFile(e.target.files?.[0] || null)} />
              </div>
              <div style={{ display: 'flex', gap: 10, paddingTop: 14 }}>
                <button onClick={handleExcelPreview} disabled={excelBusy || !excelFile || !excelSemesterId}
                  style={{ padding: '10px 24px', borderRadius: 10, border: 'none', background: '#0891b2', color: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 700, opacity: (!excelFile || !excelSemesterId) ? .5 : 1 }}>
                  <i className={`fas ${excelBusy ? 'fa-spinner fa-spin' : 'fa-magnifying-glass'}`} style={{ marginRight: 7 }} />
                  {excelBusy ? 'Analyse…' : 'Analyser le fichier'}
                </button>
                <button onClick={() => setModal(null)}
                  style={{ padding: '10px 22px', borderRadius: 10, border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--text)', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
                  Annuler
                </button>
              </div>
            </>
          ) : (
            <>
              <div style={{ background: '#ecfeff', border: '1px solid #a5f3fc', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#0e7490' }}>
                <strong>{excelPreview.ue_count} UE</strong> et <strong>{excelPreview.ec_count} EC</strong> détectés pour <strong>{excelPreview.semester_name}</strong> — vérifiez avant de valider.
              </div>
              <div style={{ maxHeight: '48vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {excelPreview.ues.map((u: any) => (
                  <div key={u.code} style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                    <div style={{ padding: '9px 14px', background: u.already_exists ? '#fef3c7' : '#f0fdf4', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <strong style={{ fontSize: 13 }}>{u.code}</strong>
                      <span style={{ fontSize: 13 }}>{u.name}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{u.credits} crédits · {u.ue_type}</span>
                      {u.already_exists && (
                        <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: '#92400e' }}>
                          <i className="fas fa-triangle-exclamation" /> UE déjà existante — ne sera pas recréée
                        </span>
                      )}
                    </div>
                    <div style={{ padding: '8px 14px', display: 'flex', flexDirection: 'column', gap: 5 }}>
                      {u.ecs.map((e: any) => (
                        <div key={e.code} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, padding: '4px 0', color: e.already_exists ? 'var(--text-muted)' : 'var(--text)' }}>
                          <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{e.code}</span>
                          <span style={{ flex: 1 }}>{e.name}</span>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Coef. {e.coefficient} · CC:{e.cc_percentage}% EX:{e.ex_percentage}%</span>
                          {e.already_exists && <span style={{ fontSize: 11, fontWeight: 700, color: '#b45309' }}>déjà existant — ignoré</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 10, paddingTop: 16 }}>
                <button onClick={handleExcelConfirm} disabled={excelBusy}
                  style={{ padding: '10px 24px', borderRadius: 10, border: 'none', background: '#10b981', color: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>
                  <i className={`fas ${excelBusy ? 'fa-spinner fa-spin' : 'fa-check'}`} style={{ marginRight: 7 }} />
                  {excelBusy ? 'Import…' : 'Confirmer l’import'}
                </button>
                <button onClick={() => setExcelPreview(null)}
                  style={{ padding: '10px 22px', borderRadius: 10, border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--text)', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
                  <i className="fas fa-arrow-left" style={{ marginRight: 6 }} />Revenir
                </button>
              </div>
            </>
          )}
        </ModalOverlay>
      )}
    </div>
  )
}
