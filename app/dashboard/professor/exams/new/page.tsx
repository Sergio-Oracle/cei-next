'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'
import type { Subject, User } from '@/types'

export default function NewExamPage() {
  const router = useRouter()
  const { success, error } = useToast()
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [proctors, setProctors] = useState<User[]>([])
  const [selectedProctors, setSelectedProctors] = useState<number[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [form, setForm] = useState({
    title: '',
    subject_id: '',
    instructions: '',
    duration_minutes: '60',
    start_time: '',
    end_time: '',
    max_tab_switches: '3',
    enable_copy_paste: false,
    enable_right_click: false,
    camera_required: false,
    proctoring_enabled: true,
    auto_correct: false,
  })

  useEffect(() => {
    Promise.all([
      api.get<Subject[]>('/api/subjects').then(r => setSubjects(Array.isArray(r) ? r : (r as any).subjects ?? [])),
      api.get<User[]>('/api/users/proctors').then(r => setProctors(Array.isArray(r) ? r : (r as any).users ?? [])).catch(() => {}),
    ]).finally(() => setLoading(false))
  }, [])

  function toggleProctor(id: number) {
    setSelectedProctors(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id])
  }

  async function handleSubmit() {
    if (!form.title.trim()) { error('Le titre est requis'); return }
    if (!form.start_time) { error('La date de début est requise'); return }
    if (!form.end_time) { error('La date de fin est requise'); return }
    setSubmitting(true)
    try {
      const body: any = {
        title: form.title,
        instructions: form.instructions,
        duration_minutes: Number(form.duration_minutes),
        start_time: form.start_time,
        end_time: form.end_time,
        max_tab_switches: Number(form.max_tab_switches),
        enable_copy_paste: form.enable_copy_paste,
        enable_right_click: form.enable_right_click,
        camera_required: form.camera_required,
        proctoring_enabled: form.proctoring_enabled,
        auto_correct: form.auto_correct,
      }
      if (form.subject_id) body.subject_id = Number(form.subject_id)

      const res = await api.post<{ id: number; exam?: any }>('/api/online_exams', body)
      const examId = res.id ?? (res as any).exam?.id

      // Assign proctors
      if (examId && selectedProctors.length > 0) {
        try {
          await api.post(`/api/online_exams/${examId}/proctors`, { proctor_ids: selectedProctors })
        } catch {
          // Non-blocking
        }
      }

      success('Examen créé avec succès')
      router.push('/dashboard/professor/exams')
    } catch (e: any) {
      error(e.message || 'Erreur création')
    } finally {
      setSubmitting(false)
    }
  }

  function set(key: string, value: any) {
    setForm(p => ({ ...p, [key]: value }))
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2><i className="fa-solid fa-plus-circle" style={{ marginRight: 10, color: 'var(--primary)' }} />Nouvel examen</h2>
          <p>Créer et configurer un examen en ligne</p>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: '2fr 1fr', alignItems: 'start' }}>
        <div>
          {/* Informations générales */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header"><h3><i className="fa-solid fa-circle-info" /> Informations générales</h3></div>
            <div style={{ padding: '0 24px 24px' }}>
              <div className="form-group">
                <label>Titre *</label>
                <input className="form-control" value={form.title} onChange={e => set('title', e.target.value)} placeholder="Titre de l'examen" />
              </div>
              <div className="form-group">
                <label>Sujet associé</label>
                <select className="form-control" value={form.subject_id} onChange={e => set('subject_id', e.target.value)}>
                  <option value="">-- Aucun sujet --</option>
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Instructions</label>
                <textarea className="form-control" rows={4} value={form.instructions} onChange={e => set('instructions', e.target.value)} placeholder="Instructions pour les étudiants..." />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Durée (minutes)</label>
                  <input type="number" className="form-control" value={form.duration_minutes} onChange={e => set('duration_minutes', e.target.value)} min="10" max="480" />
                </div>
                <div className="form-group">
                  <label>Changements d'onglet max</label>
                  <input type="number" className="form-control" value={form.max_tab_switches} onChange={e => set('max_tab_switches', e.target.value)} min="0" max="10" />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Date de début *</label>
                  <input type="datetime-local" className="form-control" value={form.start_time} onChange={e => set('start_time', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Date de fin *</label>
                  <input type="datetime-local" className="form-control" value={form.end_time} onChange={e => set('end_time', e.target.value)} />
                </div>
              </div>
            </div>
          </div>

          {/* Options */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header"><h3><i className="fa-solid fa-gear" /> Options de sécurité</h3></div>
            <div style={{ padding: '0 24px 24px' }}>
              {[
                { key: 'proctoring_enabled', label: 'Surveillance activée', icon: 'fa-eye' },
                { key: 'camera_required', label: 'Caméra obligatoire', icon: 'fa-video' },
                { key: 'auto_correct', label: 'Correction automatique', icon: 'fa-robot' },
                { key: 'enable_copy_paste', label: 'Autoriser copier/coller', icon: 'fa-clipboard' },
                { key: 'enable_right_click', label: 'Autoriser clic droit', icon: 'fa-computer-mouse' },
              ].map(opt => (
                <div key={opt.key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                  <i className={`fa-solid ${opt.icon}`} style={{ color: 'var(--text-muted)', width: 16 }} />
                  <span style={{ flex: 1 }}>{opt.label}</span>
                  <label style={{ position: 'relative', display: 'inline-block', width: 44, height: 24 }}>
                    <input type="checkbox" style={{ opacity: 0, width: 0, height: 0 }} checked={form[opt.key as keyof typeof form] as boolean} onChange={e => set(opt.key, e.target.checked)} />
                    <span style={{
                      position: 'absolute', cursor: 'pointer', inset: 0, borderRadius: 24,
                      background: form[opt.key as keyof typeof form] ? 'var(--primary)' : '#cbd5e1',
                      transition: '0.3s'
                    }}>
                      <span style={{ position: 'absolute', content: '', height: 16, width: 16, left: form[opt.key as keyof typeof form] ? 24 : 4, bottom: 4, background: 'white', borderRadius: '50%', transition: '0.3s' }} />
                    </span>
                  </label>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Surveillants */}
        <div className="card" style={{ position: 'sticky', top: 16 }}>
          <div className="card-header"><h3><i className="fa-solid fa-shield-halved" /> Surveillants</h3></div>
          <div style={{ padding: '0 16px 16px', maxHeight: 300, overflowY: 'auto' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: 20 }}><i className="fa-solid fa-spinner spin" /></div>
            ) : proctors.length === 0 ? (
              <p className="empty-message">Aucun surveillant disponible</p>
            ) : proctors.map(p => (
              <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}>
                <input type="checkbox" checked={selectedProctors.includes(p.id)} onChange={() => toggleProctor(p.id)} />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{p.full_name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.email}</div>
                </div>
              </label>
            ))}
          </div>

          <div style={{ padding: 16, borderTop: '1px solid var(--border)' }}>
            <button className="btn btn-primary btn-block" onClick={handleSubmit} disabled={submitting}>
              {submitting
                ? <><i className="fa-solid fa-spinner spin" /> Création...</>
                : <><i className="fa-solid fa-check" /> Créer l'examen</>
              }
            </button>
            <button className="btn btn-secondary btn-block" style={{ marginTop: 8 }} onClick={() => router.back()} disabled={submitting}>
              Annuler
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
