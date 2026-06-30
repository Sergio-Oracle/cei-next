'use client'

import { useState } from 'react'
import { useToast } from '@/contexts/ToastContext'
import type { OnlineExam } from '@/types'
import api from '@/lib/api'
import { IncidentsModal } from './ExamToolbarModals'

type ExamStatus = 'draft' | 'scheduled' | 'active' | 'closed'

const STATUS_META: Record<ExamStatus, { label: string; color: string; bg: string; border: string }> = {
  draft:     { label: 'Brouillon', color: '#64748b', bg: '#f1f5f9', border: '#cbd5e1' },
  scheduled: { label: 'Planifié',  color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  active:    { label: 'Actif',     color: '#059669', bg: '#f0fdf4', border: '#bbf7d0' },
  closed:    { label: 'Clôturé',   color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
}

function fmtFull(iso: string) {
  return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function fmtDuration(min: number) {
  const h = Math.floor(min / 60), m = min % 60
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`
}

interface Props {
  exam: OnlineExam
  onClose: () => void
  onViewCopies: (examId: number) => void
  onActivate: (examId: number) => Promise<void>
  onClose_: (examId: number) => Promise<void>
  onDelete: (examId: number) => Promise<void>
}

export default function ExamDetailModal({ exam, onClose, onViewCopies, onActivate, onClose_, onDelete }: Props) {
  const [showIncidents, setShowIncidents] = useState(false)
  const meta = STATUS_META[exam.status as ExamStatus] ?? STATUS_META.draft
  const isScheduled = exam.status === 'scheduled'
  const isActive    = exam.status === 'active'
  const isDraft     = exam.status === 'draft'

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'var(--surface)', borderRadius: 16, width: '100%', maxWidth: 700, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,.25)' }}>
        {/* Header */}
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 1 }}>
          <div style={{ width: 40, height: 40, background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <i className="fas fa-desktop" style={{ color: 'var(--primary)' }} />
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Détails de l'Examen</h3>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
            <i className="fas fa-times" />
          </button>
        </div>

        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Informations générales */}
          <div style={{ background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <i className="fas fa-info-circle" style={{ color: 'var(--primary)' }} />
              <span style={{ fontWeight: 700, fontSize: 14 }}>Informations Générales</span>
            </div>
            <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Row icon="fa-heading"      label="Titre"      value={exam.title} />
              {exam.subject_title && <Row icon="fa-book"    label="Sujet"      value={exam.subject_title} />}
              {exam.creator_name  && <Row icon="fa-user-tie" label="Créé par"  value={exam.creator_name} />}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                <i className="fas fa-circle-dot" style={{ color: 'var(--text-muted)', width: 16, textAlign: 'center' }} />
                <span style={{ color: 'var(--text-muted)', fontWeight: 600, minWidth: 80 }}>Statut</span>
                <span style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.border}`, borderRadius: 99, padding: '2px 10px', fontSize: 12, fontWeight: 700 }}>{meta.label}</span>
              </div>
              <Row icon="fa-clock"       label="Durée"      value={`${exam.duration_minutes} minutes (${fmtDuration(exam.duration_minutes)})`} />
              <Row icon="fa-calendar"    label="Début"      value={exam.start_time ? fmtFull(exam.start_time) : '—'} />
              <Row icon="fa-calendar"    label="Fin"        value={exam.end_time   ? fmtFull(exam.end_time)   : '—'} />
              <Row icon="fa-users"       label="Tentatives" value={String(exam.attempts_count ?? 0)} />
            </div>
          </div>

          {/* Instructions */}
          {exam.instructions && (
            <div style={{ background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <i className="fas fa-file-lines" style={{ color: 'var(--primary)' }} />
                <span style={{ fontWeight: 700, fontSize: 14 }}>Instructions</span>
              </div>
              <div style={{ padding: '14px 16px', fontSize: 13, color: 'var(--text)', whiteSpace: 'pre-wrap', background: '#f8fafc', lineHeight: 1.6 }}>
                {exam.instructions}
              </div>
            </div>
          )}

          {/* Paramètres de sécurité */}
          <div style={{ background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <i className="fas fa-shield-alt" style={{ color: '#d97706' }} />
              <span style={{ fontWeight: 700, fontSize: 14 }}>Paramètres de Sécurité</span>
            </div>
            <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Row icon="fa-window-restore" label="Changements de fenêtre autorisés" value={String(exam.max_tab_switches ?? 2)} />
              <BoolRow icon="fa-copy"         label="Copier/Coller"  value={!!exam.enable_copy_paste} />
              <BoolRow icon="fa-mouse-pointer" label="Clic droit"    value={!!exam.enable_right_click} />
              <BoolRow icon="fa-robot"         label="Correction IA" value={!!exam.auto_correct} />
              {exam.ban_on_devtools !== undefined && <RestrictionRow icon="fa-code" label="Blocage devtools" active={!!exam.ban_on_devtools} />}
            </div>
          </div>

          {/* Boutons d'action */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', paddingTop: 4 }}>
            {(exam.attempts_count ?? 0) > 0 && (
              <>
                <button onClick={() => { onClose(); onViewCopies(exam.id) }}
                  className="btn btn-primary" style={{ flex: 1, minWidth: 160 }}>
                  <i className="fas fa-file-alt" style={{ marginRight: 6 }} />Voir les Copies Soumises
                </button>
                <button onClick={() => setShowIncidents(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, fontWeight: 600, fontSize: 13, color: '#92400e', cursor: 'pointer' }}>
                  <i className="fas fa-triangle-exclamation" />Incidents
                </button>
              </>
            )}
            {isActive && (
              <>
                <button onClick={() => { onClose(); onClose_(exam.id) }}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontWeight: 600, fontSize: 13, color: '#dc2626', cursor: 'pointer' }}>
                  <i className="fas fa-flag-checkered" />Clôturer l'Examen
                </button>
              </>
            )}
            {(isDraft || isScheduled) && (
              <>
                <button onClick={() => { onClose(); onActivate(exam.id) }}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, fontWeight: 700, fontSize: 13, color: '#059669', cursor: 'pointer' }}>
                  <i className="fas fa-play" />Activer l'Examen
                </button>
                <button onClick={() => { onClose(); onDelete(exam.id) }}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontWeight: 600, fontSize: 13, color: '#dc2626', cursor: 'pointer' }}>
                  <i className="fas fa-trash" />Supprimer
                </button>
              </>
            )}
            <button onClick={onClose}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontWeight: 600, fontSize: 13, color: 'var(--text-muted)', cursor: 'pointer', marginLeft: 'auto' }}>
              <i className="fas fa-times" />Fermer
            </button>
          </div>
        </div>
      </div>

      {showIncidents && (
        <IncidentsModal examId={exam.id} examTitle={exam.title} onClose={() => setShowIncidents(false)} />
      )}
    </div>
  )
}

