'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import api from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import type { OnlineExam } from '@/types'

interface ProfDashboardAPI {
  my_subjects: number
  papers_corrected: number
}

export default function ProfessorDashboard() {
  const { user } = useAuth()
  const { error } = useToast()
  const [dashData, setDashData] = useState<ProfDashboardAPI | null>(null)
  const [activeExams, setActiveExams] = useState<OnlineExam[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const [resDash, resExams] = await Promise.allSettled([
        api.get<ProfDashboardAPI>('/api/professor/dashboard'),
        api.get<OnlineExam[]>('/api/online_exams'),
      ])

      if (resDash.status === 'fulfilled') {
        setDashData(resDash.value)
      }

      if (resExams.status === 'fulfilled') {
        const exams = Array.isArray(resExams.value) ? resExams.value : (resExams.value as any).exams ?? []
        setActiveExams(exams.filter((e: OnlineExam) => e.status === 'active'))
      }
    } catch { error('Erreur chargement') }
    finally { setLoading(false) }
  }

  const stats = [
    { label: 'Mes sujets',         value: dashData?.my_subjects ?? 0,       icon: 'fa-file-lines',       color: '#3b82f6', href: '/dashboard/professor/subjects' },
    { label: 'Examens actifs',     value: activeExams.length,               icon: 'fa-monitor-waveform', color: '#10b981', href: '/dashboard/professor/exams' },
    { label: 'Corrections faites', value: dashData?.papers_corrected ?? 0,  icon: 'fa-pen-ruler',        color: '#f59e0b', href: '/dashboard/professor/papers' },
  ]

  return (
    <div>
      <div className="page-header">
        <div>
          <h2><i className="fa-solid fa-chalkboard-teacher" style={{ marginRight: 10, color: 'var(--primary)' }} />Tableau de bord</h2>
          <p>Bienvenue, {user?.full_name}</p>
        </div>
        <Link href="/dashboard/professor/exams/new" className="btn btn-primary">
          <i className="fa-solid fa-plus" /> Nouvel examen
        </Link>
      </div>

      <div className="grid">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="stat-card" style={{ borderColor: '#e2e8f0' }}>
              <div style={{ height: 20, background: '#f1f5f9', borderRadius: 4, marginBottom: 8 }} />
              <div style={{ height: 36, background: '#f1f5f9', borderRadius: 4 }} />
            </div>
          ))
        ) : stats.map((s, i) => (
          <Link key={i} href={s.href} style={{ textDecoration: 'none' }}>
            <div className="stat-card" style={{ borderColor: s.color, cursor: 'pointer' }}>
              <div className="stat-label">
                <i className={`fa-solid ${s.icon}`} style={{ color: s.color }} /> {s.label}
              </div>
              <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', marginTop: 24 }}>
        {/* Examens actifs */}
        <div className="card">
          <div className="card-header">
            <h3><i className="fa-solid fa-play" style={{ color: 'var(--success)' }} /> Examens en cours</h3>
            <Link href="/dashboard/professor/exams" className="btn btn-sm btn-secondary">Voir tout</Link>
          </div>
          {loading ? <div style={{ textAlign: 'center', padding: 20 }}><i className="fa-solid fa-spinner spin" /></div>
          : activeExams.length === 0 ? (
            <p className="empty-message">Aucun examen actif</p>
          ) : activeExams.slice(0, 5).map(exam => (
            <div key={exam.id} className="reclamation-item">
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{exam.title}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  <i className="fa-solid fa-users" /> {exam.attempts_count ?? 0} participants · {exam.duration_minutes} min
                </div>
              </div>
              <Link href={`/proctor/${exam.id}`} className="btn btn-sm btn-success">
                <i className="fa-solid fa-eye" /> Surveiller
              </Link>
            </div>
          ))}
        </div>

        {/* Actions rapides */}
        <div className="card">
          <div className="card-header"><h3><i className="fa-solid fa-bolt" style={{ color: 'var(--warning)' }} /> Actions rapides</h3></div>
          <div style={{ padding: '8px 0' }}>
            {[
              { href: '/dashboard/professor/subjects', icon: 'fa-file-circle-plus', label: 'Créer un sujet', desc: 'Nouveau sujet ou upload PDF' },
              { href: '/dashboard/professor/exams/new', icon: 'fa-plus-circle', label: 'Nouvel examen', desc: 'Planifier un examen en ligne' },
              { href: '/dashboard/professor/papers', icon: 'fa-pen-ruler', label: 'Corriger des copies', desc: 'Correction manuelle ou automatique' },
              { href: '/dashboard/professor/questions', icon: 'fa-question-circle', label: 'Banque de questions', desc: 'Gérer vos questions réutilisables' },
              { href: '/dashboard/professor/analytics', icon: 'fa-chart-bar', label: 'Analytiques', desc: 'Statistiques et résultats' },
              { href: '/dashboard/professor/reclamations', icon: 'fa-comment-exclamation', label: 'Réclamations', desc: 'Traiter les réclamations des étudiants' },
            ].map((a, i) => (
              <Link key={i} href={a.href} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 24px', borderBottom: '1px solid var(--border)', textDecoration: 'none' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--background)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <div style={{ width: 36, height: 36, background: 'var(--primary)15', borderRadius: 'var(--radius)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className={`fa-solid ${a.icon}`} style={{ color: 'var(--primary)' }} />
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{a.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{a.desc}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
