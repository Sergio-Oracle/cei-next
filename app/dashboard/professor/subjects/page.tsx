'use client'

import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'
import Modal from '@/components/ui/Modal'
import type { Subject, EC } from '@/types'

export default function ProfessorSubjectsPage() {
  const { success, error } = useToast()
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [ecs, setEcs] = useState<EC[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [showAIModal, setShowAIModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [form, setForm] = useState({ title: '', content: '', rubric: '', ec_id: '' })
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadEcId, setUploadEcId] = useState('')
  const [uploadTitle, setUploadTitle] = useState('')
  const [aiForm, setAiForm] = useState({ level: '', duration: '120', domain: '', instructions: '' })

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const [s, e] = await Promise.all([
        api.get<Subject[]>('/api/subjects'),
        api.get<EC[]>('/api/ecs'),
      ])
      setSubjects(Array.isArray(s) ? s : (s as any).subjects ?? [])
      setEcs(Array.isArray(e) ? e : (e as any).ecs ?? [])
    } catch { error('Erreur de chargement') }
    finally { setLoading(false) }
  }

  async function handleCreate() {
    if (!form.title.trim()) { error('Le titre est requis'); return }
    setSubmitting(true)
    try {
      await api.post('/api/subjects', { title: form.title, content: form.content, rubric: form.rubric, ec_id: form.ec_id ? Number(form.ec_id) : undefined })
      success('Sujet créé')
      setShowCreateModal(false)
      setForm({ title: '', content: '', rubric: '', ec_id: '' })
      load()
    } catch (e: any) { error(e.message || 'Erreur') }
    finally { setSubmitting(false) }
  }

  async function handleUpload() {
    if (!uploadFile) { error('Sélectionnez un fichier'); return }
    setSubmitting(true)
    try {
      const fd = new FormData()
      fd.append('file', uploadFile)
      if (uploadTitle) fd.append('title', uploadTitle)
      if (uploadEcId) fd.append('ec_id', uploadEcId)
      await api.upload('/api/subjects/upload', fd)
      success('Sujet uploadé')
      setShowUploadModal(false)
      setUploadFile(null)
      load()
    } catch (e: any) { error(e.message || 'Erreur') }
    finally { setSubmitting(false) }
  }

  async function handleGenerateAI() {
    if (!aiForm.level || !aiForm.domain) { error('Niveau et domaine requis'); return }
    setSubmitting(true)
    try {
      await api.post('/api/subjects/generate-full-exam', { level: aiForm.level, duration: Number(aiForm.duration), domain: aiForm.domain, instructions: aiForm.instructions })
      success('Sujet généré avec succès')
      setShowAIModal(false)
      setAiForm({ level: '', duration: '120', domain: '', instructions: '' })
      load()
    } catch (e: any) { error(e.message || 'Erreur génération IA') }
    finally { setSubmitting(false) }
  }

  async function handleDelete(id: number) {
    if (!confirm('Supprimer ce sujet ?')) return
    try {
      await api.delete(`/api/subjects/${id}`)
      success('Sujet supprimé')
      setSubjects(prev => prev.filter(s => s.id !== id))
    } catch (e: any) { error(e.message || 'Erreur') }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2><i className="fa-solid fa-file-lines" style={{ marginRight: 10, color: 'var(--primary)' }} />Mes sujets</h2>
          <p>Gérez vos sujets d'examen</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => setShowAIModal(true)}>
            <i className="fa-solid fa-wand-magic-sparkles" /> IA
          </button>
          <button className="btn btn-secondary" onClick={() => setShowUploadModal(true)}>
            <i className="fa-solid fa-upload" /> Upload
          </button>
          <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
            <i className="fa-solid fa-plus" /> Nouveau
          </button>
        </div>
      </div>

      <div className="card">
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Titre</th><th>EC</th><th>Copies</th><th>Examens</th><th>Date</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40 }}><i className="fa-solid fa-spinner spin" /> Chargement...</td></tr>
              ) : subjects.length === 0 ? (
                <tr><td colSpan={6} className="empty-message">Aucun sujet</td></tr>
              ) : subjects.map(s => (
                <tr key={s.id}>
                  <td><div style={{ fontWeight: 600 }}>{s.title}</div>{s.filename && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}><i className="fa-solid fa-paperclip" /> {s.filename}</div>}</td>
                  <td>{s.ec_name ?? '—'}</td>
                  <td><span className="status-badge info">{s.papers_count ?? 0}</span></td>
                  <td><span className="status-badge secondary">{s.exam_count ?? 0}</span></td>
                  <td>{s.created_at ? new Date(s.created_at).toLocaleDateString('fr-FR') : '—'}</td>
                  <td>
                    <button className="btn btn-sm btn-danger" onClick={() => handleDelete(s.id)}>
                      <i className="fa-solid fa-trash" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showCreateModal && (
        <Modal title="Nouveau sujet" onClose={() => setShowCreateModal(false)}>
          <div className="form-group"><label>Titre *</label><input className="form-control" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} /></div>
          <div className="form-group"><label>EC</label>
            <select className="form-control" value={form.ec_id} onChange={e => setForm(p => ({ ...p, ec_id: e.target.value }))}>
              <option value="">-- Choisir un EC --</option>
              {ecs.map(ec => <option key={ec.id} value={ec.id}>{ec.code} – {ec.name}</option>)}
            </select>
          </div>
          <div className="form-group"><label>Contenu</label><textarea className="form-control" rows={5} value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))} /></div>
          <div className="form-group"><label>Barème</label><textarea className="form-control" rows={3} value={form.rubric} onChange={e => setForm(p => ({ ...p, rubric: e.target.value }))} /></div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>Annuler</button>
            <button className="btn btn-primary" onClick={handleCreate} disabled={submitting}>{submitting ? <><i className="fa-solid fa-spinner spin" /> Création...</> : 'Créer'}</button>
          </div>
        </Modal>
      )}

      {showUploadModal && (
        <Modal title="Uploader un sujet" onClose={() => setShowUploadModal(false)}>
          <div className="form-group"><label>Titre</label><input className="form-control" value={uploadTitle} onChange={e => setUploadTitle(e.target.value)} /></div>
          <div className="form-group"><label>EC</label>
            <select className="form-control" value={uploadEcId} onChange={e => setUploadEcId(e.target.value)}>
              <option value="">-- Choisir un EC --</option>
              {ecs.map(ec => <option key={ec.id} value={ec.id}>{ec.code} – {ec.name}</option>)}
            </select>
          </div>
          <div className="form-group"><label>Fichier *</label><input type="file" className="form-control" accept=".pdf,.docx,.txt" onChange={e => setUploadFile(e.target.files?.[0] ?? null)} /></div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={() => setShowUploadModal(false)}>Annuler</button>
            <button className="btn btn-primary" onClick={handleUpload} disabled={submitting || !uploadFile}>{submitting ? <><i className="fa-solid fa-spinner spin" /> Upload...</> : 'Uploader'}</button>
          </div>
        </Modal>
      )}

      {showAIModal && (
        <Modal title="Générer avec l'IA" onClose={() => setShowAIModal(false)}>
          <div className="form-row">
            <div className="form-group"><label>Niveau *</label>
              <select className="form-control" value={aiForm.level} onChange={e => setAiForm(p => ({ ...p, level: e.target.value }))}>
                <option value="">-- Niveau --</option>
                {['L1','L2','L3','M1','M2'].map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div className="form-group"><label>Durée (min)</label><input type="number" className="form-control" value={aiForm.duration} onChange={e => setAiForm(p => ({ ...p, duration: e.target.value }))} /></div>
          </div>
          <div className="form-group"><label>Domaine *</label><input className="form-control" value={aiForm.domain} onChange={e => setAiForm(p => ({ ...p, domain: e.target.value }))} placeholder="Ex: Algorithmique..." /></div>
          <div className="form-group"><label>Instructions</label><textarea className="form-control" rows={3} value={aiForm.instructions} onChange={e => setAiForm(p => ({ ...p, instructions: e.target.value }))} /></div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={() => setShowAIModal(false)}>Annuler</button>
            <button className="btn btn-primary" onClick={handleGenerateAI} disabled={submitting}>{submitting ? <><i className="fa-solid fa-spinner spin" /> Génération...</> : <><i className="fa-solid fa-wand-magic-sparkles" /> Générer</>}</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
