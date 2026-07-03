'use client'

import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'
import Modal from '@/components/ui/Modal'
import type { QuestionBank, QuestionType, BloomLevel, EC } from '@/types'

const TYPE_LABELS: Record<string, string> = {
  qcm: 'QCM', vf: 'Vrai/Faux', open: 'Ouvert', subopen: 'Sous-questions',
}
const TYPE_STYLES: Record<string, { bg: string; color: string }> = {
  qcm:     { bg: '#eff6ff',  color: '#3b82f6' },
  vf:      { bg: '#fff7ed',  color: '#c2410c' },
  open:    { bg: '#ecfdf5',  color: '#065f46' },
  subopen: { bg: '#fefce8',  color: '#92400e' },
}
const BLOOM_LEVELS: BloomLevel[] = ['connaissance', 'compréhension', 'application', 'analyse', 'synthèse', 'évaluation']

export default function ProfessorQuestionsPage() {
  const { success, error } = useToast()
  const [questions, setQuestions] = useState<QuestionBank[]>([])
  const [ecs, setEcs]             = useState<EC[]>([])
  const [loading, setLoading]     = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [previewQ, setPreviewQ]   = useState<QuestionBank | null>(null)
  const [editItem, setEditItem]   = useState<QuestionBank | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [selected, setSelected]   = useState<Set<number>>(new Set())

  const [form, setForm] = useState({
    title: '', content: '', rubric: '',
    question_type: 'open' as QuestionType,
    bloom_level: '' as BloomLevel | '',
    ec_id: '',
  })

  useEffect(() => {
    Promise.all([
      api.get<QuestionBank[]>('/api/questions')
        .catch(() => api.get<QuestionBank[]>('/api/question_bank'))
        .then(r => setQuestions(Array.isArray(r) ? r : (r as any).questions ?? [])),
      api.get<EC[]>('/api/ecs')
        .then(r => setEcs(Array.isArray(r) ? r : (r as any).ecs ?? []))
        .catch(() => {}),
    ]).finally(() => setLoading(false))
  }, [])

  function openCreate() {
    setEditItem(null)
    setForm({ title: '', content: '', rubric: '', question_type: 'open', bloom_level: '', ec_id: '' })
    setShowModal(true)
  }

  function openEdit(q: QuestionBank) {
    setEditItem(q)
    setForm({
      title: q.title, content: q.content, rubric: q.rubric ?? '',
      question_type: q.question_type, bloom_level: q.bloom_level ?? '',
      ec_id: q.ec_id?.toString() ?? '',
    })
    setShowModal(true)
  }

  async function handleSubmit() {
    if (!form.title.trim() || !form.content.trim()) { error('Titre et contenu requis'); return }
    setSubmitting(true)
    try {
      const body = { ...form, ec_id: form.ec_id ? Number(form.ec_id) : undefined, bloom_level: form.bloom_level || undefined }
      if (editItem) {
        await api.put(`/api/questions/${editItem.id}`, body)
        setQuestions(prev => prev.map(q => q.id === editItem.id ? { ...q, ...body, id: editItem.id, created_by_id: q.created_by_id, created_at: q.created_at } : q))
        success('Question modifiée')
      } else {
        const res = await api.post<QuestionBank>('/api/questions', body)
        setQuestions(prev => [res, ...prev])
        success('Question créée')
      }
      setShowModal(false)
    } catch (e: any) { error(e.message || 'Erreur') }
    finally { setSubmitting(false) }
  }

  async function handleDelete(id: number) {
    if (!confirm('Supprimer cette question ?')) return
    try {
      await api.delete(`/api/questions/${id}`)
      success('Question supprimée')
      setQuestions(prev => prev.filter(q => q.id !== id))
      setSelected(prev => { const n = new Set(prev); n.delete(id); return n })
    } catch (e: any) { error(e.message || 'Erreur') }
  }

  function toggleSelect(id: number) {
    setSelected(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  function selectAll() {
    setSelected(new Set(questions.map(q => q.id)))
  }

  function clearAll() {
    setSelected(new Set())
  }

  const ts = (t: string) => TYPE_STYLES[t] ?? { bg: '#f1f5f9', color: '#475569' }
  const tl = (t: string) => TYPE_LABELS[t] ?? t ?? 'Ouvert'

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <i className="fas fa-database" style={{ color: '#2563eb' }} />Banque de Questions
          </h2>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
            {questions.length} question(s) sauvegardée(s) — cochez pour sélectionner
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={selectAll}
            style={{ background: '#f1f5f9', border: 'none', color: '#475569', padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <i className="fas fa-check-square" />Tout sélectionner
          </button>
          <button className="btn btn-primary" onClick={openCreate}>
            <i className="fas fa-plus" />Nouvelle question
          </button>
        </div>
      </div>

      {/* Barre de sélection */}
      {selected.size > 0 && (
        <div style={{ background: '#2563eb', borderRadius: 12, padding: '14px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ flex: 1 }}>
            <span style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>{selected.size} question{selected.size > 1 ? 's' : ''}</span>
            <span style={{ color: '#bfdbfe', fontSize: 13, marginLeft: 8 }}>sélectionnée(s)</span>
          </div>
          <button onClick={clearAll}
            style={{ background: 'rgba(255,255,255,.15)', border: 'none', color: '#fff', padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            <i className="fas fa-times" style={{ marginRight: 6 }} />Désélectionner
          </button>
        </div>
      )}

      {/* Tableau */}
      <div style={{ background: 'white', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,.07)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              <th style={{ padding: '12px 14px', width: 36 }} />
              <th style={{ padding: '12px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.05em' }}>Type</th>
              <th style={{ padding: '12px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.05em' }}>Titre / Énoncé</th>
              <th style={{ padding: '12px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.05em' }}>Bloom</th>
              <th style={{ padding: '12px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.05em' }}>EC</th>
              <th style={{ padding: '12px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.05em' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40 }}><i className="fas fa-spinner fa-spin" style={{ fontSize: 24, color: '#2563eb' }} /></td></tr>
            ) : questions.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: '#94a3b8', fontSize: 14 }}>Aucune question dans la banque</td></tr>
            ) : questions.map((q, i) => {
              const style = ts(q.question_type)
              const isSelected = selected.has(q.id)
              return (
                <tr key={q.id} id={`bank-row-${q.id}`}
                  style={{ background: isSelected ? '#eff6ff' : i % 2 === 0 ? 'white' : '#fafafa', borderBottom: '1px solid #f1f5f9', transition: 'background .15s' }}>
                  <td style={{ padding: '10px 14px', width: 36 }}>
                    <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(q.id)}
                      style={{ width: 16, height: 16, accentColor: '#2563eb', cursor: 'pointer' }} />
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: style.bg, color: style.color }}>
                      {tl(q.question_type)}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{q.title}</td>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: '#64748b' }}>
                    {q.bloom_level ? q.bloom_level.charAt(0).toUpperCase() + q.bloom_level.slice(1) : '—'}
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: '#64748b' }}>{(q as any).ec_name ?? '—'}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => setPreviewQ(q)} title="Aperçu"
                        style={{ background: '#eff6ff', border: 'none', color: '#3b82f6', padding: '5px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>
                        <i className="fas fa-eye" />
                      </button>
                      <button onClick={() => openEdit(q)} title="Modifier"
                        style={{ background: '#f1f5f9', border: 'none', color: '#475569', padding: '5px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>
                        <i className="fas fa-pen" />
                      </button>
                      <button onClick={() => handleDelete(q.id)} title="Supprimer"
                        style={{ background: '#fef2f2', border: 'none', color: '#ef4444', padding: '5px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>
                        <i className="fas fa-trash" />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Légende types */}
      <div style={{ marginTop: 12, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {Object.entries(TYPE_LABELS).map(([k, v]) => (
          <span key={k} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, background: TYPE_STYLES[k]?.bg, color: TYPE_STYLES[k]?.color, fontWeight: 600 }}>{v}</span>
        ))}
      </div>

      {/* Modal aperçu */}
      {previewQ && (
        <Modal title={previewQ.title} onClose={() => setPreviewQ(null)} maxWidth={560}>
          <pre style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, fontSize: 13, whiteSpace: 'pre-wrap', maxHeight: 320, overflowY: 'auto' }}>
            {previewQ.content}
          </pre>
          {previewQ.rubric && (
            <>
              <h4 style={{ margin: '12px 0 6px', fontSize: 14 }}>Barème</h4>
              <pre style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: 12, fontSize: 12, whiteSpace: 'pre-wrap' }}>
                {previewQ.rubric}
              </pre>
            </>
          )}
          <div style={{ textAlign: 'right', marginTop: 14, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => openEdit(previewQ)}>
              <i className="fas fa-pen" />Modifier
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => setPreviewQ(null)}>Fermer</button>
          </div>
        </Modal>
      )}

      {/* Modal créer/modifier */}
      {showModal && (
        <Modal title={editItem ? 'Modifier la question' : 'Nouvelle question'} onClose={() => setShowModal(false)} maxWidth={700}>
          <div className="form-row">
            <div className="form-group">
              <label>Type *</label>
              <select className="form-control" value={form.question_type} onChange={e => setForm(p => ({ ...p, question_type: e.target.value as QuestionType }))}>
                {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Niveau Bloom</label>
              <select className="form-control" value={form.bloom_level} onChange={e => setForm(p => ({ ...p, bloom_level: e.target.value as BloomLevel }))}>
                <option value="">-- Niveau --</option>
                {BLOOM_LEVELS.map(b => <option key={b} value={b}>{b.charAt(0).toUpperCase() + b.slice(1)}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>Titre *</label>
            <input className="form-control" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
          </div>
          <div className="form-group">
            <label>EC</label>
            <select className="form-control" value={form.ec_id} onChange={e => setForm(p => ({ ...p, ec_id: e.target.value }))}>
              <option value="">-- EC --</option>
              {ecs.map(ec => <option key={ec.id} value={ec.id}>{(ec as any).code} – {ec.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Contenu *</label>
            <textarea className="form-control" rows={5} value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))} />
          </div>
          <div className="form-group">
            <label>Correction / Barème</label>
            <textarea className="form-control" rows={3} value={form.rubric} onChange={e => setForm(p => ({ ...p, rubric: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Annuler</button>
            <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
              {submitting ? <><i className="fas fa-spinner fa-spin" /> Enregistrement…</> : 'Enregistrer'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
