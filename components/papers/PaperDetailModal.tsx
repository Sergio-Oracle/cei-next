'use client'

import { useEffect, useState } from 'react'
import api from '@/lib/api'

interface PaperDetail {
  id: number
  subject_title?: string | null
  student_name?: string | null
  student_email?: string | null
  content?: string | null
  grade?: string | null
  score?: number | null
  filename?: string | null
  corrector_name?: string | null
  corrected_at?: string | null
  is_published?: boolean
}

/** Détail d'une copie papier corrigée : note, correction, texte de la copie.
 *  Les copies papier n'ont pas de page « tentative » comme les examens en ligne :
 *  le bouton « Voir » ouvre donc cette fenêtre. */
export default function PaperDetailModal({ paperId, onClose, onPdf }: {
  paperId: number
  onClose: () => void
  onPdf?: () => void
}) {
  const [paper, setPaper] = useState<PaperDetail | null>(null)
  const [error, setError] = useState('')
  const [showContent, setShowContent] = useState(false)

  useEffect(() => {
    setPaper(null); setError('')
    api.get<PaperDetail>(`/api/papers/detail/${paperId}`)
      .then(setPaper)
      .catch((e: any) => setError(e?.message || 'Impossible de charger la copie'))
  }, [paperId])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const score = paper?.score
  const passed = score != null && score >= 10

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} role="dialog" aria-modal="true"
        style={{ background: 'var(--surface)', borderRadius: 14, border: '1px solid #dbe7f7', width: '100%', maxWidth: 780, maxHeight: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '16px 22px', borderBottom: '1px solid #dbe7f7', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, background: '#eff6ff', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <i className="fas fa-file-pdf" style={{ color: '#2563eb', fontSize: 20 }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 18, color: 'var(--text)' }}>{paper?.student_name || 'Copie papier'}</div>
            <div style={{ fontSize: 14, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {paper?.subject_title || ''}{paper?.student_email ? ` · ${paper.student_email}` : ''}
            </div>
          </div>
          <button onClick={onClose} aria-label="Fermer"
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--text-muted)' }}>
            <i className="fas fa-times" />
          </button>
        </div>

        <div style={{ padding: 22, overflowY: 'auto' }}>
          {error && <div style={{ color: '#dc2626', fontSize: 15 }}>{error}</div>}
          {!paper && !error && <div style={{ color: 'var(--text-muted)' }}>Chargement…</div>}
          {paper && (
            <>
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 18 }}>
                <div style={{ border: '1px solid #dbe7f7', borderRadius: 12, padding: '12px 18px', minWidth: 150 }}>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Note</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: score == null ? 'var(--text-muted)' : passed ? '#059669' : '#dc2626' }}>
                    {score != null ? `${Number(score).toFixed(2).replace(/\.00$/, '')}/20` : '—'}
                  </div>
                </div>
                <div style={{ border: '1px solid #dbe7f7', borderRadius: 12, padding: '12px 18px', flex: 1, minWidth: 200 }}>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Correction</div>
                  <div style={{ fontSize: 15, color: 'var(--text)', marginTop: 4 }}>
                    {paper.corrected_at ? new Date(paper.corrected_at).toLocaleString('fr-FR') : 'Non corrigée'}
                    {paper.corrector_name ? ` — ${paper.corrector_name}` : ''}
                  </div>
                  <div style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 2 }}>
                    {paper.is_published ? 'Résultat publié à l’étudiant' : 'Résultat non publié'}
                  </div>
                </div>
              </div>

              <div style={{ fontWeight: 700, fontSize: 15, color: '#1e3a8a', marginBottom: 6 }}>Correction détaillée</div>
              <div style={{ whiteSpace: 'pre-wrap', fontSize: 15, lineHeight: 1.6, color: 'var(--text)', background: '#f8fafc', border: '1px solid #dbe7f7', borderRadius: 10, padding: 14, marginBottom: 16 }}>
                {paper.grade?.trim() || 'Aucune correction détaillée enregistrée.'}
              </div>

              <button onClick={() => setShowContent(v => !v)}
                style={{ background: 'transparent', border: 'none', color: '#2563eb', fontWeight: 600, cursor: 'pointer', fontSize: 15, padding: 0 }}>
                <i className={`fas ${showContent ? 'fa-chevron-up' : 'fa-chevron-down'}`} style={{ marginRight: 6 }} />
                Texte de la copie{paper.filename ? ` (${paper.filename})` : ''}
              </button>
              {showContent && (
                <div style={{ whiteSpace: 'pre-wrap', fontSize: 14.5, lineHeight: 1.6, color: 'var(--text)', background: '#f8fafc', border: '1px solid #dbe7f7', borderRadius: 10, padding: 14, marginTop: 8, maxHeight: 320, overflowY: 'auto' }}>
                  {paper.content?.trim() || 'Texte non disponible.'}
                </div>
              )}
            </>
          )}
        </div>

        <div style={{ padding: '12px 22px', borderTop: '1px solid #dbe7f7', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          {onPdf && (
            <button onClick={onPdf} style={{ padding: '8px 16px', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #dbe7f7', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>
              <i className="fas fa-file-pdf" style={{ marginRight: 6 }} />PDF
            </button>
          )}
          <button onClick={onClose} style={{ padding: '8px 16px', background: '#2563eb', color: 'white', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>
            Fermer
          </button>
        </div>
      </div>
    </div>
  )
}
