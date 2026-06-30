'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import api from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'

interface Exam {
  id: number
  title: string
  status: string
  start_time: string
  end_time: string
  duration_minutes: number
  attempts_count?: number
  formation_name?: string
  subject_title?: string
}

const STATUS_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  draft:     { label: 'Brouillon', color: '#94a3b8', bg: '#f1f5f9' },
  scheduled: { label: 'Planifié',  color: '#d97706', bg: '#fffbeb' },
  active:    { label: 'Actif',     color: '#059669', bg: '#ecfdf5' },
  closed:    { label: 'Clôturé',   color: '#dc2626', bg: '#fef2f2' },
}

const DAYS_FR = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']

interface Props { apiPath?: string; role?: string }

export default function ExamCalendar({ apiPath = '/api/online_exams', role = 'admin' }: Props) {
  const { error } = useToast()
  const [exams, setExams] = useState<Exam[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'calendar' | 'list'>('calendar')
  const [month, setMonth] = useState(() => new Date())
  const [selected, setSelected] = useState<Date | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const res = await api.get<any>(apiPath)
        const list = Array.isArray(res) ? res : res.exams ?? res.online_exams ?? []
        setExams(list)
      } catch { error('Erreur de chargement des examens') }
      finally { setLoading(false) }
    }
    load()
  }, [apiPath])

  /* Construire la grille calendrier */
  const year  = month.getFullYear()
  const mon   = month.getMonth()
  const first = new Date(year, mon, 1)
  const last  = new Date(year, mon + 1, 0)
  const startDay = first.getDay()

  const cells: (Date | null)[] = []
  for (let i = 0; i < startDay; i++) cells.push(null)
  for (let d = 1; d <= last.getDate(); d++) cells.push(new Date(year, mon, d))

  /* Exams par date clé */
  function dayKey(d: Date) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }
  const byDay: Record<string, Exam[]> = {}
  exams.forEach(e => {
    if (!e.start_time) return
    const k = dayKey(new Date(e.start_time))
    if (!byDay[k]) byDay[k] = []
    byDay[k].push(e)
  })

  const selectedKey = selected ? dayKey(selected) : null
  const selectedExams = selectedKey ? (byDay[selectedKey] ?? []) : []

  const filtered = view === 'list' ? [...exams].sort((a,b) => new Date(a.start_time||0).getTime() - new Date(b.start_time||0).getTime()) : []

  const prevMonth = () => setMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))
  const nextMonth = () => setMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))

  return (
    <div>
      <div className="page-header">
        <div>
          <h2><i className="fas fa-calendar-alt" style={{ marginRight: 10, color: 'var(--primary)' }} />Calendrier des Examens</h2>
          <p>Vue d'ensemble des examens planifiés</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setView('calendar')} className={`btn ${view === 'calendar' ? 'btn-primary' : 'btn-secondary'}`}>
            <i className="fas fa-calendar" /> Calendrier
          </button>
          <button onClick={() => setView('list')} className={`btn ${view === 'list' ? 'btn-primary' : 'btn-secondary'}`}>
            <i className="fas fa-list" /> Liste
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><i className="fas fa-spinner fa-spin" style={{ fontSize: 32 }} /></div>
      ) : view === 'list' ? (
        /* ── VUE LISTE ────────────────────────────────────────────── */
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
              <i className="fas fa-calendar-times" style={{ fontSize: 48, display: 'block', marginBottom: 16 }} />
              <h3>Aucun examen</h3>
            </div>
          ) : filtered.map((exam, i) => {
            const st = STATUS_STYLE[exam.status] ?? STATUS_STYLE.draft
            const start = exam.start_time ? new Date(exam.start_time) : null
            return (
              <div key={exam.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ width: 56, height: 56, borderRadius: 12, background: exam.status === 'active' ? '#dcfce7' : 'var(--background)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: `2px solid ${exam.status === 'active' ? '#10b981' : 'var(--border)'}` }}>
                  {start ? (<><div style={{ fontWeight: 700, fontSize: 20, lineHeight: 1 }}>{start.getDate()}</div><div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{MONTHS_FR[start.getMonth()].slice(0,3)}</div></>) : <i className="fas fa-calendar" />}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{exam.title}</div>
                  {exam.subject_title && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{exam.subject_title}</div>}
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
                    {start ? start.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' }) : '—'}
                    {exam.end_time ? ` → ${new Date(exam.end_time).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}` : ''} · {exam.duration_minutes} min
                    {exam.formation_name ? ` · ${exam.formation_name}` : ''}
                  </div>
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 99, background: st.bg, color: st.color }}>{st.label}</span>
                {role === 'professor' && exam.status === 'active' && (
                  <Link href={`/proctor/${exam.id}`} className="btn btn-success btn-sm">
                    <i className="fas fa-eye" /> Surveiller
                  </Link>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        /* ── VUE CALENDRIER ──────────────────────────────────────── */
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, alignItems: 'start' }}>
          <div className="card">
            {/* Navigation mois */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <button onClick={prevMonth} style={{ padding: '6px 12px', border: '1px solid var(--border)', borderRadius: 7, background: 'transparent', cursor: 'pointer', color: 'var(--text)' }}>
                <i className="fas fa-chevron-left" />
              </button>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{MONTHS_FR[mon]} {year}</h3>
              <button onClick={nextMonth} style={{ padding: '6px 12px', border: '1px solid var(--border)', borderRadius: 7, background: 'transparent', cursor: 'pointer', color: 'var(--text)' }}>
                <i className="fas fa-chevron-right" />
              </button>
            </div>

            {/* En-têtes jours */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 8 }}>
              {DAYS_FR.map(d => <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', padding: '4px 0' }}>{d}</div>)}
            </div>

            {/* Grille */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
              {cells.map((cell, i) => {
                if (!cell) return <div key={i} />
                const k = dayKey(cell)
                const dayExams = byDay[k] ?? []
                const isToday = dayKey(new Date()) === k
                const isSel = selectedKey === k
                const hasActive = dayExams.some(e => e.status === 'active')
                return (
                  <div key={i} onClick={() => setSelected(isSel ? null : cell)}
                    style={{ minHeight: 64, padding: 4, borderRadius: 8, cursor: dayExams.length > 0 ? 'pointer' : 'default', background: isSel ? 'var(--primary)15' : isToday ? '#eff6ff' : 'transparent', border: `2px solid ${isSel ? 'var(--primary)' : isToday ? '#3b82f6' : 'var(--border)'}`, transition: 'all .15s' }}>
                    <div style={{ fontSize: 13, fontWeight: isToday ? 700 : 400, color: isToday ? '#2563eb' : 'var(--text)', marginBottom: 3 }}>{cell.getDate()}</div>
                    {dayExams.slice(0,2).map(e => (
                      <div key={e.id} style={{ fontSize: 9, background: STATUS_STYLE[e.status]?.bg ?? '#f1f5f9', color: STATUS_STYLE[e.status]?.color ?? '#94a3b8', borderRadius: 3, padding: '1px 4px', marginBottom: 1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', fontWeight: 600 }}>
                        {e.title}
                      </div>
                    ))}
                    {dayExams.length > 2 && <div style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 600 }}>+{dayExams.length - 2} autre{dayExams.length - 2 > 1 ? 's' : ''}</div>}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Panneau latéral détail */}
          <div className="card">
            {!selected ? (
              <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                <i className="fas fa-hand-pointer" style={{ fontSize: 32, display: 'block', marginBottom: 12 }} />
                <p style={{ fontSize: 13 }}>Cliquez sur un jour pour voir les examens</p>
              </div>
            ) : (
              <>
                <h4 style={{ marginBottom: 16, fontSize: 14, fontWeight: 700 }}>
                  <i className="fas fa-calendar-day" style={{ marginRight: 8, color: 'var(--primary)' }} />
                  {selected.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                </h4>
                {selectedExams.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)', fontSize: 13 }}>Aucun examen ce jour</div>
                ) : selectedExams.map(e => {
                  const st = STATUS_STYLE[e.status] ?? STATUS_STYLE.draft
                  return (
                    <div key={e.id} style={{ padding: '12px 14px', borderRadius: 10, background: 'var(--background)', border: '1px solid var(--border)', marginBottom: 10 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>{e.title}</div>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: st.bg, color: st.color, display: 'inline-block', marginBottom: 8 }}>{st.label}</span>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.7 }}>
                        <div><i className="fas fa-clock" style={{ marginRight: 6 }} />{new Date(e.start_time).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})} · {e.duration_minutes} min</div>
                        {e.formation_name && <div><i className="fas fa-graduation-cap" style={{ marginRight: 6 }} />{e.formation_name}</div>}
                        {e.attempts_count != null && <div><i className="fas fa-users" style={{ marginRight: 6 }} />{e.attempts_count} participant(s)</div>}
                      </div>
                      {e.status === 'active' && (
                        <Link href={`/proctor/${e.id}`} className="btn btn-success" style={{ marginTop: 10, fontSize: 12, padding: '5px 12px', display: 'inline-flex' }}>
                          <i className="fas fa-eye" /> Surveiller
                        </Link>
                      )}
                    </div>
                  )
                })}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
