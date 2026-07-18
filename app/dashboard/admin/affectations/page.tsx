'use client'

import { useEffect, useState, useCallback } from 'react'
import api from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'

interface EC {
  id: number
  code: string
  name: string
  ue_code?: string
  ue_name?: string
  assigned_professor_id?: number | null
  assigned_professors?: number[]
}

interface Professor {
  id: number
  full_name: string
  email: string
}

interface MultiModal {
  ecId: number
  ecName: string
  assignedIds: number[]
}

export default function AdminAffectationsPage() {
  const { success, error } = useToast()

  const [ecs, setEcs] = useState<EC[]>([])
  const [professors, setProfessors] = useState<Professor[]>([])
  const [loading, setLoading] = useState(true)
  const [assigning, setAssigning] = useState<number | null>(null)
  const [selections, setSelections] = useState<Record<number, string>>({})
  const [multiModal, setMultiModal] = useState<MultiModal | null>(null)
  const [multiSelected, setMultiSelected] = useState<Set<number>>(new Set())
  const [multiBusy, setMultiBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [ecsRes, usersRes] = await Promise.all([
        api.get<any>('/api/ecs'),
        api.get<any>('/api/admin/users'),
      ])
      const ecList: EC[] = Array.isArray(ecsRes) ? ecsRes : ecsRes.ecs ?? []
      const userList: any[] = Array.isArray(usersRes) ? usersRes : usersRes.users ?? []
      setEcs(ecList)
      setProfessors(userList.filter((u: any) => u.role === 'professor'))
    } catch { error('Erreur chargement') }
    finally { setLoading(false) }
  }, []) // eslint-disable-line

  useEffect(() => { load() }, [load])

  const profName = (id?: number | null) =>
    id ? (professors.find(p => p.id === id)?.full_name ?? null) : null

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

  function openMulti(ec: EC) {
    const assignedIds = ec.assigned_professors?.length
      ? ec.assigned_professors
      : ec.assigned_professor_id ? [ec.assigned_professor_id] : []
    setMultiModal({ ecId: ec.id, ecName: ec.name, assignedIds })
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
            <i className="fas fa-link" style={{ marginRight: 10, color: 'var(--primary)' }} />
            Affectations EC aux Professeurs
          </h2>
          <p>Assignez les Éléments Constitutifs aux professeurs responsables</p>
        </div>
        <button className="btn btn-secondary" onClick={load}>
          <i className="fas fa-rotate" /> Actualiser
        </button>
      </div>

      {/* ── Stats ──────────────────────────────────────────────────────────── */}
      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: 24 }}>
        <div className="stat-card" style={{ borderColor: '#3b82f6' }}>
          <div className="stat-label">
            <i className="fas fa-layer-group" style={{ color: '#3b82f6' }} /> ECs au total
          </div>
          <div className="stat-value" style={{ color: '#3b82f6' }}>{ecs.length}</div>
        </div>
        <div className="stat-card" style={{ borderColor: '#10b981' }}>
          <div className="stat-label">
            <i className="fas fa-circle-check" style={{ color: '#10b981' }} /> ECs assignés
          </div>
          <div className="stat-value" style={{ color: '#10b981' }}>{assignedCount}</div>
        </div>
      </div>

      {/* ── Table card ─────────────────────────────────────────────────────── */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <i className="fas fa-list" style={{ color: 'var(--text-muted)', fontSize: 14 }} />
          <h3 style={{ margin: 0 }}>Liste des ECs</h3>
          <span className="status-badge secondary" style={{ marginLeft: 4, fontSize: 11, padding: '2px 9px' }}>
            {ecs.length}
          </span>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <i className="fas fa-spinner fa-spin" style={{ fontSize: 28, color: 'var(--primary)' }} />
          </div>
        ) : ecs.length === 0 ? (
          <div className="empty-message" style={{ padding: '48px 20px' }}>
            <i className="fas fa-inbox" style={{ fontSize: 32, display: 'block', marginBottom: 10 }} />
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
                {ecs.map(ec => {
                  const currentProfId = ec.assigned_professor_id ?? (ec.assigned_professors?.[0] ?? null)
                  const name = profName(currentProfId)

                  return (
                    <tr key={ec.id}>
                      {/* Code EC */}
                      <td>
                        <span style={{ display: 'inline-block', background: '#dbeafe', color: '#1d4ed8', padding: '3px 10px', borderRadius: 6, fontSize: 12, fontWeight: 700 }}>
                          {ec.code}
                        </span>
                      </td>

                      {/* Intitulé */}
                      <td style={{ fontWeight: 600, maxWidth: 280 }}>
                        {ec.name}
                      </td>

                      {/* UE */}
                      <td>
                        <span className="status-badge secondary" style={{ fontSize: 11, fontFamily: 'monospace' }}>
                          {ec.ue_code || '—'}
                        </span>
                      </td>

                      {/* Professeur actuel */}
                      <td>
                        {name ? (
                          <span className="status-badge success">
                            <i className="fas fa-circle-check" /> {name}
                          </span>
                        ) : (
                          <span className="status-badge secondary">
                            <i className="fas fa-circle-minus" /> Non assigné
                          </span>
                        )}
                      </td>

                      {/* Nouvelle affectation */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <select
                            value={selections[ec.id] ?? ''}
                            onChange={e => setSelections(prev => ({ ...prev, [ec.id]: e.target.value }))}
                            className="form-control"
                            style={{ fontSize: 13, padding: '7px 10px', minWidth: 200, maxWidth: 240 }}>
                            <option value="">— Sélectionner un professeur —</option>
                            {professors.map(p => (
                              <option key={p.id} value={p.id}>{p.full_name}</option>
                            ))}
                          </select>

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
                            style={{ background: '#eff6ff', color: '#2563eb', borderColor: '#bfdbfe' }}>
                            <i className="fas fa-users" />
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

      {/* ══ Modal Multi-Affectation ════════════════════════════════════════════ */}
      {multiModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setMultiModal(null)}>
          <div className="card" style={{ padding: 0, width: '100%', maxWidth: 480, maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}
            onClick={e => e.stopPropagation()}>

            {/* Header modal */}
            <div className="card-header">
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                <i className="fas fa-users" style={{ color: 'var(--primary)' }} />
                Affecter des professeurs
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)', fontWeight: 400 }}>
                EC : <strong>{multiModal.ecName}</strong>
              </p>
            </div>

            {/* List */}
            <div style={{ overflowY: 'auto', flex: 1, padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {professors.length === 0 ? (
                <p className="empty-message">Aucun professeur disponible</p>
              ) : professors.every(p => multiModal.assignedIds.includes(p.id)) ? (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, fontSize: 13, color: '#92400e' }}>
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
                    background: isAssigned ? '#f0fdf4' : 'var(--background)',
                    border: `1.5px solid ${isAssigned ? '#bbf7d0' : 'var(--border)'}`,
                    userSelect: 'none', transition: 'border-color .15s',
                  }}>
                    <input type="checkbox" checked={isChecked} disabled={isAssigned}
                      onChange={() => !isAssigned && toggleMulti(p.id)}
                      style={{ width: 16, height: 16, accentColor: '#3b82f6', flexShrink: 0, cursor: isAssigned ? 'default' : 'pointer' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: isAssigned ? 700 : 500, fontSize: 14, color: isAssigned ? '#15803d' : 'var(--text)' }}>
                        {p.full_name}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.email}</div>
                    </div>
                    {isAssigned && (
                      <span className="status-badge success" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
                        <i className="fas fa-check-circle" /> Assigné
                      </span>
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
