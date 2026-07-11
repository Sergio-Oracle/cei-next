'use client'

import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'

interface Paper    { score: number | null; student_name: string; student_email: string; corrected_at: string | null }
interface Attempt  { score: number | null; student_name: string; student_email: string; exam_title: string; corrected_at: string | null }
interface SubjectMeta { id: number; title: string; ec_code?: string; ec_name?: string; created_at: string }
interface SubjectStats {
  totalStudents: number; averageScore: number | null; medianScore?: number | null
  passRate: number | null; minScore: number | null; maxScore: number | null
  subject_title?: string; papers: Paper[]; attempts: Attempt[]
}
interface Subject extends SubjectMeta { stats: SubjectStats | null }

function sc(v: number | null | undefined) { return v == null ? '#64748b' : v >= 10 ? '#10b981' : '#ef4444' }
function pc(v: number | null | undefined) { return v == null ? '#64748b' : v >= 75 ? '#10b981' : v >= 50 ? '#f59e0b' : '#ef4444' }

/* ─── Barres verticales (couleurs solides) ─── */
function BarChart({ labels, data, colors }: { labels: string[]; data: number[]; colors: string[] }) {
  const max = Math.max(...data, 1)
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 150, padding: '0 2px' }}>
        {data.map((v, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: v > 0 ? colors[i] : 'transparent' }}>{v}</span>
            <div style={{ width: '80%', background: colors[i], borderRadius: '4px 4px 0 0',
              height: max > 0 ? Math.max((v / max) * 118, v > 0 ? 4 : 0) : 0 }} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, padding: '5px 2px 0', borderTop: '2px solid #e2e8f0' }}>
        {labels.map((l, i) => (
          <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: 10, color: '#64748b', fontWeight: 600 }}>{l}</div>
        ))}
      </div>
    </div>
  )
}

/* ─── Donut CSS (conic-gradient) ─── */
function Donut({ passed, failed, size = 130 }: { passed: number; failed: number; size?: number }) {
  const total = passed + failed
  const pct = total > 0 ? Math.round(passed / total * 100) : 0
  const deg = total > 0 ? Math.round(passed / total * 360) : 0
  const inner = Math.round(size * 0.63)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <div style={{ position: 'relative', width: size, height: size, borderRadius: '50%',
        background: total > 0 ? `conic-gradient(#10b981 ${deg}deg, #ef4444 ${deg}deg)` : '#e2e8f0' }}>
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
          width: inner, height: inner, borderRadius: '50%', background: 'white',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: Math.round(size * 0.15), fontWeight: 800, color: pct >= 50 ? '#10b981' : '#ef4444' }}>{pct}%</span>
          <span style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase' }}>réussite</span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        {[{ color: '#10b981', label: `Réussite (${passed})` }, { color: '#ef4444', label: `Échec (${failed})` }].map(({ color, label }) => (
          <span key={label} style={{ fontSize: 11, color: '#475569', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 9, height: 9, borderRadius: 2, background: color, display: 'inline-block' }} />{label}
          </span>
        ))}
      </div>
    </div>
  )
}

/* ─── Courbe SVG (rendu serveur, zéro dépendance externe) ─── */
function SVGLine({ scores, labels }: { scores: number[]; labels?: string[] }) {
  if (!scores.length) return (
    <div style={{ height: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 12 }}>
      Aucune donnée
    </div>
  )
  const W = 320, H = 150, PX = 28, PY = 10
  const iW = W - PX * 2, iH = H - PY * 2 - 14
  const n = scores.length
  const px = (i: number) => PX + (n > 1 ? (i / (n - 1)) * iW : iW / 2)
  const py = (s: number) => PY + (1 - s / 20) * iH
  const pts = scores.map((s, i) => `${px(i).toFixed(1)},${py(s).toFixed(1)}`).join(' ')
  const bottom = (PY + iH).toFixed(1)
  const fillPts = n > 1
    ? `${px(0).toFixed(1)},${bottom} ${scores.map((s, i) => `${px(i).toFixed(1)},${py(s).toFixed(1)}`).join(' ')} ${px(n - 1).toFixed(1)},${bottom}`
    : ''
  const thY = py(10).toFixed(1)
  const showLabels = labels ?? (n <= 14 ? scores.map((_, i) => `#${i + 1}`) : null)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 150 }}>
      {[0, 5, 10, 15, 20].map(v => (
        <line key={v} x1={PX} x2={W - PX} y1={py(v)} y2={py(v)} stroke="#e2e8f0" strokeWidth="1" />
      ))}
      {[0, 10, 20].map(v => (
        <text key={v} x={PX - 3} y={py(v) + 4} textAnchor="end" fontSize="9" fill="#94a3b8">{v}</text>
      ))}
      <line x1={PX} x2={W - PX} y1={thY} y2={thY} stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="5,3" />
      {fillPts && <polygon points={fillPts} fill="rgba(37,99,235,0.07)" />}
      <polyline points={pts} fill="none" stroke="#2563eb" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {scores.map((s, i) => (
        <circle key={i} cx={px(i)} cy={py(s)} r={n > 30 ? 2 : 5}
          fill={s >= 10 ? '#10b981' : '#ef4444'} stroke="white" strokeWidth="2" />
      ))}
      {showLabels && showLabels.map((l, i) => (
        <text key={i} x={px(i)} y={H - 1} textAnchor="middle" fontSize="8" fill="#94a3b8">{l}</text>
      ))}
    </svg>
  )
}

