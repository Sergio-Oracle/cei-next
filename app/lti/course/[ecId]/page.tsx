'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import api from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import ExamCard from '@/components/shared/StudentExamCard'
import type { OnlineExam } from '@/types'

/* Page ouverte depuis l'activité Moodle « Examens CEI » (LTI 1.3, phase 6) :
   les examens CEI de l'EC dont le cours Moodle a lancé CEI. L'étudiant y
   compose directement ; l'enseignant voit ses examens de cet EC et où les
   gérer. Les notes publiées partent seules dans le carnet de notes Moodle. */

interface EcInfo { ec_id: number; ec_code: string; ec_name: string; formation_code: string | null }

const DATE_OPTS: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Dakar' }
const STATUS_LABEL: Record<string, string> = { draft: 'Brouillon', scheduled: 'Planifié', active: 'En cours', closed: 'Terminé' }

export default function LtiCoursePage() {
  const { ecId } = useParams<{ ecId: string }>()
  const { user, loading: authLoading } = useAuth()
  const [ec, setEc] = useState<EcInfo | null>(null)
  const [exams, setExams] = useState<OnlineExam[] | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const [info, list] = await Promise.all([
        api.get<EcInfo>(`/api/lti/course/${ecId}`),
        api.get<OnlineExam[]>('/api/online_exams'),
      ])
      setEc(info)
      setExams((Array.isArray(list) ? list : []).filter(e => String((e as any).ec_id) === String(ecId))
        .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()))
    } catch (e: any) { setError(e.message || 'Chargement impossible') }
  }, [ecId])

  useEffect(() => {
    if (authLoading || !user) return
    load()
    // Un examen planifié devient « En cours » quand l'enseignant l'active.
    const t = setInterval(load, 30000)
    return () => clearInterval(t)
  }, [authLoading, user, load])

  const isStudent = user?.role === 'student'
  const dashboard = user ? `/dashboard/${user.role}` : '/dashboard'
  const manageHref = user?.role === 'admin' ? '/dashboard/admin/exams' : '/dashboard/professor/exams'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)' }}>
      <header style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 800, fontSize: 18, color: 'var(--text)' }}>
          <i className="fas fa-graduation-cap" style={{ color: 'var(--primary)' }} /> Centre d&apos;Examen Intelligent
        </div>
        <Link href={dashboard} style={{ fontSize: 15, fontWeight: 600, color: 'var(--primary)', textDecoration: 'none' }}>
          <i className="fas fa-table-columns" style={{ marginRight: 6 }} />Mon tableau de bord
        </Link>
      </header>

      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px', display: 'grid', gap: 18 }}>
        <div>
          <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 4 }}>
            <i className="fas fa-link" style={{ marginRight: 6 }} />Ouvert depuis Moodle{ec?.formation_code ? ` · ${ec.formation_code}` : ''}
          </div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: 'var(--text)' }}>
            {ec ? <><span style={{ fontFamily: 'monospace' }}>{ec.ec_code}</span> — {ec.ec_name}</> : 'Examens CEI'}
          </h1>
        </div>

        {error ? (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: 12, padding: 16 }}>
            <i className="fas fa-circle-exclamation" style={{ marginRight: 8 }} />{error}
          </div>
        ) : exams === null ? (
          <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}><i className="fas fa-spinner fa-spin" style={{ fontSize: 28 }} /></div>
        ) : exams.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 24px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16 }}>
            <i className="fas fa-calendar-xmark" style={{ fontSize: 44, color: '#cbd5e1', display: 'block', marginBottom: 12 }} />
            <h3 style={{ margin: '0 0 6px', color: '#475569' }}>Aucun examen CEI pour ce cours</h3>
            <p style={{ margin: 0, color: 'var(--text-muted)' }}>
              {isStudent ? 'Vos examens apparaîtront ici dès qu’ils seront planifiés.' : 'Les examens créés dans CEI sur un sujet de cet EC apparaîtront ici.'}
            </p>
          </div>
        ) : isStudent ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 18 }}>
            {exams.map(e => <ExamCard key={e.id} exam={e} />)}
          </div>
        ) : (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
            {exams.map((e, i) => (
              <div key={e.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', padding: '14px 18px', borderTop: i ? '1px solid var(--border)' : 'none' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)' }}>{e.title}</div>
                  <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>
                    {new Date(e.start_time).toLocaleString('fr-FR', DATE_OPTS)} · {e.duration_minutes} min · {STATUS_LABEL[e.status] || e.status}
                    {(e as any).results_published ? ' · résultats publiés (notes envoyées à Moodle)' : ''}
                  </div>
                </div>
                <Link href={manageHref} style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--primary)', textDecoration: 'none' }}>Gérer dans CEI →</Link>
              </div>
            ))}
          </div>
        )}

        {!isStudent && user && (
          <p style={{ margin: 0, fontSize: 14, color: 'var(--text-muted)' }}>
            <i className="fas fa-circle-info" style={{ marginRight: 6 }} />
            À la publication des résultats, CEI crée une colonne « Examen CEI – titre » dans le carnet de notes de ce cours Moodle et y dépose les notes sur 20.
          </p>
        )}
      </main>
    </div>
  )
}
