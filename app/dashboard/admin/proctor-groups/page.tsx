'use client'

import { useEffect, useState, useCallback } from 'react'
import api from '@/lib/api'
import { fetchUsersByRole } from '@/lib/fetchUsersByRole'
import { useToast } from '@/contexts/ToastContext'
import SearchableSelect from '@/components/ui/SearchableSelect'

interface Member { id: number; proctor_id: number; proctor_name: string; proctor_email: string; proctor_last_login?: string | null }
interface SupervisorLink { id: number; supervisor_id: number; supervisor_name: string; supervisor_email: string }
interface Group { id: number; name: string; created_by?: string; created_at?: string; members: Member[]; ec_ids: number[]; exam_ids?: number[]; supervisors: SupervisorLink[]; vigilance_level?: 'A' | 'B' | 'C' }

const VIGILANCE_META: Record<'A' | 'B' | 'C', { label: string; hint: string }> = {
  A: { label: 'Niveau A — Interaction', hint: 'Actif si le surveillant interagit réellement (souris/clavier) sur un onglet visible et au premier plan.' },
  B: { label: 'Niveau B — Interaction + suivi', hint: 'Niveau A, et le surveillant doit aussi avoir consulté un flux étudiant récemment.' },
  C: { label: 'Niveau C — + Présence caméra', hint: 'Niveau B, et une vérification périodique confirme un visage devant la caméra du surveillant (aucune image transmise ni stockée, juste oui/non).' },
}
interface Surveillant { id: number; full_name: string; email: string; last_login?: string | null }
interface Superviseur { id: number; full_name: string; email: string }
interface EC { id: number; code: string; name: string; ue_code?: string }
interface PlannedExam {
  id: number; title: string; status: string | null; start_time: string; end_time: string; effective_end_time: string
  ec_code: string | null; ec_name: string | null; source?: 'ec' | 'exam'; conflicts_with?: number[]
  available?: boolean; conflict?: string | null
}
interface MemberWarning { proctor: string; exam: string; with_exam: string; other_group: string }

const fmtDay = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
const fmtHour = (iso: string) => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
const examLabel = (e: PlannedExam) =>
  `${new Date(e.start_time).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })} ${fmtHour(e.start_time)}–${fmtHour(e.end_time)} · ${e.title}${e.ec_code ? ` (${e.ec_code})` : ''}`

function lastSeenLabel(iso?: string | null) {
  if (!iso) return { text: 'Jamais connecté', color: '#94a3b8' }
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = diffMs / 60000
  if (mins < 15) return { text: 'En ligne récemment', color: '#10b981' }
  if (mins < 60 * 24) return { text: `Vu il y a ${Math.round(mins / 60)}h`, color: '#f59e0b' }
  return { text: `Vu le ${new Date(iso).toLocaleDateString('fr-FR')}`, color: '#94a3b8' }
}

