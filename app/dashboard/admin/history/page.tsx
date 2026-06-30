'use client'

import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'
import type { OnlineExam } from '@/types'
import ExamDetailModal from '../exams/ExamDetailModal'
import ExamCopiesModal from '../exams/ExamCopiesModal'
import { IncidentsModal } from '../exams/ExamToolbarModals'

/* ── History-specific type returned by /api/admin/exams_history ── */
interface HistoryExam {
  id: number
  title: string
  subject_title?: string
  creator_name?: string
  start_time: string
  end_time: string
  duration_minutes: number
  total_attempts: number
  submitted_count: number
  banned_count: number
  corrected_count: number
  average_score: number
  incidents_count: number
  created_at: string
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function initials(name?: string) {
  if (!name) return '?'
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

export default function AdminHistoryPage() {
  const { error, success }        = useToast()
  const [exams, setExams]         = useState<HistoryExam[]>([])
  const [loading, setLoading]     = useState(true)

  /* Detail modal */
  const [detailExam, setDetailExam]           = useState<OnlineExam | null>(null)
  const [detailLoading, setDetailLoading]     = useState<number | null>(null)

  /* Copies modal */
  const [copiesExamId, setCopiesExamId]       = useState<number | null>(null)
  const [copiesTitle,  setCopiesTitle]        = useState('')

  /* Incidents modal */
  const [incidentsId,    setIncidentsId]      = useState<number | null>(null)
  const [incidentsTitle, setIncidentsTitle]   = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const res = await api.get<HistoryExam[]>('/api/admin/exams_history')
      setExams(Array.isArray(res) ? res : [])
    } catch { error('Erreur de chargement') }
    finally { setLoading(false) }
  }

  async function openDetail(id: number) {
    setDetailLoading(id)
    try {
      const exam = await api.get<OnlineExam>(`/api/online_exams/${id}/details`)
      setDetailExam(exam)
    } catch { error('Impossible de charger les détails') }
    finally { setDetailLoading(null) }
  }

  const totalAttempts  = exams.reduce((s, e) => s + (e.total_attempts ?? 0), 0)
  const totalIncidents = exams.reduce((s, e) => s + (e.incidents_count ?? 0), 0)

