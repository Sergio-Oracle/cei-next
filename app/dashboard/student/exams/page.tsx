'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import api, { serverNow } from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'
import type { OnlineExam } from '@/types'
import ExamCard from '@/components/shared/StudentExamCard'

export default function StudentExamsPage() {
  const { error } = useToast()
  const router = useRouter()
  const [exams, setExams] = useState<OnlineExam[]>([])
  const [loading, setLoading] = useState(true)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const refreshRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    load()
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (refreshRef.current) clearInterval(refreshRef.current)
    }
  }, []) // eslint-disable-line

  async function load() {
    setLoading(true)
    try {
      const list = await api.get<OnlineExam[]>('/api/online_exams')
      const exams = Array.isArray(list) ? list : (list as any).exams ?? []
      setExams(exams)

      // Auto-refresh toutes les 30s s'il y a un examen actif
      if (refreshRef.current) clearInterval(refreshRef.current)
      if (exams.some((e: OnlineExam) => e.status === 'active')) {
        refreshRef.current = setInterval(() => load(), 30_000)
      }

      // Programmer un refresh au prochain changement d'état
      const nowMs = serverNow()
      const nextMs = exams
        .flatMap((e: OnlineExam) => [new Date(e.start_time).getTime(), new Date(e.end_time).getTime()])
        .filter((t: number) => t > nowMs)
        .sort((a: number, b: number) => a - b)[0]
      if (nextMs) {
        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => load(), Math.min(nextMs - nowMs + 1500, 3_600_000))
      }
    } catch { error('Erreur de chargement des examens') }
    finally { setLoading(false) }
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ background: '#3b82f6', width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <i className="fas fa-laptop-code" style={{ color: 'white', fontSize: 22 }} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize:24, fontWeight: 700, color: 'var(--text)' }}>Mes Examens en Ligne</h2>
            <p style={{ margin: '4px 0 0', fontSize:15.5, color: 'var(--text-muted)' }}>{exams.length} examen(s) disponible(s)</p>
          </div>
        </div>
        <Link href="/dashboard/student/results"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 18px', background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: 8, fontSize:15.5, fontWeight: 600, textDecoration: 'none' }}>
          <i className="fas fa-history" /> Mon historique
        </Link>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 64, color: 'var(--text-muted)' }}>
          <i className="fas fa-spinner fa-spin" style={{ fontSize: 35 }} />
        </div>
      ) : exams.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px 24px', background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)' }}>
          <i className="fas fa-laptop-code" style={{ fontSize: 57, color: '#cbd5e1', display: 'block', marginBottom: 16 }} />
          <h3 style={{ color: '#475569', fontSize:21.5, fontWeight: 600, margin: '0 0 8px' }}>Aucun examen disponible</h3>
          <p style={{ color: '#94a3b8', fontSize:17, margin: 0 }}>Vos examens apparaîtront ici lorsqu'ils seront planifiés.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
          {exams.map(exam => <ExamCard key={exam.id} exam={exam} />)}
        </div>
      )}
    </div>
  )
}
