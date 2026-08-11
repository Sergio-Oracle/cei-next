'use client'

import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { fmtScore } from '@/lib/format'
import { useToast } from '@/contexts/ToastContext'
import type { RestitutionExample } from '@/types'

const LABEL_META: Record<string, { text: string; icon: string; bg: string; color: string }> = {
  best:    { text: 'Meilleure copie',   icon: 'fa-star',           bg: '#d1fae5', color: '#059669' },
  improve: { text: 'Copie à améliorer', icon: 'fa-arrow-trend-up', bg: '#fef3c7', color: '#b45309' },
}

export default function StudentExemplesPage() {
  const { error } = useToast()
  const [examples, setExamples] = useState<RestitutionExample[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<number>>(new Set())

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const res = await api.get<RestitutionExample[]>('/api/restitution_examples')
      setExamples(Array.isArray(res) ? res : [])
    } catch { error('Erreur de chargement') } finally { setLoading(false) }
  }

  function toggle(id: number) {
    setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  const groups = examples.reduce<Record<string, RestitutionExample[]>>((acc, e) => {
    const key = e.subject_title || 'Autre'
    ;(acc[key] ??= []).push(e)
    return acc
  }, {})

  return (
    <div>
      <div className="page-header">
        <div>
          <h2><i className="fa-solid fa-people-group" style={{ marginRight: 10, color: 'var(--primary)' }} />Copies-exemples</h2>
          <p>Exemples de copies anonymisées partagés par vos enseignants — un support pour comprendre ce qui distingue une bonne réponse d'une réponse à améliorer.</p>
        </div>
      </div>

      {loading ? (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}><i className="fa-solid fa-spinner spin" /></div>
      ) : examples.length === 0 ? (
        <div className="card empty-message" style={{ textAlign: 'center', padding: 40 }}>
          <i className="fa-solid fa-inbox" style={{ fontSize: 32, opacity: .4, display: 'block', marginBottom: 12 }} />
          Aucune copie-exemple partagée pour l'instant.
        </div>
      ) : (
        Object.entries(groups).map(([subjectTitle, list]) => (
          <div key={subjectTitle} style={{ marginBottom: 28 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>{subjectTitle}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {list.map(e => {
                const meta = LABEL_META[e.label]
                const isOpen = expanded.has(e.id)
                return (
                  <div key={e.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <button onClick={() => toggle(e.id)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ padding: '5px 12px', borderRadius: 99, fontSize: 12, fontWeight: 700, background: meta.bg, color: meta.color, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <i className={`fas ${meta.icon}`} />{meta.text}
                        </span>
                        {e.score != null && <span style={{ fontSize: 13, fontWeight: 700 }}>{fmtScore(e.score)}/{e.max_score ?? 20}</span>}
                      </span>
                      <i className={`fas fa-chevron-${isOpen ? 'up' : 'down'}`} style={{ color: 'var(--text-muted)', fontSize: 13 }} />
                    </button>
                    {isOpen && (
                      <div style={{ padding: '0 18px 18px' }}>
                        <div style={{ padding: 14, background: 'var(--background)', borderRadius: 8, fontSize: 13.5, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                          {e.anonymized_content}
                        </div>
                        {e.anonymized_feedback && (
                          <div style={{ marginTop: 10 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 6 }}>
                              <i className="fas fa-comment-dots" style={{ marginRight: 5 }} />Retour de l'enseignant
                            </div>
                            <div style={{ padding: 14, background: 'var(--background)', borderRadius: 8, fontSize: 13.5, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                              {e.anonymized_feedback}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