export default function ProctorGroupsPage() {
  const { success, error, showToast } = useToast()

  const [groups, setGroups] = useState<Group[]>([])
  const [surveillants, setSurveillants] = useState<Surveillant[]>([])
  const [superviseurs, setSuperviseurs] = useState<Superviseur[]>([])
  const [ecs, setEcs] = useState<EC[]>([])
  const [loading, setLoading] = useState(true)
  const [assigningVigilance, setAssigningVigilance] = useState(false)

  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)

  const [manageGroup, setManageGroup] = useState<Group | null>(null)
  const [memberSelected, setMemberSelected] = useState<Set<number>>(new Set())
  const [addingMembers, setAddingMembers] = useState(false)
  const [supervisorSelected, setSupervisorSelected] = useState<Set<number>>(new Set())
  const [addingSupervisors, setAddingSupervisors] = useState(false)
  const [ecToLink, setEcToLink] = useState('')
  const [linkingEc, setLinkingEc] = useState(false)
  const [schedule, setSchedule] = useState<PlannedExam[]>([])
  const [candidates, setCandidates] = useState<PlannedExam[]>([])
  const [examToLink, setExamToLink] = useState('')
  const [linkingExam, setLinkingExam] = useState(false)
  const [scheduleTick, setScheduleTick] = useState(0)

  // Planning et examens rattachables, rechargés à l'ouverture du groupe et
  // après chaque changement (membres, EC, examens).
  const manageId = manageGroup?.id
  useEffect(() => {
    if (!manageId) { setSchedule([]); setCandidates([]); return }
    let alive = true
    Promise.all([
      api.get<{ exams: PlannedExam[] }>(`/api/admin/proctor_groups/${manageId}/schedule`),
      api.get<{ exams: PlannedExam[] }>(`/api/admin/proctor_groups/${manageId}/exam_candidates`),
    ]).then(([sch, cand]) => {
      if (!alive) return
      setSchedule(sch.exams || [])
      setCandidates(cand.exams || [])
    }).catch(() => {})
    return () => { alive = false }
  }, [manageId, scheduleTick])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [groupsRes, survList, supList, ecsRes] = await Promise.all([
        api.get<Group[]>('/api/admin/proctor_groups'),
        fetchUsersByRole('surveillant'),
        fetchUsersByRole('superviseur'),
        api.get<any>('/api/ecs'),
      ])
      setGroups(Array.isArray(groupsRes) ? groupsRes : [])
      setSurveillants(survList)
      setSuperviseurs(supList)
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
    setManageGroup(g); setMemberSelected(new Set()); setSupervisorSelected(new Set()); setEcToLink(''); setExamToLink('')
  }

  function toggleMemberSel(id: number) {
    setMemberSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  function toggleSupervisorSel(id: number) {
    setSupervisorSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
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

  async function addSupervisors() {
    if (!manageGroup || supervisorSelected.size === 0) { error('Sélectionnez au moins un superviseur'); return }
    setAddingSupervisors(true)
    try {
      const res = await api.post<{ group: Group }>(`/api/admin/proctor_groups/${manageGroup.id}/supervisors`, { supervisor_ids: [...supervisorSelected] })
      success(`${supervisorSelected.size} superviseur(s) ajouté(s)`)
      setManageGroup(res.group)
      setSupervisorSelected(new Set())
      load()
    } catch (e: any) { error(e.message || 'Erreur ajout') }
    finally { setAddingSupervisors(false) }
  }

  async function removeSupervisor(s: SupervisorLink) {
    if (!manageGroup) return
    try {
      await api.delete(`/api/admin/proctor_groups/${manageGroup.id}/supervisors/${s.id}`)
      setManageGroup(g => g ? { ...g, supervisors: g.supervisors.filter(x => x.id !== s.id) } : g)
      load()
    } catch (e: any) { error(e.message || 'Erreur retrait') }
  }

  async function assignVigilance(level: 'A' | 'B' | 'C') {
    if (!manageGroup) return
    setAssigningVigilance(true)
    try {
      const res = await api.put<Group>(`/api/admin/proctor_groups/${manageGroup.id}`, { vigilance_level: level })
      setManageGroup(res)
      success('Niveau de vigilance mis à jour')
      load()
    } catch (e: any) { error(e.message || 'Erreur mise à jour') }
    finally { setAssigningVigilance(false) }
  }

  async function linkEc() {
    if (!manageGroup || !ecToLink) { error('Sélectionnez un EC'); return }
    setLinkingEc(true)
    try {
      const res = await api.post<Group>(`/api/admin/proctor_groups/${manageGroup.id}/ecs`, { ec_id: Number(ecToLink) })
      setManageGroup(res)
      setEcToLink('')
      success('EC rattaché au groupe')
      warnMembers((res as any).member_warnings)
      setScheduleTick(t => t + 1)
      load()
    } catch (e: any) { error(conflictMessage(e, 'Erreur rattachement')) }
    finally { setLinkingEc(false) }
  }

  // Refus du serveur pour chevauchement : on nomme l'examen en conflit.
  function conflictMessage(e: any, fallback: string) {
    const c = e?.data?.conflicts?.[0]
    return c ? `${e.message} Conflit : ${c.exam} et ${c.with_exam}.` : (e?.message || fallback)
  }

  function warnMembers(list?: MemberWarning[]) {
    if (!list?.length) return
    const w = list[0]
    const more = list.length > 1 ? ` (+${list.length - 1} autre${list.length > 2 ? 's' : ''})` : ''
    showToast(`Attention : ${w.proctor} surveille déjà ${w.with_exam} avec le groupe « ${w.other_group} »${more}.`, 'warning', 9000)
  }

  async function linkExam() {
    if (!manageGroup || !examToLink) { error('Sélectionnez un examen'); return }
    setLinkingExam(true)
    try {
      const res = await api.post<Group & { member_warnings?: MemberWarning[] }>(`/api/admin/proctor_groups/${manageGroup.id}/exams`, { exam_id: Number(examToLink) })
      setManageGroup(res)
      setExamToLink('')
      success('Examen ajouté au planning du groupe')
      warnMembers(res.member_warnings)
      setScheduleTick(t => t + 1)
      load()
    } catch (e: any) { error(conflictMessage(e, 'Erreur rattachement')) }
    finally { setLinkingExam(false) }
  }

  async function unlinkExam(examId: number) {
    if (!manageGroup) return
    try {
      await api.delete(`/api/admin/proctor_groups/${manageGroup.id}/exams/${examId}`)
      setManageGroup(g => g ? { ...g, exam_ids: (g.exam_ids || []).filter(x => x !== examId) } : g)
      setScheduleTick(t => t + 1)
      load()
    } catch (e: any) { error(e.message || 'Erreur retrait') }
  }

  async function unlinkEc(ecId: number) {
    if (!manageGroup) return
    try {
      await api.delete(`/api/admin/proctor_groups/${manageGroup.id}/ecs/${ecId}`)
      setManageGroup(g => g ? { ...g, ec_ids: g.ec_ids.filter(x => x !== ecId) } : g)
      setScheduleTick(t => t + 1)
      load()
    } catch (e: any) { error(e.message || 'Erreur retrait') }
  }

  const ecName = (id: number) => { const e = ecs.find(x => x.id === id); return e ? `${e.code} — ${e.name}` : `EC #${id}` }
  const availableSurveillants = manageGroup ? surveillants.filter(s => !manageGroup.members.some(m => m.proctor_id === s.id)) : []
  const availableSuperviseurs = manageGroup ? superviseurs.filter(s => !manageGroup.supervisors.some(x => x.supervisor_id === s.id)) : []
  const availableEcs = manageGroup ? ecs.filter(e => !manageGroup.ec_ids.includes(e.id)) : []

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>
            <i className="fas fa-user-shield" style={{ marginRight: 10, color: 'var(--primary)' }} />
            Groupes de Surveillants
          </h2>
          <p>Regroupez des surveillants par EC — ils sont automatiquement affectés à tout examen (nouveau ou déjà planifié) de cet EC, avec répartition des étudiants entre eux. Ajouter un surveillant en renfort le propage immédiatement à tous les examens planifiés de l'EC.</p>
        </div>
        <button className="btn btn-secondary" onClick={load}>
          <i className="fas fa-rotate" /> Actualiser
        </button>
      </div>

      {/* Création */}
      <div className="card" style={{ padding: 20, marginBottom: 20, display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <label style={{ fontSize:15.5, fontWeight: 600, display: 'block', marginBottom: 6 }}>Nouveau groupe</label>
          <input className="form-control" value={newName} onChange={e => setNewName(e.target.value)}
            placeholder="Ex : Surveillants Informatique L1" onKeyDown={e => e.key === 'Enter' && createGroup()} />
        </div>
        <button className="btn btn-primary" onClick={createGroup} disabled={creating}
          title={!newName.trim() ? 'Saisissez un nom de groupe' : undefined}>
          <i className={`fas ${creating ? 'fa-spinner fa-spin' : 'fa-plus'}`} /> Créer
        </button>
      </div>

      {/* Liste */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><i className="fas fa-spinner fa-spin" style={{ fontSize: 31, color: 'var(--primary)' }} /></div>
      ) : groups.length === 0 ? (
        <div className="empty-message" style={{ padding: '48px 20px' }}>
          <i className="fas fa-inbox" style={{ fontSize: 35, display: 'block', marginBottom: 10 }} />
          Aucun groupe de surveillants créé
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 14 }}>
          {groups.map(g => (
            <div key={g.id} className="card" style={{ padding: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize:18 }}>{g.name}</div>
                  <div style={{ fontSize:14.5, color: 'var(--text-muted)' }}>Créé par {g.created_by || '—'}</div>
                  <div style={{ fontSize:14.5, color: g.supervisors.length > 0 ? '#0891b2' : 'var(--text-muted)' }}>
                    <i className="fas fa-user-shield" style={{ marginRight: 4 }} />
                    {g.supervisors.length > 0 ? g.supervisors.map(s => s.supervisor_name).join(', ') : 'Aucun superviseur'}
                  </div>
                </div>
                <button onClick={() => deleteGroup(g)} title="Supprimer"
                  style={{ background: '#fef2f2', border: 'none', color: '#ef4444', padding: '5px 9px', borderRadius: 6, cursor: 'pointer', fontSize:14.5 }}>
                  <i className="fas fa-trash" />
                </button>
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                <span className="status-badge secondary" style={{ fontSize:13 }}><i className="fas fa-users" /> {g.members.length} surveillant(s)</span>
                <span className="status-badge secondary" style={{ fontSize:13 }}><i className="fas fa-book" /> {g.ec_ids.length} EC</span>
                {(g.exam_ids?.length ?? 0) > 0 && (
                  <span className="status-badge secondary" style={{ fontSize:13 }}><i className="fas fa-calendar-check" /> {g.exam_ids!.length} examen{g.exam_ids!.length > 1 ? 's' : ''} précis</span>
                )}
                <span className="status-badge secondary" style={{ fontSize:13 }}><i className="fas fa-shield-halved" /> Vigilance {g.vigilance_level || 'A'}</span>
              </div>
              <button className="btn btn-secondary" style={{ width: '100%', fontSize:15.5 }} onClick={() => openManage(g)}>
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
              <button onClick={() => setManageGroup(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', fontSize:20.5, cursor: 'pointer', color: 'var(--text-muted)' }}>
                <i className="fas fa-times" />
              </button>
            </div>

            <div style={{ overflowY: 'auto', flex: 1, padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Superviseurs actuels */}
              <div>
                <div style={{ fontSize:14.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>
                  Superviseurs ({manageGroup.supervisors.length})
                </div>
                {manageGroup.supervisors.length === 0 ? (
                  <p style={{ fontSize:15.5, color: 'var(--text-muted)' }}>Aucun superviseur pour l'instant</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {manageGroup.supervisors.map(s => (
                      <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--background)', borderRadius: 8, border: '1px solid var(--border)' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize:15.5 }}>{s.supervisor_name}</div>
                          <div style={{ fontSize:13, color: 'var(--text-muted)' }}>{s.supervisor_email}</div>
                        </div>
                        <button onClick={() => removeSupervisor(s)} title="Retirer"
                          style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize:15.5 }}>
                          <i className="fas fa-times" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Ajouter des superviseurs */}
              {availableSuperviseurs.length > 0 && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ fontSize:14.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Ajouter des superviseurs</div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize:14.5, fontWeight: 600, color: 'var(--primary)', cursor: 'pointer' }}>
                      <input type="checkbox"
                        checked={availableSuperviseurs.length > 0 && availableSuperviseurs.every(s => supervisorSelected.has(s.id))}
                        onChange={e => setSupervisorSelected(e.target.checked ? new Set(availableSuperviseurs.map(s => s.id)) : new Set())}
                        style={{ width: 14, height: 14, accentColor: 'var(--primary)', cursor: 'pointer' }} />
                      Tout cocher
                    </label>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto', marginBottom: 10 }}>
                    {availableSuperviseurs.map(s => (
                      <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8, cursor: 'pointer', border: '1.5px solid var(--border)' }}>
                        <input type="checkbox" checked={supervisorSelected.has(s.id)} onChange={() => toggleSupervisorSel(s.id)}
                          style={{ width: 15, height: 15, accentColor: 'var(--primary)' }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize:15.5, fontWeight: 500 }}>{s.full_name}</div>
                          <div style={{ fontSize:13, color: 'var(--text-muted)' }}>{s.email}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                  <button className="btn btn-primary" style={{ fontSize:15.5 }} onClick={addSupervisors} disabled={addingSupervisors}
                    title={supervisorSelected.size === 0 ? 'Cochez au moins un superviseur' : undefined}>
                    <i className={`fas ${addingSupervisors ? 'fa-spinner fa-spin' : 'fa-user-plus'}`} /> Ajouter ({supervisorSelected.size})
                  </button>
                </div>
              )}
              {superviseurs.length === 0 && (
                <p style={{ fontSize:14.5, color: 'var(--text-muted)', margin: '-12px 0 0' }}>
                  Aucun compte superviseur — créez-en un depuis « Utilisateurs ».
                </p>
              )}

              {/* Niveau de vigilance */}
              <div>
                <div style={{ fontSize:14.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>
                  Niveau de vigilance
                </div>
                <select value={manageGroup.vigilance_level || 'A'} disabled={assigningVigilance}
                  onChange={e => assignVigilance(e.target.value as 'A' | 'B' | 'C')}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize:15.5 }}>
                  {(['A', 'B', 'C'] as const).map(l => <option key={l} value={l}>{VIGILANCE_META[l].label}</option>)}
                </select>
                <p style={{ fontSize:14.5, color: 'var(--text-muted)', margin: '6px 0 0' }}>
                  {VIGILANCE_META[manageGroup.vigilance_level || 'A'].hint}
                </p>
              </div>

              {/* Membres actuels */}
              <div>
                <div style={{ fontSize:14.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>
                  Membres ({manageGroup.members.length})
                </div>
                {manageGroup.members.length === 0 ? (
                  <p style={{ fontSize:15.5, color: 'var(--text-muted)' }}>Aucun membre pour l'instant</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {manageGroup.members.map(m => {
                      const seen = lastSeenLabel(m.proctor_last_login)
                      return (
                        <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--background)', borderRadius: 8, border: '1px solid var(--border)' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize:15.5 }}>{m.proctor_name}</div>
                            <div style={{ fontSize:13, color: 'var(--text-muted)' }}>{m.proctor_email}</div>
                          </div>
                          <span style={{ fontSize:13, color: seen.color, whiteSpace: 'nowrap' }}><i className="fas fa-circle" style={{ fontSize: 8, marginRight: 4 }} />{seen.text}</span>
                          <button onClick={() => removeMember(m)} title="Retirer"
                            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize:15.5 }}>
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
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ fontSize:14.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Ajouter des surveillants</div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize:14.5, fontWeight: 600, color: 'var(--primary)', cursor: 'pointer' }}>
                      <input type="checkbox"
                        checked={availableSurveillants.length > 0 && availableSurveillants.every(s => memberSelected.has(s.id))}
                        onChange={e => setMemberSelected(e.target.checked ? new Set(availableSurveillants.map(s => s.id)) : new Set())}
                        style={{ width: 14, height: 14, accentColor: 'var(--primary)', cursor: 'pointer' }} />
                      Tout cocher
                    </label>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto', marginBottom: 10 }}>
                    {availableSurveillants.map(s => (
                      <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8, cursor: 'pointer', border: '1.5px solid var(--border)' }}>
                        <input type="checkbox" checked={memberSelected.has(s.id)} onChange={() => toggleMemberSel(s.id)}
                          style={{ width: 15, height: 15, accentColor: 'var(--primary)' }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize:15.5, fontWeight: 500 }}>{s.full_name}</div>
                          <div style={{ fontSize:13, color: 'var(--text-muted)' }}>{s.email}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                  <button className="btn btn-primary" style={{ fontSize:15.5 }} onClick={addMembers} disabled={addingMembers}
                    title={memberSelected.size === 0 ? 'Cochez au moins un surveillant' : undefined}>
                    <i className={`fas ${addingMembers ? 'fa-spinner fa-spin' : 'fa-user-plus'}`} /> Ajouter ({memberSelected.size})
                  </button>
                </div>
              )}

              {/* ECs rattachés */}
              <div>
                <div style={{ fontSize:14.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>
                  ECs rattachés ({manageGroup.ec_ids.length})
                </div>
                {manageGroup.ec_ids.length === 0 ? (
                  <p style={{ fontSize:15.5, color: 'var(--text-muted)' }}>Aucun EC rattaché — le groupe ne sera pas auto-affecté</p>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                    {manageGroup.ec_ids.map(ecId => (
                      <span key={ecId} className="status-badge secondary" style={{ fontSize:13, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        {ecName(ecId)}
                        <button onClick={() => unlinkEc(ecId)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize:13 }}><i className="fas fa-times" /></button>
                      </span>
                    ))}
                  </div>
                )}
                {availableEcs.length > 0 && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <select className="form-control" value={ecToLink} onChange={e => setEcToLink(e.target.value)} style={{ flex: 1, fontSize:15.5 }}>
                      <option value="">— Sélectionner un EC —</option>
                      {availableEcs.map(e => <option key={e.id} value={e.id}>{e.code} — {e.name}</option>)}
                    </select>
                    <button className="btn btn-secondary" style={{ fontSize:15.5 }} onClick={linkEc} disabled={linkingEc}
                      title={!ecToLink ? 'Sélectionnez un EC' : undefined}>
                      <i className={`fas ${linkingEc ? 'fa-spinner fa-spin' : 'fa-link'}`} /> Rattacher
                    </button>
                  </div>
                )}
              </div>

              {/* Examens précis : en plus de ceux des EC, même sur d'autres EC */}
              <div>
                <div style={{ fontSize:14.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>
                  Examens précis ({manageGroup.exam_ids?.length ?? 0})
                </div>
                <p style={{ fontSize:14.5, color: 'var(--text-muted)', margin: '0 0 8px' }}>
                  Le même groupe peut surveiller plusieurs examens dans la journée (par exemple 7h–9h, 11h–13h, 14h–16h), même sur des EC différents.
                  Deux examens doivent être séparés d&apos;au moins 15 minutes.
                </p>
                {schedule.filter(e => e.source === 'exam').length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                    {schedule.filter(e => e.source === 'exam').map(e => (
                      <span key={e.id} className="status-badge secondary" style={{ fontSize:13, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        {examLabel(e)}
                        <button onClick={() => unlinkExam(e.id)} title="Retirer cet examen du groupe"
                          style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize:13 }}><i className="fas fa-times" /></button>
                      </span>
                    ))}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <SearchableSelect
                      options={candidates.filter(c => c.available).map(c => ({ value: String(c.id), label: examLabel(c) }))}
                      value={examToLink} onChange={setExamToLink}
                      placeholder="— Ajouter un examen à venir —" emptyLabel="Aucun examen disponible sur un créneau libre" />
                  </div>
                  <button className="btn btn-secondary" style={{ fontSize:15.5 }} onClick={linkExam} disabled={linkingExam || !examToLink}
                    title={!examToLink ? 'Sélectionnez un examen' : undefined}>
                    <i className={`fas ${linkingExam ? 'fa-spinner fa-spin' : 'fa-link'}`} /> Ajouter
                  </button>
                </div>
                {candidates.some(c => !c.available) && (
                  <details style={{ marginTop: 6 }}>
                    <summary style={{ cursor: 'pointer', fontSize: 14, color: 'var(--text-muted)' }}>
                      {candidates.filter(c => !c.available).length} examen(s) indisponible(s) : créneau déjà pris
                    </summary>
                    <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 14, color: 'var(--text-muted)', display: 'grid', gap: 3 }}>
                      {candidates.filter(c => !c.available).map(c => <li key={c.id}>{examLabel(c)} — chevauche {c.conflict}</li>)}
                    </ul>
                  </details>
                )}
              </div>

              {/* Planning du groupe */}
              <div>
                <div style={{ fontSize:14.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>
                  Planning du groupe ({schedule.length} examen{schedule.length > 1 ? 's' : ''} à venir)
                </div>
                {schedule.length === 0 ? (
                  <p style={{ fontSize:15.5, color: 'var(--text-muted)' }}>Aucun examen à venir pour ce groupe.</p>
                ) : (
                  <div style={{ display: 'grid', gap: 10 }}>
                    {Object.entries(schedule.reduce<Record<string, PlannedExam[]>>((acc, e) => {
                      const d = fmtDay(e.start_time); (acc[d] ||= []).push(e); return acc
                    }, {})).map(([day, list]) => (
                      <div key={day}>
                        <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 4, textTransform: 'capitalize' }}>{day}</div>
                        <div style={{ display: 'grid', gap: 4 }}>
                          {list.map(e => (
                            <div key={e.id} style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', fontSize: 14.5,
                              padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)',
                              borderLeft: `3px solid ${e.conflicts_with?.length ? '#ef4444' : e.source === 'exam' ? '#0d9488' : '#3b82f6'}` }}>
                              <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, minWidth: 96 }}>{fmtHour(e.start_time)}–{fmtHour(e.end_time)}</span>
                              <span style={{ flex: 1, minWidth: 0 }}>{e.title}{e.ec_code ? ` · ${e.ec_code}` : ''}</span>
                              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{e.source === 'exam' ? 'examen précis' : 'par son EC'}</span>
                              {!!e.conflicts_with?.length && (
                                <span style={{ fontSize: 13, color: '#ef4444', fontWeight: 600 }}><i className="fas fa-triangle-exclamation" /> chevauche un autre examen</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
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
