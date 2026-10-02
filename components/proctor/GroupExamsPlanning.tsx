'use client'

/* Examens précis d'un groupe de surveillance et son planning — partagé par
   les pages Groupes Surveillants de l'administrateur et de l'enseignant.
   Un même groupe peut enchaîner plusieurs examens d'une journée (7h, 11h,
   14h…), même sur des EC différents ; le serveur refuse deux examens séparés
   de moins que le repos minimum du groupe (30 min par défaut, réglable ici). */

import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'
import SearchableSelect from '@/components/ui/SearchableSelect'

export interface PlannedExam {
  id: number; title: string; status: string | null; start_time: string; end_time: string; effective_end_time: string
  ec_code: string | null; ec_name: string | null; source?: 'ec' | 'exam'; conflicts_with?: number[]
  available?: boolean; conflict?: string | null
}
export interface MemberWarning { proctor: string; exam: string; with_exam: string; other_group: string }

const fmtDay = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
const fmtHour = (iso: string) => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
const examLabel = (e: PlannedExam) =>
  `${new Date(e.start_time).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })} ${fmtHour(e.start_time)}–${fmtHour(e.end_time)} · ${e.title}${e.ec_code ? ` (${e.ec_code})` : ''}`

/** Refus du serveur pour chevauchement : nomme l'examen en conflit. */
export function conflictMessage(e: any, fallback: string) {
  const c = e?.data?.conflicts?.[0]
  return c ? `${e.message} Conflit : ${c.exam} et ${c.with_exam}.` : (e?.message || fallback)
}

/** Avertissement : membre déjà pris au même moment avec un autre groupe. */
export function useMemberWarnings() {
  const { showToast } = useToast()
  return (list?: MemberWarning[]) => {
    if (!list?.length) return
    const w = list[0]
    const more = list.length > 1 ? ` (+${list.length - 1} autre${list.length > 2 ? 's' : ''})` : ''
    showToast(`Attention : ${w.proctor} surveille déjà ${w.with_exam} avec le groupe « ${w.other_group} »${more}.`, 'warning', 9000)
  }
}

const GAP_OPTIONS = [0, 15, 30, 45, 60, 90, 120, 180]
const gapLabel = (m: number) => m === 0 ? 'aucun' : m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${String(m % 60).padStart(2, '0')}` : ''}`

interface Props {
  groupId: number
  /** Repos minimum (minutes) entre deux examens du groupe. */
  minGap: number
  /** Change à chaque modification du groupe (membres, EC) pour recharger le planning. */
  refreshKey?: unknown
  /** Groupe renvoyé par le serveur après ajout/retrait d'un examen. */
  onGroupChanged: (group: any) => void
}

export default function GroupExamsPlanning({ groupId, minGap, refreshKey, onGroupChanged }: Props) {
  const { success, error } = useToast()
  const warnMembers = useMemberWarnings()
  const [schedule, setSchedule] = useState<PlannedExam[]>([])
  const [candidates, setCandidates] = useState<PlannedExam[]>([])
  const [examToLink, setExamToLink] = useState('')
  const [linkingExam, setLinkingExam] = useState(false)
  const [tick, setTick] = useState(0)
  const [savingGap, setSavingGap] = useState(false)

  async function saveGap(minutes: number) {
    setSavingGap(true)
    try {
      const res = await api.put<any>(`/api/admin/proctor_groups/${groupId}`, { min_gap_minutes: minutes })
      success(`Repos minimum entre deux examens : ${gapLabel(minutes)}`)
      setTick(t => t + 1)
      onGroupChanged(res)
    } catch (e: any) { error(e.message || 'Erreur mise à jour') }
    finally { setSavingGap(false) }
  }

  useEffect(() => {
    let alive = true
    Promise.all([
      api.get<{ exams: PlannedExam[] }>(`/api/admin/proctor_groups/${groupId}/schedule`),
      api.get<{ exams: PlannedExam[] }>(`/api/admin/proctor_groups/${groupId}/exam_candidates`),
    ]).then(([sch, cand]) => {
      if (!alive) return
      setSchedule(sch.exams || [])
      setCandidates(cand.exams || [])
    }).catch(() => {})
    return () => { alive = false }
  }, [groupId, refreshKey, tick])

  async function linkExam() {
    if (!examToLink) { error('Sélectionnez un examen'); return }
    setLinkingExam(true)
    try {
      const res = await api.post<any>(`/api/admin/proctor_groups/${groupId}/exams`, { exam_id: Number(examToLink) })
      setExamToLink('')
      success('Examen ajouté au planning du groupe')
      warnMembers(res.member_warnings)
      setTick(t => t + 1)
      onGroupChanged(res)
    } catch (e: any) { error(conflictMessage(e, 'Erreur rattachement')) }
    finally { setLinkingExam(false) }
  }

  async function unlinkExam(examId: number) {
    try {
      await api.delete(`/api/admin/proctor_groups/${groupId}/exams/${examId}`)
      setTick(t => t + 1)
      onGroupChanged(null)
    } catch (e: any) { error(e.message || 'Erreur retrait') }
  }

  const direct = schedule.filter(e => e.source === 'exam')
  const examCount = direct.length

  return (
    <>
      {/* Examens précis : en plus de ceux des EC, même sur d'autres EC */}
      <div>
        <div style={{ fontSize:14.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>
          Examens précis ({examCount})
        </div>
        <p style={{ fontSize:14.5, color: 'var(--text-muted)', margin: '0 0 8px' }}>
          Le même groupe peut surveiller plusieurs examens dans la journée (par exemple 7h–9h, 11h–13h, 14h–16h), même sur des EC différents.
          Deux examens du groupe doivent être séparés d&apos;au moins le repos minimum choisi ci-dessous.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10, fontSize: 15 }}>
          <label htmlFor={`gap-${groupId}`} style={{ fontWeight: 600 }}>Repos minimum entre deux examens</label>
          <select id={`gap-${groupId}`} className="form-control" value={minGap} disabled={savingGap}
            onChange={e => saveGap(Number(e.target.value))} style={{ width: 'auto', fontSize: 15 }}>
            {(GAP_OPTIONS.includes(minGap) ? GAP_OPTIONS : [...GAP_OPTIONS, minGap].sort((a, b) => a - b))
              .map(m => <option key={m} value={m}>{gapLabel(m)}</option>)}
          </select>
          {savingGap && <i className="fas fa-spinner fa-spin" />}
        </div>
        {direct.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
            {direct.map(e => (
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
    </>
  )
}
