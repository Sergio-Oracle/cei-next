'use client'

import { useState, useEffect, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import api from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'

interface Subject { id: number; title: string }

export default function NewExamPage() {
  const router = useRouter()
  const { success, error } = useToast()
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [loading, setLoading] = useState(false)

  const [form, setForm] = useState({
    subject_id: '',
    title: '',
    instructions: '',
    start_time: '',
    end_time: '',
    max_tab_switches: 2,
    max_no_face_count: 10,
    enable_copy_paste: false,
    enable_right_click: false,
    randomize_questions: false,
    ban_on_devtools: true,
    auto_correct: false,
  })

  useEffect(() => {
    api.get<Subject[]>('/api/subjects').then(data => {
      setSubjects(Array.isArray(data) ? data : (data as any).subjects ?? [])
    }).catch(() => {})
  }, [])

  function set(key: string, val: any) {
    setForm(f => ({ ...f, [key]: val }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form.subject_id) { error('Sélectionnez un sujet'); return }
    if (!form.start_time || !form.end_time) { error('Renseignez les dates'); return }
    setLoading(true)
    try {
      const payload = {
        ...form,
        subject_id: Number(form.subject_id),
        start_time: new Date(form.start_time).toISOString(),
        end_time:   new Date(form.end_time).toISOString(),
      }
      const res = await api.post<{ exam: { id: number } }>('/api/online_exams', payload)
      success('Examen créé')
      router.push(`/dashboard/admin/exams/${(res as any).exam?.id ?? ''}`)
    } catch (e: any) {
      error(e.message || 'Erreur création')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2><i className="fa-solid fa-plus-circle" style={{ marginRight: 10, color: 'var(--primary)' }} />Nouvel examen</h2>
          <p>Créer et configurer un examen en ligne</p>
        </div>
        <Link href="/dashboard/admin/exams" className="btn btn-secondary">
          <i className="fa-solid fa-arrow-left" /> Retour
        </Link>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 24 }}>

          {/* Informations de base */}
          <div className="card" style={{ gridColumn: '1 / -1' }}>
            <h3 className="card-title"><i className="fa-solid fa-info-circle" /> Informations de base</h3>
            <div className="form-group">
              <label>Sujet <span style={{ color: 'var(--danger)' }}>*</span></label>
              <select value={form.subject_id} onChange={e => set('subject_id', e.target.value)} required>
                <option value="">— Sélectionner un sujet —</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Titre de l'examen <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input type="text" value={form.title} onChange={e => set('title', e.target.value)} placeholder="Ex: Examen de Mathématiques — S1 2026" required />
            </div>
            <div className="form-group">
              <label>Instructions (optionnel)</label>
              <textarea value={form.instructions} onChange={e => set('instructions', e.target.value)} rows={3} placeholder="Instructions spécifiques pour les étudiants..." style={{ width: '100%', padding: '10px 14px', border: '2px solid var(--border)', borderRadius: 'var(--radius)', fontFamily: 'inherit', fontSize: 14, resize: 'vertical' }} />
            </div>
          </div>

          {/* Horaires */}
          <div className="card">
            <h3 className="card-title"><i className="fa-solid fa-clock" /> Horaires</h3>
            <div className="form-group">
              <label>Date et heure de début <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input type="datetime-local" value={form.start_time} onChange={e => set('start_time', e.target.value)} required />
            </div>
            <div className="form-group">
              <label>Date et heure de fin <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input type="datetime-local" value={form.end_time} onChange={e => set('end_time', e.target.value)} required />
            </div>
            {form.start_time && form.end_time && new Date(form.end_time) > new Date(form.start_time) && (
              <div className="alert alert-info" style={{ fontSize: 13 }}>
                <i className="fa-solid fa-stopwatch" /> Durée calculée : {Math.round((new Date(form.end_time).getTime() - new Date(form.start_time).getTime()) / 60000)} minutes
              </div>
            )}
          </div>

          {/* Sécurité */}
          <div className="card">
            <h3 className="card-title"><i className="fa-solid fa-shield-alt" /> Sécurité anti-triche</h3>
            <div className="form-group">
              <label>Changements d'onglet max</label>
              <input type="number" min={0} max={20} value={form.max_tab_switches} onChange={e => set('max_tab_switches', Number(e.target.value))} />
            </div>
            <div className="form-group">
              <label>Alertes caméra max (absence visage)</label>
              <input type="number" min={0} max={50} value={form.max_no_face_count} onChange={e => set('max_no_face_count', Number(e.target.value))} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { key: 'ban_on_devtools', label: 'Bannir sur ouverture DevTools' },
                { key: 'enable_copy_paste', label: 'Autoriser copier/coller' },
                { key: 'enable_right_click', label: 'Autoriser clic droit' },
                { key: 'randomize_questions', label: 'Mélanger les questions' },
                { key: 'auto_correct', label: 'Correction IA automatique' },
              ].map(({ key, label }) => (
                <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14 }}>
                  <input type="checkbox" checked={(form as any)[key]} onChange={e => set(key, e.target.checked)} style={{ width: 16, height: 16 }} />
                  {label}
                </label>
              ))}
            </div>
          </div>

        </div>

        <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? <><i className="fa-solid fa-spinner spin" /> Création...</> : <><i className="fa-solid fa-check" /> Créer l'examen</>}
          </button>
          <Link href="/dashboard/admin/exams" className="btn btn-secondary">Annuler</Link>
        </div>
      </form>
    </div>
  )
}
