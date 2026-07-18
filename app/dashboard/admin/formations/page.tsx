'use client'

import { useEffect, useState, useCallback } from 'react'
import api from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'

/* ── Types ──────────────────────────────────────────────────────────────────── */
interface Pole {
  id: number; code: string; name: string; description?: string; is_active: boolean; formations_count: number
}
interface Niveau {
  id: number; code: string; name: string; description?: string
  pole_id?: number; pole_code?: string; pole_name?: string
  is_active: boolean; formations_count: number
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
  niveau_id?: number; niveau_code?: string; niveau_name?: string
  is_active: boolean; semesters: Semester[]
}

type ModalKind =
  | 'manage_poles'
  | 'edit_pole'         | 'edit_niveau'
  | 'edit_formation'
  | 'create_semester'  | 'edit_semester'
  | 'create_ue'        | 'edit_ue'
  | 'create_ec'        | 'edit_ec'
  | 'import_csv'
  | 'wizard'

type WizardStep = 'pole' | 'niveau' | 'formation' | 'semester' | 'ue' | 'ec'
const WIZARD_STEPS: WizardStep[] = ['pole', 'niveau', 'formation', 'semester', 'ue', 'ec']
const WIZARD_LABELS: Record<WizardStep, string> = { pole: 'Pôle', niveau: 'Niveau', formation: 'Formation', semester: 'Semestre', ue: 'UE', ec: 'EC' }

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
  const [niveaux, setNiveaux] = useState<Niveau[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<ModalState | null>(null)
  const [form, setForm] = useState<any>({})
  const [submitting, setSubmitting] = useState(false)
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<any>(null)

  // Import Excel maquette (format réel école — UE/EC avec CC/EX imbriqués),
  // utilisé depuis l'étape UE de l'assistant "Créer la hiérarchie (pas-à-pas)"
  // — excelSemesterId est pré-ciblé sur le semestre courant de l'assistant.
  const [excelSemesterId, setExcelSemesterId] = useState('')
  const [excelFile, setExcelFile] = useState<File | null>(null)
  const [excelPreview, setExcelPreview] = useState<any>(null)
  const [excelBusy, setExcelBusy] = useState(false)
  // Création d'un pôle directement depuis la modale "Créer une Formation" —
  // évite de devoir fermer la modale pour aller créer le pôle ailleurs
  const [inlinePoleOpen, setInlinePoleOpen] = useState(false)
  const [inlinePoleForm, setInlinePoleForm] = useState({ code: '', name: '', description: '' })
  const [inlinePoleBusy, setInlinePoleBusy] = useState(false)
  // Pour la gestion inline des niveaux — rattachés à un pôle (hiérarchie
  // Pôle → Niveau → Formation → Semestre → UE → EC). L'ajout se fait
  // directement sous la carte du pôle concerné (section fusionnée), donc pas
  // besoin de re-sélectionner le pôle dans le formulaire : il est déjà connu.
  const [quickNiveauPoleId, setQuickNiveauPoleId] = useState<number | null>(null)
  const [niveauForm, setNiveauForm] = useState({ code: '', name: '', description: '' })
  const [niveauSubmitting, setNiveauSubmitting] = useState(false)
  const [inlineNiveauOpen, setInlineNiveauOpen] = useState(false)
  const [inlineNiveauForm, setInlineNiveauForm] = useState({ code: '', name: '', description: '' })
  const [inlineNiveauBusy, setInlineNiveauBusy] = useState(false)
  // Assistant de création pas-à-pas — respecte la hiérarchie Pôle → Niveau →
  // Formation → Semestre → UE → EC en demandant chaque niveau l'un après
  // l'autre (choisir un existant ou en créer un nouveau), au lieu d'avoir à
  // naviguer manuellement dans l'arbre après chaque création.
  const [wizardStep, setWizardStep] = useState<WizardStep>('pole')
  const [wizardCtx, setWizardCtx] = useState<{ poleId?: number; niveauId?: number; formationId?: number; semesterId?: number; ueId?: number }>({})
  const [wizardCreatingNew, setWizardCreatingNew] = useState(true)
  const [wizardForm, setWizardForm] = useState<any>({})
  const [wizardBusy, setWizardBusy] = useState(false)
  const [wizardEcCount, setWizardEcCount] = useState(0)
  // À l'étape UE, choix entre créer une UE/EC à la main ou importer tout le
  // semestre d'un coup via le fichier Excel officiel (pré-ciblé sur ce semestre).
  const [wizardUeMode, setWizardUeMode] = useState<'manual' | 'excel'>('manual')

  function openWizard() {
    setWizardStep('pole')
    setWizardCtx({})
    setWizardCreatingNew(poles.length === 0)
    setWizardForm({})
    setWizardEcCount(0)
    setWizardUeMode('manual')
    setExcelFile(null); setExcelPreview(null); setExcelSemesterId('')
    setModal({ kind: 'wizard' })
  }

  async function wizardCreatePole() {
    if (!wizardForm.code || !wizardForm.name) { error('Code et nom requis'); return }
    setWizardBusy(true)
    try {
      const res = await api.post<Pole>('/api/admin/poles', { code: wizardForm.code, name: wizardForm.name, description: wizardForm.description })
      success(`Pôle ${res.code} créé`)
      await loadPoles()
      setWizardCtx(c => ({ ...c, poleId: res.id }))
      setWizardStep('niveau'); setWizardCreatingNew(false); setWizardForm({})
    } catch (e: any) { error(e.message || 'Erreur') }
    finally { setWizardBusy(false) }
  }

  async function wizardCreateNiveau() {
    if (!wizardForm.code || !wizardForm.name) { error('Code et nom requis'); return }
    setWizardBusy(true)
    try {
      const res = await api.post<Niveau>('/api/admin/niveaux', { code: wizardForm.code, name: wizardForm.name, description: wizardForm.description, pole_id: wizardCtx.poleId })
      success(`Niveau ${res.code} créé`)
      await loadNiveaux()
      setWizardCtx(c => ({ ...c, niveauId: res.id }))
      setWizardStep('formation'); setWizardCreatingNew(false); setWizardForm({})
    } catch (e: any) { error(e.message || 'Erreur') }
    finally { setWizardBusy(false) }
  }

  async function wizardCreateFormation() {
    if (!wizardForm.code || !wizardForm.name) { error('Code et nom requis'); return }
    setWizardBusy(true)
    try {
      const res = await api.post<any>('/api/admin/formations', { code: wizardForm.code, name: wizardForm.name, department: wizardForm.department, niveau_id: wizardCtx.niveauId })
      success(`Formation ${res.formation.code} créée`)
      await load()
      setWizardCtx(c => ({ ...c, formationId: res.formation.id }))
      setWizardStep('semester'); setWizardCreatingNew(true); setWizardForm({ number: 1, total_credits: 30 })
    } catch (e: any) { error(e.message || 'Erreur') }
    finally { setWizardBusy(false) }
  }

  async function wizardCreateSemester() {
    if (!wizardForm.number) { error('Numéro requis'); return }
    setWizardBusy(true)
    try {
      const res = await api.post<any>('/api/admin/semesters', {
        formation_id: wizardCtx.formationId, number: wizardForm.number,
        name: wizardForm.name || `Semestre ${wizardForm.number}`, total_credits: wizardForm.total_credits || 30,
      })
      success('Semestre créé')
      await load()
      setWizardCtx(c => ({ ...c, semesterId: res.semester.id }))
      setExcelSemesterId(String(res.semester.id))
      setWizardStep('ue'); setWizardCreatingNew(true); setWizardUeMode('manual'); setWizardForm({ credits: 6, ue_type: 'obligatoire' })
    } catch (e: any) { error(e.message || 'Erreur') }
    finally { setWizardBusy(false) }
  }

  async function wizardCreateUe() {
    if (!wizardForm.code || !wizardForm.name) { error('Code et nom requis'); return }
    setWizardBusy(true)
    try {
      const res = await api.post<any>('/api/admin/ues', {
        semester_id: wizardCtx.semesterId, code: wizardForm.code, name: wizardForm.name,
        credits: wizardForm.credits || 6, ue_type: wizardForm.ue_type || 'obligatoire',
      })
      success(`UE ${res.ue.code} créée`)
      await load()
      setWizardCtx(c => ({ ...c, ueId: res.ue.id }))
      setWizardStep('ec'); setWizardCreatingNew(true)
      setWizardForm({ cm: 0, td: 0, tp: 0, tpe: 0, vht: 0, coefficient: 1, cc_percentage: 40, ex_percentage: 60 })
    } catch (e: any) { error(e.message || 'Erreur') }
    finally { setWizardBusy(false) }
  }

  async function wizardCreateEc(next: 'another_ec' | 'another_ue' | 'done') {
    if (!wizardForm.code || !wizardForm.name) { error('Code et nom requis'); return }
    setWizardBusy(true)
    try {
      const res = await api.post<any>('/api/admin/ecs', { ue_id: wizardCtx.ueId, ...wizardForm })
      success(`EC ${res.ec.code} créé`)
      await load()
      setWizardEcCount(n => n + 1)
      if (next === 'another_ec') {
        setWizardForm({ cm: 0, td: 0, tp: 0, tpe: 0, vht: 0, coefficient: 1, cc_percentage: 40, ex_percentage: 60 })
      } else if (next === 'another_ue') {
        setWizardStep('ue'); setWizardCreatingNew(true); setWizardUeMode('manual'); setWizardForm({ credits: 6, ue_type: 'obligatoire' })
      } else {
        setModal(null)
      }
    } catch (e: any) { error(e.message || 'Erreur') }
    finally { setWizardBusy(false) }
  }

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

  async function createInlineNiveau() {
    if (!inlineNiveauForm.code || !inlineNiveauForm.name) { error('Code et nom du niveau requis'); return }
    if (!form.pole_id) { error('Sélectionnez d\'abord un pôle'); return }
    setInlineNiveauBusy(true)
    try {
      const res = await api.post<Niveau>('/api/admin/niveaux', { ...inlineNiveauForm, pole_id: form.pole_id })
      success(`Niveau ${inlineNiveauForm.code} créé`)
      await loadNiveaux()
      setForm((p: any) => ({ ...p, niveau_id: res.id }))
      setInlineNiveauForm({ code: '', name: '', description: '' })
      setInlineNiveauOpen(false)
    } catch (e: any) { error(e.message || 'Erreur lors de la création du niveau') }
    finally { setInlineNiveauBusy(false) }
  }

  /* ── Load all data ────────────────────────────────────────────────────────── */
  const loadPoles = useCallback(async () => {
    try {
      const data = await api.get<Pole[]>('/api/poles')
      setPoles(Array.isArray(data) ? data : [])
    } catch { /* silent */ }
  }, [])

  const loadNiveaux = useCallback(async () => {
    try {
      const data = await api.get<Niveau[]>('/api/niveaux')
      setNiveaux(Array.isArray(data) ? data : [])
    } catch { /* silent */ }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [rawPoles, rawNiveaux, rawForms] = await Promise.all([
        api.get<Pole[]>('/api/poles').catch(() => []),
        api.get<Niveau[]>('/api/niveaux').catch(() => []),
        api.get<any>('/api/formations'),
      ])
      setPoles(Array.isArray(rawPoles) ? rawPoles : [])
      setNiveaux(Array.isArray(rawNiveaux) ? rawNiveaux : [])
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
      case 'edit_pole': return (<>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>Code : <strong style={{ color: 'var(--text)' }}>{modal.item?.code}</strong> (non modifiable)</div>
        {inp('name', 'Nom *', { placeholder: 'Ex: Sciences et Technologies du Numérique' })}
        <div className="form-group">
          <label style={{ fontWeight: 600, fontSize: 13, marginBottom: 6, display: 'block' }}>Description</label>
          <textarea className="form-control" rows={3} value={form.description ?? ''}
            onChange={e => setForm((p: any) => ({ ...p, description: e.target.value }))}
            style={{ width: '100%', padding: '10px 14px', border: '1.5px solid var(--border)', borderRadius: 10, fontSize: 14, background: 'var(--surface)', color: 'var(--text)', resize: 'vertical', boxSizing: 'border-box' }} />
        </div>
        {chk('is_active', 'Pôle actif')}
      </>)
      case 'edit_niveau': return (<>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>Code : <strong style={{ color: 'var(--text)' }}>{modal.item?.code}</strong> (non modifiable)</div>
        {sel('pole_id', 'Pôle *', poles.map(p => ({ value: p.id, label: `${p.code} — ${p.name}` })))}
        {inp('name', 'Nom *', { placeholder: 'Ex: Licence 1' })}
        <div className="form-group">
          <label style={{ fontWeight: 600, fontSize: 13, marginBottom: 6, display: 'block' }}>Description</label>
          <textarea className="form-control" rows={3} value={form.description ?? ''}
            onChange={e => setForm((p: any) => ({ ...p, description: e.target.value }))}
            style={{ width: '100%', padding: '10px 14px', border: '1.5px solid var(--border)', borderRadius: 10, fontSize: 14, background: 'var(--surface)', color: 'var(--text)', resize: 'vertical', boxSizing: 'border-box' }} />
        </div>
        {chk('is_active', 'Niveau actif')}
      </>)
      case 'edit_formation': return (<>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <label style={{ fontWeight: 600, fontSize: 13 }}>Pôle</label>
              <button type="button" onClick={() => setInlinePoleOpen(o => !o)}
                style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                <i className={`fas ${inlinePoleOpen ? 'fa-xmark' : 'fa-plus'}`} /> {inlinePoleOpen ? 'Annuler' : 'Nouveau'}
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
                  {inlinePoleBusy ? 'Création…' : 'Créer et sélectionner'}
                </button>
              </div>
            ) : (
              <select value={form.pole_id ?? ''}
                onChange={e => {
                  const pid = e.target.value === '' ? null : Number(e.target.value)
                  setForm((p: any) => {
                    // Le niveau appartient à un pôle (Pôle → Niveau → Formation) :
                    // si on change de pôle, un niveau d'un autre pôle n'est plus valide.
                    const stillValid = p.niveau_id && niveaux.find(n => n.id === p.niveau_id)?.pole_id === pid
                    return { ...p, pole_id: pid, niveau_id: stillValid ? p.niveau_id : null }
                  })
                }}
                style={{ width: '100%', padding: '10px 14px', border: '1.5px solid var(--border)', borderRadius: 10, fontSize: 14, background: 'var(--surface)', color: 'var(--text)', outline: 'none', boxSizing: 'border-box' }}>
                <option value="">— Sélectionner —</option>
                {poles.map(p => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
              </select>
            )}
          </div>
          <div className="form-group">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <label style={{ fontWeight: 600, fontSize: 13 }}>Niveau {form.pole_id ? '' : <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: 11 }}>(pôle d&apos;abord)</span>}</label>
              <button type="button" disabled={!form.pole_id} onClick={() => setInlineNiveauOpen(o => !o)}
                style={{ background: 'none', border: 'none', color: form.pole_id ? 'var(--primary)' : 'var(--text-muted)', fontSize: 12, fontWeight: 600, cursor: form.pole_id ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: 4 }}>
                <i className={`fas ${inlineNiveauOpen ? 'fa-xmark' : 'fa-plus'}`} /> {inlineNiveauOpen ? 'Annuler' : 'Nouveau'}
              </button>
            </div>
            {inlineNiveauOpen ? (
              <div style={{ border: '1.5px dashed var(--border)', borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
                <input placeholder="Code (ex: L1)" value={inlineNiveauForm.code}
                  onChange={e => setInlineNiveauForm(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                  style={{ padding: '8px 12px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 13, background: 'var(--surface)', color: 'var(--text)' }} />
                <input placeholder="Nom du niveau (ex: Licence 1)" value={inlineNiveauForm.name}
                  onChange={e => setInlineNiveauForm(p => ({ ...p, name: e.target.value }))}
                  style={{ padding: '8px 12px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 13, background: 'var(--surface)', color: 'var(--text)' }} />
                <button type="button" onClick={createInlineNiveau} disabled={inlineNiveauBusy || !inlineNiveauForm.code || !inlineNiveauForm.name || !form.pole_id}
                  style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: (!inlineNiveauForm.code || !inlineNiveauForm.name) ? .5 : 1 }}>
                  <i className={`fas ${inlineNiveauBusy ? 'fa-spinner fa-spin' : 'fa-check'}`} style={{ marginRight: 6 }} />
                  {inlineNiveauBusy ? 'Création…' : `Créer sous ${poles.find(p => p.id === form.pole_id)?.code || 'ce pôle'}`}
                </button>
              </div>
            ) : (
              <select value={form.niveau_id ?? ''} disabled={!form.pole_id}
                onChange={e => setForm((p: any) => ({ ...p, niveau_id: e.target.value === '' ? null : Number(e.target.value) }))}
                style={{ width: '100%', padding: '10px 14px', border: '1.5px solid var(--border)', borderRadius: 10, fontSize: 14, background: 'var(--surface)', color: 'var(--text)', outline: 'none', boxSizing: 'border-box', opacity: form.pole_id ? 1 : .6 }}>
                <option value="">— Sélectionner —</option>
                {niveaux.filter(n => n.pole_id === form.pole_id).map(n => <option key={n.id} value={n.id}>{n.code} — {n.name}</option>)}
              </select>
            )}
          </div>
        </div>
        {inp('code', 'Code *', { placeholder: 'Ex: L1-SOCIO' })}
        {inp('name', 'Nom *', { placeholder: 'Ex: Licence Sociologie' })}
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

  /* ── Assistant pas-à-pas : contenu de l'étape courante ────────────────────── */
  function wizardStepBody() {
    const wInp = (key: string, label: string, opts?: { type?: string; placeholder?: string }) => (
      <div style={{ marginBottom: 10 }}>
        <label style={{ fontWeight: 600, fontSize: 12.5, marginBottom: 4, display: 'block' }}>{label}</label>
        <input type={opts?.type || 'text'} placeholder={opts?.placeholder}
          value={wizardForm[key] ?? (opts?.type === 'number' ? 0 : '')}
          onChange={e => setWizardForm((p: any) => ({ ...p, [key]: opts?.type === 'number' ? Number(e.target.value) : e.target.value }))}
          style={{ width: '100%', padding: '9px 12px', border: '1.5px solid var(--border)', borderRadius: 9, fontSize: 13.5, background: 'var(--surface)', color: 'var(--text)', boxSizing: 'border-box' }} />
      </div>
    )

    // Bloc générique "choisir un existant OU créer un nouveau" partagé par les
    // étapes Pôle/Niveau/Formation/Semestre/UE.
    function pickOrCreate(args: {
      existing: { id: number; label: string }[]
      onPick: (id: number) => void
      createFields: React.ReactNode
      onCreateSubmit: () => void
      createDisabled: boolean
      pickLabel: string
      createLabel: string
    }) {
      const { existing, onPick, createFields, onCreateSubmit, createDisabled, pickLabel, createLabel } = args
      return existing.length > 0 && !wizardCreatingNew ? (
        <div>
          <label style={{ fontWeight: 600, fontSize: 13, marginBottom: 6, display: 'block' }}>{pickLabel}</label>
          <select value="" onChange={e => e.target.value && onPick(Number(e.target.value))}
            style={{ width: '100%', padding: '10px 14px', border: '1.5px solid var(--border)', borderRadius: 10, fontSize: 14, background: 'var(--surface)', color: 'var(--text)', marginBottom: 10, boxSizing: 'border-box' }}>
            <option value="">— Sélectionner —</option>
            {existing.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
          <button type="button" onClick={() => { setWizardCreatingNew(true); setWizardForm({}) }}
            style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
            <i className="fas fa-plus" style={{ marginRight: 4 }} />{createLabel} à la place
          </button>
        </div>
      ) : (
        <div>
          {createFields}
          {existing.length > 0 && (
            <button type="button" onClick={() => setWizardCreatingNew(false)}
              style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', marginBottom: 12, display: 'block' }}>
              <i className="fas fa-arrow-left" style={{ marginRight: 4 }} />{pickLabel} à la place
            </button>
          )}
          <button onClick={onCreateSubmit} disabled={wizardBusy || createDisabled}
            style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: '#db2777', color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 700, opacity: createDisabled ? .5 : 1 }}>
            <i className={`fas ${wizardBusy ? 'fa-spinner fa-spin' : 'fa-check'}`} style={{ marginRight: 6 }} />
            {wizardBusy ? 'Création…' : `${createLabel} et continuer`}
          </button>
        </div>
      )
    }

    switch (wizardStep) {
      case 'pole':
        return pickOrCreate({
          existing: poles.map(p => ({ id: p.id, label: `${p.code} — ${p.name}` })),
          onPick: id => { setWizardCtx(c => ({ ...c, poleId: id })); setWizardStep('niveau'); setWizardCreatingNew(false); setWizardForm({}) },
          createFields: <>
            {wInp('code', 'Code *', { placeholder: 'Ex: STN' })}
            {wInp('name', 'Nom *', { placeholder: 'Ex: Sciences et Technologies du Numérique' })}
            {wInp('description', 'Description (optionnel)')}
          </>,
          onCreateSubmit: wizardCreatePole,
          createDisabled: !wizardForm.code || !wizardForm.name,
          pickLabel: 'Choisir un Pôle existant', createLabel: 'Créer un Pôle',
        })
      case 'niveau': {
        const opts = niveaux.filter(n => n.pole_id === wizardCtx.poleId)
        return pickOrCreate({
          existing: opts.map(n => ({ id: n.id, label: `${n.code} — ${n.name}` })),
          onPick: id => { setWizardCtx(c => ({ ...c, niveauId: id })); setWizardStep('formation'); setWizardCreatingNew(false); setWizardForm({}) },
          createFields: <>
            {wInp('code', 'Code *', { placeholder: 'Ex: L1' })}
            {wInp('name', 'Nom *', { placeholder: 'Ex: Licence 1' })}
            {wInp('description', 'Description (optionnel)')}
          </>,
          onCreateSubmit: wizardCreateNiveau,
          createDisabled: !wizardForm.code || !wizardForm.name,
          pickLabel: 'Choisir un Niveau existant (sous ce pôle)', createLabel: 'Créer un Niveau',
        })
      }
      case 'formation': {
        const opts = formations.filter(f => f.niveau_id === wizardCtx.niveauId)
        return pickOrCreate({
          existing: opts.map(f => ({ id: f.id, label: `${f.code} — ${f.name}` })),
          onPick: id => { setWizardCtx(c => ({ ...c, formationId: id })); setWizardStep('semester'); setWizardCreatingNew(true); setWizardForm({ number: 1, total_credits: 30 }) },
          createFields: <>
            {wInp('code', 'Code *', { placeholder: 'Ex: L1-SOCIO' })}
            {wInp('name', 'Nom *', { placeholder: 'Ex: Licence Sociologie' })}
            {wInp('department', 'Département (optionnel)')}
          </>,
          onCreateSubmit: wizardCreateFormation,
          createDisabled: !wizardForm.code || !wizardForm.name,
          pickLabel: 'Choisir une Formation existante (sous ce niveau)', createLabel: 'Créer une Formation',
        })
      }
      case 'semester': {
        const currentFormation = formations.find(f => f.id === wizardCtx.formationId)
        const opts = currentFormation?.semesters ?? []
        return pickOrCreate({
          existing: opts.map(s => ({ id: s.id, label: s.name || `Semestre ${s.number}` })),
          onPick: id => { setWizardCtx(c => ({ ...c, semesterId: id })); setExcelSemesterId(String(id)); setWizardStep('ue'); setWizardCreatingNew(true); setWizardUeMode('manual'); setWizardForm({ credits: 6, ue_type: 'obligatoire' }) },
          createFields: <>
            {wInp('number', 'Numéro *', { type: 'number', placeholder: 'Ex: 1' })}
            {wInp('name', 'Nom (optionnel)', { placeholder: 'Ex: Semestre 1' })}
            {wInp('total_credits', 'Crédits totaux', { type: 'number' })}
          </>,
          onCreateSubmit: wizardCreateSemester,
          createDisabled: !wizardForm.number,
          pickLabel: 'Choisir un Semestre existant (sous cette formation)', createLabel: 'Créer un Semestre',
        })
      }
      case 'ue': {
        const currentFormation = formations.find(f => f.id === wizardCtx.formationId)
        const currentSemester = currentFormation?.semesters.find(s => s.id === wizardCtx.semesterId)
        const opts = currentSemester?.ues ?? []
        return (
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <button type="button" onClick={() => { setWizardUeMode('manual'); setExcelPreview(null); setExcelFile(null) }}
                style={{ padding: '7px 14px', borderRadius: 8, border: wizardUeMode === 'manual' ? 'none' : '1.5px solid var(--border)', background: wizardUeMode === 'manual' ? '#db2777' : 'transparent', color: wizardUeMode === 'manual' ? 'white' : 'var(--text)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
                UE par UE (manuel)
              </button>
              <button type="button" onClick={() => setWizardUeMode('excel')}
                style={{ padding: '7px 14px', borderRadius: 8, border: wizardUeMode === 'excel' ? 'none' : '1.5px solid var(--border)', background: wizardUeMode === 'excel' ? '#0891b2' : 'transparent', color: wizardUeMode === 'excel' ? 'white' : 'var(--text)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
                <i className="fas fa-file-excel" style={{ marginRight: 6 }} />Importer via Excel (toutes les UE/EC)
              </button>
            </div>

            {wizardUeMode === 'excel' ? (
              !excelPreview ? (
                <div>
                  <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.6 }}>
                    Fichier au format réel de l&apos;établissement (colonnes Code/Nom/Crédit/Type UE puis Code/Nom/Coef EC, pourcentages CC/EX entre crochets dans le nom de l&apos;EC) — importe toutes les UE et EC de ce semestre d&apos;un coup.
                  </p>
                  <button onClick={downloadExcelTemplate}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 18px', borderRadius: 10, border: 'none', background: '#06b6d4', color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 700, marginBottom: 14 }}>
                    <i className="fas fa-download" /> Télécharger Template Excel
                  </button>
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ fontWeight: 600, fontSize: 12.5, marginBottom: 4, display: 'block' }}>Fichier Excel (.xlsx) *</label>
                    <input type="file" accept=".xlsx,.xls" style={{ width: '100%', fontSize: 13.5 }}
                      onChange={e => setExcelFile(e.target.files?.[0] || null)} />
                  </div>
                  <button onClick={handleExcelPreview} disabled={excelBusy || !excelFile}
                    style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: '#0891b2', color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 700, opacity: !excelFile ? .5 : 1 }}>
                    <i className={`fas ${excelBusy ? 'fa-spinner fa-spin' : 'fa-magnifying-glass'}`} style={{ marginRight: 7 }} />
                    {excelBusy ? 'Analyse…' : 'Analyser le fichier'}
                  </button>
                </div>
              ) : (
                <div>
                  <div style={{ background: '#ecfeff', border: '1px solid #a5f3fc', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 12.5, color: '#0e7490' }}>
                    <strong>{excelPreview.ue_count} UE</strong> et <strong>{excelPreview.ec_count} EC</strong> détectés — vérifiez avant de valider.
                  </div>
                  <div style={{ maxHeight: '32vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
                    {excelPreview.ues.map((u: any) => (
                      <div key={u.code} style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                        <div style={{ padding: '8px 12px', background: u.already_exists ? '#fef3c7' : '#f0fdf4', fontSize: 12.5 }}>
                          <strong>{u.code}</strong> — {u.name} <span style={{ color: 'var(--text-muted)' }}>({u.credits} crédits)</span>
                          {u.already_exists && <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: '#92400e' }}><i className="fas fa-triangle-exclamation" /> déjà existante</span>}
                        </div>
                        <div style={{ padding: '6px 12px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                          {u.ecs.map((e: any) => (
                            <div key={e.code} style={{ fontSize: 11.5, color: e.already_exists ? 'var(--text-muted)' : 'var(--text)' }}>
                              <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{e.code}</span> — {e.name} <span style={{ color: 'var(--text-muted)' }}>(Coef.{e.coefficient}, CC:{e.cc_percentage}%/EX:{e.ex_percentage}%)</span>
                              {e.already_exists && <span style={{ marginLeft: 6, fontWeight: 700, color: '#b45309' }}>ignoré</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={handleExcelConfirm} disabled={excelBusy}
                      style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: '#10b981', color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
                      <i className={`fas ${excelBusy ? 'fa-spinner fa-spin' : 'fa-check'}`} style={{ marginRight: 7 }} />
                      {excelBusy ? 'Import…' : "Confirmer l'import et terminer"}
                    </button>
                    <button onClick={() => setExcelPreview(null)}
                      style={{ padding: '10px 18px', borderRadius: 10, border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--text)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                      Revenir
                    </button>
                  </div>
                </div>
              )
            ) : pickOrCreate({
              existing: opts.map(u => ({ id: u.id, label: `${u.code} — ${u.name}` })),
              onPick: id => { setWizardCtx(c => ({ ...c, ueId: id })); setWizardStep('ec'); setWizardCreatingNew(true); setWizardForm({ cm: 0, td: 0, tp: 0, tpe: 0, vht: 0, coefficient: 1, cc_percentage: 40, ex_percentage: 60 }) },
              createFields: <>
                {wInp('code', 'Code *', { placeholder: 'Ex: SOCIO111' })}
                {wInp('name', 'Nom *', { placeholder: "Ex: Sociologie et Anthropologie" })}
                {wInp('credits', 'Crédits', { type: 'number' })}
              </>,
              onCreateSubmit: wizardCreateUe,
              createDisabled: !wizardForm.code || !wizardForm.name,
              pickLabel: 'Choisir une UE existante (sous ce semestre)', createLabel: 'Créer une UE',
            })}
          </div>
        )
      }
      case 'ec': {
        const currentFormation = formations.find(f => f.id === wizardCtx.formationId)
        const currentSemester = currentFormation?.semesters.find(s => s.id === wizardCtx.semesterId)
        const currentUe = currentSemester?.ues.find(u => u.id === wizardCtx.ueId)
        return (
          <div>
            {wizardEcCount > 0 && (
              <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 12.5, color: '#166534' }}>
                <i className="fas fa-check-circle" style={{ marginRight: 6 }} />{wizardEcCount} EC déjà créé(s) sous {currentUe?.code}
              </div>
            )}
            {wInp('code', 'Code *', { placeholder: 'Ex: SOCIO1111' })}
            {wInp('name', 'Nom *', { placeholder: "Ex: Introduction à la sociologie" })}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 10 }}>
              {wInp('cm', 'CM (h)', { type: 'number' })}
              {wInp('td', 'TD (h)', { type: 'number' })}
              {wInp('tp', 'TP (h)', { type: 'number' })}
              {wInp('tpe', 'TPE (h)', { type: 'number' })}
              {wInp('vht', 'VHT (h)', { type: 'number' })}
              {wInp('coefficient', 'Coefficient', { type: 'number' })}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
              {wInp('cc_percentage', 'CC % (contrôle continu)', { type: 'number' })}
              {wInp('ex_percentage', 'EX % (examen final)', { type: 'number' })}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              <button onClick={() => wizardCreateEc('another_ec')} disabled={wizardBusy || !wizardForm.code || !wizardForm.name}
                style={{ padding: '10px 16px', borderRadius: 10, border: 'none', background: '#db2777', color: 'white', cursor: 'pointer', fontSize: 12.5, fontWeight: 700, opacity: (!wizardForm.code || !wizardForm.name) ? .5 : 1 }}>
                <i className="fas fa-plus" style={{ marginRight: 6 }} />Créer et ajouter un autre EC
              </button>
              <button onClick={() => wizardCreateEc('another_ue')} disabled={wizardBusy || !wizardForm.code || !wizardForm.name}
                style={{ padding: '10px 16px', borderRadius: 10, border: '1.5px solid #db2777', background: 'transparent', color: '#db2777', cursor: 'pointer', fontSize: 12.5, fontWeight: 700, opacity: (!wizardForm.code || !wizardForm.name) ? .5 : 1 }}>
                Créer et ajouter une autre UE
              </button>
              <button onClick={() => wizardCreateEc('done')} disabled={wizardBusy || !wizardForm.code || !wizardForm.name}
                style={{ padding: '10px 16px', borderRadius: 10, border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--text)', cursor: 'pointer', fontSize: 12.5, fontWeight: 700, opacity: (!wizardForm.code || !wizardForm.name) ? .5 : 1 }}>
                Créer et terminer
              </button>
            </div>
          </div>
        )
      }
      default: return null
    }
  }

  function modalTitle() {
    if (!modal) return ''
    const isCreate = modal.kind.startsWith('create')
    const labels: Record<string, string> = { pole: 'un Pôle', niveau: 'un Niveau', formation: 'une Formation', semester: 'un Semestre', ue: 'une UE', ec: 'un EC' }
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
        case 'edit_pole':        endpoint = `/api/admin/poles/${modal.item.id}`; method = 'PUT'; break
        case 'edit_niveau':      endpoint = `/api/admin/niveaux/${modal.item.id}`; method = 'PUT'; break
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

  async function deletePole(id: number, code: string) {
    if (!confirm(`Supprimer définitivement le pôle ${code} et tous ses niveaux ?\n\nLes formations qui en dépendaient seront conservées (juste détachées, à retrouver sous "Formations sans niveau").`)) return
    try { await api.delete(`/api/admin/poles/${id}`); success('Pôle et ses niveaux supprimés'); load() }
    catch (e: any) { error(e.message || 'Erreur') }
  }

  /* ── Niveau creation inline ───────────────────────────────────────────────── */
  async function createNiveau(poleId: number) {
    if (!niveauForm.code || !niveauForm.name) { error('Code et nom requis'); return }
    setNiveauSubmitting(true)
    try {
      await api.post('/api/admin/niveaux', { ...niveauForm, pole_id: poleId })
      success(`Niveau ${niveauForm.code} créé`)
      setNiveauForm({ code: '', name: '', description: '' })
      setQuickNiveauPoleId(null)
      loadNiveaux()
      load()
    } catch (e: any) { error(e.message || 'Erreur') }
    finally { setNiveauSubmitting(false) }
  }

  async function deleteNiveau(id: number, code: string) {
    if (!confirm(`Supprimer définitivement le niveau ${code} ?\n\nLes formations qui en dépendaient seront conservées (juste détachées, à retrouver sous "Formations sans niveau").`)) return
    try { await api.delete(`/api/admin/niveaux/${id}`); success('Niveau supprimé'); load() }
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
    setInlineNiveauOpen(false); setInlineNiveauForm({ code: '', name: '', description: '' })
  }

  function openEdit(kind: ModalKind, item: any) {
    setForm({ ...item }); setModal({ kind, item })
    setInlinePoleOpen(false); setInlinePoleForm({ code: '', name: '', description: '' })
    setInlineNiveauOpen(false); setInlineNiveauForm({ code: '', name: '', description: '' })
  }

  /* ── Carte Formation (avec ses Semestres/UE/EC) — imbriquée sous son Niveau ── */
  function renderFormationCard(f: Formation) {
    return (
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
    )
  }

  const formationsSansNiveau = formations.filter(f => !f.niveau_id)

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
          Gérez la hiérarchie : <strong>Pôle → Niveau → Formation → Semestre → UE → EC</strong>
        </p>
      </div>

      {/* ══ Section unique : Pôle → Niveau → Formation → Semestre → UE → EC ═══════ */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <i className="fas fa-sitemap" style={{ color: '#2563eb' }} /> Pôles, Niveaux &amp; Formations UNCHK
          </h3>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={openWizard}
              title="Créer pas-à-pas : Pôle → Niveau → Formation → Semestre → UE → EC"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 18px', borderRadius: 10, border: 'none', background: '#db2777', color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
              <i className="fas fa-shoe-prints" /> Créer la hiérarchie (pas-à-pas)
            </button>
            <button onClick={() => { setModal({ kind: 'import_csv' }); setCsvFile(null); setImportResult(null) }}
              title="Import en masse — crée aussi le Pôle et le Niveau à la volée s'ils n'existent pas encore"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 18px', borderRadius: 10, border: 'none', background: '#10b981', color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
              <i className="fas fa-file-csv" /> Import CSV
            </button>
          </div>
        </div>

        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 48 }}>
              <i className="fas fa-spinner fa-spin" style={{ fontSize: 32, color: 'var(--primary)' }} />
            </div>
          ) : (
            <>
              {poles.length === 0 && formationsSansNiveau.length === 0 && (
                <div style={{ textAlign: 'center', padding: '24px 20px', color: 'var(--text-muted)' }}>
                  <i className="fas fa-inbox" style={{ fontSize: 32, display: 'block', marginBottom: 10 }} />
                  Aucun pôle créé — cliquez &quot;Créer la hiérarchie (pas-à-pas)&quot; en haut pour commencer
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 18, alignItems: 'start' }}>
              {poles.map(p => {
                const pnv = niveaux.filter(n => n.pole_id === p.id)
                return (
                  <div key={p.id} style={{ border: `1.5px solid ${poleColor(p.code)}40`, borderRadius: 14, overflow: 'hidden' }}>
                    {/* En-tête pôle */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: poleColor(p.code) + '18', padding: '12px 18px' }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: poleColor(p.code) }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 800, fontSize: 14, color: poleColor(p.code) }}>Pôle {p.code} — {p.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.formations_count} formation(s) · {pnv.length} niveau(x)</div>
                      </div>
                      <button onClick={() => openEdit('edit_pole', p)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: poleColor(p.code), fontSize: 13, padding: 2, marginRight: 4 }} title="Modifier le pôle">
                        <i className="fas fa-pen" />
                      </button>
                      <button onClick={() => deletePole(p.id, p.code)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 13, padding: 2 }} title="Supprimer le pôle et ses niveaux">
                        <i className="fas fa-times" />
                      </button>
                    </div>

                    {/* Niveaux imbriqués sous ce pôle, chacun avec ses formations imbriquées */}
                    <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                      {pnv.length === 0 && quickNiveauPoleId !== p.id && (
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Aucun niveau sous ce pôle</span>
                      )}
                      {pnv.map(n => {
                        const nf = formations.filter(f => f.niveau_id === n.id)
                        return (
                          <div key={n.id} style={{ border: '1px solid #0d948840', borderRadius: 12, overflow: 'hidden' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#0d948812', padding: '10px 16px' }}>
                              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#0d9488' }} />
                              <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 800, fontSize: 12.5, color: '#0d9488' }}>Niveau {n.code} — {n.name}</div>
                                <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{nf.length} formation(s)</div>
                              </div>
                              <button onClick={() => openEdit('edit_niveau', n)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0d9488', fontSize: 12, padding: 2 }} title="Modifier">
                                <i className="fas fa-pen" />
                              </button>
                              <button onClick={() => deleteNiveau(n.id, n.code)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 12, padding: 2 }} title="Supprimer">
                                <i className="fas fa-times" />
                              </button>
                            </div>
                            <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                              {nf.length === 0 ? (
                                <p style={{ color: 'var(--text-muted)', fontSize: 12.5, margin: 0 }}>
                                  Aucune formation sous ce niveau — cliquez &quot;Créer la hiérarchie (pas-à-pas)&quot; en haut
                                </p>
                              ) : nf.map(f => renderFormationCard(f))}
                            </div>
                          </div>
                        )
                      })}
                      {quickNiveauPoleId === p.id ? (
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <input placeholder="Code (ex: L1)" autoFocus value={niveauForm.code}
                            onChange={e => setNiveauForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                            style={{ width: 90, padding: '6px 10px', border: '1.5px solid var(--border)', borderRadius: 7, fontSize: 12, background: 'var(--surface)', color: 'var(--text)' }} />
                          <input placeholder="Nom (ex: Licence 1)" value={niveauForm.name}
                            onChange={e => setNiveauForm(f => ({ ...f, name: e.target.value }))}
                            style={{ width: 150, padding: '6px 10px', border: '1.5px solid var(--border)', borderRadius: 7, fontSize: 12, background: 'var(--surface)', color: 'var(--text)' }} />
                          <button onClick={() => createNiveau(p.id)} disabled={niveauSubmitting || !niveauForm.code || !niveauForm.name}
                            style={{ padding: '6px 12px', borderRadius: 7, border: 'none', background: '#0d9488', color: 'white', cursor: 'pointer', fontSize: 12, fontWeight: 700, opacity: (!niveauForm.code || !niveauForm.name) ? .5 : 1 }}>
                            <i className={`fas ${niveauSubmitting ? 'fa-spinner fa-spin' : 'fa-check'}`} />
                          </button>
                          <button onClick={() => { setQuickNiveauPoleId(null); setNiveauForm({ code: '', name: '', description: '' }) }}
                            style={{ padding: '6px 10px', borderRadius: 7, border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--text)', cursor: 'pointer', fontSize: 12 }}>
                            <i className="fas fa-xmark" />
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => { setQuickNiveauPoleId(p.id); setNiveauForm({ code: '', name: '', description: '' }) }}
                          style={{ alignSelf: 'flex-start', background: 'none', border: '1.5px dashed #0d948870', borderRadius: 8, padding: '6px 12px', color: '#0d9488', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                          <i className="fas fa-plus" style={{ marginRight: 5 }} />Niveau
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
              </div>

              {/* Niveaux orphelins (sans pôle) — cas hérité, à corriger via modification */}
              {niveaux.some(n => !n.pole_id) && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>Niveaux sans pôle</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {niveaux.filter(n => !n.pole_id).map(n => {
                      const nf = formations.filter(f => f.niveau_id === n.id)
                      return (
                        <div key={n.id} style={{ border: '1px solid #cbd5e1', borderRadius: 12, overflow: 'hidden' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f1f5f9', padding: '10px 16px' }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 800, fontSize: 12.5 }}>{n.code} — {n.name}</div>
                              <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{nf.length} formation(s)</div>
                            </div>
                            <button onClick={() => openEdit('edit_niveau', n)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0d9488', fontSize: 12, padding: 2 }} title="Modifier">
                              <i className="fas fa-pen" />
                            </button>
                            <button onClick={() => deleteNiveau(n.id, n.code)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 12, padding: 2 }} title="Supprimer">
                              <i className="fas fa-times" />
                            </button>
                          </div>
                          {nf.length > 0 && (
                            <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                              {nf.map(f => renderFormationCard(f))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Formations sans niveau (à rattacher via "Modifier") */}
              {formationsSansNiveau.length > 0 && (
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#b45309', marginBottom: 10 }}>
                    <i className="fas fa-triangle-exclamation" style={{ marginRight: 6 }} />
                    Formations sans niveau ({formationsSansNiveau.length}) — à rattacher via &quot;Modifier&quot;
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {formationsSansNiveau.map(f => renderFormationCard(f))}
                  </div>
                </div>
              )}
            </>
          )}
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
              <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
                Importez toute la hiérarchie Pôle → Niveau → Formation → Semestre → UE → EC via CSV
              </p>
            </div>
          </div>

          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '12px 16px', marginBottom: 18, fontSize: 13 }}>
            <strong style={{ color: '#1d4ed8' }}>Instructions :</strong>
            <ol style={{ margin: '8px 0 0 18px', color: '#1e40af', lineHeight: 1.9 }}>
              <li>Téléchargez le template CSV</li>
              <li>Remplissez ligne par ligne : Pôle, Niveau, Formation, Semestre, UE, EC</li>
              <li>Un Pôle ou Niveau qui n&apos;existe pas encore (code + nom renseignés) est créé automatiquement à l&apos;import — inutile de le créer à part avant</li>
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


      {/* ══ Assistant pas-à-pas Pôle → Niveau → Formation → Semestre → UE → EC ═══ */}
      {modal?.kind === 'wizard' && (
        <ModalOverlay onClose={() => setModal(null)} wide>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
            <div style={{ width: 42, height: 42, borderRadius: 11, background: '#fdf2f8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fas fa-shoe-prints" style={{ color: '#db2777', fontSize: 17 }} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Créer la hiérarchie pas-à-pas</h3>
              <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>À chaque étape : choisissez un existant ou créez-en un nouveau</p>
            </div>
          </div>

          {/* Fil d'ariane des étapes */}
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
            {WIZARD_STEPS.map((s, i) => {
              const currentIdx = WIZARD_STEPS.indexOf(wizardStep)
              const state = i < currentIdx ? 'done' : i === currentIdx ? 'current' : 'pending'
              return (
                <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{
                    fontSize: 12.5, fontWeight: 800, padding: '4px 10px', borderRadius: 20,
                    background: state === 'current' ? '#db2777' : state === 'done' ? '#fce7f3' : 'var(--border)',
                    color: state === 'current' ? 'white' : state === 'done' ? '#db2777' : 'var(--text-muted)',
                  }}>
                    {state === 'done' && <i className="fas fa-check" style={{ marginRight: 4 }} />}
                    {WIZARD_LABELS[s]}
                  </span>
                  {i < WIZARD_STEPS.length - 1 && <i className="fas fa-arrow-right" style={{ fontSize: 10, color: 'var(--text-muted)' }} />}
                </div>
              )
            })}
          </div>

          {wizardStepBody()}

          <div style={{ display: 'flex', gap: 10, marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
            {wizardCtx.poleId && wizardStep !== 'ec' && (
              <button onClick={() => { success('Hiérarchie enregistrée jusqu\'ici'); setModal(null); load() }}
                style={{ padding: '10px 18px', borderRadius: 10, border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--text)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                Terminer ici
              </button>
            )}
            <button onClick={() => setModal(null)}
              style={{ padding: '10px 18px', borderRadius: 10, border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--text)', cursor: 'pointer', fontSize: 13, fontWeight: 600, marginLeft: 'auto' }}>
              Annuler
            </button>
          </div>
        </ModalOverlay>
      )}
    </div>
  )
}