function Row({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13 }}>
      <i className={`fas ${icon}`} style={{ color: 'var(--text-muted)', width: 16, textAlign: 'center', marginTop: 2 }} />
      <span style={{ color: 'var(--text-muted)', fontWeight: 600, minWidth: 80, flexShrink: 0 }}>{label}</span>
      <span style={{ color: 'var(--text)', flex: 1 }}>{value}</span>
    </div>
  )
}

function BoolRow({ icon, label, value }: { icon: string; label: string; value: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
      <i className={`fas ${icon}`} style={{ color: 'var(--text-muted)', width: 16, textAlign: 'center' }} />
      <span style={{ color: 'var(--text-muted)', fontWeight: 600, minWidth: 80, flexShrink: 0 }}>{label}</span>
      {value
        ? <span style={{ color: '#059669', fontWeight: 700 }}><i className="fas fa-check" style={{ marginRight: 4 }} />Autorisé</span>
        : <span style={{ color: '#dc2626', fontWeight: 600 }}><i className="fas fa-times" style={{ marginRight: 4 }} />Désactivé</span>}
    </div>
  )
}

/* ban_on_devtools=true → blocage actif (pas "Autorisé") */
function RestrictionRow({ icon, label, active }: { icon: string; label: string; active: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
      <i className={`fas ${icon}`} style={{ color: 'var(--text-muted)', width: 16, textAlign: 'center' }} />
      <span style={{ color: 'var(--text-muted)', fontWeight: 600, minWidth: 80, flexShrink: 0 }}>{label}</span>
      {active
        ? <span style={{ color: '#059669', fontWeight: 700 }}><i className="fas fa-shield-check" style={{ marginRight: 4 }} />Actif</span>
        : <span style={{ color: '#94a3b8', fontWeight: 600 }}><i className="fas fa-times" style={{ marginRight: 4 }} />Inactif</span>}
    </div>
  )
}
