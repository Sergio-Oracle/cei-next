'use client'

import { useEffect, useState, useCallback } from 'react'
import api from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'
import Pager from '@/components/ui/Pager'

interface Formation {
  id: number
  code: string
  name: string
  level?: string
  semesters?: Semester[]
}

interface Semester {
  id: number
  name: string
  ues?: UE[]
}

interface UE {
  id: number
  code: string
  name: string
  sem?: string
}

interface Student {
  id: number
  full_name: string
  email: string
  formation_id: number | null
  formation_name?: string
  formation_code?: string
  pole_id?: number | null
  pole_name?: string
  pole_code?: string
}

// Même palette que les autres pages (admin/questions) — identité visuelle
// cohérente par pôle dans toute l'application.
const poleColor = (_code?: string | null) => '#3b82f6'

interface Enrollment {
  enrollment_id: number
  ue_id: number
  ue_code: string
  ue_name: string
  formation_name?: string
}

interface EnrollModal {
  student: Student
  enrolledUeIds: Set<number>
}

const PAGE_SIZE = 50

interface ListState {
  students: Student[]
  page: number
  totalPages: number
  total: number
  loading: boolean
}
const emptyList = (): ListState => ({ students: [], page: 1, totalPages: 1, total: 0, loading: false })

interface FormationGroup { formation_id: number | null; formation_code: string; formation_name: string; count: number }
interface PoleGroupStat { pole_id: number | null; pole_code: string; pole_name: string; count: number }

