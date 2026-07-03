'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'
import type { Subject } from '@/types'

export default function ProfessorSubjectsPage() {
  const { success, error } = useToast()
  const router = useRouter()
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [loading, setLoading] = useState(true)

  const [previewSubject, setPreviewSubject] = useState<Subject | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  useEffect(() => { reload() }, [])

  async function reload() {
    setLoading(true)
    try {
      const s = await api.get<Subject[] | { subjects: Subject[] }>('/api/subjects')
      setSubjects(Array.isArray(s) ? s : (s as any).subjects ?? [])
    } catch { error('Erreur de chargement') }
    finally { setLoading(false) }
  }

  async function openPreview(s: Subject) {
    if (s.content) { setPreviewSubject(s); return }
    setPreviewLoading(true)
    try {
      const full = await api.get<Subject>(`/api/subjects/${s.id}`)
      setPreviewSubject(full)
    } catch { error('Impossible de charger le sujet') }
    finally { setPreviewLoading(false) }
  }

  async function handleDelete(id: number) {
    if (!confirm('Supprimer ce sujet ?')) return
    try {
      await api.delete(`/api/subjects/${id}`)
      success('Sujet supprimé')
      setSubjects(prev => prev.filter(s => s.id !== id))
    } catch (e: any) { error(e.message || 'Erreur suppression') }
  }

  return (
    <div>
      {/* En-tête */}
      <div className="page-header">
        <div>
          <h2>
            <i className="fa-solid fa-file-lines" style={{ marginRight: 10, color: 'var(--primary)' }} />
            Mes Sujets
          </h2>
          <p>Consultez, prévisualisez et gérez vos sujets d'examen</p>
        </div>
      </div>

      {/* Raccourcis vers les pages de création */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 24 }}>
        <button
          onClick={() => router.push('/dashboard/professor/create-subject')}
          style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '18px 22px', background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 14, cursor: 'pointer', textAlign: 'left', transition: 'border-color .15s, box-shadow .15s' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--primary)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(59,130,246,.1)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.boxShadow = 'none' }}
        >
          <div style={{ width: 48, height: 48, background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <i className="fas fa-upload" style={{ color: 'var(--primary)', fontSize: 20 }} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', marginBottom: 4 }}>Créer un Sujet</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Uploadez un fichier PDF/DOCX — extraction texte + annotation + barème IA
            </div>
          </div>
          <i className="fas fa-arrow-right" style={{ color: 'var(--primary)', marginLeft: 'auto', fontSize: 14 }} />
        </button>

        <button
          onClick={() => router.push('/dashboard/professor/suggestions')}
          style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '18px 22px', background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 14, cursor: 'pointer', textAlign: 'left', transition: 'border-color .15s, box-shadow .15s' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#f59e0b'; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(245,158,11,.1)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.boxShadow = 'none' }}
        >
          <div style={{ width: 48, height: 48, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <i className="fas fa-wand-magic-sparkles" style={{ color: '#d97706', fontSize: 20 }} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', marginBottom: 4 }}>Générer avec l'IA</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Uploadez un cours — l'IA propose 3 sujets complets avec questions et barème
            </div>
          </div>
          <i className="fas fa-arrow-right" style={{ color: '#d97706', marginLeft: 'auto', fontSize: 14 }} />
        </button>
      </div>

      {/* Tableau */}
      <div className="card">
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <i className="fas fa-list" style={{ color: 'var(--text-muted)', fontSize: 14 }} />
            <span style={{ fontWeight: 600, fontSize: 14 }}>
              {loading ? '…' : `${subjects.length} sujet${subjects.length !== 1 ? 's' : ''} au total`}
            </span>
          </div>
          <button onClick={reload} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
            <i className="fas fa-rotate-right" style={{ fontSize: 12 }} />Actualiser
          </button>
        </div>

        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Titre</th>
                <th>EC</th>
                <th>Copies</th>
                <th>Examens</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: 40 }}>
                    <i className="fas fa-spinner fa-spin" style={{ fontSize: 22, color: 'var(--primary)' }} />
                  </td>
                </tr>
              ) : subjects.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <div style={{ textAlign: 'center', padding: '48px 24px' }}>
                      <div style={{ width: 56, height: 56, background: '#eff6ff', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                        <i className="fas fa-file-lines" style={{ fontSize: 24, color: 'var(--primary)' }} />
                      </div>
                      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>Aucun sujet pour le moment</div>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 18 }}>
                        Créez votre premier sujet en uploadant un fichier ou en laissant l'IA vous aider.
                      </div>
                      <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                        <button className="btn btn-secondary" onClick={() => router.push('/dashboard/professor/create-subject')}>
                          <i className="fas fa-upload" /> Créer un sujet
                        </button>
                        <button className="btn btn-primary" onClick={() => router.push('/dashboard/professor/suggestions')}>
                          <i className="fas fa-wand-magic-sparkles" /> Générer avec l'IA
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : subjects.map(s => {
                const dateStr  = s.created_at
                  ? new Date(s.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
                  : '—'
                const hasRubric = !!s.rubric
                return (
                  <tr key={s.id}>
                    <td style={{ maxWidth: 320 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, lineHeight: 1.4 }}>{s.title}</div>
                      {hasRubric && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', padding: '1px 7px', borderRadius: 99, fontSize: 10, fontWeight: 600, marginTop: 4 }}>
                          <i className="fas fa-scale-balanced" style={{ fontSize: 8 }} /> Barème
                        </span>
                      )}
                    </td>
                    <td>
                      {s.ec_code
                        ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#dbeafe', color: '#1d4ed8', padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 600 }}>
                            <i className="fas fa-book" style={{ fontSize: 9 }} /> {s.ec_code}
                          </span>
                        : <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>—</span>}
                    </td>
                    <td><span className="status-badge secondary">{s.papers_count ?? 0}</span></td>
                    <td><span className="status-badge secondary">{s.exam_count ?? 0}</span></td>
                    <td style={{ fontSize: 13, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      <i className="fas fa-calendar-day" style={{ marginRight: 5, fontSize: 11 }} />{dateStr}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-sm btn-secondary" onClick={() => openPreview(s)} title="Aperçu du contenu">
                          <i className="fa-solid fa-eye" />
                        </button>
                        <button className="btn btn-sm btn-danger" onClick={() => handleDelete(s.id)} title="Supprimer">
                          <i className="fa-solid fa-trash" />
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

      {/* Modal aperçu */}
      {(previewSubject || previewLoading) && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setPreviewSubject(null) }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'var(--surface)', borderRadius: 16, width: '100%', maxWidth: 820, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,.2)', overflow: 'hidden' }}>
            {previewLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60 }}>
                <i className="fas fa-spinner fa-spin" style={{ fontSize: 28, color: 'var(--primary)' }} />
              </div>
            ) : previewSubject && (
              <>
                <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700, lineHeight: 1.3 }}>{previewSubject.title}</h3>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      {previewSubject.ec_code && (
                        <span style={{ background: '#dbeafe', color: '#1d4ed8', padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 600 }}>
                          <i className="fas fa-book" style={{ marginRight: 4, fontSize: 9 }} />{previewSubject.ec_code}
                        </span>
                      )}
                      {previewSubject.created_at && (
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          <i className="fas fa-calendar-day" style={{ marginRight: 4 }} />
                          {new Date(previewSubject.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                      )}
                    </div>
                  </div>
                  <button onClick={() => setPreviewSubject(null)}
                    style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--text-muted)', lineHeight: 1, padding: 4 }}>
                    <i className="fas fa-times" />
                  </button>
                </div>

                <div style={{ flex: 1, overflow: 'auto', padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {previewSubject.content ? (
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 6 }}>
                        <i className="fas fa-file-lines" style={{ marginRight: 6 }} />Contenu du sujet
                      </div>
                      <textarea readOnly value={previewSubject.content}
                        style={{ width: '100%', minHeight: 260, padding: '12px 14px', border: '1.5px solid var(--border)', borderRadius: 10, fontSize: 13, lineHeight: 1.7, fontFamily: 'monospace', background: 'var(--background)', color: 'var(--text)', resize: 'vertical', boxSizing: 'border-box', outline: 'none' }} />
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                      <i className="fas fa-file-slash" style={{ fontSize: 32, marginBottom: 10, display: 'block' }} />
                      Aucun contenu textuel disponible pour ce sujet.
                    </div>
                  )}
                  {previewSubject.rubric && (
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#15803d', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 6 }}>
                        <i className="fas fa-scale-balanced" style={{ marginRight: 6 }} />Barème de notation
                      </div>
                      <textarea readOnly value={previewSubject.rubric}
                        style={{ width: '100%', minHeight: 200, padding: '12px 14px', border: '1.5px solid #bbf7d0', borderRadius: 10, fontSize: 13, lineHeight: 1.7, fontFamily: 'monospace', background: '#f0fdf4', color: 'var(--text)', resize: 'vertical', boxSizing: 'border-box', outline: 'none' }} />
                    </div>
                  )}
                </div>

                <div style={{ padding: '12px 22px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
                  <button onClick={() => setPreviewSubject(null)} className="btn btn-secondary">
                    <i className="fas fa-times" style={{ marginRight: 6 }} />Fermer
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
