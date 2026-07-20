'use client'

import { useEffect, useState, useCallback } from 'react'
import api from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'

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
const POLE_COLORS: Record<string, string> = { STN: '#2563eb', LSHE: '#10b981', SEJA: '#f59e0b' }
const poleColor = (code?: string | null) => POLE_COLORS[code || ''] || '#7c3aed'

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

export default function AdminEnrollmentsPage() {
  const { success, error: toastErr } = useToast()

  const [formations, setFormations] = useState<Formation[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [enrollmentsByStudent, setEnrollmentsByStudent] = useState<Record<number, Enrollment[]>>({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Modal state
  const [modal, setModal] = useState<EnrollModal | null>(null)
  const [checked, setChecked] = useState<Record<number, boolean>>({}) // ueId → bool
  const [saving, setSaving] = useState(false)
  const [setPrimaryBusy, setSetPrimaryBusy] = useState(false)
  const [view, setView] = useState<'list' | 'byFormation' | 'byPole'>('list')

  // Retour #2 — inscription groupée : sélection multi-étudiants + UE cible
  const [bulkSel, setBulkSel] = useState<Set<number>>(new Set())
  const [bulkUeId, setBulkUeId] = useState('')
  const [bulkBusy, setBulkBusy] = useState(false)

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [fRes, sRes] = await Promise.all([
        api.get<any>('/api/formations'),
        api.get<any>('/api/students/list'),
      ])
      const fList: Formation[] = Array.isArray(fRes) ? fRes : fRes.formations ?? []
      const sList: Student[] = Array.isArray(sRes) ? sRes : sRes.students ?? []

      // Charger semesters + UEs pour chaque formation
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

      // Charger inscriptions de chaque étudiant
      const byStudent: Record<number, Enrollment[]> = {}
      await Promise.all(sList.map(async s => {
        try {
          const r = await api.get<any>(`/api/admin/students/${s.id}/enrollments`)
          byStudent[s.id] = r.enrollments ?? r ?? []
        } catch { byStudent[s.id] = [] }
      }))

      setFormations(fList)
      setStudents(sList)
      setEnrollmentsByStudent(byStudent)
    } catch { toastErr('Erreur de chargement') }
    finally { setLoading(false) }
  }, []) // eslint-disable-line

  useEffect(() => { loadAll() }, [loadAll])

  const totalUes = formations.reduce((acc, f) =>
    acc + (f.semesters?.reduce((a, s) => a + (s.ues?.length ?? 0), 0) ?? 0), 0)

  const enrolledCount = students.filter(s => (enrollmentsByStudent[s.id]?.length ?? 0) > 0).length

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
    } catch { toastErr('Erreur chargement inscriptions') }
  }

  function bulkCheck(formationId: number, val: boolean) {
    const f = formations.find(f => f.id === formationId)
    if (!f) return
    const updates: Record<number, boolean> = {}
    f.semesters?.forEach(s => s.ues?.forEach(u => { updates[u.id] = val }))
    setChecked(prev => ({ ...prev, ...updates }))
  }

  async function setPrimary(studentId: number, formationId: number) {
    setSetPrimaryBusy(true)
    try {
      const r = await api.post<any>(`/api/admin/students/${studentId}/set_formation`, {
        formation_id: formationId, replace_all: false
      })
      success(r.message || 'Formation principale mise à jour')
      setModal(null)
      loadAll()
    } catch (e: any) { toastErr(e.message || 'Erreur') }
    finally { setSetPrimaryBusy(false) }
  }

  async function saveChanges() {
    if (!modal) return
    setSaving(true)
    try {
      const r = await api.get<any>(`/api/admin/students/${modal.student.id}/enrollments`)
      const current: Enrollment[] = r.enrollments ?? r ?? []
      const enrolledMap: Record<number, number> = {}
      current.forEach(e => { enrolledMap[e.ue_id] = e.enrollment_id })

      let added = 0, removed = 0, errors = 0
      const allUeIds = new Set(
        formations.flatMap(f => f.semesters?.flatMap(s => s.ues?.map(u => u.id) ?? []) ?? [])
      )

      for (const ueId of allUeIds) {
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
      loadAll()
    } catch (e: any) { toastErr(e.message || 'Erreur') }
    finally { setSaving(false) }
  }

  const filtered = students.filter(s =>
    s.full_name.toLowerCase().includes(search.toLowerCase()) ||
    s.email.toLowerCase().includes(search.toLowerCase())
  )

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
      await loadAll()
    } catch (e: any) { toastErr(e.message || "Erreur lors de l'inscription groupée") }
    finally { setBulkBusy(false) }
  }

  // Grouper les étudiants par formation principale
  const byFormation: { formation: Formation | null; students: Student[] }[] = []
  const noFormation: Student[] = []
  for (const f of formations) {
    const group = students.filter(s => s.formation_id === f.id)
    if (group.length > 0) byFormation.push({ formation: f, students: group })
  }
  // Étudiants sans formation
  students.filter(s => !s.formation_id).forEach(s => noFormation.push(s))

  // Grouper par pôle — vue côte à côte pour bien distinguer la hiérarchie
  // Pôle → Niveau → Formation à respecter (demande explicite)
  const poleMap = new Map<number, { poleId: number; poleCode: string; poleName: string; students: Student[] }>()
  const noPole: Student[] = []
  for (const s of students) {
    if (s.pole_id) {
      if (!poleMap.has(s.pole_id)) {
        poleMap.set(s.pole_id, { poleId: s.pole_id, poleCode: s.pole_code || '?', poleName: s.pole_name || s.pole_code || '?', students: [] })
      }
      poleMap.get(s.pole_id)!.students.push(s)
    } else {
      noPole.push(s)
    }
  }
  const byPole = Array.from(poleMap.values()).sort((a, b) => a.poleCode.localeCompare(b.poleCode))

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
          <div className="stat-value" style={{ color: '#3b82f6' }}>{students.length}</div>
        </div>
        <div className="stat-card" style={{ borderColor: '#10b981' }}>
          <div className="stat-label"><i className="fas fa-layer-group" style={{ color: '#10b981' }} /> UEs disponibles</div>
          <div className="stat-value" style={{ color: '#10b981' }}>{totalUes}</div>
        </div>
        <div className="stat-card" style={{ borderColor: '#f59e0b' }}>
          <div className="stat-label"><i className="fas fa-user-check" style={{ color: '#f59e0b' }} /> Étudiants inscrits</div>
          <div className="stat-value" style={{ color: '#f59e0b' }}>{enrolledCount}</div>
        </div>
      </div>

      {formations.length === 0 && !loading && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '14px 18px', marginBottom: 20, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <i className="fas fa-triangle-exclamation" style={{ color: '#f59e0b', fontSize: 18, flexShrink: 0 }} />
          <p style={{ margin: 0, fontSize: 13, color: '#92400e' }}>Créez d'abord des formations et des UEs dans <strong>Maquette Pédagogique</strong> avant d'inscrire des étudiants.</p>
        </div>
      )}

      {/* Onglets */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 4, width: 'fit-content' }}>
        <button
          onClick={() => setView('list')}
          style={{ padding: '7px 16px', borderRadius: 7, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13, background: view === 'list' ? 'var(--primary)' : 'transparent', color: view === 'list' ? '#fff' : 'var(--text-muted)', transition: 'all .15s' }}>
          <i className="fas fa-list" style={{ marginRight: 6 }} />Liste
        </button>
        <button
          onClick={() => setView('byFormation')}
          style={{ padding: '7px 16px', borderRadius: 7, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13, background: view === 'byFormation' ? 'var(--primary)' : 'transparent', color: view === 'byFormation' ? '#fff' : 'var(--text-muted)', transition: 'all .15s' }}>
          <i className="fas fa-layer-group" style={{ marginRight: 6 }} />Par formation
        </button>
        <button
          onClick={() => setView('byPole')}
          style={{ padding: '7px 16px', borderRadius: 7, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13, background: view === 'byPole' ? 'var(--primary)' : 'transparent', color: view === 'byPole' ? '#fff' : 'var(--text-muted)', transition: 'all .15s' }}>
          <i className="fas fa-sitemap" style={{ marginRight: 6 }} />Par pôle
        </button>
      </div>

      {/* Vue : Liste étudiants */}
      {view === 'list' && <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <i className="fas fa-list" style={{ color: 'var(--text-muted)', fontSize: 13 }} />
            <h3 style={{ margin: 0 }}>Liste des étudiants</h3>
            <span className="status-badge secondary" style={{ fontSize: 11 }}>{students.length}</span>
          </div>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un étudiant…"
            className="form-control"
            style={{ width: 260, fontSize: 13, padding: '7px 12px' }}
          />
        </div>

        {/* Retour #2 — barre d'action inscription groupée */}
        {!loading && filtered.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 18px', background: bulkSel.size ? '#eff6ff' : 'var(--background)', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', cursor: 'pointer' }}>
              <input type="checkbox"
                checked={filtered.length > 0 && filtered.every(s => bulkSel.has(s.id))}
                onChange={e => setBulkSel(e.target.checked ? new Set(filtered.map(s => s.id)) : new Set())} />
              Tout sélectionner ({bulkSel.size})
            </label>
            {bulkSel.size > 0 && (
              <>
                <select value={bulkUeId} onChange={e => setBulkUeId(e.target.value)} className="form-control" style={{ maxWidth: 320, fontSize: 12, padding: '6px 10px' }}>
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

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <i className="fas fa-spinner fa-spin" style={{ fontSize: 28, color: 'var(--primary)' }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-message" style={{ padding: '48px 20px' }}>
            <i className="fas fa-inbox" style={{ fontSize: 32, display: 'block', marginBottom: 10 }} />
            Aucun étudiant enregistré.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, padding: 12 }}>
            {filtered.map(st => {
              const enrollments = enrollmentsByStudent[st.id] ?? []
              const initials = (st.full_name || st.email || '?').split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()

              return (
                <div key={st.id} style={{ background: bulkSel.has(st.id) ? '#eff6ff' : 'var(--surface)', border: `1px solid ${bulkSel.has(st.id) ? '#bfdbfe' : 'var(--border)'}`, borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
                  <input type="checkbox" checked={bulkSel.has(st.id)} onChange={() => toggleBulk(st.id)} style={{ flexShrink: 0 }} />
                  {/* Avatar */}
                  <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#dbeafe', color: '#1d4ed8', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {initials}
                  </div>
                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 700 }}>{st.full_name || st.email}</span>
                      {st.formation_id ? (
                        <span className="status-badge success" style={{ fontSize: 11 }}>
                          <i className="fas fa-graduation-cap" /> {st.formation_code || st.formation_name}
                        </span>
                      ) : (
                        <span className="status-badge" style={{ fontSize: 11, background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a' }}>
                          <i className="fas fa-triangle-exclamation" /> Sans formation
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
                      <i className="fas fa-envelope" style={{ marginRight: 3, fontSize: 10 }} />{st.email}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginRight: 2 }}>UEs :</span>
                      {enrollments.length === 0 ? (
                        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>Aucune UE</span>
                      ) : enrollments.map(e => (
                        <span key={e.enrollment_id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 99, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>
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
        )}
      </div>}

      {/* Vue : Par formation */}
      {view === 'byFormation' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 60 }}>
              <i className="fas fa-spinner fa-spin" style={{ fontSize: 28, color: 'var(--primary)' }} />
            </div>
          ) : (
            <>
              {byFormation.map(({ formation, students: fStudents }) => (
                <div key={formation!.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  {/* En-tête formation */}
                  <div style={{ background: 'var(--primary)', padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <i className="fas fa-graduation-cap" style={{ color: '#fff', fontSize: 16 }} />
                      <div>
                        <div style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>{formation!.name}</div>
                        <div style={{ color: 'rgba(255,255,255,.75)', fontSize: 12 }}>{formation!.code} — Niveau {formation!.level}</div>
                      </div>
                    </div>
                    <span style={{ background: 'rgba(255,255,255,.2)', color: '#fff', borderRadius: 99, padding: '3px 12px', fontSize: 13, fontWeight: 700 }}>
                      {fStudents.length} étudiant{fStudents.length > 1 ? 's' : ''}
                    </span>
                  </div>
                  {/* Liste étudiants de cette formation */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 1, padding: 10 }}>
                    {fStudents.map(st => {
                      const enrollments = enrollmentsByStudent[st.id] ?? []
                      const initials = (st.full_name || st.email || '?').split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
                      return (
                        <div key={st.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 8, background: 'var(--background)', border: '1px solid var(--border)' }}>
                          <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#dbeafe', color: '#1d4ed8', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {initials}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>{st.full_name || st.email}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                              <i className="fas fa-envelope" style={{ marginRight: 3, fontSize: 10 }} />{st.email}
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginRight: 2 }}>UEs :</span>
                              {enrollments.length === 0 ? (
                                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>Aucune</span>
                              ) : enrollments.map(e => (
                                <span key={e.enrollment_id} style={{ display: 'inline-flex', alignItems: 'center', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 99, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>
                                  {e.ue_code}
                                </span>
                              ))}
                            </div>
                          </div>
                          <button onClick={() => openModal(st)} className="btn btn-sm btn-secondary" style={{ whiteSpace: 'nowrap', flexShrink: 0, fontSize: 12 }}>
                            <i className="fas fa-pen-to-square" /> Gérer
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}

              {/* Étudiants sans formation */}
              {noFormation.length > 0 && (
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  <div style={{ background: '#f59e0b', padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <i className="fas fa-triangle-exclamation" style={{ color: '#fff', fontSize: 16 }} />
                      <div style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>Sans formation principale</div>
                    </div>
                    <span style={{ background: 'rgba(255,255,255,.2)', color: '#fff', borderRadius: 99, padding: '3px 12px', fontSize: 13, fontWeight: 700 }}>
                      {noFormation.length} étudiant{noFormation.length > 1 ? 's' : ''}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 1, padding: 10 }}>
                    {noFormation.map(st => {
                      const enrollments = enrollmentsByStudent[st.id] ?? []
                      const initials = (st.full_name || st.email || '?').split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
                      return (
                        <div key={st.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 8, background: 'var(--background)', border: '1px solid var(--border)' }}>
                          <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#fef3c7', color: '#b45309', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {initials}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>{st.full_name || st.email}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                              <i className="fas fa-envelope" style={{ marginRight: 3, fontSize: 10 }} />{st.email}
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginRight: 2 }}>UEs :</span>
                              {enrollments.length === 0 ? (
                                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>Aucune</span>
                              ) : enrollments.map(e => (
                                <span key={e.enrollment_id} style={{ display: 'inline-flex', alignItems: 'center', background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a', borderRadius: 99, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>
                                  {e.ue_code}
                                </span>
                              ))}
                            </div>
                          </div>
                          <button onClick={() => openModal(st)} className="btn btn-sm" style={{ whiteSpace: 'nowrap', flexShrink: 0, fontSize: 12, background: 'var(--primary)', color: '#fff', border: 'none' }}>
                            <i className="fas fa-pen-to-square" /> Affecter
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {byFormation.length === 0 && noFormation.length === 0 && (
                <div className="card empty-message" style={{ padding: '48px 20px' }}>
                  <i className="fas fa-inbox" style={{ fontSize: 32, display: 'block', marginBottom: 10 }} />
                  Aucun étudiant enregistré.
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Vue : Par pôle — colonnes côte à côte pour bien distinguer la
          hiérarchie Pôle → Niveau → Formation à respecter */}
      {view === 'byPole' && (
        loading ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <i className="fas fa-spinner fa-spin" style={{ fontSize: 28, color: 'var(--primary)' }} />
          </div>
        ) : byPole.length === 0 && noPole.length === 0 ? (
          <div className="card empty-message" style={{ padding: '48px 20px' }}>
            <i className="fas fa-inbox" style={{ fontSize: 32, display: 'block', marginBottom: 10 }} />
            Aucun étudiant enregistré.
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 10, alignItems: 'flex-start' }}>
            {byPole.map(p => {
              const color = poleColor(p.poleCode)
              return (
                <div key={p.poleId} className="card" style={{ flex: '0 0 340px', padding: 0, overflow: 'hidden' }}>
                  <div style={{ background: color, padding: '12px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, position: 'sticky', top: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      <i className="fas fa-sitemap" style={{ color: '#fff', fontSize: 16, flexShrink: 0 }} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ color: '#fff', fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.poleName}</div>
                        <div style={{ color: 'rgba(255,255,255,.75)', fontSize: 11 }}>{p.poleCode}</div>
                      </div>
                    </div>
                    <span style={{ background: 'rgba(255,255,255,.22)', color: '#fff', borderRadius: 99, padding: '3px 10px', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                      {p.students.length}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 10, maxHeight: 640, overflowY: 'auto' }}>
                    {p.students.map(st => {
                      const enrollments = enrollmentsByStudent[st.id] ?? []
                      const initials = (st.full_name || st.email || '?').split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
                      return (
                        <div key={st.id} style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--background)', border: '1px solid var(--border)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                            <div style={{ width: 30, height: 30, borderRadius: '50%', background: `${color}22`, color, fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              {initials}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{st.full_name || st.email}</div>
                              <div style={{ fontSize: 10.5, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{st.formation_code}</div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center', marginBottom: 8 }}>
                            {enrollments.length === 0 ? (
                              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>Aucune UE</span>
                            ) : enrollments.map(e => (
                              <span key={e.enrollment_id} style={{ display: 'inline-flex', alignItems: 'center', background: `${color}18`, color, border: `1px solid ${color}44`, borderRadius: 99, padding: '2px 7px', fontSize: 10.5, fontWeight: 600 }}>
                                {e.ue_code}
                              </span>
                            ))}
                          </div>
                          <button onClick={() => openModal(st)} className="btn btn-sm btn-secondary" style={{ width: '100%', fontSize: 11.5 }}>
                            <i className="fas fa-pen-to-square" /> Gérer
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}

            {noPole.length > 0 && (
              <div key="nopole" className="card" style={{ flex: '0 0 340px', padding: 0, overflow: 'hidden' }}>
                <div style={{ background: '#f59e0b', padding: '12px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <i className="fas fa-triangle-exclamation" style={{ color: '#fff', fontSize: 16 }} />
                    <div style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>Sans pôle</div>
                  </div>
                  <span style={{ background: 'rgba(255,255,255,.22)', color: '#fff', borderRadius: 99, padding: '3px 10px', fontSize: 12, fontWeight: 700 }}>
                    {noPole.length}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 10, maxHeight: 640, overflowY: 'auto' }}>
                  {noPole.map(st => {
                    const enrollments = enrollmentsByStudent[st.id] ?? []
                    const initials = (st.full_name || st.email || '?').split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
                    return (
                      <div key={st.id} style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--background)', border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                          <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#fef3c7', color: '#b45309', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {initials}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{st.full_name || st.email}</div>
                            <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{st.email}</div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center', marginBottom: 8 }}>
                          {enrollments.length === 0 ? (
                            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>Aucune UE</span>
                          ) : enrollments.map(e => (
                            <span key={e.enrollment_id} style={{ display: 'inline-flex', alignItems: 'center', background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a', borderRadius: 99, padding: '2px 7px', fontSize: 10.5, fontWeight: 600 }}>
                              {e.ue_code}
                            </span>
                          ))}
                        </div>
                        <button onClick={() => openModal(st)} className="btn btn-sm" style={{ width: '100%', fontSize: 11.5, background: 'var(--primary)', color: '#fff', border: 'none' }}>
                          <i className="fas fa-pen-to-square" /> Affecter
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
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
                <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)', fontWeight: 400 }}>
                  Cochez les UEs souhaitées. Un étudiant en <strong>double cursus</strong> peut avoir des UEs de plusieurs
                  formations. La formation <span style={{ background: '#3b82f6', color: '#fff', padding: '1px 6px', borderRadius: 4, fontSize: 11 }}>PRINCIPALE</span> détermine son cursus principal.
                </p>
              </div>
              <button onClick={() => setModal(null)}
                style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-muted)' }}>
                <i className="fas fa-times" />
              </button>
            </div>

            {/* Content */}
            <div style={{ overflowY: 'auto', flex: 1, padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {formations.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Aucune formation disponible.</p>
              ) : formations.map(f => {
                const isPrimary = f.id === modal.student.formation_id
                const allUes = f.semesters?.flatMap(s => s.ues ?? []) ?? []
                const enrolledInF = allUes.filter(u => !!checked[u.id]).length

                return (
                  <div key={f.id} style={{ border: `1.5px solid ${isPrimary ? '#3b82f6' : 'var(--border)'}`, borderRadius: 10, overflow: 'hidden' }}>
                    {/* Formation header */}
                    <div style={{ background: isPrimary ? '#eff6ff' : 'var(--background)', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {isPrimary && (
                          <span style={{ fontSize: 10, background: '#3b82f6', color: '#fff', padding: '2px 7px', borderRadius: 99, fontWeight: 700 }}>PRINCIPALE</span>
                        )}
                        <span style={{ fontWeight: 700, fontSize: 13 }}>{f.code}</span>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>— {f.name}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{enrolledInF}/{allUes.length} UE(s) inscrites</span>
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {!isPrimary && (
                          <button onClick={() => setPrimary(modal.student.id, f.id)} disabled={setPrimaryBusy}
                            style={{ fontSize: 11, padding: '4px 9px', background: 'var(--surface)', color: '#3b82f6', border: '1px solid #bfdbfe', borderRadius: 6, cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' }}>
                            <i className="fas fa-star" /> Définir principale
                          </button>
                        )}
                        <button onClick={() => bulkCheck(f.id, true)}
                          style={{ fontSize: 11, padding: '4px 9px', background: '#10b981', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' }}>
                          <i className="fas fa-check-double" /> Tout cocher
                        </button>
                        <button onClick={() => bulkCheck(f.id, false)}
                          style={{ fontSize: 11, padding: '4px 9px', background: 'var(--surface)', color: '#ef4444', border: '1px solid #fecaca', borderRadius: 6, cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' }}>
                          <i className="fas fa-xmark" /> Tout décocher
                        </button>
                      </div>
                    </div>

                    {/* UEs */}
                    <div style={{ padding: '6px 10px', display: 'flex', flexDirection: 'column', gap: 1 }}>
                      {allUes.length === 0 ? (
                        <p style={{ color: 'var(--text-muted)', fontSize: 12, padding: '4px 8px', margin: 0 }}>Aucune UE dans cette formation.</p>
                      ) : allUes.map(u => (
                        <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', borderRadius: 6, cursor: 'pointer', fontSize: 13, background: checked[u.id] ? '#eff6ff' : 'transparent', transition: 'background .1s' }}>
                          <input
                            type="checkbox"
                            checked={!!checked[u.id]}
                            onChange={e => setChecked(prev => ({ ...prev, [u.id]: e.target.checked }))}
                            style={{ width: 15, height: 15, accentColor: '#3b82f6', flexShrink: 0 }}
                          />
                          <span>
                            <strong>{u.code}</strong>
                            <span style={{ color: 'var(--text-muted)' }}> — {u.name}</span>
                            {u.sem && <span style={{ color: 'var(--text-muted)', fontSize: 11 }}> ({u.sem})</span>}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Footer */}
            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button className="btn btn-secondary" onClick={() => setModal(null)}>
                <i className="fas fa-times" /> Annuler
              </button>
              <button className="btn btn-primary" onClick={saveChanges} disabled={saving}>
                <i className={`fas ${saving ? 'fa-spinner fa-spin' : 'fa-save'}`} />
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
