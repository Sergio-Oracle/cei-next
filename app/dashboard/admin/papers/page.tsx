'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'

interface CorrectedPaper {
  id: number
  type?: 'online' | 'paper'
  student_name: string
  student_email: string
  subject_title: string
  professor_name?: string
  score: number | null
  corrected_at: string
  attempt_id?: number
  paper_id?: number
}

interface PapersResponse {
  papers: CorrectedPaper[]
}

export default function AdminPapersPage() {
  const router = useRouter()
  const [papers, setPapers]   = useState<CorrectedPaper[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [filterType, setFilterType] = useState<'all' | 'online' | 'paper'>('all')
  const [pdfBusy, setPdfBusy] = useState<number | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const res = await api.get<PapersResponse | CorrectedPaper[]>('/api/admin/corrected_papers')
      const list = Array.isArray(res) ? res : (res as PapersResponse).papers ?? []
      setPapers(list)
    } catch { setPapers([]) }
    finally { setLoading(false) }
  }

  async function downloadPdf(paper: CorrectedPaper) {
    setPdfBusy(paper.id)
    try {
      const endpoint = paper.type === 'online'
        ? `/api/attempts/${paper.attempt_id || paper.id}/correction-pdf`
        : `/api/papers/${paper.paper_id || paper.id}/correction-pdf`
      const blob = await api.blob(endpoint)
      const a    = document.createElement('a')
      a.href     = URL.createObjectURL(blob)
      a.download = `correction_${(paper.student_name || '').replace(/\s+/g, '_')}.pdf`
      a.click()
      URL.revokeObjectURL(a.href)
    } catch { alert('Impossible de générer le PDF') }
    finally { setPdfBusy(null) }
  }

  function openDetail(paper: CorrectedPaper) {
    const attemptId = paper.attempt_id || (paper.type === 'online' ? paper.id : null)
    if (attemptId) {
      router.push(`/dashboard/professor/attempts/${attemptId}`)
    }
  }

  const visible = papers.filter(p => {
    if (filterType !== 'all' && p.type !== filterType) return false
    if (!search) return true
    const q = search.toLowerCase()
    return (
      p.student_name.toLowerCase().includes(q) ||
      p.student_email.toLowerCase().includes(q) ||
      p.subject_title.toLowerCase().includes(q) ||
      (p.professor_name?.toLowerCase().includes(q) ?? false)
    )
  })

  const total   = papers.length
  const online  = papers.filter(p => p.type === 'online').length
  const paper   = papers.filter(p => p.type === 'paper').length
  const avgScore = papers.filter(p => p.score != null).length
    ? (papers.filter(p => p.score != null).reduce((s, p) => s + (p.score as number), 0) / papers.filter(p => p.score != null).length).toFixed(1)
    : '—'

  return (
    <div>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <i className="fas fa-check-circle" style={{ color: 'var(--primary)' }} />Copies Corrigées
          </h2>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 14 }}>Toutes les copies corrigées par les professeurs — examens en ligne et sur papier</p>
        </div>
        <button onClick={load} style={{ padding: '9px 16px', background: 'var(--surface)', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
          <i className="fas fa-rotate-right" />Actualiser
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { icon: 'fa-clipboard-check', label: 'Total copies',   value: loading ? '…' : total,    color: '#2563eb', bg: '#dbeafe' },
          { icon: 'fa-desktop',    label: 'En ligne',        value: loading ? '…' : online,   color: '#10b981', bg: '#d1fae5' },
          { icon: 'fa-file-pdf',   label: 'Sur papier',      value: loading ? '…' : paper,    color: '#0891b2', bg: '#e0f2fe' },
          { icon: 'fa-chart-line', label: 'Moy. générale',   value: loading ? '…' : avgScore, color: '#f59e0b', bg: '#fef3c7' },
        ].map(({ icon, label, value, color, bg }) => (
          <div key={label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 18, display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <i className={`fas ${icon}`} style={{ color, fontSize: 18 }} />
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>{value}</p>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filtres */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px', marginBottom: 18, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220, position: 'relative' }}>
          <i className="fas fa-search" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: 13 }} />
          <input placeholder="Rechercher étudiant, sujet, professeur…" value={search} onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', padding: '9px 12px 9px 34px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box', color: 'var(--text)', background: 'var(--background)' }} />
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['all', 'online', 'paper'] as const).map(t => (
            <button key={t} onClick={() => setFilterType(t)}
              style={{
                padding: '7px 14px', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 12,
                background: filterType === t ? (t === 'online' ? '#dbeafe' : t === 'paper' ? '#e0f2fe' : '#0f172a') : '#f1f5f9',
                color:      filterType === t ? (t === 'online' ? '#1d4ed8' : t === 'paper' ? '#0891b2' : 'white') : '#475569'
              }}>
              <i className={`fas ${t === 'all' ? 'fa-list' : t === 'online' ? 'fa-desktop' : 'fa-file-pdf'}`} style={{ marginRight: 6 }} />
              {t === 'all' ? 'Tous' : t === 'online' ? 'En ligne' : 'Sur papier'}
            </button>
          ))}
        </div>
      </div>

      {/* Tableau */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 24px', color: 'var(--text-muted)' }}>
            <i className="fas fa-spinner fa-spin" style={{ fontSize: 28, color: 'var(--primary)', display: 'block', marginBottom: 14 }} />
            Chargement des copies…
          </div>
        ) : visible.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 24px', color: 'var(--text-muted)' }}>
            <i className="fas fa-inbox" style={{ fontSize: 36, display: 'block', marginBottom: 14, opacity: .4 }} />
            <p style={{ margin: '0 0 6px', fontWeight: 600 }}>{papers.length === 0 ? 'Aucune copie corrigée pour l\'instant' : 'Aucun résultat'}</p>
            <p style={{ margin: 0, fontSize: 13 }}>
              {papers.length === 0 ? 'Les copies corrigées apparaîtront ici après les examens' : 'Modifiez vos critères de recherche'}
            </p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                {['Type','Étudiant','Email','Sujet','Professeur','Note/20','Date de correction','Actions'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: .5, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((p, i) => {
                const isOnline  = p.type === 'online'
                const scoreNum  = p.score ?? null
                const scoreGood = scoreNum != null && scoreNum >= 10
                return (
                  <tr key={p.id} style={{ background: i % 2 === 0 ? 'white' : '#fafafa', borderBottom: '1px solid #f1f5f9' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#f0f9ff' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = i % 2 === 0 ? 'white' : '#fafafa' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ padding: '4px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: isOnline ? '#dbeafe' : '#e0f2fe', color: isOnline ? '#1d4ed8' : '#0891b2', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        <i className={`fas ${isOnline ? 'fa-desktop' : 'fa-file-pdf'}`} style={{ fontSize: 10 }} />
                        {isOnline ? 'En ligne' : 'Papier'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text)', fontSize: 14 }}>
                      <i className="fas fa-user-circle" style={{ color: '#94a3b8', marginRight: 8 }} />
                      {p.student_name}
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 13 }}>{p.student_email}</td>
                    <td style={{ padding: '12px 16px', color: '#334155', fontSize: 14, maxWidth: 180 }}>
                      <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.subject_title}</span>
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 13 }}>
                      {p.professor_name || <span style={{ color: '#cbd5e1' }}>—</span>}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {scoreNum != null ? (
                        <span style={{ padding: '5px 12px', borderRadius: 8, fontWeight: 700, fontSize: 14, background: scoreGood ? '#d1fae5' : '#fee2e2', color: scoreGood ? '#059669' : '#dc2626', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                          <i className={`fas ${scoreGood ? 'fa-check-circle' : 'fa-times-circle'}`} style={{ fontSize: 11 }} />
                          {scoreNum.toFixed(1)}/20
                        </span>
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: 12 }}>
                          <i className="fas fa-clock" style={{ marginRight: 4 }} />En attente
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 13, whiteSpace: 'nowrap' }}>
                      <i className="fas fa-calendar" style={{ marginRight: 6 }} />
                      {new Date(p.corrected_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => openDetail(p)}
                          style={{ padding: '6px 11px', background: '#dbeafe', color: '#1d4ed8', border: 'none', borderRadius: 7, fontWeight: 600, cursor: 'pointer', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                          <i className="fas fa-eye" style={{ fontSize: 11 }} />Voir
                        </button>
                        <button onClick={() => downloadPdf(p)} disabled={pdfBusy === p.id}
                          style={{ padding: '6px 11px', background: pdfBusy === p.id ? '#f1f5f9' : '#fee2e2', color: pdfBusy === p.id ? '#94a3b8' : '#dc2626', border: 'none', borderRadius: 7, fontWeight: 600, cursor: pdfBusy === p.id ? 'not-allowed' : 'pointer', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                          {pdfBusy === p.id
                            ? <><i className="fas fa-spinner fa-spin" style={{ fontSize: 11 }} />…</>
                            : <><i className="fas fa-file-pdf" style={{ fontSize: 11 }} />PDF</>}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}

        {/* Footer */}
        {!loading && visible.length > 0 && (
          <div style={{ padding: '12px 18px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
            <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
              <i className="fas fa-table" style={{ marginRight: 6 }} />
              {visible.length} copie{visible.length > 1 ? 's' : ''} affichée{visible.length > 1 ? 's' : ''}
              {filterType !== 'all' || search ? ` sur ${papers.length} total` : ''}
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <span style={{ fontSize: 12, color: '#10b981', fontWeight: 600 }}>
                <i className="fas fa-thumbs-up" style={{ marginRight: 4 }} />
                {papers.filter(p => (p.score ?? 0) >= 10).length} réussites
              </span>
              <span style={{ fontSize: 12, color: '#ef4444', fontWeight: 600 }}>
                <i className="fas fa-thumbs-down" style={{ marginRight: 4 }} />
                {papers.filter(p => p.score != null && p.score < 10).length} échecs
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
