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
import { useToast } from '@/contexts/ToastContext'

export default function SupervisorCallListener() {
  const { user } = useAuth()
  const router = useRouter()
  const { showToast } = useToast()
  // roomProctorId : propriétaire de la salle d'appel (supcall-<surveillant>) — moi quand un superviseur m'appelle, l'appelant quand un surveillant m'appelle
  const [incoming, setIncoming] = useState<{ supervisorId: number; supervisorName: string; callerLabel?: string; roomProctorId?: number } | null>(null)
  const [answering, setAnswering] = useState(false)
  const [resumedAlert, setResumedAlert] = useState<{ examId: number; message: string } | null>(null)
  const [riskAlert, setRiskAlert] = useState<{ message: string } | null>(null)

  const handleNotifEvent = useCallback((ev: NotifEvent) => {
    const anyEv = ev as NotifEvent & { supervisor_id?: number; supervisor_name?: string; caller_label?: string; exam_id?: number; proctor_id?: number; proctor_name?: string }
    if (ev.type === 'proctor_call_request' && anyEv.proctor_id) {
      playAlertBeep()
      setIncoming({ supervisorId: anyEv.proctor_id, supervisorName: anyEv.proctor_name || 'Un surveillant', callerLabel: 'Surveillant', roomProctorId: anyEv.proctor_id })
    }
    if (ev.type === 'staff_message' && anyEv.exam_id) {
      showToast(`${ev.title} : ${ev.message}`, 'info', 9000, () => router.push(`/proctor/monitor/${anyEv.exam_id}?chat=1`))
    }
    if (ev.type === 'supervisor_call_request' && anyEv.supervisor_id) {
      setIncoming({ supervisorId: anyEv.supervisor_id, supervisorName: anyEv.supervisor_name || 'Votre superviseur', callerLabel: anyEv.caller_label })
    }
    if (ev.type === 'student_resumed' && anyEv.exam_id) {
      playAlertBeep()
      setResumedAlert({ examId: anyEv.exam_id, message: ev.message })
    }
    // Alertes surveillance émises par notify_exam (bus back-end) : bannissement,
    // risque élevé, identité non confirmée, seuil atteint, surveillant
    // déconnecté, agent autonome. Le contenu de la grille se rafraîchit par
    // ailleurs (poll 8 s de la page de surveillance) — ici on ne fait que
    // signaler.
    if (['student_banned', 'high_risk', 'identity_mismatch', 'threshold_alert', 'proctor_disconnected', 'agent_alert'].includes(ev.type)) {
      playAlertBeep()
      setRiskAlert({ message: ev.message || ev.title || 'Alerte de surveillance' })
    }
  }, [])

  // Surveillants ET superviseurs travaillent depuis /proctor/* — les deux
  // doivent être avertis d'une reprise d'étudiant, pas seulement l'appel.
  useNotificationPoll(!!user && ['surveillant', 'superviseur', 'professor', 'admin', 'responsable_examen'].includes(String(user.role)), handleNotifEvent)

  return (
    <>
      {riskAlert && (
        <div style={{ position: 'fixed', top: incoming ? 152 : 72, left: 20, zIndex: 9599, background: '#0f172a', color: 'white', borderRadius: 12, padding: '12px 16px', boxShadow: '0 10px 40px rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', gap: 12, border: '1px solid rgba(245,158,11,.5)', maxWidth: 340 }}>
          <i className="fas fa-triangle-exclamation" style={{ color: '#f59e0b', fontSize: 22, flexShrink: 0 }} />
          <div style={{ fontSize:15, flex: 1 }}>{riskAlert.message}</div>
          <button onClick={() => setRiskAlert(null)}
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.6)', cursor: 'pointer', fontSize:17 }}>
            <i className="fas fa-times" />
          </button>
        </div>
      )}
      {resumedAlert && (
        <div style={{ position: 'fixed', top: incoming ? 152 : 72, right: 20, zIndex: 9599, background: '#0f172a', color: 'white', borderRadius: 12, padding: '12px 16px', boxShadow: '0 10px 40px rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', gap: 12, border: '1px solid rgba(59,130,246,.4)', cursor: 'pointer', maxWidth: 320 }}
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
        <div style={{ position: 'fixed', top: 72, right: 20, zIndex: 9600, background: '#0f172a', color: 'white', borderRadius: 12, padding: '14px 18px', boxShadow: '0 10px 40px rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', gap: 14, border: '1px solid rgba(16,185,129,.4)' }}>
          <i className="fas fa-phone-volume fa-shake" style={{ color: '#10b981', fontSize: 24 }} />
          <div>
            <div style={{ fontWeight: 700, fontSize:15.5 }}>Appel entrant</div>
            <div style={{ fontSize:14.5, color: 'rgba(255,255,255,.7)' }}>{incoming.supervisorName}{incoming.callerLabel ? ` — ${incoming.callerLabel.toLowerCase()}` : ''}</div>
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
          proctorId={incoming.roomProctorId ?? user.id}
          supervisorName={incoming.supervisorName}
          callerLabel={incoming.callerLabel}
          onClose={() => { setAnswering(false); setIncoming(null) }}
        />
      )}
    </>
  )
}
