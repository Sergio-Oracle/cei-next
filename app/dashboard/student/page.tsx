'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import api from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import type { StudentPaper, OnlineExam } from '@/types'

interface OnlineResult {
  attempt_id: number
  exam_id: number
  exam_title: string
  subject_title?: string
  score: number | null
  feedback?: string
  corrected_at?: string | null
  submitted_at?: string | null
  auto_correct?: boolean
  has_reclamation?: boolean
  reclamation_status?: string
  results_published?: boolean
  pending_publication?: boolean
}

const REC_COLORS: Record<string, string> = { pending: '#f59e0b', accepted: '#10b981', rejected: '#ef4444' }
const REC_LABELS: Record<string, string> = { pending: 'En cours', accepted: 'Acceptée', rejected: 'Rejetée' }

function fmtDate(iso?: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function ScoreBadge({ score, pendingPublication }: { score: number | null | undefined; pendingPublication?: boolean }) {
  if (score == null) {
    // Retour #29 — distinguer "pas encore corrigé" de "corrigé, en attente
    // de délibération" pour ne pas laisser croire à un retard de correction
    return pendingPublication
      ? <span style={{ color: '#f59e0b', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}><i className="fas fa-gavel" /> En attente de délibération</span>
      : <span style={{ color: '#94a3b8', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}><i className="fas fa-clock" /> En attente</span>
  }
  const c = score >= 10 ? '#10b981' : '#ef4444'
  return <span style={{ fontWeight: 700, color: c, fontSize: 13 }}>{Number(score).toFixed(2)}/20</span>
}

function RecBadge({ hasRec, status }: { hasRec?: boolean; status?: string }) {
  if (!hasRec || !status) return null
  const c = REC_COLORS[status] ?? '#94a3b8'
  return (
    <span style={{ fontSize: 10, fontWeight: 700, color: c, background: c + '22', padding: '2px 7px', borderRadius: 99, marginLeft: 6 }}>
      {REC_LABELS[status] ?? status}
    </span>
  )
}

async function downloadPDF(paperId: number) {
  try {
    const blob = await api.blob(`/api/papers/${paperId}/pdf`)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `copie_${paperId}.pdf`; a.click()
    URL.revokeObjectURL(url)
  } catch {}
}

const LOCALE_OPTS: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Dakar' }

export default function StudentDashboard() {
  const { user } = useAuth()
  const { error } = useToast()
  const [papers,      setPapers]      = useState<StudentPaper[]>([])
  const [online,      setOnline]      = useState<OnlineResult[]>([])
  const [activeExams, setActiveExams] = useState<OnlineExam[]>([])
  const [loading,     setLoading]     = useState(true)

  useEffect(() => { load() }, []) // eslint-disable-line

  async function load() {
    setLoading(true)
    try {
      const [rPapers, rOnline, rExams] = await Promise.allSettled([
        api.get<StudentPaper[]>('/api/student/papers'),
        api.get<OnlineResult[]>('/api/student/online_results'),
        api.get<OnlineExam[]>('/api/online_exams'),
      ])
      if (rPapers.status === 'fulfilled') {
        const v = rPapers.value
        setPapers(Array.isArray(v) ? v : (v as any).papers ?? [])
      }
      if (rOnline.status === 'fulfilled') {
        const v = rOnline.value
        setOnline(Array.isArray(v) ? v : (v as any).results ?? [])
      }
      if (rExams.status === 'fulfilled') {
        const v = rExams.value
        const list: OnlineExam[] = Array.isArray(v) ? v : (v as any).exams ?? []
        const now = Date.now()
        // Garder les examens actifs (dans la fenêtre de temps) avec attempt en cours ou composable
        const active = list.filter(e => {
          if (e.status !== 'active' && e.status !== 'scheduled') return false
          const start = new Date(e.start_time).getTime()
          const end   = new Date(e.end_time).getTime()
          return now >= start && now <= end
        })
        setActiveExams(active)
      }
    } catch { error('Erreur de chargement') }
    finally { setLoading(false) }
  }

  // ── Calcul des stats ─────────────────────────────────────────────────────────
  const paperScores  = papers.filter(p => p.score != null).map(p => p.score as number)
  const onlineScores = online.filter(o => o.score != null).map(o => o.score as number)
  const allScores    = [...paperScores, ...onlineScores]
  const totalCount   = papers.length + online.length

  const avgAll    = allScores.length    ? (allScores.reduce((a, b) => a + b, 0) / allScores.length)    : null
  const avgPaper  = paperScores.length  ? (paperScores.reduce((a, b) => a + b, 0) / paperScores.length)  : null
  const avgOnline = onlineScores.length ? (onlineScores.reduce((a, b) => a + b, 0) / onlineScores.length) : null
  const admis     = allScores.filter(s => s >= 10).length
  const pending   = papers.filter(p => p.score == null).length + online.filter(o => o.score == null).length

  const avgColor = avgAll == null ? '#94a3b8' : avgAll >= 10 ? '#10b981' : '#ef4444'

  const showSplit = paperScores.length > 0 && onlineScores.length > 0

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
        <div style={{ background: '#3b82f6', width: 46, height: 46, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <i className="fas fa-chart-bar" style={{ color: 'white', fontSize: 20 }} />
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>Mon tableau de bord</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
            Bienvenue, <strong>{user?.full_name}</strong>
          </p>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 64, color: 'var(--text-muted)' }}>
          <i className="fas fa-spinner fa-spin" style={{ fontSize: 32 }} />
        </div>
      ) : (
        <>
          {/* ── Alerte légère : examen(s) actif(s) ─────────────────────────── */}
          {activeExams.length > 0 && (
            <Link href="/dashboard/student/exams" style={{ textDecoration: 'none', display: 'block', marginBottom: 20 }}>
              <div style={{ background: '#ecfdf5', border: '1.5px solid #6ee7b7', borderRadius: 12, padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', transition: 'box-shadow .15s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 14px rgba(16,185,129,.18)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = 'none' }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#10b981', display: 'inline-block', animation: 'pulse 1.5s infinite', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <span style={{ fontWeight: 700, color: '#065f46', fontSize: 13 }}>
                    {activeExams.length > 1
                      ? `${activeExams.length} examens ouverts en ce moment`
                      : `Examen ouvert : ${activeExams[0].title}`}
                  </span>
                  {activeExams.length === 1 && (
                    <span style={{ fontSize: 12, color: '#047857', marginLeft: 8 }}>
                      — ferme le {new Date(activeExams[0].end_time).toLocaleString('fr-FR', LOCALE_OPTS)}
                    </span>
                  )}
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#059669', display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                  Accéder <i className="fas fa-arrow-right" />
                </span>
              </div>
            </Link>
          )}

          {/* ── Tuiles stats ────────────────────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14, marginBottom: 28 }}>
            <StatTile icon="fa-file" label="Évaluations" value={totalCount} color="#0f172a" />
            <StatTile icon="fa-star" label="Moyenne générale /20" value={avgAll != null ? Number(avgAll).toFixed(2) : '—'} color={avgColor} />
            <StatTile icon="fa-check-circle" label="Admis (≥ 10)" value={admis} color="#10b981" />
            <StatTile icon="fa-hourglass-half" label="En attente" value={pending} color="#f59e0b" />
            {showSplit && (
              <>
                <StatTile icon="fa-file-alt" label="Moy. copies /20" value={avgPaper != null ? Number(avgPaper).toFixed(2) : '—'} color="#3b82f6" sm />
                <StatTile icon="fa-laptop" label="Moy. en ligne /20" value={avgOnline != null ? Number(avgOnline).toFixed(2) : '—'} color="#2563eb" sm />
              </>
            )}
          </div>

          {/* ── Tableau historique ───────────────────────────────────────────── */}
          {totalCount === 0 ? (
            <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)', textAlign: 'center', padding: '52px 24px', marginBottom: 28 }}>
              <i className="fas fa-inbox" style={{ fontSize: 52, color: '#cbd5e1', display: 'block', marginBottom: 16 }} />
              <p style={{ color: '#94a3b8', margin: 0 }}>Aucune évaluation pour le moment.<br />Vos notes apparaîtront ici après correction.</p>
            </div>
          ) : (
            <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)', marginBottom: 28, overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <i className="fas fa-list-alt" style={{ color: '#3b82f6' }} /> Historique de toutes mes notes
                </h3>
                <span style={{ fontSize: 12, color: '#94a3b8' }}>{totalCount} évaluation(s)</span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      {['Intitulé', 'Type', 'Note', 'Date', 'Actions'].map(h => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 12, color: '#64748b', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {papers.map(p => (
                      <tr key={`p-${p.id}`} style={{ borderTop: '1px solid var(--border)' }}>
                        <td style={{ padding: '10px 14px', fontSize: 13 }}>
                          <i className="fas fa-file-alt" style={{ color: '#3b82f6', marginRight: 6 }} />
                          {p.subject_title || '—'}
                          <RecBadge hasRec={p.has_reclamation} status={p.reclamation_status} />
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{ fontSize: 11, background: '#dbeafe', color: '#1d4ed8', padding: '2px 8px', borderRadius: 99 }}>Copie</span>
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <ScoreBadge score={p.score} />
                        </td>
                        <td style={{ padding: '10px 14px', fontSize: 12, color: '#64748b' }}>
                          {fmtDate(p.corrected_at || p.created_at)}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          {p.score != null ? (
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              <button onClick={() => downloadPDF(p.id)} style={actBtn('#3b82f6')}>
                                <i className="fas fa-file-pdf" /> PDF
                              </button>
                              {!p.has_reclamation && (
                                <Link href={`/dashboard/student/reclamations?paper_id=${p.id}`} style={actBtn('#f59e0b')}>
                                  <i className="fas fa-exclamation-triangle" /> Réclamer
                                </Link>
                              )}
                            </div>
                          ) : <span style={{ color: '#94a3b8', fontSize: 12 }}>—</span>}
                        </td>
                      </tr>
                    ))}
                    {online.map(o => (
                      <tr key={`o-${o.attempt_id}`} style={{ borderTop: '1px solid var(--border)' }}>
                        <td style={{ padding: '10px 14px', fontSize: 13 }}>
                          <i className="fas fa-laptop" style={{ color: '#2563eb', marginRight: 6 }} />
                          {o.exam_title || '—'}
                          <RecBadge hasRec={o.has_reclamation} status={o.reclamation_status} />
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          {o.auto_correct
                            ? <span style={{ fontSize: 11, background: '#f0fdf4', color: '#15803d', padding: '2px 8px', borderRadius: 99 }}>IA auto</span>
                            : <span style={{ fontSize: 11, background: '#dbeafe', color: '#1d4ed8', padding: '2px 8px', borderRadius: 99 }}>En ligne</span>}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <ScoreBadge score={o.score} pendingPublication={o.pending_publication} />
                        </td>
                        <td style={{ padding: '10px 14px', fontSize: 12, color: '#64748b' }}>
                          {fmtDate(o.corrected_at)}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <Link href={`/dashboard/student/results`} style={actBtn('#2563eb')}>
                              <i className="fas fa-eye" /> Voir
                            </Link>
                            {!o.has_reclamation && (
                              <Link href={`/dashboard/student/reclamations?attempt_id=${o.attempt_id}`} style={actBtn('#f59e0b')}>
                                <i className="fas fa-exclamation-triangle" /> Réclamer
                              </Link>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Liens rapides ────────────────────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12 }}>
            {[
              { href: '/dashboard/student/results',       icon: 'fa-chart-line',           label: 'Mes résultats',   color: '#3b82f6' },
              { href: '/dashboard/student/papers',        icon: 'fa-file-alt',             label: 'Mes copies',      color: '#3b82f6' },
              { href: '/dashboard/student/transcripts',   icon: 'fa-scroll',               label: 'Relevés de notes', color: '#10b981' },
              { href: '/dashboard/student/reclamations',  icon: 'fa-exclamation-triangle', label: 'Réclamations',    color: '#f59e0b' },
            ].map(a => (
              <Link key={a.href} href={a.href} style={{ textDecoration: 'none' }}>
                <div style={{ background: 'var(--surface)', border: `1px solid var(--border)`, borderRadius: 14, padding: '20px 14px', textAlign: 'center', cursor: 'pointer', transition: 'box-shadow .2s, transform .2s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 18px rgba(0,0,0,.1)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = 'none'; (e.currentTarget as HTMLElement).style.transform = 'translateY(0)' }}>
                  <i className={`fas ${a.icon}`} style={{ fontSize: 26, color: a.color, marginBottom: 10, display: 'block' }} />
                  <div style={{ color: a.color, fontWeight: 600, fontSize: 13 }}>{a.label}</div>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function StatTile({ icon, label, value, color, sm }: {
  icon: string; label: string; value: string | number; color: string; sm?: boolean
}) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 16px', textAlign: 'center' }}>
      <div style={{ fontSize: sm ? 20 : 28, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: sm ? 11 : 12, color: '#64748b', marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
        <i className={`fas ${icon}`} /> {label}
      </div>
    </div>
  )
}

function actBtn(bg: string): React.CSSProperties {
  return { display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '5px 10px', background: bg, color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', textDecoration: 'none', fontWeight: 600 }
}