  return (
    <div>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <i className="fas fa-clock-rotate-left" style={{ color: 'var(--primary)' }} />
            Historique des Examens
          </h2>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 13 }}>Statistiques et journaux des examens terminés</p>
        </div>
      </div>

      {/* KPI tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
        <KpiCard icon="fa-file-circle-check" iconColor="#3b82f6" bg="#eff6ff" label="Examens terminés" value={loading ? '…' : String(exams.length)} />
        <KpiCard icon="fa-users"             iconColor="#10b981" bg="#dcfce7" label="Participations totales" value={loading ? '…' : String(totalAttempts)} />
        <KpiCard
          icon={totalIncidents > 0 ? 'fa-triangle-exclamation' : 'fa-shield-check'}
          iconColor={totalIncidents > 0 ? '#ef4444' : '#10b981'}
          bg={totalIncidents > 0 ? '#fee2e2' : '#dcfce7'}
          label="Incidents détectés"
          value={loading ? '…' : String(totalIncidents)}
        />
      </div>

      {/* Main table card */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <i className="fas fa-list" style={{ color: 'var(--text-muted)', fontSize: 13 }} />
          <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--text)' }}>Liste des examens</span>
          <span style={{ background: 'var(--background)', color: 'var(--text-muted)', padding: '1px 8px', borderRadius: 99, fontSize: 12, marginLeft: 4 }}>{exams.length}</span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--background)' }}>
                {['Examen', 'Créateur', 'Date de clôture', 'Participants', 'Moyenne', 'Incidents', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', borderBottom: '1px solid var(--border)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <i className="fas fa-spinner fa-spin" style={{ fontSize: 22 }} />
                </td></tr>
              ) : exams.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: '56px', textAlign: 'center' }}>
                  <i className="fas fa-folder-open" style={{ fontSize: 48, color: 'var(--text-muted)', display: 'block', marginBottom: 14 }} />
                  <h3 style={{ color: 'var(--text)', margin: '0 0 8px' }}>Aucun examen terminé</h3>
                  <p style={{ color: 'var(--text-muted)', margin: 0 }}>L'historique s'alimentera automatiquement dès qu'un examen sera clôturé.</p>
                </td></tr>
              ) : exams.map(exam => {
                const sc       = exam.average_score
                const scColor  = sc >= 10 ? '#10b981' : '#ef4444'
                const scBg     = sc >= 10 ? '#dcfce7'  : '#fee2e2'
                const isBusy   = detailLoading === exam.id

                return (
                  <tr key={exam.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    {/* Examen */}
                    <td style={{ padding: '14px 16px', maxWidth: 260 }}>
                      <p style={{ margin: 0, fontWeight: 600, color: 'var(--text)', fontSize: 13, lineHeight: 1.4 }}>{exam.title}</p>
                      {exam.subject_title && <p style={{ margin: '3px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>{exam.subject_title}</p>}
                    </td>

                    {/* Créateur */}
                    <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#dbeafe', color: '#1d4ed8', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {initials(exam.creator_name)}
                        </div>
                        <span style={{ fontSize: 13, color: 'var(--text)' }}>{exam.creator_name ?? '—'}</span>
                      </div>
                    </td>

                    {/* Date de clôture */}
                    <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted)' }}>
                        <i className="fas fa-calendar-day" style={{ color: 'var(--text-muted)', fontSize: 11 }} />
                        {fmtDate(exam.end_time)}
                      </div>
                    </td>

                    {/* Participants */}
                    <td style={{ padding: '14px 16px' }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{exam.total_attempts} participant(s)</p>
                      <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>
                        {exam.submitted_count} soumis · {exam.corrected_count} corrigés
                        {exam.banned_count > 0 && <span style={{ color: '#ef4444', fontWeight: 600 }}> · {exam.banned_count} exclus</span>}
                      </p>
                    </td>

                    {/* Moyenne */}
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      <span style={{ display: 'inline-block', background: scBg, color: scColor, padding: '4px 10px', borderRadius: 8, fontWeight: 700, fontSize: 15 }}>
                        {sc}/20
                      </span>
                    </td>

                    {/* Incidents */}
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      {exam.incidents_count > 0
                        ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: '#fee2e2', color: '#991b1b', padding: '3px 9px', borderRadius: 99, fontSize: 12, fontWeight: 600 }}>
                            <i className="fas fa-triangle-exclamation" style={{ fontSize: 10 }} />{exam.incidents_count}
                          </span>
                        : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: '#dcfce7', color: '#15803d', padding: '3px 9px', borderRadius: 99, fontSize: 12, fontWeight: 600 }}>
                            <i className="fas fa-check" style={{ fontSize: 10 }} />Aucun
                          </span>}
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => openDetail(exam.id)} disabled={isBusy}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 11px', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: isBusy ? 'not-allowed' : 'pointer', opacity: isBusy ? .7 : 1 }}>
                          <i className={`fas ${isBusy ? 'fa-spinner fa-spin' : 'fa-eye'}`} />{isBusy ? '…' : 'Détails'}
                        </button>
                        <button onClick={() => { setIncidentsId(exam.id); setIncidentsTitle(exam.title) }}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 11px', background: '#fffbeb', color: '#92400e', border: '1px solid #fde68a', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                          <i className="fas fa-list-ul" />Logs
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ExamDetailModal */}
      {detailExam && (
        <ExamDetailModal
          exam={detailExam}
          onClose={() => setDetailExam(null)}
          onViewCopies={(id) => {
            setDetailExam(null)
            const exam = exams.find(e => e.id === id)
            setCopiesTitle(exam?.title ?? '')
            setCopiesExamId(id)
          }}
          onActivate={async () => {}}
          onClose_={async () => {}}
          onDelete={async () => {}}
        />
      )}

      {/* ExamCopiesModal */}
      {copiesExamId !== null && (
        <ExamCopiesModal
          examId={copiesExamId}
          examTitle={copiesTitle}
          onClose={() => setCopiesExamId(null)}
        />
      )}

      {/* IncidentsModal */}
      {incidentsId !== null && (
        <IncidentsModal
          examId={incidentsId}
          examTitle={incidentsTitle}
          onClose={() => { setIncidentsId(null); setIncidentsTitle('') }}
        />
      )}
    </div>
  )
}

function KpiCard({ icon, iconColor, bg, label, value }: { icon: string; iconColor: string; bg: string; label: string; value: string }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <i className={`fas ${icon}`} style={{ color: iconColor, fontSize: 16 }} />
      </div>
      <div>
        <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>{value}</p>
        <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>{label}</p>
      </div>
    </div>
  )
}