/* ─── Barres horizontales ─── */
function HorizChart({ subjects }: { subjects: Subject[] }) {
  const rows = subjects.filter(s => s.stats?.averageScore != null && (s.stats.totalStudents ?? 0) > 0)
  if (!rows.length) return <div style={{ color: '#94a3b8', fontSize: 12 }}>Aucune donnée</div>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {rows.map(s => {
        const avg = s.stats!.averageScore!
        const color = avg >= 10 ? '#10b981' : '#ef4444'
        const pct = Math.max((avg / 20) * 100, avg > 0 ? 1 : 0)
        return (
          <div key={s.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
              <span style={{ color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '72%' }}>
                {s.title.length > 42 ? s.title.substring(0, 41) + '…' : s.title}
              </span>
              <span style={{ fontWeight: 700, color, flexShrink: 0 }}>{avg.toFixed(1)}/20</span>
            </div>
            <div style={{ height: 10, background: '#f1f5f9', borderRadius: 99 }}>
              <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 99 }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ─── Panneau détails d'un sujet ─── */
function SubjectDetail({ subject, onClose }: { subject: Subject; onClose: () => void }) {
  const st = subject.stats!
  const allRows   = [...(st.papers || []), ...(st.attempts || [])]
  const allScores = allRows.map(r => r.score).filter((s): s is number => s != null).sort((a, b) => a - b)
  const passed = allScores.filter(s => s >= 10).length
  const failed = allScores.length - passed
  const dist   = [0, 0, 0, 0]
  allScores.forEach(s => { if (s < 5) dist[0]++; else if (s < 10) dist[1]++; else if (s < 15) dist[2]++; else dist[3]++ })

  const timeRows   = allRows.filter(r => r.score != null && r.corrected_at)
    .sort((a, b) => new Date(a.corrected_at!).getTime() - new Date(b.corrected_at!).getTime())
  const timeScores = timeRows.map(r => r.score as number)
  const timeLabels = timeRows.length <= 14
    ? timeRows.map(r => new Date(r.corrected_at!).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }))
    : undefined

  const hasPapers   = (st.papers   || []).length > 0
  const hasAttempts = (st.attempts || []).length > 0

  const kpis = [
    { icon: 'fa-users',          color: '#2563eb', label: 'Étudiants', value: String(st.totalStudents) },
    { icon: 'fa-chart-line',     color: '#10b981', label: 'Moyenne',   value: st.averageScore  != null ? st.averageScore.toFixed(1)  + '/20' : '—' },
    { icon: 'fa-sort-amount-up', color: '#f59e0b', label: 'Médiane',   value: st.medianScore   != null ? String(st.medianScore)      + '/20' : '—' },
    { icon: 'fa-arrow-down',     color: '#ef4444', label: 'Min',       value: st.minScore      != null ? String(st.minScore)         + '/20' : '—' },
    { icon: 'fa-arrow-up',       color: '#3b82f6', label: 'Max',       value: st.maxScore      != null ? String(st.maxScore)         + '/20' : '—' },
    { icon: 'fa-percentage',     color: '#059669', label: 'Réussite',  value: st.passRate      != null ? String(st.passRate)         + '%'   : '—' },
  ]

  return (
    <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden',
      boxShadow: '0 2px 8px rgba(0,0,0,.08)', marginTop: 8 }}>

      <div style={{ background: '#2563eb', padding: '16px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <p style={{ color: '#c7d2fe', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', margin: '0 0 4px' }}>
            Statistiques détaillées
          </p>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'white' }}>{subject.title}</h3>
        </div>
        <button onClick={onClose} style={{ background: 'rgba(255,255,255,.2)', border: 'none', color: 'white',
          width: 32, height: 32, borderRadius: '50%', cursor: 'pointer', fontSize: 18,
          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <i className="fas fa-times" />
        </button>
      </div>

      <div style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* KPI */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 10 }}>
          {kpis.map(({ icon, color, label, value }) => (
            <div key={label} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 12px', textAlign: 'center' }}>
              <div style={{ width: 34, height: 34, background: color + '18', borderRadius: 9,
                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px' }}>
                <i className={`fas ${icon}`} style={{ color, fontSize: 14 }} />
              </div>
              <div style={{ fontSize: 19, fontWeight: 800, color: '#0f172a' }}>{value}</div>
              <div style={{ fontSize: 10, color: '#64748b', marginTop: 2, fontWeight: 600 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Graphiques 2×2 */}
        <div className="grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
            <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 700, color: '#374151' }}>
              <i className="fas fa-chart-bar" style={{ color: '#2563eb', marginRight: 5 }} />Distribution des notes
            </p>
            <BarChart labels={['0 – 5', '5 – 10', '10 – 15', '15 – 20']} data={dist}
              colors={['#ef4444', '#f59e0b', '#10b981', '#3b82f6']} />
          </div>
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16,
            display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 700, color: '#374151', alignSelf: 'flex-start' }}>
              <i className="fas fa-chart-pie" style={{ color: '#10b981', marginRight: 5 }} />Réussite / Échec
            </p>
            <Donut passed={passed} failed={failed} size={120} />
          </div>
        </div>

        <div className="grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
            <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 700, color: '#374151' }}>
              <i className="fas fa-chart-line" style={{ color: '#3b82f6', marginRight: 5 }} />Scores individuels (classement)
            </p>
            <SVGLine scores={allScores} />
          </div>
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
            <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 700, color: '#374151' }}>
              <i className="fas fa-calendar-alt" style={{ color: '#2563eb', marginRight: 5 }} />Évolution dans le temps
            </p>
            <SVGLine scores={timeScores} labels={timeLabels} />
          </div>
        </div>

        {/* Tableau copies papier */}
        {hasPapers && (
          <div>
            <h4 style={{ fontSize: 14, fontWeight: 700, color: '#374151', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <i className="fas fa-file-alt" style={{ color: '#2563eb' }} />Copies Papier ({st.papers.length})
            </h4>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                {['Étudiant', 'Email', 'Note', 'Corrigé le'].map(h => (
                  <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 11, color: '#64748b',
                    fontWeight: 700, textTransform: 'uppercase', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {st.papers.map((p, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '7px 10px', fontSize: 13 }}>{p.student_name}</td>
                    <td style={{ padding: '7px 10px', fontSize: 12, color: '#64748b' }}>{p.student_email}</td>
                    <td style={{ padding: '7px 10px', fontWeight: 700, color: sc(p.score) }}>{p.score != null ? p.score + '/20' : '—'}</td>
                    <td style={{ padding: '7px 10px', fontSize: 12, color: '#94a3b8' }}>
                      {p.corrected_at ? new Date(p.corrected_at).toLocaleDateString('fr-FR') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Tableau examens en ligne */}
        {hasAttempts && (
          <div>
            <h4 style={{ fontSize: 14, fontWeight: 700, color: '#374151', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <i className="fas fa-laptop-code" style={{ color: '#3b82f6' }} />Examens en Ligne ({st.attempts.length})
            </h4>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                {['Étudiant', 'Email', 'Examen', 'Note', 'Date'].map(h => (
                  <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 11, color: '#64748b',
                    fontWeight: 700, textTransform: 'uppercase', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {st.attempts.map((a, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '7px 10px', fontSize: 13 }}>{a.student_name}</td>
                    <td style={{ padding: '7px 10px', fontSize: 12, color: '#64748b' }}>{a.student_email}</td>
                    <td style={{ padding: '7px 10px', fontSize: 12, color: '#64748b' }}>{a.exam_title}</td>
                    <td style={{ padding: '7px 10px', fontWeight: 700, color: sc(a.score) }}>{a.score != null ? a.score + '/20' : '—'}</td>
                    <td style={{ padding: '7px 10px', fontSize: 12, color: '#94a3b8' }}>
                      {a.corrected_at ? new Date(a.corrected_at).toLocaleDateString('fr-FR') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!hasPapers && !hasAttempts && (
          <p style={{ color: '#94a3b8', fontSize: 13, margin: 0 }}>Aucune copie disponible pour ce sujet.</p>
        )}
      </div>
    </div>
  )
}

/* ─── Page principale ─── */
export default function ProfessorResultsPage() {
  const { error } = useToast()
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [loading,  setLoading]  = useState(true)
  const [detail,   setDetail]   = useState<Subject | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const list = await api.get<SubjectMeta[]>('/api/subjects')
      const arr  = Array.isArray(list) ? list : []
      const withStats = await Promise.all(
        arr.map(async s => {
          try   { return { ...s, stats: await api.get<SubjectStats>(`/api/statistics/${s.id}`) } }
          catch { return { ...s, stats: null } }
        })
      )
      setSubjects(withStats)
    } catch { error('Erreur de chargement des résultats') }
    finally   { setLoading(false) }
  }

  /* Agrégats globaux */
  const allScores = subjects.flatMap(s => [
    ...(s.stats?.papers   ?? []).map(p => p.score),
    ...(s.stats?.attempts ?? []).map(a => a.score),
  ]).filter((x): x is number => x != null)

  const gTotal  = subjects.reduce((a, s) => a + (s.stats?.totalStudents ?? 0), 0)
  const gAvg    = allScores.length ? +(allScores.reduce((a, b) => a + b, 0) / allScores.length).toFixed(1) : null
  const gPass   = allScores.length ? Math.round(allScores.filter(s => s >= 10).length / allScores.length * 100) : null
  const gMin    = allScores.length ? +Math.min(...allScores).toFixed(1) : null
  const gMax    = allScores.length ? +Math.max(...allScores).toFixed(1) : null
  const gDist   = [0, 0, 0, 0]
  allScores.forEach(s => { if (s < 5) gDist[0]++; else if (s < 10) gDist[1]++; else if (s < 15) gDist[2]++; else gDist[3]++ })
  const gPassed = allScores.filter(s => s >= 10).length
  const gFailed = allScores.filter(s => s < 10).length
  const hasGlobal = allScores.length > 0

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <i className="fas fa-chart-bar" style={{ color: '#2563eb' }} />Résultats &amp; Statistiques
          </h2>
          <p style={{ color: 'var(--text-muted)', margin: '4px 0 0', fontSize: 14 }}>Statistiques détaillées de vos examens</p>
        </div>
        <button className="btn btn-secondary" onClick={load}><i className="fas fa-rotate" /> Actualiser</button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '80px 24px' }}>
          <i className="fas fa-spinner fa-spin" style={{ fontSize: 32, color: 'var(--primary)', display: 'block', marginBottom: 14 }} />
          <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>Chargement…</span>
        </div>
      ) : subjects.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 60 }}>
          <i className="fas fa-chart-bar" style={{ fontSize: 40, color: 'var(--text-muted)', display: 'block', marginBottom: 14, opacity: .3 }} />
          <p style={{ margin: '0 0 16px', fontWeight: 600 }}>Aucun sujet créé pour le moment</p>
          <a href="/dashboard/professor/create-subject" className="btn btn-primary">
            <i className="fas fa-plus-circle" /> Créer un sujet
          </a>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* ── Bandeau global ── */}
          {hasGlobal && (
            <div style={{ background: '#2563eb', borderRadius: 14, padding: '20px 22px' }}>
              <p style={{ color: '#c7d2fe', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', margin: '0 0 14px' }}>
                <i className="fas fa-globe-africa" style={{ marginRight: 6 }} />Vue d'ensemble globale
              </p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {[
                  { icon: 'fa-users',      label: 'Étudiants', val: gTotal },
                  { icon: 'fa-chart-line', label: 'Moyenne',   val: gAvg  != null ? gAvg  + '/20' : '—' },
                  { icon: 'fa-percentage', label: 'Réussite',  val: gPass != null ? gPass + '%'   : '—' },
                  { icon: 'fa-arrow-down', label: 'Min',       val: gMin  != null ? gMin  + '/20' : '—' },
                  { icon: 'fa-arrow-up',   label: 'Max',       val: gMax  != null ? gMax  + '/20' : '—' },
                ].map(({ icon, label, val }) => (
                  <div key={label} style={{ flex: 1, minWidth: 100, background: 'rgba(255,255,255,.15)',
                    borderRadius: 12, padding: '14px 12px', textAlign: 'center' }}>
                    <div style={{ width: 36, height: 36, background: 'rgba(255,255,255,.18)', borderRadius: 9,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px' }}>
                      <i className={`fas ${icon}`} style={{ color: '#fff', fontSize: 14 }} />
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: '#fff' }}>{val}</div>
                    <div style={{ fontSize: 10, color: '#bfdbfe', marginTop: 2, fontWeight: 600, textTransform: 'uppercase' }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Graphiques globaux ── */}
          {hasGlobal && (
            <>
              <div className="grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 14, padding: '18px 20px' }}>
                  <p style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 700, color: '#374151', display: 'flex', alignItems: 'center', gap: 7 }}>
                    <i className="fas fa-chart-bar" style={{ color: '#2563eb' }} />Distribution des notes
                  </p>
                  <BarChart labels={['0 – 5', '5 – 10', '10 – 15', '15 – 20']} data={gDist}
                    colors={['#ef4444', '#f59e0b', '#10b981', '#3b82f6']} />
                </div>
                <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 14, padding: '18px 20px',
                  display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <p style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 700, color: '#374151', alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 7 }}>
                    <i className="fas fa-chart-pie" style={{ color: '#10b981' }} />Réussite / Échec
                  </p>
                  <Donut passed={gPassed} failed={gFailed} size={140} />
                </div>
              </div>

              {subjects.some(s => s.stats?.averageScore != null && (s.stats.totalStudents ?? 0) > 0) && (
                <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 14, padding: '18px 20px' }}>
                  <p style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 700, color: '#374151', display: 'flex', alignItems: 'center', gap: 7 }}>
                    <i className="fas fa-chart-line" style={{ color: '#3b82f6' }} />Moyenne par sujet
                  </p>
                  <HorizChart subjects={subjects} />
                </div>
              )}
            </>
          )}

          {/* ── Cartes sujets ── */}
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.05em', margin: '0 0 10px' }}>
              <i className="fas fa-file-alt" style={{ marginRight: 6 }} />Détail par sujet
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {subjects.map(s => {
                const st      = s.stats
                const hasData = (st?.totalStudents ?? 0) > 0 && st?.averageScore != null
                const pr      = st?.passRate ?? 0
                const prColor = pc(pr)
                const isOpen  = detail?.id === s.id

                return (
                  <div key={s.id}>
                    <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 14,
                      overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '16px 20px', gap: 14, flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: 200 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 3 }}>{s.title}</div>
                          {s.ec_name
                            ? <div style={{ fontSize: 11, color: '#64748b' }}><i className="fas fa-book" style={{ marginRight: 4 }} />{s.ec_code} — {s.ec_name}</div>
                            : <div style={{ fontSize: 11, color: '#94a3b8' }}>{new Date(s.created_at).toLocaleDateString('fr-FR')}</div>}
                        </div>

                        {hasData ? (
                          <div style={{ display: 'flex', gap: 22, alignItems: 'center' }}>
                            {[
                              { label: 'Copies',   val: String(st!.totalStudents),                        color: '#2563eb' },
                              { label: 'Moy.',     val: st!.averageScore!.toFixed(1) + '/20',             color: sc(st!.averageScore) },
                              { label: 'Réussite', val: pr + '%',                                         color: prColor },
                              { label: 'Min',      val: st!.minScore != null ? st!.minScore + '/20' : '—', color: '#64748b' },
                              { label: 'Max',      val: st!.maxScore != null ? st!.maxScore + '/20' : '—', color: '#3b82f6' },
                            ].map(({ label, val, color }) => (
                              <div key={label} style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: 15, fontWeight: 800, color }}>{val}</div>
                                <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600 }}>{label}</div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>
                            <i className="fas fa-clock" style={{ marginRight: 4 }} />Aucune copie corrigée
                          </span>
                        )}

                        <button onClick={() => setDetail(isOpen ? null : s)}
                          style={{ background: hasData ? '#2563eb' : '#f1f5f9', color: hasData ? '#fff' : '#64748b',
                            border: 'none', padding: '9px 16px', borderRadius: 9, fontSize: 13, fontWeight: 600,
                            cursor: 'pointer', whiteSpace: 'nowrap' }}>
                          <i className={`fas ${hasData ? (isOpen ? 'fa-times' : 'fa-chart-pie') : 'fa-search'}`} style={{ marginRight: 6 }} />
                          {hasData ? (isOpen ? 'Fermer' : 'Détails') : 'Consulter'}
                        </button>
                      </div>

                      {hasData && (
                        <div style={{ padding: '0 20px 14px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                            <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Taux de réussite</span>
                            <span style={{ fontSize: 10, color: prColor, fontWeight: 700 }}>{pr}%</span>
                          </div>
                          <div style={{ background: '#f1f5f9', borderRadius: 99, height: 5 }}>
                            <div style={{ width: `${Math.min(pr, 100)}%`, height: '100%', background: prColor, borderRadius: 99 }} />
                          </div>
                        </div>
                      )}
                    </div>

                    {isOpen && hasData && <SubjectDetail subject={s} onClose={() => setDetail(null)} />}
                  </div>
                )
              })}
            </div>
          </div>

        </div>
      )}
    </div>
  )
}
