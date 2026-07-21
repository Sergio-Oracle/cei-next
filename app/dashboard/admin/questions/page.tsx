'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'

interface Question {
  id: number
  title: string
  content: string
  rubric?: string
  question_type: string
  bloom_level?: string
  ec_id?: number;  ec_code?: string;  ec_name?: string
  ue_id?: number;  ue_code?: string;  ue_name?: string
  semester_id?: number; semester_number?: number
  formation_id?: number; formation_name?: string; formation_level?: string
  pole_id?: number; pole_code?: string; pole_name?: string
  created_by?: string; created_by_id?: number
  created_at?: string; updated_at?: string
  tags: string[]
  status: 'active' | 'hidden'
}

interface ECOpt { id: number; name: string; code?: string }
interface DupPair { q1: { id: number; title: string }; q2: { id: number; title: string }; similarity: number }

const TYPE_LABEL: Record<string, string> = {
  open:        'Ouvert',
  qcm:         'QCU',
  qcm_multi:   'QCM',
  vf:          'Vrai/Faux',
  subopen:     'Semi-ouvert',
  appariement: 'Appariement',
  code:        'Maths / Code',
}
const TYPE_STYLE: Record<string, { bg: string; color: string }> = {
  open:        { bg: '#f1f5f9', color: '#475569' },
  qcm:         { bg: '#dbeafe', color: '#1d4ed8' },
  qcm_multi:   { bg: '#f0fdfa', color: '#0d9488' },
  vf:          { bg: '#dcfce7', color: '#15803d' },
  subopen:     { bg: '#fff7ed', color: '#c2410c' },
  appariement: { bg: '#fdf2f8', color: '#be185d' },
  code:        { bg: '#fff7ed', color: '#c2410c' },
}

const POLE_COLORS: Record<string, string> = { STN: '#2563eb', LSHE: '#10b981', SEJA: '#f59e0b', RTN: '#0891b2' }
const poleColor = (code?: string | null) => POLE_COLORS[code || ''] || '#64748b'

