'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import api from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'
import Modal from '@/components/ui/Modal'
import type { RestitutionExample, ExampleLabel } from '@/types'

interface CorrectedPaper {
  id: number
  type: 'online' | 'paper'
  student_name: string
  student_email: string
  subject_title: string
  score: number | null
  corrected_at: string
  attempt_id?: number
  paper_id?: number
  is_published: boolean
  exam_id?: number
}

interface Stats { total: number; online: number; paper: number }

export default function CorrectedPage() {
  const router = useRouter()
  const { error: toastErr, success: toastOk } = useToast()
  const [papers, setPapers]   = useState<CorrectedPaper[]>([])
  const [stats, setStats]     = useState<Stats>({ total: 0, online: 0, paper: 0 })
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [filterType, setFilterType] = useState<'all' | 'online' | 'paper'>('all')
  const [pdfBusy, setPdfBusy] = useState<number | null>(null)
  const [publishBusy, setPublishBusy] = useState<number | null>(null)
  const [bulkPublishing, setBulkPublishing] = useState(false)
  const [exampleModal, setExampleModal] = useState<CorrectedPaper | null>(null)
  const [creatingExample, setCreatingExample] = useState(false)
  const [createdExample, setCreatedExample] = useState<RestitutionExample | null>(null)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    try {
      const res = await api.get<{ papers: CorrectedPaper[] }>('/api/professor/corrected_papers')
      const list: CorrectedPaper[] = res.papers || []
      setPapers(list)
      setStats({
        total:  list.length,
        online: list.filter(p => p.type === 'online').length,
        paper:  list.filter(p => p.type === 'paper').length,
      })
    } catch { setPapers([]) } finally { setLoading(false) }
  }

  async function downloadPdf(paper: CorrectedPaper) {
    setPdfBusy(paper.id)
    try {
      const endpoint = paper.type === 'online'
        ? `/api/attempts/${paper.attempt_id || paper.id}/correction-pdf`
        : `/api/papers/${paper.paper_id || paper.id}/correction-pdf`
      const blob = await api.blob(endpoint)
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `correction_${paper.student_name.replace(/\s+/g,'_')}_${paper.subject_title.replace(/\s+/g,'_')}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch { toastErr('Impossible de générer le PDF de correction') } finally { setPdfBusy(null) }
  }

  async function publishPaper(paper: CorrectedPaper) {
    setPublishBusy(paper.id)
    try {
      await api.put(`/api/papers/${paper.id}/publish`, { published: true })
      setPapers(prev => prev.map(p => p.id === paper.id && p.type === 'paper' ? { ...p, is_published: true } : p))
      toastOk('Note publiée — l\'étudiant a été notifié par email')
    } catch { toastErr('Impossible de publier cette copie') } finally { setPublishBusy(null) }
  }

  async function publishAllVisible() {
    const ids = visible.filter(p => p.type === 'paper' && !p.is_published).map(p => p.id)
    if (ids.length === 0) return
    setBulkPublishing(true)
    try {
      const res = await api.put<{ success: boolean; published: number }>('/api/papers/publish-bulk', { paper_ids: ids })
      setPapers(prev => prev.map(p => p.type === 'paper' && ids.includes(p.id) ? { ...p, is_published: true } : p))
      toastOk(`${res.published} copie(s) publiée(s) — étudiants notifiés par email`)
    } catch { toastErr('Impossible de publier les copies sélectionnées') } finally { setBulkPublishing(false) }
  }

  async function createExample(paper: CorrectedPaper, label: ExampleLabel) {
    setCreatingExample(true)
    try {
      const body = paper.type === 'online' ? { attempt_id: paper.attempt_id || paper.id, label } : { paper_id: paper.paper_id || paper.id, label }
      const res = await api.aiPost<{ success: boolean; example: RestitutionExample }>('/api/restitution_examples', body)
      setCreatedExample(res.example)
      toastOk('Copie-exemple anonymisée — vérifiez-la avant de la publier au groupe')
    } catch (e: any) { toastErr(e.message || "Impossible de créer l'exemple") } finally { setCreatingExample(false) }
  }

  function openDetail(paper: CorrectedPaper) {
    if (paper.type === 'online') {
      router.push(`/dashboard/professor/attempts/${paper.attempt_id || paper.id}`)
    } else {
      router.push(`/dashboard/professor/attempts/${paper.attempt_id || paper.id}`)
    }
  }

  const visible = papers.filter(p => {
    if (filterType !== 'all' && p.type !== filterType) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        p.student_name.toLowerCase().includes(q) ||
        p.student_email.toLowerCase().includes(q) ||
        p.subject_title.toLowerCase().includes(q)
      )
    }
    return true
  })

  const avgScore = papers.length
    ? (papers.reduce((s, p) => s + (p.score ?? 0), 0) / papers.filter(p => p.score != null).length || 0).toFixed(1)
    : '—'

  return (
    <div style={{ padding: '28px 32px' }}>

      {/* En-tête */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize:24, fontWeight: 800, color: '#0f172a', margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <i className="fas fa-check-circle" style={{ color: '#2563eb' }} />Copies Corrigées
          </h1>
          <p style={{ color: '#64748b', margin: 0, fontSize:17 }}>Toutes les copies corrigées — examens en ligne et sur papier numérisé</p>
        </div>
        <button onClick={loadData} style={{ padding: '9px 16px', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize:15.5 }}>
          <i className="fas fa-rotate-right" style={{ marginRight: 6 }} />Actualiser
        </button>
      </div>

      {/* Statistiques */}
      <div className="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { icon: 'fa-clipboard-check', label: 'Total copies', value: stats.total, color: '#2563eb', bg: '#dbeafe' },
          { icon: 'fa-desktop',    label: 'En ligne',      value: stats.online, color: '#10b981', bg: '#d1fae5' },
          { icon: 'fa-file-pdf',   label: 'Sur papier',    value: stats.paper,  color: '#0891b2', bg: '#e0f2fe' },
          { icon: 'fa-chart-line', label: 'Moy. générale', value: avgScore,     color: '#f59e0b', bg: '#fef3c7' },
        ].map(({ icon, label, value, color, bg }) => (
          <div key={label} style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, padding: 18, display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className={`fas ${icon}`} style={{ color, fontSize: 22 }} />
            </div>
            <div>
              <p style={{ margin: 0, fontSize:24, fontWeight: 800, color: '#0f172a' }}>{value}</p>
              <p style={{ margin: 0, fontSize:14.5, color: '#64748b' }}>{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filtres */}
      <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, padding: '14px 18px', marginBottom: 18, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220, position: 'relative' }}>
          <i className="fas fa-search" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: 16 }} />
          <input placeholder="Rechercher étudiant, sujet…" value={search} onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', padding: '9px 12px 9px 34px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize:17, outline: 'none', boxSizing: 'border-box', color: '#0f172a' }} />
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['all','online','paper'] as const).map(t => (
            <button key={t} onClick={() => setFilterType(t)}
              style={{ padding: '7px 14px', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize:14.5,
                background: filterType === t ? (t === 'online' ? '#dbeafe' : t === 'paper' ? '#e0f2fe' : '#0f172a') : '#f1f5f9',
                color:      filterType === t ? (t === 'online' ? '#1d4ed8' : t === 'paper' ? '#0891b2' : 'white') : '#475569' }}>
              <i className={`fas ${t === 'all' ? 'fa-list' : t === 'online' ? 'fa-desktop' : 'fa-file-pdf'}`} style={{ marginRight: 6 }} />
              {t === 'all' ? 'Tous' : t === 'online' ? 'En ligne' : 'Sur papier'}
            </button>
          ))}
        </div>
        {papers.some(p => p.type === 'paper' && !p.is_published) && (
          <button onClick={publishAllVisible} disabled={bulkPublishing}
            style={{ padding: '9px 16px', background: bulkPublishing ? '#93c5fd' : '#10b981', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, cursor: bulkPublishing ? 'not-allowed' : 'pointer', fontSize:15.5, display: 'flex', alignItems: 'center', gap: 8 }}>
            {bulkPublishing ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-bullhorn" />}
            Publier les copies papier non publiées
          </button>
        )}
      </div>

      {/* Tableau */}
      <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 24px', color: '#64748b' }}>
            <i className="fas fa-spinner fa-spin" style={{ fontSize: 31, color: '#2563eb', display: 'block', marginBottom: 14 }} />
            Chargement des copies…
          </div>
        ) : visible.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 24px', color: '#64748b' }}>
            <i className="fas fa-inbox" style={{ fontSize: 40, display: 'block', marginBottom: 14, opacity: .4 }} />
            <p style={{ margin: '0 0 6px', fontWeight: 600 }}>{papers.length === 0 ? 'Aucune copie corrigée pour l\'instant' : 'Aucun résultat'}</p>
            <p style={{ margin: 0, fontSize:15.5 }}>{papers.length === 0 ? 'Les copies corrigées apparaîtront ici après les examens' : 'Modifiez vos critères de recherche'}</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                {['Type','Étudiant','Email','Sujet','Note/20','Publication','Date de correction','Actions'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize:14.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: .5, borderBottom: '1px solid #e2e8f0' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((paper, i) => {
                const isOnline    = paper.type === 'online'
                const scoreNum    = paper.score ?? null
                const scoreGood   = scoreNum != null && scoreNum >= 10
                const scoreBad    = scoreNum != null && scoreNum < 10
                return (
                  <tr key={paper.id} style={{ background: i % 2 === 0 ? 'white' : '#fafafa', borderBottom: '1px solid #f1f5f9' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#f0f9ff' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = i % 2 === 0 ? 'white' : '#fafafa' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ padding: '4px 10px', borderRadius: 99, fontSize:13, fontWeight: 700, background: isOnline ? '#dbeafe' : '#e0f2fe', color: isOnline ? '#1d4ed8' : '#0891b2', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        <i className={`fas ${isOnline ? 'fa-desktop' : 'fa-file-pdf'}`} style={{ fontSize: 12 }} />
                        {isOnline ? 'En ligne' : 'Papier'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: '#0f172a', fontSize:17 }}>
                      <i className="fas fa-user-circle" style={{ color: '#94a3b8', marginRight: 8 }} />
                      {paper.student_name}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#64748b', fontSize:15.5 }}>{paper.student_email}</td>
                    <td style={{ padding: '12px 16px', color: '#334155', fontSize:17, maxWidth: 200 }}>
                      <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{paper.subject_title}</span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {scoreNum != null ? (
                        <span style={{ padding: '5px 12px', borderRadius: 8, fontWeight: 700, fontSize:17, background: scoreGood ? '#d1fae5' : '#fee2e2', color: scoreGood ? '#059669' : '#dc2626', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                          <i className={`fas ${scoreGood ? 'fa-check-circle' : 'fa-times-circle'}`} style={{ fontSize: 13 }} />
                          {scoreNum.toFixed(1)}/20
                        </span>
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize:14.5 }}>
                          <i className="fas fa-clock" style={{ marginRight: 4 }} />En attente
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {isOnline ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ padding: '4px 10px', borderRadius: 99, fontSize:13, fontWeight: 700, background: paper.is_published ? '#d1fae5' : '#f1f5f9', color: paper.is_published ? '#059669' : '#64748b' }}>
                            <i className={`fas ${paper.is_published ? 'fa-eye' : 'fa-eye-slash'}`} style={{ marginRight: 4 }} />
                            {paper.is_published ? 'Publié' : 'Non publié'}
                          </span>
                          {!paper.is_published && (
                            <Link href={`/dashboard/professor/exams/${paper.exam_id}`}
                              style={{ fontSize:13, color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}>
                              Publier l'examen →
                            </Link>
                          )}
                        </span>
                      ) : paper.is_published ? (
                        <span style={{ padding: '4px 10px', borderRadius: 99, fontSize:13, fontWeight: 700, background: '#d1fae5', color: '#059669' }}>
                          <i className="fas fa-eye" style={{ marginRight: 4 }} />Publiée
                        </span>
                      ) : (
                        <button onClick={() => publishPaper(paper)} disabled={publishBusy === paper.id}
                          style={{ padding: '5px 12px', background: publishBusy === paper.id ? '#f1f5f9' : '#10b981', color: publishBusy === paper.id ? '#94a3b8' : 'white', border: 'none', borderRadius: 7, fontWeight: 700, cursor: publishBusy === paper.id ? 'not-allowed' : 'pointer', fontSize:13, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                          {publishBusy === paper.id
                            ? <><i className="fas fa-spinner fa-spin" />Publication…</>
                            : <><i className="fas fa-bullhorn" />Publier</>}
                        </button>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#64748b', fontSize:15.5, whiteSpace: 'nowrap' }}>
                      <i className="fas fa-calendar" style={{ marginRight: 6 }} />
                      {new Date(paper.corrected_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => openDetail(paper)}
                          style={{ padding: '6px 11px', background: '#dbeafe', color: '#1d4ed8', border: 'none', borderRadius: 7, fontWeight: 600, cursor: 'pointer', fontSize:14.5, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                          <i className={`fas ${isOnline ? 'fa-eye' : 'fa-info-circle'}`} style={{ fontSize: 13 }} />
                          {isOnline ? 'Réviser' : 'Détail'}
                        </button>
                        <button onClick={() => downloadPdf(paper)} disabled={pdfBusy === paper.id}
                          style={{ padding: '6px 11px', background: pdfBusy === paper.id ? '#f1f5f9' : '#fee2e2', color: pdfBusy === paper.id ? '#94a3b8' : '#dc2626', border: 'none', borderRadius: 7, fontWeight: 600, cursor: pdfBusy === paper.id ? 'not-allowed' : 'pointer', fontSize:14.5, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                          {pdfBusy === paper.id
                            ? <><i className="fas fa-spinner fa-spin" style={{ fontSize: 13 }} />PDF…</>
                            : <><i className="fas fa-file-pdf" style={{ fontSize: 13 }} />PDF</>
                          }
                        </button>
                        {scoreNum != null && (
                          <button onClick={() => setExampleModal(paper)}
                            style={{ padding: '6px 11px', background: '#ccfbf1', color: '#0f766e', border: 'none', borderRadius: 7, fontWeight: 600, cursor: 'pointer', fontSize:14.5, display: 'inline-flex', alignItems: 'center', gap: 5 }}
                            title="Créer une copie-exemple anonymisée pour une restitution collective">
                            <i className="fas fa-user-secret" style={{ fontSize: 13 }} />Exemple
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
        )}

        {/* Footer */}
        {!loading && visible.length > 0 && (
          <div style={{ padding: '12px 18px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
            <p style={{ margin: 0, fontSize:15.5, color: '#64748b' }}>
              <i className="fas fa-table" style={{ marginRight: 6 }} />
              {visible.length} copie{visible.length > 1 ? 's' : ''} affichée{visible.length > 1 ? 's' : ''}
              {filterType !== 'all' || search ? ` (filtrées sur ${papers.length} total)` : ''}
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <span style={{ fontSize:14.5, color: '#10b981', fontWeight: 600 }}>
                <i className="fas fa-thumbs-up" style={{ marginRight: 4 }} />
                {papers.filter(p => (p.score ?? 0) >= 10).length} réussites
              </span>
              <span style={{ fontSize:14.5, color: '#ef4444', fontWeight: 600 }}>
                <i className="fas fa-thumbs-down" style={{ marginRight: 4 }} />
                {papers.filter(p => p.score != null && p.score < 10).length} échecs
              </span>
            </div>
          </div>
        )}
      </div>

      {exampleModal && !createdExample && (
        <Modal title="Créer une copie-exemple" onClose={() => !creatingExample && setExampleModal(null)} maxWidth={480}>
          <p style={{ fontSize:16, color: 'var(--text-muted, #64748b)', marginBottom: 18 }}>
            L'IA va anonymiser le contenu de la copie de <b>{exampleModal.student_name}</b> (nom, prénom et toute mention identifiante retirés) pour un partage en séance de restitution. Vous pourrez relire et modifier le texte avant de le publier au groupe.
          </p>
          {creatingExample ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <i className="fas fa-spinner fa-spin" style={{ fontSize: 24, color: '#0f766e' }} />
              <p style={{ marginTop: 10, fontSize:15.5, color: '#64748b' }}>Anonymisation en cours…</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button onClick={() => createExample(exampleModal, 'best')}
                style={{ padding: '12px 16px', background: '#d1fae5', color: '#059669', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize:17, display: 'flex', alignItems: 'center', gap: 10 }}>
                <i className="fas fa-star" />Meilleure copie
              </button>
              <button onClick={() => createExample(exampleModal, 'improve')}
                style={{ padding: '12px 16px', background: '#fef3c7', color: '#b45309', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize:17, display: 'flex', alignItems: 'center', gap: 10 }}>
                <i className="fas fa-arrow-trend-up" />Copie à améliorer
              </button>
            </div>
          )}
        </Modal>
      )}

      {createdExample && (
        <Modal title="Copie-exemple anonymisée — brouillon" onClose={() => { setCreatedExample(null); setExampleModal(null) }} maxWidth={620}>
          <div style={{ padding: '10px 14px', background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 8, fontSize:15, color: '#92400e', marginBottom: 16, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <i className="fas fa-eye-slash" style={{ marginTop: 1 }} />
            <span>Encore invisible aux étudiants. Relisez le texte anonymisé ci-dessous, puis publiez-le depuis la page <b>Restitution</b>.</span>
          </div>
          <div style={{ fontSize:14.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 6 }}>Copie anonymisée</div>
          <div style={{ padding: 14, background: '#f8fafc', borderRadius: 8, fontSize:15.5, lineHeight: 1.7, whiteSpace: 'pre-wrap', maxHeight: 220, overflowY: 'auto', marginBottom: 14, border: '1px solid #e2e8f0' }}>
            {createdExample.anonymized_content}
          </div>
          {createdExample.anonymized_feedback && (
            <>
              <div style={{ fontSize:14.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 6 }}>Feedback anonymisé</div>
              <div style={{ padding: 14, background: '#f8fafc', borderRadius: 8, fontSize:15.5, lineHeight: 1.7, whiteSpace: 'pre-wrap', maxHeight: 160, overflowY: 'auto', marginBottom: 14, border: '1px solid #e2e8f0' }}>
                {createdExample.anonymized_feedback}
              </div>
            </>
          )}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => { setCreatedExample(null); setExampleModal(null) }}
              style={{ padding: '9px 16px', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize:15.5 }}>
              Fermer
            </button>
            <Link href="/dashboard/professor/restitution"
              style={{ padding: '9px 16px', background: '#0f766e', color: 'white', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize:15.5, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <i className="fas fa-people-group" />Aller relire et publier
            </Link>
          </div>
        </Modal>
      )}
    </div>
  )
}
