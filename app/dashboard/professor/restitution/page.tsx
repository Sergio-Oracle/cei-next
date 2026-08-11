'use client'

import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { fmtScore } from '@/lib/format'
import { useToast } from '@/contexts/ToastContext'
import type { RestitutionExample } from '@/types'

const LABEL_META: Record<string, { text: string; icon: string; bg: string; color: string }> = {
  best:    { text: 'Meilleure copie',    icon: 'fa-star',            bg: '#d1fae5', color: '#059669' },
  improve: { text: 'Copie à améliorer',  icon: 'fa-arrow-trend-up',  bg: '#fef3c7', color: '#b45309' },
}

export default function RestitutionPage() {
  const { success: toastOk, error: toastErr } = useToast()
  const [examples, setExamples] = useState<RestitutionExample[]>([])
  const [loading, setLoading] = useState(true)
  const [edits, setEdits] = useState<Record<number, { content: string; feedback: string }>>({})
  const [savingId, setSavingId] = useState<number | null>(null)
  const [publishingId, setPublishingId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const res = await api.get<RestitutionExample[]>('/api/restitution_examples')
      const list = Array.isArray(res) ? res : []
      setExamples(list)
      setEdits(Object.fromEntries(list.map(e => [e.id, { content: e.anonymized_content, feedback: e.anonymized_feedback ?? '' }])))
    } catch { toastErr('Erreur de chargement') } finally { setLoading(false) }
  }

  function isDirty(e: RestitutionExample) {
    const ed = edits[e.id]
    if (!ed) return false
    return ed.content !== e.anonymized_content || ed.feedback !== (e.anonymized_feedback ?? '')
  }

  async function saveEdit(e: RestitutionExample) {
    const ed = edits[e.id]
    if (!ed || !ed.content.trim()) { toastErr('Le contenu ne peut pas être vide'); return }
    setSavingId(e.id)
    try {
      await api.put(`/api/restitution_examples/${e.id}`, { anonymized_content: ed.content, anonymized_feedback: ed.feedback })
      toastOk('Modifications enregistrées')
      load()
    } catch (err: any) { toastErr(err.message || 'Erreur') } finally { setSavingId(null) }
  }

  async function togglePublish(e: RestitutionExample) {
    setPublishingId(e.id)
    try {
      await api.put(`/api/restitution_examples/${e.id}/publish`, { published: !e.is_published })
      toastOk(e.is_published ? 'Exemple dépublié' : 'Exemple publié — visible par les étudiants du sujet')
      load()
    } catch (err: any) { toastErr(err.message || 'Erreur') } finally { setPublishingId(null) }
  }

  async function deleteExample(e: RestitutionExample) {
    if (!confirm('Supprimer définitivement cette copie-exemple ?')) return
    setDeletingId(e.id)
    try {
      await api.delete(`/api/restitution_examples/${e.id}`)
      toastOk('Exemple supprimé')
      load()
    } catch (err: any) { toastErr(err.message || 'Erreur') } finally { setDeletingId(null) }
  }

  const groups = examples.reduce<Record<string, RestitutionExample[]>>((acc, e) => {
    const key = e.subject_title || 'Sans sujet'
    ;(acc[key] ??= []).push(e)
    return acc
  }, {})

  return (
    <div style={{ padding: '28px 32px' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <i className="fas fa-people-group" style={{ color: '#0f766e' }} />Restitution — copies-exemples
        </h1>
        <p style={{ color: '#64748b', margin: 0, fontSize: 14 }}>
          Sélectionnez des copies corrigées comme exemples anonymisés pour une séance de restitution collective. Rien n'est visible aux étudiants tant que vous n'avez pas publié.
        </p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 24px', color: '#64748b' }}>
          <i className="fas fa-spinner fa-spin" style={{ fontSize: 31, color: '#0f766e', display: 'block', marginBottom: 14 }} />
          Chargement…
        </div>
      ) : examples.length === 0 ? (
        <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, padding: '60px 24px', textAlign: 'center', color: '#64748b' }}>
          <i className="fas fa-inbox" style={{ fontSize: 40, display: 'block', marginBottom: 14, opacity: .4 }} />
          <p style={{ margin: '0 0 6px', fontWeight: 600 }}>Aucune copie-exemple pour l'instant</p>
          <p style={{ margin: 0, fontSize: 13 }}>Créez-en une depuis <b>Copies Corrigées</b>, avec le bouton « Exemple » sur une copie notée.</p>
        </div>
      ) : (
        Object.entries(groups).map(([subjectTitle, list]) => (
          <div key={subjectTitle} style={{ marginBottom: 32 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 14, paddingBottom: 8, borderBottom: '2px solid #e2e8f0' }}>
              {subjectTitle}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {list.map(e => {
                const meta = LABEL_META[e.label]
                const ed = edits[e.id] ?? { content: e.anonymized_content, feedback: e.anonymized_feedback ?? '' }
                return (
                  <div key={e.id} style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, padding: 18 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ padding: '5px 12px', borderRadius: 99, fontSize: 12, fontWeight: 700, background: meta.bg, color: meta.color, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <i className={`fas ${meta.icon}`} />{meta.text}
                        </span>
                        {e.score != null && (
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{fmtScore(e.score)}/{e.max_score ?? 20}</span>
                        )}
                        <span style={{ padding: '4px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: e.is_published ? '#d1fae5' : '#f1f5f9', color: e.is_published ? '#059669' : '#64748b' }}>
                          <i className={`fas ${e.is_published ? 'fa-eye' : 'fa-eye-slash'}`} style={{ marginRight: 4 }} />
                          {e.is_published ? 'Publié' : 'Brouillon'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {isDirty(e) && (
                          <button onClick={() => saveEdit(e)} disabled={savingId === e.id}
                            style={{ padding: '7px 14px', background: '#2563eb', color: 'white', border: 'none', borderRadius: 7, fontWeight: 600, cursor: 'pointer', fontSize: 12.5 }}>
                            {savingId === e.id ? <><i className="fas fa-spinner fa-spin" /> Enregistrement…</> : <><i className="fas fa-save" /> Enregistrer</>}
                          </button>
                        )}
                        <button onClick={() => togglePublish(e)} disabled={publishingId === e.id}
                          style={{ padding: '7px 14px', background: e.is_published ? '#f1f5f9' : '#0f766e', color: e.is_published ? '#475569' : 'white', border: 'none', borderRadius: 7, fontWeight: 700, cursor: 'pointer', fontSize: 12.5 }}>
                          {publishingId === e.id ? <i className="fas fa-spinner fa-spin" /> : e.is_published ? <><i className="fas fa-eye-slash" /> Dépublier</> : <><i className="fas fa-bullhorn" /> Publier</>}
                        </button>
                        <button onClick={() => deleteExample(e)} disabled={deletingId === e.id}
                          style={{ padding: '7px 11px', background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 7, fontWeight: 600, cursor: 'pointer', fontSize: 12.5 }}>
                          {deletingId === e.id ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-trash" />}
                        </button>
                      </div>
                    </div>

                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 5 }}>Copie anonymisée</label>
                    <textarea value={ed.content} onChange={ev => setEdits(p => ({ ...p, [e.id]: { ...ed, content: ev.target.value } }))}
                      rows={5} style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontFamily: 'inherit', fontSize: 13, resize: 'vertical', marginBottom: 12, boxSizing: 'border-box' }} />

                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 5 }}>Feedback anonymisé (optionnel)</label>
                    <textarea value={ed.feedback} onChange={ev => setEdits(p => ({ ...p, [e.id]: { ...ed, feedback: ev.target.value } }))}
                      rows={3} placeholder="Aucun feedback" style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontFamily: 'inherit', fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }} />
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