const selStyle = { padding: '8px 11px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 12, background: 'var(--background)', color: 'var(--text)', outline: 'none', width: '100%' }

export default function AdminQuestionsPage() {
  const { success, error: toastErr } = useToast()
  const router = useRouter()

  const [questions,  setQuestions]  = useState<Question[]>([])
  const [loading,    setLoading]    = useState(true)
  const [selected,   setSelected]   = useState<Set<number>>(new Set())
  const [preview,    setPreview]    = useState<Question | null>(null)
  const [dupPairs,   setDupPairs]   = useState<DupPair[] | null>(null)
  const [dupLoading, setDupLoading] = useState(false)
  const [assembleModal, setAssembleModal] = useState(false)
  const [ecs, setEcs] = useState<ECOpt[]>([])

  // Cascade filters
  const [filterPole,   setFilterPole]   = useState('')
  const [filterForm,   setFilterForm]   = useState('')
  const [filterSem,    setFilterSem]    = useState('')
  const [filterUe,     setFilterUe]     = useState('')
  const [filterEc,     setFilterEc]     = useState('')
  const [filterType,   setFilterType]   = useState('')
  const [filterTag,    setFilterTag]    = useState('')
  const [filterSearch, setFilterSearch] = useState('')
  const [showHidden,   setShowHidden]   = useState(false)

  // Édition / duplication / déplacement / suppression groupée — parité Moodle
  const [editQ,      setEditQ]      = useState<Question | null>(null)
  const [editForm,    setEditForm]   = useState({ title: '', content: '', rubric: '', question_type: 'open', bloom_level: '', ec_id: '', tags: '' })
  const [savingEdit,  setSavingEdit] = useState(false)
  const [busyIds,      setBusyIds]     = useState<Set<number>>(new Set())
  const [moveModal,    setMoveModal]   = useState(false)
  const [moveEcId,     setMoveEcId]    = useState('')
  const [moving,        setMoving]      = useState(false)
  const [bulkDeleting,  setBulkDeleting] = useState(false)

  // Assemblage
  const [aTitle,    setATitle]    = useState('Examen Assemblé')
  const [aDuration, setADuration] = useState(60)
  const [aLevel,    setALevel]    = useState('Licence 3')
  const [aEcId,     setAEcId]     = useState('')
  const [assembling, setAssembling] = useState(false)

  function load() {
    setLoading(true)
    api.get<Question[]>('/api/question_bank')
      .then(r => setQuestions(Array.isArray(r) ? r : []))
      .catch(() => setQuestions([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    api.get<any>('/api/ecs').then(r => setEcs(Array.isArray(r) ? r : r.ecs ?? [])).catch(() => {})
  }, [])

  function toggle(id: number) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function selectAll()  { setSelected(new Set(filtered.map(q => q.id))) }
  function clearAll()   { setSelected(new Set()) }

  async function checkDuplicates() {
    setDupLoading(true)
    try {
      const res = await api.get<{ duplicates: DupPair[]; count: number }>('/api/question_bank/duplicates')
      if ((res.count ?? 0) === 0) {
        setDupPairs([])
        success('Aucun doublon détecté dans la banque')
      } else {
        // Suppression automatique : on garde la question la plus ancienne de
        // chaque paire ≥95% similaire, la plus récente est retirée.
        const clean = await api.post<{ deleted_count: number; deleted: { id: number; title: string }[] }>(
          '/api/question_bank/duplicates/auto-clean'
        )
        setDupPairs([])
        success(`${clean.deleted_count} doublon(s) supprimé(s) automatiquement (question la plus récente de chaque paire ≥95% similaire retirée)`)
        await load()
      }
    } catch { toastErr('Erreur lors de la vérification des doublons') }
    finally { setDupLoading(false) }
  }

  async function deleteQ(id: number) {
    if (!confirm('Supprimer cette question de la banque ?')) return
    try {
      await api.delete(`/api/question_bank/${id}`)
      success('Question supprimée')
      setSelected(prev => { const n = new Set(prev); n.delete(id); return n })
      load()
    } catch { toastErr('Erreur lors de la suppression') }
  }

  /* ── Édition en place ── */
  function openEdit(q: Question) {
    setEditQ(q)
    setEditForm({
      title: q.title, content: q.content, rubric: q.rubric || '',
      question_type: q.question_type, bloom_level: q.bloom_level || '',
      ec_id: q.ec_id ? String(q.ec_id) : '', tags: (q.tags || []).join(', '),
    })
  }
  async function saveEdit() {
    if (!editQ) return
    if (!editForm.title.trim() || !editForm.content.trim()) { toastErr('Titre et contenu requis'); return }
    setSavingEdit(true)
    try {
      await api.put(`/api/question_bank/${editQ.id}`, {
        title: editForm.title.trim(), content: editForm.content.trim(), rubric: editForm.rubric,
        question_type: editForm.question_type, bloom_level: editForm.bloom_level,
        ec_id: editForm.ec_id ? Number(editForm.ec_id) : null,
        tags: editForm.tags.split(',').map(t => t.trim()).filter(Boolean),
      })
      success('Question mise à jour')
      setEditQ(null)
      load()
    } catch (e: any) { toastErr(e.message || 'Erreur lors de la mise à jour') }
    finally { setSavingEdit(false) }
  }

  /* ── Duplication ── */
  async function duplicateQ(id: number) {
    setBusyIds(prev => new Set(prev).add(id))
    try {
      await api.post(`/api/question_bank/${id}/duplicate`)
      success('Question dupliquée')
      load()
    } catch (e: any) { toastErr(e.message || 'Erreur lors de la duplication') }
    finally { setBusyIds(prev => { const n = new Set(prev); n.delete(id); return n }) }
  }

  /* ── Masquer / réactiver (retrait de la sélection sans suppression) ── */
  async function toggleStatus(q: Question) {
    setBusyIds(prev => new Set(prev).add(q.id))
    try {
      const newStatus = q.status === 'hidden' ? 'active' : 'hidden'
      await api.put(`/api/question_bank/${q.id}`, { status: newStatus })
      success(newStatus === 'hidden' ? 'Question masquée' : 'Question réactivée')
      load()
    } catch (e: any) { toastErr(e.message || 'Erreur') }
    finally { setBusyIds(prev => { const n = new Set(prev); n.delete(q.id); return n }) }
  }

  /* ── Déplacement groupé vers un autre EC ── */
  async function doBulkMove() {
    const ids = [...selected]
    if (!ids.length) return
    setMoving(true)
    try {
      const res = await api.post<{ moved: number; skipped: number }>('/api/question_bank/bulk_move', {
        question_ids: ids, ec_id: moveEcId ? Number(moveEcId) : null,
      })
      success(`${res.moved} question(s) déplacée(s)${res.skipped ? ` (${res.skipped} ignorée(s))` : ''}`)
      setMoveModal(false); setMoveEcId(''); setSelected(new Set())
      load()
    } catch (e: any) { toastErr(e.message || 'Erreur lors du déplacement') }
    finally { setMoving(false) }
  }

  /* ── Suppression groupée ── */
  async function bulkDelete() {
    const ids = [...selected]
    if (!ids.length) return
    if (!confirm(`Supprimer définitivement ${ids.length} question(s) de la banque ?`)) return
    setBulkDeleting(true)
    try {
      const res = await api.post<{ deleted: number; skipped: number }>('/api/question_bank/bulk_delete', { question_ids: ids })
      success(`${res.deleted} question(s) supprimée(s)${res.skipped ? ` (${res.skipped} ignorée(s))` : ''}`)
      setSelected(new Set())
      load()
    } catch (e: any) { toastErr(e.message || 'Erreur lors de la suppression groupée') }
    finally { setBulkDeleting(false) }
  }

  async function assemble() {
    if (!aTitle.trim()) { toastErr('Veuillez saisir un titre'); return }
    const ids = [...selected]
    if (!ids.length) { toastErr('Aucune question sélectionnée'); return }
    setAssembling(true)
    try {
      await api.post('/api/question_bank/assemble', {
        question_ids:  ids,
        title:         aTitle.trim(),
        duration:      aDuration,
        student_level: aLevel,
        ec_id:         aEcId ? Number(aEcId) : null,
      })
      success(`Sujet "${aTitle}" créé avec ${ids.length} question(s)`)
      setAssembleModal(false)
      setSelected(new Set())
      setTimeout(() => router.push('/dashboard/admin/subjects'), 1200)
    } catch (e: any) {
      toastErr(e.message || 'Erreur lors de la création du sujet')
    } finally { setAssembling(false) }
  }

  /* ── Cascade options derived from questions list ────────────────────────── */
  const availPoles = Array.from(new Map(
    questions.filter(q => q.pole_id).map(q => [q.pole_id, { id: q.pole_id!, code: q.pole_code!, name: q.pole_name! }])
  ).values())

  const availForms = Array.from(new Map(
    questions.filter(q => q.formation_id && (!filterPole || String(q.pole_id) === filterPole))
      .map(q => [q.formation_id, { id: q.formation_id!, name: q.formation_name! }])
  ).values())

  const availSems = Array.from(new Map(
    questions.filter(q => q.semester_id && (!filterForm || String(q.formation_id) === filterForm))
      .map(q => [q.semester_id, { id: q.semester_id!, number: q.semester_number! }])
  ).values()).sort((a, b) => a.number - b.number)

  const availUes = Array.from(new Map(
    questions.filter(q => q.ue_id && (!filterSem || String(q.semester_id) === filterSem))
      .map(q => [q.ue_id, { id: q.ue_id!, code: q.ue_code!, name: q.ue_name! }])
  ).values())

  const availEcs = Array.from(new Map(
    questions.filter(q => q.ec_id && (!filterUe || String(q.ue_id) === filterUe))
      .map(q => [q.ec_id, { id: q.ec_id!, code: q.ec_code!, name: q.ec_name! }])
  ).values())

  const availTags = Array.from(new Set(questions.flatMap(q => q.tags || []))).sort()
  const hiddenCount = questions.filter(q => q.status === 'hidden').length

  /* ── Filtered questions ─────────────────────────────────────────────────── */
  // Parité Moodle : une question sans EC (équivalent contexte "Système") est
  // héritée dans TOUS les filtres hiérarchiques au lieu d'être masquée dès
  // qu'un Pôle/Formation/UE/EC précis est sélectionné — c'est le principe
  // même de Moodle (une catégorie créée au niveau Système reste visible
  // depuis n'importe quel cours/module en dessous).
  const filtered = questions.filter(q => {
    if (!showHidden && q.status === 'hidden')                     return false
    if (q.ec_id != null) {
      if (filterPole   && String(q.pole_id)       !== filterPole)   return false
      if (filterForm   && String(q.formation_id)  !== filterForm)   return false
      if (filterSem    && String(q.semester_id)   !== filterSem)    return false
      if (filterUe     && String(q.ue_id)         !== filterUe)     return false
      if (filterEc     && String(q.ec_id)         !== filterEc)     return false
    }
    if (filterType   && q.question_type         !== filterType)   return false
    if (filterTag     && !(q.tags || []).includes(filterTag))      return false
    if (filterSearch && !`${q.title} ${q.content}`.toLowerCase().includes(filterSearch.toLowerCase())) return false
    return true
  })

  const hasFilter = filterPole || filterForm || filterSem || filterUe || filterEc || filterType || filterTag || filterSearch

  const typeSt    = (t: string) => TYPE_STYLE[t] ?? TYPE_STYLE.open
  const typeLabel = (t: string) => TYPE_LABEL[t] ?? t ?? 'Ouvert'

  function resetFilters() {
    setFilterPole(''); setFilterForm(''); setFilterSem(''); setFilterUe(''); setFilterEc(''); setFilterType(''); setFilterTag(''); setFilterSearch('')
  }

  /* ── PREVIEW MODAL ─────────────────────────────────────── */
  if (preview) return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div className="card" style={{ width: '100%', maxWidth: 600, maxHeight: '85vh', overflowY: 'auto', padding: 28 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16, gap: 12 }}>
          <h3 style={{ margin: 0, fontSize: 17 }}>{preview.title}</h3>
          <button className="btn btn-secondary btn-sm" onClick={() => setPreview(null)}><i className="fas fa-times" /></button>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          <span style={{ ...typeSt(preview.question_type), padding: '2px 10px', borderRadius: 99, fontSize: 12, fontWeight: 700 }}>
            {typeLabel(preview.question_type)}
          </span>
          {preview.bloom_level && <span className="status-badge secondary" style={{ fontSize: 12 }}>{preview.bloom_level}</span>}
          {preview.pole_code && (
            <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 12, fontWeight: 700, background: poleColor(preview.pole_code) + '20', color: poleColor(preview.pole_code) }}>
              Pôle {preview.pole_code}
            </span>
          )}
          {preview.formation_name && <span className="status-badge secondary" style={{ fontSize: 11 }}>{preview.formation_name}</span>}
          {preview.ue_code && <span className="status-badge secondary" style={{ fontSize: 11 }}>UE {preview.ue_code}</span>}
          {preview.ec_name && <span className="status-badge secondary" style={{ fontSize: 11 }}><i className="fas fa-book" /> {preview.ec_name}</span>}
          {preview.status === 'hidden' && <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: '#f1f5f9', color: '#64748b' }}><i className="fas fa-eye-slash" style={{ marginRight: 3 }} />Masquée</span>}
        </div>
        {preview.tags && preview.tags.length > 0 && (
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 14 }}>
            {preview.tags.map(t => (
              <span key={t} style={{ fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 99, background: '#f5f3ff', color: '#7c3aed' }}>
                <i className="fas fa-hashtag" style={{ fontSize: 9, marginRight: 3 }} />{t}
              </span>
            ))}
          </div>
        )}
        <pre style={{ background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 8, padding: 14, fontSize: 13, whiteSpace: 'pre-wrap', lineHeight: 1.7, maxHeight: 280, overflowY: 'auto' }}>
          {preview.content}
        </pre>
        {preview.rubric && (<>
          <h4 style={{ margin: '16px 0 8px', fontSize: 14 }}>
            <i className="fas fa-clipboard-list" style={{ color: '#10b981', marginRight: 6 }} />Barème
          </h4>
          <pre style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: 14, fontSize: 12, whiteSpace: 'pre-wrap', lineHeight: 1.7, maxHeight: 200, overflowY: 'auto' }}>
            {preview.rubric}
          </pre>
        </>)}
        <p style={{ margin: '14px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>
          <i className="fas fa-user" style={{ marginRight: 4 }} />Créée par {preview.created_by || '—'}
          {preview.created_at && <> le {new Date(preview.created_at).toLocaleDateString('fr-FR')}</>}
          {preview.updated_at && preview.updated_at !== preview.created_at && (
            <> · modifiée le {new Date(preview.updated_at).toLocaleDateString('fr-FR')}</>
          )}
        </p>
        <div style={{ textAlign: 'right', marginTop: 16 }}>
          <button className="btn btn-secondary" onClick={() => setPreview(null)}>Fermer</button>
        </div>
      </div>
    </div>
  )

  /* ── ASSEMBLE MODAL ─────────────────────────────────────── */
  if (assembleModal) {
    const selQuestions = questions.filter(q => selected.has(q.id))
    const uniqueEcIds = [...new Map(
      selQuestions.filter(q => q.ec_id).map(q => [q.ec_id, { id: q.ec_id!, name: q.ec_name! }])
    ).values()]
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div className="card" style={{ width: '100%', maxWidth: 580, maxHeight: '90vh', overflowY: 'auto', padding: 28 }}>
          <h3 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 700 }}>
            <i className="fas fa-layer-group" style={{ color: '#2563eb', marginRight: 8 }} />
            Créer un sujet à partir de {selected.size} question{selected.size > 1 ? 's' : ''}
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Titre de l&apos;examen *</label>
              <input className="form-control" value={aTitle} onChange={e => setATitle(e.target.value)} placeholder="Ex : Examen de Réseaux S1 2025" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Durée (minutes)</label>
                <input className="form-control" type="number" min={15} max={360} value={aDuration} onChange={e => setADuration(Number(e.target.value))} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Niveau</label>
                <select className="form-control" value={aLevel} onChange={e => setALevel(e.target.value)}>
                  {['Licence 1','Licence 2','Licence 3','Master 1','Master 2','Doctorat'].map(l => <option key={l}>{l}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Élément Constitutif (EC)</label>
              <select className="form-control" value={aEcId} onChange={e => setAEcId(e.target.value)}>
                <option value="">— Aucun EC spécifique —</option>
                {(uniqueEcIds.length ? uniqueEcIds : ecs).map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
            <div style={{ background: 'var(--background)', borderRadius: 8, padding: 12, maxHeight: 160, overflowY: 'auto' }}>
              <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Questions sélectionnées :</p>
              {selQuestions.map((q, i) => {
                const st = typeSt(q.question_type)
                return (
                  <div key={q.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ ...st, fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 99, flexShrink: 0 }}>{typeLabel(q.question_type)}</span>
                    <span style={{ fontSize: 13 }}>{i + 1}. {q.title}</span>
                  </div>
                )
              })}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={() => setAssembleModal(false)}>Annuler</button>
            <button className="btn btn-primary" onClick={assemble} disabled={assembling}>
              <i className={`fas ${assembling ? 'fa-spinner fa-spin' : 'fa-layer-group'}`} />
              {assembling ? 'Création…' : 'Créer le sujet'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  /* ── PAGE PRINCIPALE ─────────────────────────────────────── */
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* En-tête */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <i className="fas fa-database" style={{ color: '#2563eb' }} />
            Banque de Questions
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
            {filtered.length} / {questions.length} question(s) — cochez pour assembler un sujet
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={checkDuplicates} disabled={dupLoading || questions.length === 0}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', border: '1.5px solid #f59e0b', background: dupPairs && dupPairs.length > 0 ? '#fef3c7' : '#fffbeb', color: '#92400e', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: questions.length === 0 ? 'not-allowed' : 'pointer' }}>
            <i className={`fas ${dupLoading ? 'fa-spinner fa-spin' : 'fa-clone'}`} />
            {dupLoading ? 'Analyse…' : dupPairs !== null ? `${dupPairs.length} doublon${dupPairs.length !== 1 ? 's' : ''}` : 'Vérifier doublons'}
          </button>
          {filtered.length > 0 && (
            <button className="btn btn-secondary" onClick={selectAll}>
              <i className="fas fa-check-square" /> Tout sélectionner ({filtered.length})
            </button>
          )}
        </div>
      </div>

      {/* ── Sélecteur cascade Pôle → Formation → Semestre → UE → EC ── */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <i className="fas fa-filter" style={{ color: '#2563eb' }} /> Filtrer par hiérarchie académique
          {hasFilter && (
            <button onClick={resetFilters} style={{ background: '#fef2f2', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 11, padding: '2px 8px', borderRadius: 6, marginLeft: 4 }}>
              <i className="fas fa-times" /> Réinitialiser
            </button>
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>

          {/* Pôle */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#2563eb', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
              <i className="fas fa-sitemap" /> Pôle
            </label>
            <select value={filterPole} onChange={e => { setFilterPole(e.target.value); setFilterForm(''); setFilterSem(''); setFilterUe(''); setFilterEc('') }} style={selStyle}>
              <option value="">Tous les pôles</option>
              {availPoles.map(p => (
                <option key={p.id} value={String(p.id)}>{p.code} — {p.name}</option>
              ))}
            </select>
          </div>

          {/* Formation */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#2563eb', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
              <i className="fas fa-university" /> Formation
            </label>
            <select value={filterForm} onChange={e => { setFilterForm(e.target.value); setFilterSem(''); setFilterUe(''); setFilterEc('') }} style={selStyle}>
              <option value="">Toutes</option>
              {availForms.map(f => <option key={f.id} value={String(f.id)}>{f.name}</option>)}
            </select>
          </div>

          {/* Semestre */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#0891b2', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
              <i className="fas fa-calendar-alt" /> Semestre
            </label>
            <select value={filterSem} onChange={e => { setFilterSem(e.target.value); setFilterUe(''); setFilterEc('') }} style={selStyle}>
              <option value="">Tous</option>
              {availSems.map(s => <option key={s.id} value={String(s.id)}>Semestre {s.number}</option>)}
            </select>
          </div>

          {/* UE */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#10b981', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
              <i className="fas fa-book-open" /> UE
            </label>
            <select value={filterUe} onChange={e => { setFilterUe(e.target.value); setFilterEc('') }} style={selStyle}>
              <option value="">Toutes</option>
              {availUes.map(u => <option key={u.id} value={String(u.id)}>{u.code} — {u.name}</option>)}
            </select>
          </div>

          {/* EC */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
              <i className="fas fa-tag" /> EC
            </label>
            <select value={filterEc} onChange={e => setFilterEc(e.target.value)} style={selStyle}>
              <option value="">Tous</option>
              {availEcs.map(e => <option key={e.id} value={String(e.id)}>{e.code} — {e.name}</option>)}
            </select>
          </div>

          {/* Type */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
              <i className="fas fa-list" /> Type
            </label>
            <select value={filterType} onChange={e => setFilterType(e.target.value)} style={selStyle}>
              <option value="">Tous types</option>
              {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>

          {/* Tag — parité Moodle : recherche transversale hors hiérarchie */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#7c3aed', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
              <i className="fas fa-hashtag" /> Tag
            </label>
            <select value={filterTag} onChange={e => setFilterTag(e.target.value)} style={selStyle} disabled={availTags.length === 0}>
              <option value="">{availTags.length ? 'Tous les tags' : 'Aucun tag'}</option>
              {availTags.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

        </div>

        {/* Recherche texte + afficher masquées */}
        <div style={{ marginTop: 10, display: 'flex', gap: 10, alignItems: 'center' }}>
          <input
            type="search"
            placeholder="Rechercher dans le titre ou l'énoncé…"
            value={filterSearch}
            onChange={e => setFilterSearch(e.target.value)}
            style={{ ...selStyle, flex: 1, padding: '9px 14px', fontSize: 13 }}
          />
          {hiddenCount > 0 && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              <input type="checkbox" checked={showHidden} onChange={e => setShowHidden(e.target.checked)} />
              Afficher les {hiddenCount} masquée{hiddenCount > 1 ? 's' : ''}
            </label>
          )}
        </div>
      </div>

      {/* Barre de sélection */}
      {selected.size > 0 && (
        <div style={{ background: '#2563eb', borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ flex: 1 }}>
            <span style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>{selected.size} question{selected.size > 1 ? 's' : ''}</span>
            <span style={{ color: '#bfdbfe', fontSize: 13, marginLeft: 8 }}>sélectionnée{selected.size > 1 ? 's' : ''}</span>
          </div>
          <button onClick={clearAll}
            style={{ background: 'rgba(255,255,255,.15)', border: 'none', color: '#fff', padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            <i className="fas fa-times" /> Désélectionner
          </button>
          <button onClick={() => setMoveModal(true)}
            style={{ background: 'rgba(255,255,255,.15)', border: 'none', color: '#fff', padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            <i className="fas fa-arrow-right-arrow-left" /> Déplacer vers un EC
          </button>
          <button onClick={bulkDelete} disabled={bulkDeleting}
            style={{ background: 'rgba(255,255,255,.15)', border: 'none', color: '#fecaca', padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: bulkDeleting ? 'not-allowed' : 'pointer' }}>
            <i className={`fas ${bulkDeleting ? 'fa-spinner fa-spin' : 'fa-trash'}`} /> Supprimer
          </button>
          <button onClick={() => setAssembleModal(true)}
            style={{ background: '#fff', border: 'none', color: '#1d4ed8', padding: '10px 20px', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 2px 8px rgba(0,0,0,.15)' }}>
            <i className="fas fa-layer-group" /> Créer un sujet d&apos;examen
          </button>
        </div>
      )}

      {/* ── Modale : déplacer la sélection vers un autre EC ── */}
      {moveModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={() => setMoveModal(false)}>
          <div className="card" style={{ width: '100%', maxWidth: 440, padding: 24 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>
              <i className="fas fa-arrow-right-arrow-left" style={{ color: '#2563eb', marginRight: 8 }} />
              Déplacer {selected.size} question{selected.size > 1 ? 's' : ''}
            </h3>
            <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>EC de destination</label>
            <select className="form-control" value={moveEcId} onChange={e => setMoveEcId(e.target.value)}>
              <option value="">— Retirer l&apos;EC (question indépendante) —</option>
              {ecs.map(e => <option key={e.id} value={e.id}>{e.code ? `${e.code} — ` : ''}{e.name}</option>)}
            </select>
            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setMoveModal(false)}>Annuler</button>
              <button className="btn btn-primary" onClick={doBulkMove} disabled={moving}>
                <i className={`fas ${moving ? 'fa-spinner fa-spin' : 'fa-check'}`} />
                {moving ? 'Déplacement…' : 'Déplacer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modale : édition en place ── */}
      {editQ && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={() => setEditQ(null)}>
          <div className="card" style={{ width: '100%', maxWidth: 620, maxHeight: '90vh', overflowY: 'auto', padding: 28 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 18px', fontSize: 17, fontWeight: 700 }}>
              <i className="fas fa-pen-to-square" style={{ color: '#2563eb', marginRight: 8 }} />
              Modifier la question
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Titre *</label>
                <input className="form-control" value={editForm.title} onChange={e => setEditForm(p => ({ ...p, title: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Énoncé *</label>
                <textarea className="form-control" rows={6} style={{ resize: 'vertical', fontFamily: 'inherit' }}
                  value={editForm.content} onChange={e => setEditForm(p => ({ ...p, content: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Barème / correction</label>
                <textarea className="form-control" rows={3} style={{ resize: 'vertical', fontFamily: 'inherit' }}
                  value={editForm.rubric} onChange={e => setEditForm(p => ({ ...p, rubric: e.target.value }))} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Type</label>
                  <select className="form-control" value={editForm.question_type} onChange={e => setEditForm(p => ({ ...p, question_type: e.target.value }))}>
                    {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Niveau de Bloom</label>
                  <select className="form-control" value={editForm.bloom_level} onChange={e => setEditForm(p => ({ ...p, bloom_level: e.target.value }))}>
                    <option value="">—</option>
                    {['Connaissance','Compréhension','Application','Analyse','Synthèse','Évaluation'].map(b => <option key={b}>{b}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Élément Constitutif</label>
                <select className="form-control" value={editForm.ec_id} onChange={e => setEditForm(p => ({ ...p, ec_id: e.target.value }))}>
                  <option value="">— Aucun —</option>
                  {ecs.map(e => <option key={e.id} value={e.id}>{e.code ? `${e.code} — ` : ''}{e.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                  <i className="fas fa-hashtag" style={{ color: '#7c3aed', marginRight: 4 }} />Tags (séparés par des virgules)
                </label>
                <input className="form-control" value={editForm.tags} onChange={e => setEditForm(p => ({ ...p, tags: e.target.value }))}
                  placeholder="ex : révision, difficile, 2026" />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setEditQ(null)}>Annuler</button>
              <button className="btn btn-primary" onClick={saveEdit} disabled={savingEdit}>
                <i className={`fas ${savingEdit ? 'fa-spinner fa-spin' : 'fa-save'}`} />
                {savingEdit ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tableau */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>
            <i className="fas fa-spinner fa-spin" style={{ fontSize: 28, display: 'block', marginBottom: 12 }} />
            Chargement…
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 64, textAlign: 'center' }}>
            <i className="fas fa-inbox" style={{ fontSize: 40, color: 'var(--text-muted)', display: 'block', marginBottom: 14 }} />
            <h3 style={{ margin: '0 0 10px' }}>{questions.length === 0 ? 'Banque vide' : 'Aucun résultat'}</h3>
            <p style={{ margin: 0, color: 'var(--text-muted)', maxWidth: 380, marginInline: 'auto' }}>
              {questions.length === 0
                ? 'Sauvegardez des questions depuis la génération IA pour les réutiliser ici.'
                : 'Modifiez ou réinitialisez les filtres.'}
            </p>
            {hasFilter && (
              <button onClick={resetFilters} className="btn btn-secondary" style={{ marginTop: 14 }}>
                <i className="fas fa-times" /> Réinitialiser les filtres
              </button>
            )}
          </div>
        ) : (
          <div className="table-responsive">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--background)' }}>
                  <th style={{ padding: '12px 14px', width: 36 }}></th>
                  <th style={{ padding: '12px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Type</th>
                  <th style={{ padding: '12px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Titre / Énoncé</th>
                  <th style={{ padding: '12px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Bloom</th>
                  <th style={{ padding: '12px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Pôle / UE / EC</th>
                  <th style={{ padding: '12px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(q => {
                  const st = typeSt(q.question_type)
                  const isSelected = selected.has(q.id)
                  const isHidden = q.status === 'hidden'
                  const isBusy = busyIds.has(q.id)
                  return (
                    <tr key={q.id} style={{ background: isSelected ? '#eff6ff' : undefined, opacity: isHidden ? 0.55 : 1, transition: 'background .15s' }}>
                      <td style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
                        <input type="checkbox" checked={isSelected} onChange={() => toggle(q.id)}
                          style={{ width: 16, height: 16, accentColor: '#2563eb', cursor: 'pointer' }} />
                      </td>
                      <td style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
                        <span style={{ ...st, padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700 }}>
                          {typeLabel(q.question_type)}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 600, color: 'var(--text)', maxWidth: 320 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          {q.title}
                          {isHidden && (
                            <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 99, background: '#f1f5f9', color: '#64748b' }}>
                              <i className="fas fa-eye-slash" style={{ marginRight: 3 }} />masquée
                            </span>
                          )}
                        </div>
                        {q.tags && q.tags.length > 0 && (
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                            {q.tags.map(t => (
                              <span key={t} onClick={() => setFilterTag(t)} title="Filtrer par ce tag"
                                style={{ fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 99, background: '#f5f3ff', color: '#7c3aed', cursor: 'pointer' }}>
                                <i className="fas fa-hashtag" style={{ fontSize: 8, marginRight: 2 }} />{t}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', fontSize: 12, color: 'var(--text-muted)' }}>
                        {q.bloom_level || '—'}
                      </td>
                      <td style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          {q.pole_code && (
                            <span style={{ fontSize: 10, fontWeight: 800, padding: '1px 7px', borderRadius: 99, background: poleColor(q.pole_code) + '20', color: poleColor(q.pole_code), width: 'fit-content' }}>
                              {q.pole_code}
                            </span>
                          )}
                          {q.ue_code && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>UE {q.ue_code}</span>}
                          {q.ec_name && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{q.ec_code} — {q.ec_name}</span>}
                          {!q.pole_code && !q.ec_name && (
                            <span title="Sans EC — visible dans tous les filtres, comme une question de contexte Système dans Moodle"
                              style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 99, background: '#f1f5f9', color: '#64748b', width: 'fit-content' }}>
                              <i className="fas fa-globe" style={{ marginRight: 3 }} />Globale
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                          <button onClick={() => setPreview(q)} title="Aperçu"
                            style={{ background: '#eff6ff', border: 'none', color: '#3b82f6', padding: '5px 9px', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>
                            <i className="fas fa-eye" />
                          </button>
                          <button onClick={() => openEdit(q)} title="Modifier"
                            style={{ background: '#f0fdf4', border: 'none', color: '#16a34a', padding: '5px 9px', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>
                            <i className="fas fa-pen-to-square" />
                          </button>
                          <button onClick={() => duplicateQ(q.id)} title="Dupliquer" disabled={isBusy}
                            style={{ background: '#eef2ff', border: 'none', color: '#4f46e5', padding: '5px 9px', borderRadius: 6, fontSize: 12, cursor: isBusy ? 'not-allowed' : 'pointer' }}>
                            <i className={`fas ${isBusy ? 'fa-spinner fa-spin' : 'fa-copy'}`} />
                          </button>
                          <button onClick={() => toggleStatus(q)} title={isHidden ? 'Réactiver' : 'Masquer'} disabled={isBusy}
                            style={{ background: '#fffbeb', border: 'none', color: '#b45309', padding: '5px 9px', borderRadius: 6, fontSize: 12, cursor: isBusy ? 'not-allowed' : 'pointer' }}>
                            <i className={`fas ${isHidden ? 'fa-eye' : 'fa-eye-slash'}`} />
                          </button>
                          <button onClick={() => deleteQ(q.id)} title="Supprimer"
                            style={{ background: '#fef2f2', border: 'none', color: '#ef4444', padding: '5px 9px', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>
                            <i className="fas fa-trash" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Légende types */}
      {questions.length > 0 && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {Object.entries(TYPE_LABEL).map(([k, v]) => {
            const st = typeSt(k)
            return <span key={k} style={{ ...st, fontSize: 11, padding: '2px 10px', borderRadius: 99, fontWeight: 600 }}>{v}</span>
          })}
        </div>
      )}
    </div>
  )
}