export default function AdminEnrollmentsPage() {
  const { success, error: toastErr } = useToast()

  // Hiérarchie Formation → Semestre → UE (petit volume, chargée en entier
  // comme avant — sert le modal, le sélecteur "attribuer une formation" et
  // les dropdowns d'inscription en masse par formation).
  const [formations, setFormations] = useState<Formation[]>([])
  const [hierarchyLoading, setHierarchyLoading] = useState(true)

  // Stats + répartitions (indépendantes de la pagination des listes d'étudiants).
  const [stats, setStats] = useState({ total_students: 0, total_ues: 0, enrolled_count: 0 })
  const [formationGroups, setFormationGroups] = useState<FormationGroup[]>([])
  const [poleGroups, setPoleGroups] = useState<PoleGroupStat[]>([])
  const [statsLoaded, setStatsLoaded] = useState(false)

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  // Une liste paginée pour l'onglet "Liste", une par formation, une par pôle.
  const [listState, setListState] = useState<ListState>(emptyList())
  const [formationLists, setFormationLists] = useState<Record<string, ListState>>({})
  const [poleLists, setPoleLists] = useState<Record<string, ListState>>({})

  // Inscriptions UE par étudiant — peuplé au fur et à mesure des pages
  // affichées (plus jamais "tous les étudiants d'un coup").
  const [enrollmentsByStudent, setEnrollmentsByStudent] = useState<Record<number, Enrollment[]>>({})

  // Cache des IDs complets correspondant à un filtre (recherche / formation /
  // pôle) — sert exclusivement "Tout sélectionner" / "Tout cocher", pour que
  // ça porte vraiment sur TOUS les étudiants correspondants et pas seulement
  // sur la page actuellement affichée. Vidé après toute action de mutation.
  const [groupAllIds, setGroupAllIds] = useState<Record<string, number[]>>({})

  // Modal state
  const [modal, setModal] = useState<EnrollModal | null>(null)
  const [checked, setChecked] = useState<Record<number, boolean>>({}) // ueId → bool
  const [saving, setSaving] = useState(false)
  // Attribution de formation pour un étudiant qui n'en a pas encore — un
  // étudiant n'a plus qu'UNE formation (logique Pôle → Niveau → Formation à
  // respecter, plus de "double cursus" / "formation principale")
  const [assignFormationId, setAssignFormationId] = useState('')
  const [assigningFormation, setAssigningFormation] = useState(false)
  const [view, setView] = useState<'list' | 'byFormation' | 'byPole'>('list')

  // Retour #2 — inscription groupée : sélection multi-étudiants + UE cible
  const [bulkSel, setBulkSel] = useState<Set<number>>(new Set())
  const [bulkUeId, setBulkUeId] = useState('')
  const [bulkBusy, setBulkBusy] = useState(false)
  // Inscription en masse SCOPÉE par formation (vue "Par formation") — le
  // sélecteur d'UE de chaque carte ne propose que les UE de CETTE formation,
  // pour qu'il soit structurellement impossible d'inscrire un étudiant à une
  // UE d'une autre formation (logique Pôle → Niveau → Formation à respecter).
  const [bulkUeIdByFormation, setBulkUeIdByFormation] = useState<Record<number, string>>({})

  /* ── Hiérarchie Formation → Semestre → UE (chargée une fois, petit volume) ── */
  const loadFormationsHierarchy = useCallback(async () => {
    setHierarchyLoading(true)
    try {
      const fRes = await api.get<any>('/api/formations')
      const fList: Formation[] = Array.isArray(fRes) ? fRes : fRes.formations ?? []
      for (const f of fList) {
        try {
          const semRes = await api.get<any>(`/api/formations/${f.id}/semesters`)
          f.semesters = Array.isArray(semRes) ? semRes : semRes.semesters ?? []
          for (const sem of f.semesters ?? []) {
            const ueRes = await api.get<any>(`/api/semesters/${sem.id}/ues`)
            sem.ues = (Array.isArray(ueRes) ? ueRes : ueRes.ues ?? []).map((u: any) => ({
              ...u, sem: sem.name
            }))
          }
        } catch { f.semesters = [] }
      }
      setFormations(fList)
    } catch { toastErr('Erreur de chargement') }
    finally { setHierarchyLoading(false) }
  }, []) // eslint-disable-line

  async function loadStats() {
    try {
      const data = await api.get<any>('/api/admin/enrollments/stats')
      setStats({
        total_students: data.total_students ?? 0,
        total_ues: data.total_ues ?? 0,
        enrolled_count: data.enrolled_count ?? 0,
      })
      setFormationGroups(data.formation_groups ?? [])
      setPoleGroups(data.pole_groups ?? [])
    } catch { /* silencieux — les stats restent à 0, pas bloquant */ }
    finally { setStatsLoaded(true) }
  }

  useEffect(() => { loadFormationsHierarchy(); loadStats() }, [loadFormationsHierarchy])

  // Recherche débattue (400ms) — l'onglet "Liste" est le seul à supporter la
  // recherche (comme avant), mais elle déclenche maintenant un vrai fetch.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 400)
    return () => clearTimeout(t)
  }, [search])

  /* ── Fetch paginé générique ──────────────────────────────────────────── */
  async function fetchStudentsPage(params: Record<string, string>) {
    const qs = new URLSearchParams({ page: '1', limit: String(PAGE_SIZE), ...params })
    const data = await api.get<any>(`/api/students/list?${qs.toString()}`)
    return { students: (data.students ?? []) as Student[], total: data.total ?? 0, page: data.page ?? 1, total_pages: data.total_pages ?? 1 }
  }

  async function fetchEnrollmentsFor(ids: number[]) {
    if (ids.length === 0) return
    try {
      const res = await api.get<Record<string, Enrollment[]>>(`/api/admin/students/enrollments/bulk?student_ids=${ids.join(',')}`)
      setEnrollmentsByStudent(prev => {
        const next = { ...prev }
        ids.forEach(id => { next[id] = res[String(id)] ?? [] })
        return next
      })
    } catch { /* badges vides pour cette page — non bloquant */ }
  }

  async function loadListTab(page: number) {
    setListState(p => ({ ...p, loading: true }))
    const params: Record<string, string> = { page: String(page) }
    if (debouncedSearch) params.search = debouncedSearch
    try {
      const r = await fetchStudentsPage(params)
      setListState({ students: r.students, total: r.total, page: r.page, totalPages: r.total_pages, loading: false })
      fetchEnrollmentsFor(r.students.map(s => s.id))
    } catch { toastErr('Erreur chargement étudiants'); setListState(p => ({ ...p, loading: false })) }
  }

  async function loadFormationList(key: string, formationIdParam: string, page: number) {
    setFormationLists(p => ({ ...p, [key]: { ...(p[key] || emptyList()), loading: true } }))
    try {
      const r = await fetchStudentsPage({ formation_id: formationIdParam, page: String(page) })
      setFormationLists(p => ({ ...p, [key]: { students: r.students, total: r.total, page: r.page, totalPages: r.total_pages, loading: false } }))
      fetchEnrollmentsFor(r.students.map(s => s.id))
    } catch { toastErr('Erreur chargement étudiants'); setFormationLists(p => ({ ...p, [key]: { ...(p[key] || emptyList()), loading: false } })) }
  }

  async function loadPoleList(key: string, poleIdParam: string, page: number) {
    setPoleLists(p => ({ ...p, [key]: { ...(p[key] || emptyList()), loading: true } }))
    try {
      const r = await fetchStudentsPage({ pole_id: poleIdParam, page: String(page) })
      setPoleLists(p => ({ ...p, [key]: { students: r.students, total: r.total, page: r.page, totalPages: r.total_pages, loading: false } }))
      fetchEnrollmentsFor(r.students.map(s => s.id))
    } catch { toastErr('Erreur chargement étudiants'); setPoleLists(p => ({ ...p, [key]: { ...(p[key] || emptyList()), loading: false } })) }
  }

  useEffect(() => {
    if (view === 'list') loadListTab(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, debouncedSearch])

  useEffect(() => {
    if (view === 'byFormation' && formationGroups.length > 0) {
      formationGroups.forEach(g => {
        const key = g.formation_id == null ? 'none' : String(g.formation_id)
        loadFormationList(key, key, 1)
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, formationGroups])

  useEffect(() => {
    if (view === 'byPole' && poleGroups.length > 0) {
      poleGroups.forEach(g => {
        const key = g.pole_id == null ? 'none' : String(g.pole_id)
        loadPoleList(key, key, 1)
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, poleGroups])

  // Recharge tout ce qui est visible, à la page courante de chacun (ne
  // ramène pas l'utilisateur à la page 1 après une simple édition) + les
  // stats. Le cache d'IDs "sélection totale" est vidé (une affectation de
  // formation peut avoir changé qui appartient à quel groupe).
  function reloadVisible() {
    setGroupAllIds({})
    loadStats()
    if (view === 'list') {
      loadListTab(listState.page)
    } else if (view === 'byFormation') {
      formationGroups.forEach(g => {
        const key = g.formation_id == null ? 'none' : String(g.formation_id)
        loadFormationList(key, key, formationLists[key]?.page || 1)
      })
    } else if (view === 'byPole') {
      poleGroups.forEach(g => {
        const key = g.pole_id == null ? 'none' : String(g.pole_id)
        loadPoleList(key, key, poleLists[key]?.page || 1)
      })
    }
  }

  // IDs complets (toutes pages confondues) correspondant à un filtre —
  // mis en cache pour ne pas re-fetcher à chaque clic.
  async function fetchGroupIds(cacheKey: string, params: Record<string, string>): Promise<number[]> {
    const cached = groupAllIds[cacheKey]
    if (cached) return cached
    try {
      const qs = new URLSearchParams(params)
      const res = await api.get<{ ids: number[] }>(`/api/students/ids?${qs.toString()}`)
      setGroupAllIds(prev => ({ ...prev, [cacheKey]: res.ids }))
      return res.ids
    } catch { toastErr('Erreur de sélection'); return [] }
  }

  // Ouvrir la modal de gestion
  async function openModal(student: Student) {
    try {
      const r = await api.get<any>(`/api/admin/students/${student.id}/enrollments`)
      const enrollments: Enrollment[] = r.enrollments ?? r ?? []
      const ids = new Set(enrollments.map((e: Enrollment) => e.ue_id))
      setModal({ student, enrolledUeIds: ids })
      const init: Record<number, boolean> = {}
      ids.forEach(id => { init[id] = true })
      setChecked(init)
      setAssignFormationId('')
    } catch { toastErr('Erreur chargement inscriptions') }
  }

  function bulkCheck(formationId: number, val: boolean) {
    const f = formations.find(f => f.id === formationId)
    if (!f) return
    const updates: Record<number, boolean> = {}
    f.semesters?.forEach(s => s.ues?.forEach(u => { updates[u.id] = val }))
    setChecked(prev => ({ ...prev, ...updates }))
  }

  // Attribue une formation à un étudiant qui n'en a pas encore — rattache
  // formation_id et inscrit à toutes les UE de la formation en un appel
  // (même route que la cascade Pôle→Niveau→Formation de la page Utilisateurs).
  async function assignFormation() {
    if (!modal || !assignFormationId) return
    setAssigningFormation(true)
    try {
      const r = await api.post<any>(`/api/admin/students/${modal.student.id}/set_formation`, {
        formation_id: Number(assignFormationId)
      })
      success(r.message || 'Formation attribuée')
      setModal(null)
      setAssignFormationId('')
      reloadVisible()
    } catch (e: any) { toastErr(e.message || 'Erreur') }
    finally { setAssigningFormation(false) }
  }

  async function saveChanges() {
    if (!modal || !modal.student.formation_id) return
    setSaving(true)
    try {
      // Scope strict à la SEULE formation de l'étudiant — jamais aux UE
      // d'une autre formation, même si une inscription héritée existe
      // (logique Pôle → Niveau → Formation à respecter).
      const f = formations.find(x => x.id === modal.student.formation_id)
      const relevantUeIds = f ? (f.semesters?.flatMap(s => s.ues?.map(u => u.id) ?? []) ?? []) : []

      const r = await api.get<any>(`/api/admin/students/${modal.student.id}/enrollments`)
      const current: Enrollment[] = r.enrollments ?? r ?? []
      const enrolledMap: Record<number, number> = {}
      current.forEach(e => { enrolledMap[e.ue_id] = e.enrollment_id })

      let added = 0, removed = 0, errors = 0
      for (const ueId of relevantUeIds) {
        const shouldEnroll = !!checked[ueId]
        const isEnrolled = ueId in enrolledMap

        if (shouldEnroll && !isEnrolled) {
          try {
            await api.post(`/api/admin/students/${modal.student.id}/enroll`, { ue_id: ueId })
            added++
          } catch { errors++ }
        } else if (!shouldEnroll && isEnrolled) {
          try {
            await api.delete(`/api/admin/student_enrollments/${enrolledMap[ueId]}`)
            removed++
          } catch { errors++ }
        }
      }

      const parts = []
      if (added) parts.push(`${added} UE(s) ajoutée(s)`)
      if (removed) parts.push(`${removed} UE(s) retirée(s)`)
      if (errors) parts.push(`${errors} erreur(s)`)
      if (parts.length) {
        errors ? toastErr(parts.join(', ')) : success(parts.join(', '))
      } else {
        success('Aucun changement')
      }
      setModal(null)
      reloadVisible()
    } catch (e: any) { toastErr(e.message || 'Erreur') }
    finally { setSaving(false) }
  }

  const allUes = formations.flatMap(f => (f.semesters ?? []).flatMap(sem => (sem.ues ?? []).map(u => ({
    id: u.id, label: `${u.code} — ${u.name} (${f.code})`,
  }))))

  function toggleBulk(id: number) {
    setBulkSel(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  async function bulkEnroll() {
    if (!bulkUeId || bulkSel.size === 0) return
    setBulkBusy(true)
    try {
      const res = await api.post<{ success: boolean; enrolled: number; already_enrolled: number; errors: string[] }>(
        '/api/admin/student_enrollments/bulk', { student_ids: Array.from(bulkSel), ue_id: Number(bulkUeId) }
      )
      success(`${res.enrolled} étudiant(s) inscrit(s)${res.already_enrolled ? ` (${res.already_enrolled} déjà inscrit(s))` : ''}`)
      setBulkSel(new Set()); setBulkUeId('')
      reloadVisible()
    } catch (e: any) { toastErr(e.message || "Erreur lors de l'inscription groupée") }
    finally { setBulkBusy(false) }
  }

  async function bulkEnrollFormation(formationId: number) {
    const ueId = bulkUeIdByFormation[formationId]
    if (!ueId) return
    setBulkBusy(true)
    try {
      const allIds = await fetchGroupIds(`formation:${formationId}`, { formation_id: String(formationId) })
      const ids = allIds.filter(id => bulkSel.has(id))
      if (ids.length === 0) { toastErr('Aucun étudiant sélectionné dans cette formation'); return }
      const res = await api.post<{ success: boolean; enrolled: number; already_enrolled: number; errors: string[] }>(
        '/api/admin/student_enrollments/bulk', { student_ids: ids, ue_id: Number(ueId) }
      )
      if (res.errors?.length) toastErr(res.errors.join(' — '))
      success(`${res.enrolled} étudiant(s) inscrit(s)${res.already_enrolled ? ` (${res.already_enrolled} déjà inscrit(s))` : ''}`)
      setBulkSel(prev => { const n = new Set(prev); ids.forEach(id => n.delete(id)); return n })
      setBulkUeIdByFormation(prev => ({ ...prev, [formationId]: '' }))
      reloadVisible()
    } catch (e: any) { toastErr(e.message || "Erreur lors de l'inscription groupée") }
    finally { setBulkBusy(false) }
  }

  async function bulkUnenrollFormation(formationId: number) {
    const ueId = bulkUeIdByFormation[formationId]
    if (!ueId) return
    setBulkBusy(true)
    try {
      const allIds = await fetchGroupIds(`formation:${formationId}`, { formation_id: String(formationId) })
      const ids = allIds.filter(id => bulkSel.has(id))
      if (ids.length === 0) { toastErr('Aucun étudiant sélectionné dans cette formation'); return }
      const res = await api.post<{ success: boolean; removed: number }>(
        '/api/admin/student_enrollments/bulk_remove', { student_ids: ids, ue_id: Number(ueId) }
      )
      success(`${res.removed} étudiant(s) désinscrit(s)`)
      setBulkSel(prev => { const n = new Set(prev); ids.forEach(id => n.delete(id)); return n })
      setBulkUeIdByFormation(prev => ({ ...prev, [formationId]: '' }))
      reloadVisible()
    } catch (e: any) { toastErr(e.message || "Erreur lors de la désinscription groupée") }
    finally { setBulkBusy(false) }
  }

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h2><i className="fas fa-user-graduate" style={{ marginRight: 10, color: 'var(--primary)' }} />Inscriptions UE des Étudiants</h2>
          <p>Gérez les inscriptions des étudiants aux Unités d'Enseignement selon la maquette pédagogique</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginBottom: 20 }}>
        <div className="stat-card" style={{ borderColor: '#3b82f6' }}>
          <div className="stat-label"><i className="fas fa-users" style={{ color: '#3b82f6' }} /> Étudiants</div>
          <div className="stat-value" style={{ color: '#3b82f6' }}>{stats.total_students}</div>
        </div>
        <div className="stat-card" style={{ borderColor: '#10b981' }}>
          <div className="stat-label"><i className="fas fa-layer-group" style={{ color: '#10b981' }} /> UEs disponibles</div>
          <div className="stat-value" style={{ color: '#10b981' }}>{stats.total_ues}</div>
        </div>
        <div className="stat-card" style={{ borderColor: '#f59e0b' }}>
          <div className="stat-label"><i className="fas fa-user-check" style={{ color: '#f59e0b' }} /> Étudiants inscrits</div>
          <div className="stat-value" style={{ color: '#f59e0b' }}>{stats.enrolled_count}</div>
        </div>
      </div>

      {formations.length === 0 && !hierarchyLoading && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '14px 18px', marginBottom: 20, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <i className="fas fa-triangle-exclamation" style={{ color: '#f59e0b', fontSize: 22, flexShrink: 0 }} />
          <p style={{ margin: 0, fontSize:15.5, color: '#92400e' }}>Créez d'abord des formations et des UEs dans <strong>Maquette Pédagogique</strong> avant d'inscrire des étudiants.</p>
        </div>
      )}

      {/* Onglets */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 4, width: 'fit-content' }}>
        <button
          onClick={() => setView('list')}
          style={{ padding: '7px 16px', borderRadius: 7, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize:15.5, background: view === 'list' ? 'var(--primary)' : 'transparent', color: view === 'list' ? '#fff' : 'var(--text-muted)', transition: 'all .15s' }}>
          <i className="fas fa-list" style={{ marginRight: 6 }} />Liste
        </button>
        <button
          onClick={() => setView('byFormation')}
          style={{ padding: '7px 16px', borderRadius: 7, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize:15.5, background: view === 'byFormation' ? 'var(--primary)' : 'transparent', color: view === 'byFormation' ? '#fff' : 'var(--text-muted)', transition: 'all .15s' }}>
          <i className="fas fa-layer-group" style={{ marginRight: 6 }} />Par formation
        </button>
        <button
          onClick={() => setView('byPole')}
          style={{ padding: '7px 16px', borderRadius: 7, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize:15.5, background: view === 'byPole' ? 'var(--primary)' : 'transparent', color: view === 'byPole' ? '#fff' : 'var(--text-muted)', transition: 'all .15s' }}>
          <i className="fas fa-sitemap" style={{ marginRight: 6 }} />Par pôle
        </button>
      </div>

      {/* Vue : Liste étudiants */}
      {view === 'list' && <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <i className="fas fa-list" style={{ color: 'var(--text-muted)', fontSize: 16 }} />
            <h3 style={{ margin: 0 }}>Liste des étudiants</h3>
            <span className="status-badge secondary" style={{ fontSize:13 }}>{listState.total}</span>
          </div>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un étudiant…"
            className="form-control"
            style={{ width: 260, fontSize:15.5, padding: '7px 12px' }}
          />
        </div>

        {/* Retour #2 — barre d'action inscription groupée. "Tout sélectionner"
            porte sur TOUS les étudiants correspondant au filtre (via
            /api/students/ids), pas seulement la page affichée. */}
        {!listState.loading && listState.total > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 18px', background: bulkSel.size ? '#eff6ff' : 'var(--background)', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize:14.5, fontWeight: 600, color: 'var(--text-muted)', cursor: 'pointer' }}>
              <input type="checkbox"
                checked={(() => { const ids = groupAllIds[`list:${debouncedSearch}`]; return !!ids && ids.length > 0 && ids.every(id => bulkSel.has(id)) })()}
                onChange={async e => {
                  if (e.target.checked) {
                    const ids = await fetchGroupIds(`list:${debouncedSearch}`, debouncedSearch ? { search: debouncedSearch } : {})
                    setBulkSel(new Set(ids))
                  } else {
                    setBulkSel(new Set())
                  }
                }} />
              Tout sélectionner ({bulkSel.size})
            </label>
            {bulkSel.size > 0 && (
              <>
                <select value={bulkUeId} onChange={e => setBulkUeId(e.target.value)} className="form-control" style={{ maxWidth: 320, fontSize:14.5, padding: '6px 10px' }}>
                  <option value="">— Choisir l'UE cible —</option>
                  {allUes.map(u => <option key={u.id} value={String(u.id)}>{u.label}</option>)}
                </select>
                <button onClick={bulkEnroll} disabled={!bulkUeId || bulkBusy} className="btn btn-sm btn-primary"
                  style={{ opacity: !bulkUeId || bulkBusy ? .6 : 1, cursor: !bulkUeId || bulkBusy ? 'not-allowed' : 'pointer' }}>
                  {bulkBusy ? <><i className="fas fa-spinner fa-spin" /> Inscription…</> : <><i className="fas fa-user-plus" /> Inscrire la sélection ({bulkSel.size})</>}
                </button>
              </>
            )}
          </div>
        )}

        {listState.loading && listState.students.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <i className="fas fa-spinner fa-spin" style={{ fontSize: 31, color: 'var(--primary)' }} />
          </div>
        ) : listState.total === 0 ? (
          <div className="empty-message" style={{ padding: '48px 20px' }}>
            <i className="fas fa-inbox" style={{ fontSize: 35, display: 'block', marginBottom: 10 }} />
            Aucun étudiant enregistré.
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1, padding: 12, position: 'relative', minHeight: 60 }}>
              {listState.loading && (
                <div style={{ position: 'absolute', inset: 0, background: 'var(--surface)', opacity: .6, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
                  <i className="fas fa-spinner fa-spin" style={{ color: 'var(--primary)' }} />
                </div>
              )}
              {listState.students.map(st => {
                const enrollments = enrollmentsByStudent[st.id] ?? []
                const initials = (st.full_name || st.email || '?').split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()

                return (
                  <div key={st.id} style={{ background: bulkSel.has(st.id) ? '#eff6ff' : 'var(--surface)', border: `1px solid ${bulkSel.has(st.id) ? '#bfdbfe' : 'var(--border)'}`, borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
                    <input type="checkbox" checked={bulkSel.has(st.id)} onChange={() => toggleBulk(st.id)} style={{ flexShrink: 0 }} />
                    {/* Avatar */}
                    <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#dbeafe', color: '#1d4ed8', fontSize:14.5, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {initials}
                    </div>
                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                        <span style={{ fontSize:17, fontWeight: 700 }}>{st.full_name || st.email}</span>
                        {st.formation_id ? (
                          <span className="status-badge success" style={{ fontSize:13 }}>
                            <i className="fas fa-graduation-cap" /> {st.formation_code || st.formation_name}
                          </span>
                        ) : (
                          <span className="status-badge" style={{ fontSize:13, background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a' }}>
                            <i className="fas fa-triangle-exclamation" /> Sans formation
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize:13, color: 'var(--text-muted)', marginBottom: 6 }}>
                        <i className="fas fa-envelope" style={{ marginRight: 3, fontSize: 12 }} />{st.email}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                        <span style={{ fontSize:13, color: 'var(--text-muted)', fontWeight: 600, marginRight: 2 }}>UEs :</span>
                        {enrollments.length === 0 ? (
                          <span style={{ fontSize:14.5, color: 'var(--text-muted)', fontStyle: 'italic' }}>Aucune UE</span>
                        ) : enrollments.map(e => (
                          <span key={e.enrollment_id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 99, padding: '2px 8px', fontSize:13, fontWeight: 600 }}>
                            {e.ue_code}
                          </span>
                        ))}
                      </div>
                    </div>
                    {/* Action */}
                    <button
                      onClick={() => openModal(st)}
                      className="btn btn-sm"
                      style={{ background: st.formation_id ? 'var(--background)' : 'var(--primary)', color: st.formation_id ? 'var(--text)' : '#fff', border: `1px solid ${st.formation_id ? 'var(--border)' : 'var(--primary)'}`, whiteSpace: 'nowrap', flexShrink: 0 }}>
                      <i className="fas fa-pen-to-square" /> Gérer les inscriptions
                    </button>
                  </div>
                )
              })}
            </div>
            <Pager page={listState.page} totalPages={listState.totalPages} loading={listState.loading} onChange={p => loadListTab(p)} />
          </>
        )}
      </div>}

      {/* Vue : Par formation — colonnes côte à côte, même principe que "Par
          pôle", pour distinguer les formations d'un même pôle (ex: L2-MIC vs
          L3-TR-DEV). Chaque colonne est maintenant paginée indépendamment. */}
      {view === 'byFormation' && (
        <div style={{ display: 'flex', flexDirection: 'row', gap: 16, overflowX: 'auto', paddingBottom: 10, alignItems: 'flex-start' }}>
          {!statsLoaded ? (
            <div style={{ textAlign: 'center', padding: 60 }}>
              <i className="fas fa-spinner fa-spin" style={{ fontSize: 31, color: 'var(--primary)' }} />
            </div>
          ) : formationGroups.length === 0 ? (
            <div className="card empty-message" style={{ padding: '48px 20px' }}>
              <i className="fas fa-inbox" style={{ fontSize: 35, display: 'block', marginBottom: 10 }} />
              Aucun étudiant enregistré.
            </div>
          ) : (
            formationGroups.map(g => {
              const isNoFormation = g.formation_id == null
              const key = isNoFormation ? 'none' : String(g.formation_id)
              const fl = formationLists[key] || emptyList()
              const formation = isNoFormation ? null : formations.find(f => f.id === g.formation_id)
              const cacheKey = `formation:${g.formation_id}`
              const knownIds = groupAllIds[cacheKey]
              const fSelectedCount = knownIds ? knownIds.filter(id => bulkSel.has(id)).length : fl.students.filter(s => bulkSel.has(s.id)).length
              const fAllChecked = knownIds ? knownIds.length > 0 && knownIds.every(id => bulkSel.has(id)) : (fl.students.length > 0 && fl.students.every(s => bulkSel.has(s.id)))
              const fUes = formation ? (formation.semesters ?? []).flatMap(sem => (sem.ues ?? []).map(u => ({ ...u, sem: sem.name }))) : []
              const fUeId = g.formation_id != null ? (bulkUeIdByFormation[g.formation_id] || '') : ''

              return (
                <div key={key} className="card" style={{ flex: '0 0 380px', padding: 0, overflow: 'hidden' }}>
                  {/* En-tête */}
                  <div style={{ background: isNoFormation ? '#f59e0b' : 'var(--primary)', padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      <i className={`fas ${isNoFormation ? 'fa-triangle-exclamation' : 'fa-graduation-cap'}`} style={{ color: '#fff', fontSize: 19 }} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ color: '#fff', fontWeight: 700, fontSize:18, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {isNoFormation ? 'Sans formation principale' : g.formation_name}
                        </div>
                        {!isNoFormation && <div style={{ color: 'rgba(255,255,255,.75)', fontSize:14.5 }}>{g.formation_code}{formation?.level ? ` — Niveau ${formation.level}` : ''}</div>}
                      </div>
                    </div>
                    <span style={{ background: 'rgba(255,255,255,.2)', color: '#fff', borderRadius: 99, padding: '3px 12px', fontSize:15.5, fontWeight: 700, flexShrink: 0 }}>
                      {g.count} étudiant{g.count > 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Barre d'inscription en masse — uniquement pour les vraies
                      formations (pas "sans formation"), UE limitées à CETTE
                      formation (logique Pôle→Niveau→Formation). */}
                  {!isNoFormation && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px', background: fSelectedCount ? '#eff6ff' : 'var(--background)', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize:14.5, fontWeight: 600, color: 'var(--text-muted)', cursor: 'pointer' }}>
                        <input type="checkbox"
                          checked={fAllChecked}
                          onChange={async e => {
                            const doCheck = e.target.checked
                            const ids = await fetchGroupIds(cacheKey, { formation_id: String(g.formation_id) })
                            setBulkSel(prev => { const n = new Set(prev); ids.forEach(id => doCheck ? n.add(id) : n.delete(id)); return n })
                          }} />
                        Tout cocher ({fSelectedCount})
                      </label>
                      {fSelectedCount > 0 && (
                        <>
                          <select value={fUeId} onChange={e => setBulkUeIdByFormation(p => ({ ...p, [g.formation_id!]: e.target.value }))}
                            className="form-control" style={{ maxWidth: 320, fontSize:14.5, padding: '6px 10px' }}>
                            <option value="">— Choisir l'UE de {g.formation_code} —</option>
                            {fUes.map(u => <option key={u.id} value={String(u.id)}>{u.code} — {u.name} ({u.sem})</option>)}
                          </select>
                          <button onClick={() => bulkEnrollFormation(g.formation_id!)} disabled={!fUeId || bulkBusy} className="btn btn-sm btn-primary"
                            style={{ opacity: !fUeId || bulkBusy ? .6 : 1, cursor: !fUeId || bulkBusy ? 'not-allowed' : 'pointer' }}>
                            {bulkBusy ? <><i className="fas fa-spinner fa-spin" /> Inscription…</> : <><i className="fas fa-user-plus" /> Inscrire la sélection ({fSelectedCount})</>}
                          </button>
                          <button onClick={() => bulkUnenrollFormation(g.formation_id!)} disabled={!fUeId || bulkBusy}
                            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', border: '1px solid #fecaca', background: 'var(--surface)', color: '#ef4444', borderRadius: 8, fontSize:14.5, fontWeight: 600, cursor: !fUeId || bulkBusy ? 'not-allowed' : 'pointer', opacity: !fUeId || bulkBusy ? .6 : 1 }}>
                            {bulkBusy ? <><i className="fas fa-spinner fa-spin" /> Désinscription…</> : <><i className="fas fa-user-minus" /> Désinscrire la sélection ({fSelectedCount})</>}
                          </button>
                        </>
                      )}
                    </div>
                  )}

                  {/* Liste étudiants de cette formation */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 10, maxHeight: 640, overflowY: 'auto', position: 'relative', minHeight: 60 }}>
                    {fl.loading && (
                      <div style={{ position: 'absolute', inset: 0, background: 'var(--surface)', opacity: .6, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
                        <i className="fas fa-spinner fa-spin" style={{ color: 'var(--primary)' }} />
                      </div>
                    )}
                    {fl.students.map(st => {
                      const enrollments = enrollmentsByStudent[st.id] ?? []
                      const initials = (st.full_name || st.email || '?').split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
                      return (
                        <div key={st.id} style={{ padding: '10px 12px', borderRadius: 8, background: bulkSel.has(st.id) ? '#eff6ff' : 'var(--background)', border: `1px solid ${bulkSel.has(st.id) ? '#bfdbfe' : 'var(--border)'}` }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                            {!isNoFormation && <input type="checkbox" checked={bulkSel.has(st.id)} onChange={() => toggleBulk(st.id)} style={{ flexShrink: 0 }} />}
                            <div style={{ width: 30, height: 30, borderRadius: '50%', background: isNoFormation ? '#fef3c7' : '#dbeafe', color: isNoFormation ? '#b45309' : '#1d4ed8', fontSize:12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              {initials}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize:15, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{st.full_name || st.email}</div>
                              <div style={{ fontSize:12.5, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{st.email}</div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center', marginBottom: 8 }}>
                            {enrollments.length === 0 ? (
                              <span style={{ fontSize:13, color: 'var(--text-muted)', fontStyle: 'italic' }}>Aucune UE</span>
                            ) : enrollments.map(e => (
                              <span key={e.enrollment_id} style={{ display: 'inline-flex', alignItems: 'center', background: isNoFormation ? '#fef3c7' : '#eff6ff', color: isNoFormation ? '#b45309' : '#1d4ed8', border: `1px solid ${isNoFormation ? '#fde68a' : '#bfdbfe'}`, borderRadius: 99, padding: '2px 7px', fontSize:12.5, fontWeight: 600 }}>
                                {e.ue_code}
                              </span>
                            ))}
                          </div>
                          <button onClick={() => openModal(st)} className="btn btn-sm btn-secondary" style={{ width: '100%', fontSize:14, ...(isNoFormation ? { background: 'var(--primary)', color: '#fff', border: 'none' } : {}) }}>
                            <i className="fas fa-pen-to-square" /> {isNoFormation ? 'Affecter' : 'Gérer'}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                  <Pager page={fl.page} totalPages={fl.totalPages} loading={fl.loading} onChange={p => loadFormationList(key, key, p)} />
                </div>
              )
            })
          )}
        </div>
      )}

      {/* Vue : Par pôle — colonnes côte à côte pour bien distinguer la
          hiérarchie Pôle → Niveau → Formation à respecter. Chaque colonne
          est maintenant paginée indépendamment (pas de sélection groupée
          ici, comme avant). */}
      {view === 'byPole' && (
        !statsLoaded ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <i className="fas fa-spinner fa-spin" style={{ fontSize: 31, color: 'var(--primary)' }} />
          </div>
        ) : poleGroups.length === 0 ? (
          <div className="card empty-message" style={{ padding: '48px 20px' }}>
            <i className="fas fa-inbox" style={{ fontSize: 35, display: 'block', marginBottom: 10 }} />
            Aucun étudiant enregistré.
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 10, alignItems: 'flex-start' }}>
            {poleGroups.map(g => {
              const isNoPole = g.pole_id == null
              const key = isNoPole ? 'none' : String(g.pole_id)
              const pl = poleLists[key] || emptyList()
              const color = isNoPole ? '#f59e0b' : poleColor(g.pole_code)
              return (
                <div key={key} className="card" style={{ flex: '0 0 340px', padding: 0, overflow: 'hidden' }}>
                  <div style={{ background: color, padding: '12px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, position: 'sticky', top: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      <i className={`fas ${isNoPole ? 'fa-triangle-exclamation' : 'fa-sitemap'}`} style={{ color: '#fff', fontSize: 19, flexShrink: 0 }} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ color: '#fff', fontWeight: 700, fontSize:17, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{isNoPole ? 'Sans pôle' : g.pole_name}</div>
                        {!isNoPole && <div style={{ color: 'rgba(255,255,255,.75)', fontSize:13 }}>{g.pole_code}</div>}
                      </div>
                    </div>
                    <span style={{ background: 'rgba(255,255,255,.22)', color: '#fff', borderRadius: 99, padding: '3px 10px', fontSize:14.5, fontWeight: 700, flexShrink: 0 }}>
                      {g.count}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 10, maxHeight: 640, overflowY: 'auto', position: 'relative', minHeight: 60 }}>
                    {pl.loading && (
                      <div style={{ position: 'absolute', inset: 0, background: 'var(--surface)', opacity: .6, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
                        <i className="fas fa-spinner fa-spin" style={{ color: 'var(--primary)' }} />
                      </div>
                    )}
                    {pl.students.map(st => {
                      const enrollments = enrollmentsByStudent[st.id] ?? []
                      const initials = (st.full_name || st.email || '?').split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
                      return (
                        <div key={st.id} style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--background)', border: '1px solid var(--border)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                            <div style={{ width: 30, height: 30, borderRadius: '50%', background: isNoPole ? '#fef3c7' : `${color}22`, color: isNoPole ? '#b45309' : color, fontSize:12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              {initials}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize:15, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{st.full_name || st.email}</div>
                              <div style={{ fontSize:12.5, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{isNoPole ? st.email : st.formation_code}</div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center', marginBottom: 8 }}>
                            {enrollments.length === 0 ? (
                              <span style={{ fontSize:13, color: 'var(--text-muted)', fontStyle: 'italic' }}>Aucune UE</span>
                            ) : enrollments.map(e => (
                              <span key={e.enrollment_id} style={{ display: 'inline-flex', alignItems: 'center', background: isNoPole ? '#fef3c7' : `${color}18`, color: isNoPole ? '#b45309' : color, border: `1px solid ${isNoPole ? '#fde68a' : `${color}44`}`, borderRadius: 99, padding: '2px 7px', fontSize:12.5, fontWeight: 600 }}>
                                {e.ue_code}
                              </span>
                            ))}
                          </div>
                          <button onClick={() => openModal(st)} className="btn btn-sm btn-secondary" style={{ width: '100%', fontSize:14, ...(isNoPole ? { background: 'var(--primary)', color: '#fff', border: 'none' } : {}) }}>
                            <i className="fas fa-pen-to-square" /> {isNoPole ? 'Affecter' : 'Gérer'}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                  <Pager page={pl.page} totalPages={pl.totalPages} loading={pl.loading} onChange={p => loadPoleList(key, key, p)} />
                </div>
              )
            })}
          </div>
        )
      )}

      {/* ══ Modal Inscriptions ════════════════════════════════════════════════ */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setModal(null)}>
          <div className="card" style={{ padding: 0, width: '100%', maxWidth: 640, maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}
            onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="card-header" style={{ position: 'relative' }}>
              <div>
                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <i className="fas fa-user-graduate" style={{ color: 'var(--primary)' }} />
                  Inscriptions de {modal.student.full_name}
                </h3>
                <p style={{ margin: '4px 0 0', fontSize:15.5, color: 'var(--text-muted)', fontWeight: 400 }}>
                  {modal.student.formation_id
                    ? "Un étudiant n'appartient qu'à une seule formation — seules les UE de sa formation sont modifiables ici."
                    : "Cet étudiant n'a pas encore de formation — attribuez-en une pour faire apparaître ses UE."}
                </p>
              </div>
              <button onClick={() => setModal(null)}
                style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: 'pointer', fontSize:21.5, color: 'var(--text-muted)' }}>
                <i className="fas fa-times" />
              </button>
            </div>

            {/* Content */}
            <div style={{ overflowY: 'auto', flex: 1, padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {!modal.student.formation_id ? (
                // Étudiant sans formation — un seul sélecteur, jamais de double cursus
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <label style={{ fontSize:14.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Formation à attribuer</label>
                  <select value={assignFormationId} onChange={e => setAssignFormationId(e.target.value)} className="form-control">
                    <option value="">— Choisir une formation —</option>
                    {formations.map(f => <option key={f.id} value={String(f.id)}>{f.code} — {f.name}</option>)}
                  </select>
                  <button onClick={assignFormation} disabled={!assignFormationId || assigningFormation} className="btn btn-primary"
                    style={{ alignSelf: 'flex-start', opacity: !assignFormationId || assigningFormation ? .6 : 1 }}>
                    <i className={`fas ${assigningFormation ? 'fa-spinner fa-spin' : 'fa-check'}`} />
                    {assigningFormation ? 'Attribution…' : 'Attribuer cette formation'}
                  </button>
                </div>
              ) : (() => {
                const f = formations.find(x => x.id === modal.student.formation_id)
                if (!f) return <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Formation introuvable.</p>
                const allUesF = f.semesters?.flatMap(s => s.ues ?? []) ?? []
                const enrolledInF = allUesF.filter(u => !!checked[u.id]).length

                return (
                  <div style={{ border: '1.5px solid #3b82f6', borderRadius: 10, overflow: 'hidden' }}>
                    {/* Formation header */}
                    <div style={{ background: '#eff6ff', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 700, fontSize:15.5 }}>{f.code}</span>
                        <span style={{ fontSize:14.5, color: 'var(--text-muted)' }}>— {f.name}</span>
                        <span style={{ fontSize:13, color: 'var(--text-muted)' }}>{enrolledInF}/{allUesF.length} UE(s) inscrites</span>
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button onClick={() => bulkCheck(f.id, true)}
                          style={{ fontSize:13, padding: '4px 9px', background: '#10b981', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' }}>
                          <i className="fas fa-check-double" /> Tout cocher
                        </button>
                        <button onClick={() => bulkCheck(f.id, false)}
                          style={{ fontSize:13, padding: '4px 9px', background: 'var(--surface)', color: '#ef4444', border: '1px solid #fecaca', borderRadius: 6, cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' }}>
                          <i className="fas fa-xmark" /> Tout décocher
                        </button>
                      </div>
                    </div>

                    {/* UEs */}
                    <div style={{ padding: '6px 10px', display: 'flex', flexDirection: 'column', gap: 1 }}>
                      {allUesF.length === 0 ? (
                        <p style={{ color: 'var(--text-muted)', fontSize:14.5, padding: '4px 8px', margin: 0 }}>Aucune UE dans cette formation.</p>
                      ) : allUesF.map(u => (
                        <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', borderRadius: 6, cursor: 'pointer', fontSize:15.5, background: checked[u.id] ? '#eff6ff' : 'transparent', transition: 'background .1s' }}>
                          <input
                            type="checkbox"
                            checked={!!checked[u.id]}
                            onChange={e => setChecked(prev => ({ ...prev, [u.id]: e.target.checked }))}
                            style={{ width: 15, height: 15, accentColor: '#3b82f6', flexShrink: 0 }}
                          />
                          <span>
                            <strong>{u.code}</strong>
                            <span style={{ color: 'var(--text-muted)' }}> — {u.name}</span>
                            {u.sem && <span style={{ color: 'var(--text-muted)', fontSize:13 }}> ({u.sem})</span>}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )
              })()}
            </div>

            {/* Footer */}
            {!!modal.student.formation_id && (
              <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button className="btn btn-secondary" onClick={() => setModal(null)}>
                  <i className="fas fa-times" /> Annuler
                </button>
                <button className="btn btn-primary" onClick={saveChanges} disabled={saving}>
                  <i className={`fas ${saving ? 'fa-spinner fa-spin' : 'fa-save'}`} />
                  {saving ? 'Enregistrement…' : 'Enregistrer'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
