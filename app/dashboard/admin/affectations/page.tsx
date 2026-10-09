'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import api from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'

interface ECAssignmentRef { id: number; professor_id: number }
interface EC {
  id: number
  code: string
  name: string
  ue_code?: string
  ue_name?: string
  assigned_professor_id?: number | null
  assigned_professors?: number[]
  assignments?: ECAssignmentRef[]
}

interface Professor {
  id: number
  full_name: string
  email: string
  is_active?: boolean
}

interface MultiModal {
  ecId: number
  ecName: string
  assignedIds: number[]
  /** professor_id -> id d'affectation (ECAssignment.id), pour permettre le retrait */
  assignmentIdByProf: Record<number, number>
}

export default function AdminAffectationsPage() {
  const { success, error } = useToast()

  const [ecs, setEcs] = useState<EC[]>([])
  const [professors, setProfessors] = useState<Professor[]>([])
  const [loading, setLoading] = useState(true)
  const [assigning, setAssigning] = useState<number | null>(null)
  const [unassigning, setUnassigning] = useState<number | null>(null)
  const [selections, setSelections] = useState<Record<number, string>>({})
  const [multiModal, setMultiModal] = useState<MultiModal | null>(null)
  const [multiSelected, setMultiSelected] = useState<Set<number>>(new Set())
  const [multiBusy, setMultiBusy] = useState(false)
  // Performance : la liste des ~250 professeurs n'est construite que pour la
  // ligne en cours d'affectation (avant : 178 listes, ~44 000 options), et la
  // table affiche 25 EC à la fois, avec recherche.
  const [activeRow, setActiveRow] = useState<number | null>(null)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 25

  const load = useCallback(async () => {
    setLoading(true)
    try {
      // Un seul appel léger : EC, affectations et noms des professeurs.
      const res = await api.get<{ ecs: EC[]; professors: Professor[] }>('/api/admin/ec_assignments/overview')
      setEcs(res.ecs || [])
      setProfessors(res.professors || [])
    } catch { error('Erreur chargement') }
    finally { setLoading(false) }
  }, []) // eslint-disable-line

  useEffect(() => { load() }, [load])

  const profById = useMemo(() => new Map(professors.map(p => [p.id, p])), [professors])
  const profName = (id?: number | null) =>
    id ? (profById.get(id)?.full_name ?? null) : null
  const profOptions = useMemo(() => professors.map(p => (
    <option key={p.id} value={p.id}>{p.full_name}{p.is_active === false ? ' (inactif)' : ''}</option>
  )), [professors])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return ecs
    return ecs.filter(ec => {
      const names = (ec.assignments?.map(a => a.professor_id) ?? ec.assigned_professors ?? []).map(id => profById.get(id)?.full_name ?? '')
      return [ec.code, ec.name, ec.ue_code, ...names].some(v => (v || '').toLowerCase().includes(q))
    })
  }, [ecs, query, profById])
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  async function assign(ecId: number) {
    const profId = selections[ecId]
    if (!profId) { error('Sélectionnez un professeur'); return }
    setAssigning(ecId)
    try {
      await api.post(`/api/admin/ecs/${ecId}/assign`, { professor_id: Number(profId) })
      success('EC assigné avec succès')
      setSelections(prev => { const n = { ...prev }; delete n[ecId]; return n })
      load()
    } catch (e: any) { error(e.message || 'Erreur affectation') }
    finally { setAssigning(null) }
  }

  async function unassign(assignmentId: number) {
    if (!assignmentId || assignmentId < 0) { error('Affectation introuvable — actualisez la page'); return }
    setUnassigning(assignmentId)
    try {
      await api.delete(`/api/admin/ec_assignments/${assignmentId}`)
      success('Professeur retiré de cet EC')
      // Si le modal multi-affectation est ouvert sur cet EC, retire aussi le
      // professeur de son état local pour refléter le changement sans avoir
      // à fermer/rouvrir le modal.
      setMultiModal(prev => {
        if (!prev) return prev
        const profId = Object.entries(prev.assignmentIdByProf).find(([, aid]) => aid === assignmentId)?.[0]
        if (!profId) return prev
        const { [Number(profId)]: _removed, ...rest } = prev.assignmentIdByProf
        return { ...prev, assignedIds: prev.assignedIds.filter(id => id !== Number(profId)), assignmentIdByProf: rest }
      })
      load()
    } catch (e: any) { error(e.message || 'Erreur retrait') }
    finally { setUnassigning(null) }
  }

  function openMulti(ec: EC) {
    const assignments = ec.assignments?.length
      ? ec.assignments
      : (ec.assigned_professors ?? []).map(pid => ({ id: -1, professor_id: pid }))
    const assignedIds = assignments.map(a => a.professor_id)
    const assignmentIdByProf = Object.fromEntries(assignments.map(a => [a.professor_id, a.id]))
    setMultiModal({ ecId: ec.id, ecName: ec.name, assignedIds, assignmentIdByProf })
    setMultiSelected(new Set())
  }

  function toggleMulti(profId: number) {
    setMultiSelected(prev => {
      const next = new Set(prev)
      next.has(profId) ? next.delete(profId) : next.add(profId)
      return next
    })
  }

  async function confirmMultiAssign() {
    if (!multiModal) return
    if (multiSelected.size === 0) {
      const allAssigned = professors.length > 0 && professors.every(p => multiModal.assignedIds.includes(p.id))
      error(allAssigned
        ? 'Tous les professeurs disponibles sont déjà affectés à cet EC'
        : 'Cochez au moins un professeur non encore affecté')
      return
    }
    setMultiBusy(true)
    let ok = 0, fail = 0
    for (const profId of multiSelected) {
      try { await api.post(`/api/admin/ecs/${multiModal.ecId}/assign`, { professor_id: profId }); ok++ }
      catch { fail++ }
    }
    setMultiBusy(false); setMultiModal(null)
    if (ok) success(`${ok} professeur(s) assigné(s)${fail ? ` — ${fail} échec(s)` : ''}`)
    else error('Aucune affectation effectuée')
    load()
  }

  const assignedCount = ecs.filter(e =>
    e.assigned_professor_id || (e.assigned_professors?.length ?? 0) > 0
  ).length

  return (
    <div>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <h2>
            <i className="fas fa-link" style={{ marginRight: 10, color: '#1e3a8a' }} />
            Affectations EC aux Professeurs
          </h2>
          <p>Assignez les Éléments Constitutifs aux professeurs responsables</p>
        </div>
        <button className="btn btn-secondary" onClick={load} style={{ background: 'var(--surface)', color: '#1e3a8a', border: '1px solid #bfdbfe' }}>
          <i className="fas fa-rotate" /> Actualiser
        </button>
      </div>

      {/* ── Stats ──────────────────────────────────────────────────────────── */}
      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-label">
            <i className="fas fa-layer-group" style={{ color: '#3b82f6' }} /> ECs au total
          </div>
          <div className="stat-value">{ecs.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">
            <i className="fas fa-circle-check" style={{ color: '#3b82f6' }} /> ECs assignés
          </div>
          <div className="stat-value">{assignedCount}</div>
        </div>
      </div>

      {/* ── Table card ─────────────────────────────────────────────────────── */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <i className="fas fa-list" style={{ color: 'var(--text-muted)', fontSize: 17 }} />
          <h3 style={{ margin: 0 }}>Liste des ECs</h3>
          <span className="status-badge secondary" style={{ marginLeft: 4, fontSize:13, padding: '2px 9px' }}>
            {filtered.length !== ecs.length ? `${filtered.length} / ${ecs.length}` : ecs.length}
          </span>
          <div style={{ marginLeft: 'auto', position: 'relative', minWidth: 260 }}>
            <i className="fas fa-magnifying-glass" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: 14 }} />
            <input className="form-control" value={query} placeholder="Rechercher : code, intitulé, UE, professeur"
              onChange={e => { setQuery(e.target.value); setPage(1) }} style={{ paddingLeft: 32, fontSize: 15 }} />
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <i className="fas fa-spinner fa-spin" style={{ fontSize: 31, color: 'var(--primary)' }} />
          </div>
        ) : ecs.length === 0 ? (
          <div className="empty-message" style={{ padding: '48px 20px' }}>
            <i className="fas fa-inbox" style={{ fontSize: 35, display: 'block', marginBottom: 10 }} />
            Aucun EC disponible. Créez d'abord des formations et des UEs.
          </div>
        ) : (
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Code EC</th>
                  <th>Intitulé</th>
                  <th>UE</th>
                  <th>Professeur actuel</th>
                  <th>Nouvelle affectation</th>
                </tr>
              </thead>
              <tbody>
                {visible.map(ec => {
                  const assignments: ECAssignmentRef[] = ec.assignments?.length
                    ? ec.assignments
                    : (ec.assigned_professors ?? []).map(pid => ({ id: -1, professor_id: pid }))

                  return (
                    <tr key={ec.id}>
                      {/* Code EC */}
                      <td>
                        <span style={{ display: 'inline-block', background: '#eff6ff', color: '#1e3a8a', border: '1px solid #bfdbfe', padding: '3px 10px', borderRadius: 6, fontSize:14.5, fontWeight: 700 }}>
                          {ec.code}
                        </span>
                      </td>

                      {/* Intitulé */}
                      <td style={{ fontWeight: 600, maxWidth: 280 }}>
                        {ec.name}
                      </td>

                      {/* UE */}
                      <td>
                        <span className="status-badge secondary" style={{ fontSize:13, fontFamily: 'monospace' }}>
                          {ec.ue_code || '—'}
                        </span>
                      </td>

                      {/* Professeur actuel — tous les professeurs assignés, retirables un par un
                          (rien n'empêche plusieurs professeurs sur le même EC ; jusqu'ici aucun
                          moyen de voir/retirer les affectations au-delà de la première) */}
                      <td>
                        {assignments.length === 0 ? (
                          <span className="status-badge secondary">
                            <i className="fas fa-circle-minus" /> Non assigné
                          </span>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                            {assignments.map(a => (
                              <span key={a.id} className="status-badge success" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                <i className="fas fa-circle-check" /> {profName(a.professor_id) ?? `#${a.professor_id}`}
                                <button onClick={() => unassign(a.id)} disabled={unassigning === a.id}
                                  title="Retirer ce professeur de cet EC"
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', opacity: .7, padding: 0, marginLeft: 2, lineHeight: 1 }}>
                                  <i className={`fas ${unassigning === a.id ? 'fa-spinner fa-spin' : 'fa-times'}`} style={{ fontSize: 13 }} />
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* Nouvelle affectation */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          {activeRow === ec.id ? (
                            <select autoFocus
                              value={selections[ec.id] ?? ''}
                              onChange={e => setSelections(prev => ({ ...prev, [ec.id]: e.target.value }))}
                              className="form-control"
                              style={{ fontSize:15.5, padding: '7px 10px', minWidth: 200, maxWidth: 240 }}>
                              <option value="">— Sélectionner un professeur —</option>
                              {profOptions}
                            </select>
                          ) : (
                            <button type="button" className="form-control" onClick={() => setActiveRow(ec.id)}
                              style={{ fontSize:15.5, padding: '7px 10px', minWidth: 200, maxWidth: 240, textAlign: 'left', cursor: 'pointer', color: 'var(--text-muted)' }}>
                              — Sélectionner un professeur — <i className="fas fa-chevron-down" style={{ float: 'right', marginTop: 4, fontSize: 12 }} />
                            </button>
                          )}

                          <button
                            className="btn btn-sm btn-primary"
                            onClick={() => assign(ec.id)}
                            disabled={assigning === ec.id || !selections[ec.id]}>
                            <i className={`fas ${assigning === ec.id ? 'fa-spinner fa-spin' : 'fa-link'}`} />
                            Assigner
                          </button>

                          <button
                            className="btn btn-sm btn-secondary btn-icon-sm"
                            onClick={() => openMulti(ec)}
                            title="Affecter plusieurs professeurs"
                            style={{ background: 'var(--surface)', color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
                            <i className="fas fa-users" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="empty-message" style={{ padding: '32px 20px' }}>Aucun EC ne correspond à « {query} ».</div>
            )}
            {pageCount > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '14px 10px', flexWrap: 'wrap' }}>
                <button className="btn btn-sm btn-secondary" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}><i className="fas fa-chevron-left" /></button>
                {Array.from({ length: pageCount }, (_, i) => i + 1)
                  .filter(n => n === 1 || n === pageCount || Math.abs(n - currentPage) <= 2)
                  .map((n, i, arr) => (
                    <span key={n} style={{ display: 'inline-flex', gap: 6 }}>
                      {i > 0 && n - arr[i - 1] > 1 && <span style={{ color: 'var(--text-muted)', alignSelf: 'center' }}>…</span>}
                      <button className={`btn btn-sm ${n === currentPage ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setPage(n)} style={{ minWidth: 36 }}>{n}</button>
                    </span>
                  ))}
                <button className="btn btn-sm btn-secondary" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}><i className="fas fa-chevron-right" /></button>
                <span style={{ fontSize: 14, color: 'var(--text-muted)', marginLeft: 8 }}>
                  {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} sur {filtered.length}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ══ Modal Multi-Affectation ════════════════════════════════════════════ */}
      {multiModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setMultiModal(null)}>
          <div className="card" style={{ padding: 0, width: '100%', maxWidth: 480, maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}
            onClick={e => e.stopPropagation()}>

            {/* Header modal */}
            <div className="card-header">
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                <i className="fas fa-users" style={{ color: 'var(--text-muted)' }} />
                Affecter des professeurs
              </h3>
              <p style={{ margin: '4px 0 0', fontSize:15.5, color: 'var(--text-muted)', fontWeight: 400 }}>
                EC : <strong>{multiModal.ecName}</strong>
              </p>
            </div>

            {/* List */}
            <div style={{ overflowY: 'auto', flex: 1, padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {professors.length === 0 ? (
                <p className="empty-message">Aucun professeur disponible</p>
              ) : professors.every(p => multiModal.assignedIds.includes(p.id)) ? (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 10, fontSize:15.5, color: 'var(--text-muted)' }}>
                  <i className="fas fa-circle-info" style={{ marginTop: 2 }} />
                  <span>Tous les professeurs disponibles sont déjà affectés à cet EC. Créez d'abord un nouveau compte professeur pour pouvoir en affecter un supplémentaire.</span>
                </div>
              ) : null}
              {professors.length > 0 && professors.map(p => {
                const isAssigned = multiModal.assignedIds.includes(p.id)
                const isChecked = isAssigned || multiSelected.has(p.id)
                return (
                  <label key={p.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 14px', borderRadius: 10, cursor: isAssigned ? 'default' : 'pointer',
                    background: 'var(--background)',
                    border: '1px solid var(--border)',
                    userSelect: 'none', transition: 'border-color .15s',
                  }}>
                    <input type="checkbox" checked={isChecked} disabled={isAssigned}
                      onChange={() => !isAssigned && toggleMulti(p.id)}
                      style={{ width: 16, height: 16, accentColor: 'var(--primary)', flexShrink: 0, cursor: isAssigned ? 'default' : 'pointer' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: isAssigned ? 700 : 500, fontSize:17, color: 'var(--text)' }}>
                        {p.full_name}
                        {p.is_active === false && (
                          <span title="Compte inactif : ce professeur ne peut pas se connecter à CEI tant qu'il n'est pas réactivé (Utilisateurs)."
                            style={{ marginLeft: 8, fontSize: 12.5, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: 'var(--surface)', color: 'var(--text-muted)', border: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                            Inactif
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize:14.5, color: 'var(--text-muted)' }}>{p.email}</div>
                    </div>
                    {isAssigned && (
                      <>
                        <span className="status-badge success" style={{ fontSize:13, whiteSpace: 'nowrap' }}>
                          <i className="fas fa-check-circle" /> Assigné
                        </span>
                        <button type="button"
                          onClick={e => { e.preventDefault(); e.stopPropagation(); unassign(multiModal.assignmentIdByProf[p.id]) }}
                          disabled={unassigning === multiModal.assignmentIdByProf[p.id]}
                          title="Retirer ce professeur de cet EC"
                          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-muted)', borderRadius: 6, padding: '3px 8px', fontSize:13, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                          <i className={`fas ${unassigning === multiModal.assignmentIdByProf[p.id] ? 'fa-spinner fa-spin' : 'fa-times'}`} /> Retirer
                        </button>
                      </>
                    )}
                  </label>
                )
              })}
            </div>

            {/* Footer */}
            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button className="btn btn-secondary" onClick={() => setMultiModal(null)}>
                <i className="fas fa-times" /> Fermer
              </button>
              <button className="btn btn-primary" onClick={confirmMultiAssign}
                disabled={multiBusy}
                title={multiSelected.size === 0 ? 'Cochez au moins un professeur non encore affecté' : undefined}>
                <i className={`fas ${multiBusy ? 'fa-spinner fa-spin' : 'fa-save'}`} />
                {multiBusy ? 'Assignation…' : `Assigner (${multiSelected.size})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
