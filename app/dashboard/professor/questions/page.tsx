'use client'

import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'
import Modal from '@/components/ui/Modal'
import type { QuestionBank, QuestionType, BloomLevel, EC } from '@/types'

const QUESTION_TYPES: Record<QuestionType, string> = {
  open: 'Question ouverte',
  qcm: 'QCM',
  vf: 'Vrai/Faux',
}

const BLOOM_LEVELS: BloomLevel[] = ['connaissance', 'compréhension', 'application', 'analyse', 'synthèse', 'évaluation']

export default function ProfessorQuestionsPage() {
  const { success, error } = useToast()
  const [questions, setQuestions] = useState<QuestionBank[]>([])
  const [ecs, setEcs] = useState<EC[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState<QuestionBank | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [filterType, setFilterType] = useState<QuestionType | ''>('')

  const [form, setForm] = useState({
    title: '', content: '', rubric: '', question_type: 'open' as QuestionType,
    bloom_level: '' as BloomLevel | '', ec_id: '',
  })

  useEffect(() => {
    Promise.all([
      api.get<QuestionBank[]>('/api/questions').catch(() => api.get<QuestionBank[]>('/api/question_bank')).then(r => setQuestions(Array.isArray(r) ? r : (r as any).questions ?? [])),
      api.get<EC[]>('/api/ecs').then(r => setEcs(Array.isArray(r) ? r : (r as any).ecs ?? [])).catch(() => {}),
    ]).finally(() => setLoading(false))
  }, [])

  function openCreate() {
    setEditItem(null)
    setForm({ title: '', content: '', rubric: '', question_type: 'open', bloom_level: '', ec_id: '' })
    setShowModal(true)
  }

  function openEdit(q: QuestionBank) {
    setEditItem(q)
    setForm({ title: q.title, content: q.content, rubric: q.rubric ?? '', question_type: q.question_type, bloom_level: q.bloom_level ?? '', ec_id: q.ec_id?.toString() ?? '' })
    setShowModal(true)
  }

  async function handleSubmit() {
    if (!form.title.trim() || !form.content.trim()) { error('Titre et contenu requis'); return }
    setSubmitting(true)
    try {
      const body = { ...form, ec_id: form.ec_id ? Number(form.ec_id) : undefined, bloom_level: form.bloom_level || undefined }
      if (editItem) {
        await api.put(`/api/questions/${editItem.id}`, body)
        success('Question modifiée')
      } else {
        const res = await api.post<QuestionBank>('/api/questions', body)
        setQuestions(prev => [res, ...prev])
        success('Question créée')
      }
      setShowModal(false)
      if (editItem) {
        setQuestions(prev => prev.map(q => q.id === editItem.id ? { ...q, ...body, id: editItem.id, created_by_id: q.created_by_id, created_at: q.created_at } : q))
      }
    } catch (e: any) { error(e.message || 'Erreur') }
    finally { setSubmitting(false) }
  }

  async function handleDelete(id: number) {
    if (!confirm('Supprimer cette question ?')) return
    try {
      await api.delete(`/api/questions/${id}`)
      success('Question supprimée')
      setQuestions(prev => prev.filter(q => q.id !== id))
    } catch (e: any) { error(e.message || 'Erreur') }
  }

  const filtered = filterType ? questions.filter(q => q.question_type === filterType) : questions

  return (
    <div>
      <div className="page-header">
        <div>
          <h2><i className="fa-solid fa-question-circle" style={{ marginRight: 10, color: 'var(--primary)' }} />Banque de questions</h2>
          <p>{questions.length} question(s) disponible(s)</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>
          <i className="fa-solid fa-plus" /> Nouvelle question
        </button>
      </div>

      {/* Filtres */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button className={`btn btn-sm ${!filterType ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilterType('')}>Toutes</button>
        {(Object.keys(QUESTION_TYPES) as QuestionType[]).map(t => (
          <button key={t} className={`btn btn-sm ${filterType === t ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilterType(t)}>
            {QUESTION_TYPES[t]}
          </button>
        ))}
      </div>

      <div className="card">
        <div className="table-responsive">
          <table>
            <thead>
              <tr><th>Titre</th><th>Type</th><th>Niveau Bloom</th><th>EC</th><th>Date</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40 }}><i className="fa-solid fa-spinner spin" /></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="empty-message">Aucune question</td></tr>
              ) : filtered.map(q => (
                <tr key={q.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{q.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.content}</div>
                  </td>
                  <td><span className="status-badge info">{QUESTION_TYPES[q.question_type]}</span></td>
                  <td>{q.bloom_level ? <span className="status-badge secondary">{q.bloom_level}</span> : '—'}</td>
                  <td>{q.ec_name ?? '—'}</td>
                  <td>{new Date(q.created_at).toLocaleDateString('fr-FR')}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-sm btn-secondary" onClick={() => openEdit(q)}><i className="fa-solid fa-pen" /></button>
                      <button className="btn btn-sm btn-danger" onClick={() => handleDelete(q.id)}><i className="fa-solid fa-trash" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <Modal title={editItem ? 'Modifier la question' : 'Nouvelle question'} onClose={() => setShowModal(false)} maxWidth={700}>
          <div className="form-row">
            <div className="form-group">
              <label>Type *</label>
              <select className="form-control" value={form.question_type} onChange={e => setForm(p => ({ ...p, question_type: e.target.value as QuestionType }))}>
                {(Object.entries(QUESTION_TYPES) as [QuestionType, string][]).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
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
          <div className="form-group"><label>Titre *</label><input className="form-control" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} /></div>
          <div className="form-group"><label>EC</label>
            <select className="form-control" value={form.ec_id} onChange={e => setForm(p => ({ ...p, ec_id: e.target.value }))}>
              <option value="">-- EC --</option>
              {ecs.map(ec => <option key={ec.id} value={ec.id}>{ec.code} – {ec.name}</option>)}
            </select>
          </div>
          <div className="form-group"><label>Contenu *</label><textarea className="form-control" rows={5} value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))} /></div>
          <div className="form-group"><label>Correction / Barème</label><textarea className="form-control" rows={3} value={form.rubric} onChange={e => setForm(p => ({ ...p, rubric: e.target.value }))} /></div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Annuler</button>
            <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
              {submitting ? <><i className="fa-solid fa-spinner spin" /> Enregistrement...</> : 'Enregistrer'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
