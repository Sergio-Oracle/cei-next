'use client'

import { useEffect, useState, useCallback } from 'react'
import api from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'

interface Member { id: number; proctor_id: number; proctor_name: string; proctor_email: string; proctor_last_login?: string | null }
interface Group { id: number; name: string; created_by?: string; created_at?: string; members: Member[]; ec_ids: number[] }
interface Surveillant { id: number; full_name: string; email: string; last_login?: string | null }
interface EC { id: number; code: string; name: string; ue_code?: string }

function lastSeenLabel(iso?: string | null) {
  if (!iso) return { text: 'Jamais connecté', color: '#94a3b8' }
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = diffMs / 60000
  if (mins < 15) return { text: 'En ligne récemment', color: '#10b981' }
  if (mins < 60 * 24) return { text: `Vu il y a ${Math.round(mins / 60)}h`, color: '#f59e0b' }
  return { text: `Vu le ${new Date(iso).toLocaleDateString('fr-FR')}`, color: '#94a3b8' }
}

export default function ProctorGroupsPage() {
  const { success, error } = useToast()

  const [groups, setGroups] = useState<Group[]>([])
  const [surveillants, setSurveillants] = useState<Surveillant[]>([])
  const [ecs, setEcs] = useState<EC[]>([])
  const [loading, setLoading] = useState(true)

  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)

  const [manageGroup, setManageGroup] = useState<Group | null>(null)
  const [memberSelected, setMemberSelected] = useState<Set<number>>(new Set())
  const [addingMembers, setAddingMembers] = useState(false)
  const [ecToLink, setEcToLink] = useState('')
  const [linkingEc, setLinkingEc] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [groupsRes, usersRes, ecsRes] = await Promise.all([
        api.get<Group[]>('/api/admin/proctor_groups'),
        api.get<any>('/api/admin/users'),
        api.get<any>('/api/ecs'),
      ])
      setGroups(Array.isArray(groupsRes) ? groupsRes : [])
      const userList: any[] = Array.isArray(usersRes) ? usersRes : usersRes.users ?? []
      setSurveillants(userList.filter((u: any) => u.role === 'surveillant'))
      setEcs(Array.isArray(ecsRes) ? ecsRes : ecsRes.ecs ?? [])
    } catch { error('Erreur chargement') }
    finally { setLoading(false) }
  }, []) // eslint-disable-line

  useEffect(() => { load() }, [load])

  async function createGroup() {
    if (!newName.trim()) { error('Nom du groupe requis'); return }
    setCreating(true)
    try {
      await api.post('/api/admin/proctor_groups', { name: newName.trim() })
      success('Groupe créé')
      setNewName('')
      load()
    } catch (e: any) { error(e.message || 'Erreur création') }
    finally { setCreating(false) }
  }

  async function deleteGroup(g: Group) {
    if (!confirm(`Supprimer le groupe « ${g.name} » ?`)) return
    try {
      await api.delete(`/api/admin/proctor_groups/${g.id}`)
      success('Groupe supprimé')
      load()
    } catch (e: any) { error(e.message || 'Erreur suppression') }
  }

  function openManage(g: Group) {
    setManageGroup(g); setMemberSelected(new Set()); setEcToLink('')
  }

  function toggleMemberSel(id: number) {
    setMemberSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  async function addMembers() {
    if (!manageGroup || memberSelected.size === 0) { error('Sélectionnez au moins un surveillant'); return }
    setAddingMembers(true)
    try {
      const res = await api.post<{ group: Group }>(`/api/admin/proctor_groups/${manageGroup.id}/members`, { proctor_ids: [...memberSelected] })
      success(`${memberSelected.size} surveillant(s) ajouté(s) — notifiés automatiquement`)
      setManageGroup(res.group)
      setMemberSelected(new Set())
      load()
    } catch (e: any) { error(e.message || 'Erreur ajout') }
    finally { setAddingMembers(false) }
  }

  async function removeMember(m: Member) {
    if (!manageGroup) return
    try {
      await api.delete(`/api/admin/proctor_groups/${manageGroup.id}/members/${m.id}`)
      setManageGroup(g => g ? { ...g, members: g.members.filter(x => x.id !== m.id) } : g)
      load()
    } catch (e: any) { error(e.message || 'Erreur retrait') }
  }

  async function linkEc() {
    if (!manageGroup || !ecToLink) { error('Sélectionnez un EC'); return }
    setLinkingEc(true)
    try {
      const res = await api.post<Group>(`/api/admin/proctor_groups/${manageGroup.id}/ecs`, { ec_id: Number(ecToLink) })
      setManageGroup(res)
      setEcToLink('')
      success('EC rattaché au groupe')
      load()
    } catch (e: any) { error(e.message || 'Erreur rattachement') }
    finally { setLinkingEc(false) }
  }

  async function unlinkEc(ecId: number) {
    if (!manageGroup) return
    try {
      await api.delete(`/api/admin/proctor_groups/${manageGroup.id}/ecs/${ecId}`)
      setManageGroup(g => g ? { ...g, ec_ids: g.ec_ids.filter(x => x !== ecId) } : g)
      load()
    } catch (e: any) { error(e.message || 'Erreur retrait') }
  }

  const ecName = (id: number) => { const e = ecs.find(x => x.id === id); return e ? `${e.code} — ${e.name}` : `EC #${id}` }
  const availableSurveillants = manageGroup ? surveillants.filter(s => !manageGroup.members.some(m => m.proctor_id === s.id)) : []
  const availableEcs = manageGroup ? ecs.filter(e => !manageGroup.ec_ids.includes(e.id)) : []

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>
            <i className="fas fa-user-shield" style={{ marginRight: 10, color: 'var(--primary)' }} />
            Groupes de Surveillants
          </h2>
          <p>Regroupez des surveillants par EC — ils seront automatiquement affectés à chaque nouvel examen créé pour cet EC</p>
        </div>
        <button className="btn btn-secondary" onClick={load}>
          <i className="fas fa-rotate" /> Actualiser
        </button>
      </div>

      {/* Création */}
      <div className="card" style={{ padding: 20, marginBottom: 20, display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Nouveau groupe</label>
          <input className="form-control" value={newName} onChange={e => setNewName(e.target.value)}
            placeholder="Ex : Surveillants Informatique L1" onKeyDown={e => e.key === 'Enter' && createGroup()} />
        </div>
        <button className="btn btn-primary" onClick={createGroup} disabled={creating || !newName.trim()}>
          <i className={`fas ${creating ? 'fa-spinner fa-spin' : 'fa-plus'}`} /> Créer
        </button>
      </div>

      {/* Liste */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><i className="fas fa-spinner fa-spin" style={{ fontSize: 28, color: 'var(--primary)' }} /></div>
      ) : groups.length === 0 ? (
        <div className="empty-message" style={{ padding: '48px 20px' }}>
          <i className="fas fa-inbox" style={{ fontSize: 32, display: 'block', marginBottom: 10 }} />
          Aucun groupe de surveillants créé
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 14 }}>
          {groups.map(g => (
            <div key={g.id} className="card" style={{ padding: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{g.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Créé par {g.created_by || '—'}</div>
                </div>
                <button onClick={() => deleteGroup(g)} title="Supprimer"
                  style={{ background: '#fef2f2', border: 'none', color: '#ef4444', padding: '5px 9px', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
                  <i className="fas fa-trash" />
                </button>
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                <span className="status-badge secondary" style={{ fontSize: 11 }}><i className="fas fa-users" /> {g.members.length} surveillant(s)</span>
                <span className="status-badge secondary" style={{ fontSize: 11 }}><i className="fas fa-book" /> {g.ec_ids.length} EC</span>
              </div>
              <button className="btn btn-secondary" style={{ width: '100%', fontSize: 13 }} onClick={() => openManage(g)}>
                <i className="fas fa-gear" /> Gérer
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ══ Modal gestion groupe ══ */}
      {manageGroup && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setManageGroup(null)}>
          <div className="card" style={{ padding: 0, width: '100%', maxWidth: 560, maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}
            onClick={e => e.stopPropagation()}>
            <div className="card-header">
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                <i className="fas fa-user-shield" style={{ color: 'var(--primary)' }} /> {manageGroup.name}
              </h3>
              <button onClick={() => setManageGroup(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', fontSize: 17, cursor: 'pointer', color: 'var(--text-muted)' }}>
                <i className="fas fa-times" />
              </button>
            </div>

            <div style={{ overflowY: 'auto', flex: 1, padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Membres actuels */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>
                  Membres ({manageGroup.members.length})
                </div>
                {manageGroup.members.length === 0 ? (
                  <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Aucun membre pour l'instant</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {manageGroup.members.map(m => {
                      const seen = lastSeenLabel(m.proctor_last_login)
                      return (
                        <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--background)', borderRadius: 8, border: '1px solid var(--border)' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>{m.proctor_name}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{m.proctor_email}</div>
                          </div>
                          <span style={{ fontSize: 11, color: seen.color, whiteSpace: 'nowrap' }}><i className="fas fa-circle" style={{ fontSize: 7, marginRight: 4 }} />{seen.text}</span>
                          <button onClick={() => removeMember(m)} title="Retirer"
                            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 13 }}>
                            <i className="fas fa-times" />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Ajouter des membres */}
              {availableSurveillants.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Ajouter des surveillants</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto', marginBottom: 10 }}>
                    {availableSurveillants.map(s => (
                      <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8, cursor: 'pointer', border: '1.5px solid var(--border)' }}>
                        <input type="checkbox" checked={memberSelected.has(s.id)} onChange={() => toggleMemberSel(s.id)}
                          style={{ width: 15, height: 15, accentColor: 'var(--primary)' }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 500 }}>{s.full_name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.email}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                  <button className="btn btn-primary" style={{ fontSize: 13 }} onClick={addMembers} disabled={addingMembers || memberSelected.size === 0}>
                    <i className={`fas ${addingMembers ? 'fa-spinner fa-spin' : 'fa-user-plus'}`} /> Ajouter ({memberSelected.size})
                  </button>
                </div>
              )}

              {/* ECs rattachés */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>
                  ECs rattachés ({manageGroup.ec_ids.length})
                </div>
                {manageGroup.ec_ids.length === 0 ? (
                  <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Aucun EC rattaché — le groupe ne sera pas auto-affecté</p>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                    {manageGroup.ec_ids.map(ecId => (
                      <span key={ecId} className="status-badge secondary" style={{ fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        {ecName(ecId)}
                        <button onClick={() => unlinkEc(ecId)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 11 }}><i className="fas fa-times" /></button>
                      </span>
                    ))}
                  </div>
                )}
                {availableEcs.length > 0 && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <select className="form-control" value={ecToLink} onChange={e => setEcToLink(e.target.value)} style={{ flex: 1, fontSize: 13 }}>
                      <option value="">— Sélectionner un EC —</option>
                      {availableEcs.map(e => <option key={e.id} value={e.id}>{e.code} — {e.name}</option>)}
                    </select>
                    <button className="btn btn-secondary" style={{ fontSize: 13 }} onClick={linkEc} disabled={linkingEc || !ecToLink}>
                      <i className={`fas ${linkingEc ? 'fa-spinner fa-spin' : 'fa-link'}`} /> Rattacher
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setManageGroup(null)}>Fermer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
