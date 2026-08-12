'use client'

/**
 * Écoute des appels superviseur entrants sur les pages /proctor/* (page de
 * surveillance plein écran, /proctor/[id] et /proctor/monitor/[id]) — ces
 * pages utilisent un layout séparé (app/proctor/layout.tsx) SANS le Header
 * partagé (components/layout/Header.tsx), où l'écoute équivalente est déjà
 * branchée pour le reste de l'application. Sans ce composant, un surveillant
 * activement sur sa page de surveillance — le cas le plus probable — ne
 * verrait jamais un appel entrant de son superviseur.
 */
import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useNotificationPoll, type NotifEvent } from '@/hooks/useNotificationPoll'
import AnswerSupervisorCallModal from '@/components/exam/AnswerSupervisorCallModal'
import { playAlertBeep } from '@/lib/notifSound'

export default function SupervisorCallListener() {
  const { user } = useAuth()
  const router = useRouter()
  const [incoming, setIncoming] = useState<{ supervisorId: number; supervisorName: string } | null>(null)
  const [answering, setAnswering] = useState(false)
  const [resumedAlert, setResumedAlert] = useState<{ examId: number; message: string } | null>(null)

  const handleNotifEvent = useCallback((ev: NotifEvent) => {
    const anyEv = ev as NotifEvent & { supervisor_id?: number; supervisor_name?: string; exam_id?: number }
    if (ev.type === 'supervisor_call_request' && anyEv.supervisor_id) {
      setIncoming({ supervisorId: anyEv.supervisor_id, supervisorName: anyEv.supervisor_name || 'Votre superviseur' })
    }
    if (ev.type === 'student_resumed' && anyEv.exam_id) {
      playAlertBeep()
      setResumedAlert({ examId: anyEv.exam_id, message: ev.message })
    }
  }, [])

  // Surveillants ET superviseurs travaillent depuis /proctor/* — les deux
  // doivent être avertis d'une reprise d'étudiant, pas seulement l'appel.
  useNotificationPoll(user?.role === 'surveillant' || user?.role === 'superviseur', handleNotifEvent)

  return (
    <>
      {resumedAlert && (
        <div style={{ position: 'fixed', top: incoming ? 96 : 16, right: 20, zIndex: 9599, background: '#0f172a', color: 'white', borderRadius: 12, padding: '12px 16px', boxShadow: '0 10px 40px rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', gap: 12, border: '1px solid rgba(59,130,246,.4)', cursor: 'pointer', maxWidth: 320 }}
          onClick={() => { router.push(`/proctor/monitor/${resumedAlert.examId}`); setResumedAlert(null) }}>
          <i className="fas fa-bell" style={{ color: '#60a5fa', fontSize: 22, flexShrink: 0 }} />
          <div style={{ fontSize:15, flex: 1 }}>{resumedAlert.message}</div>
          <button onClick={(e) => { e.stopPropagation(); setResumedAlert(null) }}
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.6)', cursor: 'pointer', fontSize:17 }}>
            <i className="fas fa-times" />
          </button>
        </div>
      )}
      {incoming && !answering && (
        <div style={{ position: 'fixed', top: 16, right: 20, zIndex: 9600, background: '#0f172a', color: 'white', borderRadius: 12, padding: '14px 18px', boxShadow: '0 10px 40px rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', gap: 14, border: '1px solid rgba(16,185,129,.4)' }}>
          <i className="fas fa-phone-volume fa-shake" style={{ color: '#10b981', fontSize: 24 }} />
          <div>
            <div style={{ fontWeight: 700, fontSize:15.5 }}>Appel entrant</div>
            <div style={{ fontSize:14.5, color: 'rgba(255,255,255,.7)' }}>{incoming.supervisorName}</div>
          </div>
          <button onClick={() => setAnswering(true)}
            style={{ background: '#10b981', color: 'white', border: 'none', borderRadius: 8, padding: '8px 14px', fontWeight: 700, fontSize:14.5, cursor: 'pointer' }}>
            <i className="fas fa-phone" /> Répondre
          </button>
          <button onClick={() => setIncoming(null)}
            style={{ background: 'rgba(239,68,68,.2)', color: '#fca5a5', border: 'none', borderRadius: 8, padding: '8px 14px', fontWeight: 700, fontSize:14.5, cursor: 'pointer' }}>
            <i className="fas fa-phone-slash" /> Refuser
          </button>
        </div>
      )}
      {answering && incoming && user && (
        <AnswerSupervisorCallModal
          proctorId={user.id}
          supervisorName={incoming.supervisorName}
          onClose={() => { setAnswering(false); setIncoming(null) }}
        />
      )}
    </>
  )
}
