'use client'

import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'
import type { OnlineExam } from '@/types'

interface StudentMessage {
  id: number
  student_name: string
  student_id: number
  message: string
  created_at: string
  is_read?: boolean
}

export default function SurveillantMessagesPage() {
  const { error } = useToast()
  const [exams, setExams] = useState<OnlineExam[]>([])
  const [selectedExamId, setSelectedExamId] = useState<number | null>(null)
  const [messages, setMessages] = useState<StudentMessage[]>([])
  const [loadingExams, setLoadingExams] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)

  useEffect(() => {
    loadExams()
  }, [])

  async function loadExams() {
    setLoadingExams(true)
    try {
      let res: OnlineExam[]
      try {
        res = await api.get<OnlineExam[]>('/api/surveillant/exams')
      } catch {
        res = await api.get<OnlineExam[]>('/api/online_exams')
      }
      const list = Array.isArray(res) ? res : (res as any).exams ?? []
      setExams(list.filter((e: OnlineExam) => e.status === 'active' || e.status === 'closed'))
    } catch { error('Erreur chargement examens') }
    finally { setLoadingExams(false) }
  }

  async function loadMessages(examId: number) {
    setSelectedExamId(examId)
    setLoadingMessages(true)
    try {
      const res = await api.get<StudentMessage[]>(`/api/online_exams/${examId}/student_messages`)
      setMessages(Array.isArray(res) ? res : (res as any).messages ?? [])
    } catch { error('Erreur chargement messages') }
    finally { setLoadingMessages(false) }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2><i className="fa-solid fa-comments" style={{ marginRight: 10, color: 'var(--primary)' }} />Messages des étudiants</h2>
          <p>Consultez les messages envoyés pendant les examens</p>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: '280px 1fr', alignItems: 'start' }}>
        {/* Sidebar examens */}
        <div className="card">
          <div className="card-header"><h3><i className="fa-solid fa-list" /> Examens</h3></div>
          {loadingExams ? (
            <div style={{ textAlign: 'center', padding: 20 }}><i className="fa-solid fa-spinner spin" /></div>
          ) : exams.length === 0 ? (
            <p className="empty-message">Aucun examen</p>
          ) : exams.map(exam => (
            <div
              key={exam.id}
              className="reclamation-item"
              style={{ cursor: 'pointer', background: selectedExamId === exam.id ? 'var(--primary)15' : undefined }}
              onClick={() => loadMessages(exam.id)}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{exam.title}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  <span className={`status-badge ${exam.status === 'active' ? 'success' : 'secondary'}`} style={{ fontSize: 10 }}>
                    {exam.status === 'active' ? 'Actif' : 'Clôturé'}
                  </span>
                </div>
              </div>
              <i className="fa-solid fa-chevron-right" style={{ color: 'var(--text-muted)', fontSize: 12 }} />
            </div>
          ))}
        </div>

        {/* Messages */}
        <div className="card">
          {!selectedExamId ? (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
              <i className="fa-solid fa-arrow-left" style={{ fontSize: 32, marginBottom: 12, display: 'block' }} />
              Sélectionnez un examen pour voir les messages
            </div>
          ) : loadingMessages ? (
            <div style={{ textAlign: 'center', padding: 40 }}><i className="fa-solid fa-spinner spin" /></div>
          ) : messages.length === 0 ? (
            <p className="empty-message">Aucun message pour cet examen</p>
          ) : (
            <div style={{ padding: 16 }}>
              {messages.map(msg => (
                <div key={msg.id} className="reclamation-item" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--primary)20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'var(--primary)', fontSize: 13 }}>
                        {msg.student_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{msg.student_name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Étudiant #{msg.student_id}</div>
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{new Date(msg.created_at).toLocaleString('fr-FR')}</div>
                  </div>
                  <div style={{ fontSize: 14, padding: '8px 12px', background: 'var(--background)', borderRadius: 'var(--radius)', width: '100%' }}>
                    {msg.message}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
