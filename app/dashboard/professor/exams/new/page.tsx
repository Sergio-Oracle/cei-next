'use client'

import { useEffect, useState, CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'
import type { Subject, User } from '@/types'

export default function NewExamPage() {
  const router = useRouter()
  const { success, error } = useToast()
  const [subjects, setSubjects]   = useState<Subject[]>([])
  const [proctors, setProctors]   = useState<User[]>([])
  const [selectedProctors, setSelectedProctors] = useState<number[]>([])
  const [loading, setLoading]     = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [form, setForm] = useState({
    subject_id:        '',
    title:              '',
    instructions:       '',
    start_time:         '',
    end_time:           '',
    max_tab_switches:   2,
    questions_per_page: 5,
    max_no_face_count:  10,
    ban_on_devtools:    true,
    enable_copy_paste:  false,
    enable_right_click: false,
    auto_correct:       false,
  })

  useEffect(() => {
    Promise.all([
      api.get<any>('/api/subjects').then(r => setSubjects(Array.isArray(r) ? r : r.subjects ?? [])),
      api.get<any>('/api/users/proctors').then(r => setProctors(Array.isArray(r) ? r : r.users ?? [])).catch(() => {}),
    ]).finally(() => setLoading(false))
  }, [])

  function set(key: string, val: any) {
    setForm(f => ({ ...f, [key]: val }))
  }

  function toggleProctor(id: number) {
    setSelectedProctors(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id])
  }

  function calcDuration() {
    if (!form.start_time || !form.end_time) return null
    const diff = new Date(form.end_time).getTime() - new Date(form.start_time).getTime()
    return diff > 0 ? Math.round(diff / 60000) : null
  }

  async function handleSubmit() {
    if (!form.subject_id) { error('Sélectionnez un sujet'); return }
    if (!form.title.trim()) { error('Le titre est requis'); return }
    if (!form.start_time || !form.end_time) { error('Renseignez les dates de début et de fin'); return }

    // UTC en ajoutant :00Z à la valeur brute du datetime-local (identique à la plateforme originale)
    const startTime = form.start_time + ':00Z'
    const endTime   = form.end_time   + ':00Z'
    if (startTime >= endTime) { error('La date de fin doit être après la date de début'); return }

    setSubmitting(true)
    try {
      const res = await api.post<{ success: boolean; exam: { id: number; duration_minutes: number } }>('/api/online_exams', {
        subject_id:        Number(form.subject_id),
        title:             form.title,
        instructions:      form.instructions,
        start_time:        startTime,
        end_time:          endTime,
        max_tab_switches:  form.max_tab_switches,
        questions_per_page: form.questions_per_page,
        max_no_face_count: form.max_no_face_count,
        ban_on_devtools:   form.ban_on_devtools,
        enable_copy_paste: form.enable_copy_paste,
        enable_right_click: form.enable_right_click,
        auto_correct:      form.auto_correct,
      })
      const examId = res.exam?.id

      // L'API n'accepte qu'un seul proctor_id par appel — un POST par surveillant sélectionné
      if (examId && selectedProctors.length > 0) {
        await Promise.all(
          selectedProctors.map(pid =>
            api.post(`/api/online_exams/${examId}/proctors`, { proctor_id: pid }).catch(() => {})
          )
        )
      }

      success(`Examen créé — Durée : ${res.exam?.duration_minutes ?? '?'} min`)
      router.push(`/dashboard/professor/exams`)
    } catch (e: any) {
      error(e.message || 'Erreur lors de la création')
    } finally {
      setSubmitting(false)
    }
  }

  const duration = calcDuration()

  return (
    <div>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
        <div style={{ background: '#3b82f6', width: 42, height: 42, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <i className="fas fa-plus" style={{ color: 'white', fontSize: 16 }} />
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>Créer un Examen en Ligne</h2>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>Configurez les paramètres de votre examen</p>
        </div>
      </div>

      <div className="grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, alignItems: 'start' }}>

        {/* Colonne principale */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>

          <div className="grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
            <div style={{ gridColumn: '1 / -1', marginBottom: 18 }}>
              <label style={lbl}><i className="fas fa-book" /> Sujet Associé <span style={{ color: '#ef4444' }}>*</span></label>
              <select value={form.subject_id} onChange={e => set('subject_id', e.target.value)} style={inp}>
                <option value="">-- Sélectionner un sujet --</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
              </select>
            </div>

            <div style={{ gridColumn: '1 / -1', marginBottom: 18 }}>
              <label style={lbl}><i className="fas fa-heading" /> Titre de l'Examen <span style={{ color: '#ef4444' }}>*</span></label>
              <input type="text" value={form.title} onChange={e => set('title', e.target.value)} placeholder="Ex: Examen Final Blockchain" style={inp} />
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={lbl}><i className="fas fa-calendar-plus" /> Début <span style={{ color: '#ef4444' }}>*</span></label>
              <input type="datetime-local" value={form.start_time} onChange={e => set('start_time', e.target.value)} style={inp} />
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={lbl}><i className="fas fa-calendar-minus" /> Fin <span style={{ color: '#ef4444' }}>*</span></label>
              <input type="datetime-local" value={form.end_time} onChange={e => set('end_time', e.target.value)} style={inp} />
              {duration !== null
                ? <small style={{ color: '#3b82f6', fontSize: 12, display: 'block', marginTop: 4 }}><i className="fas fa-stopwatch" /> Durée : {duration} minutes</small>
                : <small style={{ color: 'var(--text-muted)', fontSize: 12, display: 'block', marginTop: 4 }}>Durée calculée automatiquement</small>
              }
            </div>

            <div style={{ gridColumn: '1 / -1', marginBottom: 18 }}>
              <label style={lbl}><i className="fas fa-align-left" /> Instructions</label>
              <textarea value={form.instructions} onChange={e => set('instructions', e.target.value)} rows={3} placeholder="Consignes pour les étudiants..." style={{ ...inp, resize: 'vertical', fontFamily: 'inherit' }} />
            </div>

            <div style={{ marginBottom: 4 }}>
              <label style={lbl}><i className="fas fa-book-open" /> Questions par page</label>
              <input type="number" min={0} max={50} value={form.questions_per_page} onChange={e => set('questions_per_page', Number(e.target.value))} style={inp} />
              <small style={{ color: 'var(--text-muted)', fontSize: 12, display: 'block', marginTop: 4 }}>Évite le défilement long (0 = tout sur une page)</small>
            </div>
          </div>

          {/* Paramètres de Sécurité */}
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '16px 18px', marginTop: 18, marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <i className="fas fa-shield-alt" style={{ color: '#1d4ed8', fontSize: 15 }} />
              <span style={{ fontWeight: 700, color: '#0f172a', fontSize: 14 }}>Paramètres de Sécurité</span>
            </div>

            <div className="grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ ...lbl, fontSize: 13 }}><i className="fas fa-exchange-alt" style={{ color: '#f59e0b' }} /> Seuil — changements de fenêtre</label>
                <input type="number" min={0} max={20} value={form.max_tab_switches} onChange={e => set('max_tab_switches', Number(e.target.value))} style={inp} />
                <small style={{ color: 'var(--text-muted)', fontSize: 12, display: 'block', marginTop: 4 }}>Bannissement après ce nombre (0 = aucun toléré)</small>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ ...lbl, fontSize: 13 }}><i className="fas fa-eye-slash" style={{ color: '#ef4444' }} /> Seuil — visage absent (caméra)</label>
                <input type="number" min={-1} max={100} value={form.max_no_face_count} onChange={e => set('max_no_face_count', Number(e.target.value))} style={inp} />
                <small style={{ color: 'var(--text-muted)', fontSize: 12, display: 'block', marginTop: 4 }}>Bannissement après N détections sans visage (-1 = désactivé)</small>
              </div>
            </div>

            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 14px', marginBottom: 14, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <input type="checkbox" id="p_ban_devtools" checked={form.ban_on_devtools} onChange={e => set('ban_on_devtools', e.target.checked)} style={{ width: 'auto', marginTop: 2, flexShrink: 0, accentColor: '#dc2626' }} />
              <div>
                <label htmlFor="p_ban_devtools" style={{ fontSize: 13, fontWeight: 600, color: '#dc2626', cursor: 'pointer', margin: 0, display: 'block' }}>
                  <i className="fas fa-terminal" /> Bannir immédiatement si outils développeur ouverts
                </label>
                <small style={{ color: '#64748b' }}>Exclusion instantanée en cas de tentative d'accès aux outils développeur (F12, Ctrl+Shift+I…)</small>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#475569' }}>
                <input type="checkbox" checked={form.enable_copy_paste} onChange={e => set('enable_copy_paste', e.target.checked)} style={{ width: 'auto' }} />
                <span>Autoriser Copier/Coller</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#475569' }}>
                <input type="checkbox" checked={form.enable_right_click} onChange={e => set('enable_right_click', e.target.checked)} style={{ width: 'auto' }} />
                <span>Autoriser Clic Droit</span>
              </label>
            </div>
          </div>

          {/* Correction IA */}
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '16px 18px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <input type="checkbox" id="p_auto_correct" checked={form.auto_correct} onChange={e => set('auto_correct', e.target.checked)} style={{ width: 'auto', marginTop: 3, flexShrink: 0, accentColor: '#15803d' }} />
            <div>
              <label htmlFor="p_auto_correct" style={{ fontSize: 13, fontWeight: 600, color: '#15803d', cursor: 'pointer', margin: 0, display: 'block' }}>
                <i className="fas fa-robot" /> Activer la correction automatique par IA
              </label>
              <small style={{ color: '#64748b', lineHeight: 1.5, display: 'block', marginTop: 3 }}>
                Dès qu'un étudiant soumet sa copie, l'IA la corrige automatiquement.<br />
                <strong>Désactivé par défaut</strong> — vous pouvez toujours réviser ou corriger manuellement après.
              </small>
            </div>
          </div>
        </div>

        {/* Surveillants */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, position: 'sticky', top: 16 }}>
          <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <i className="fas fa-shield-halved" style={{ color: '#1d4ed8', fontSize: 14 }} />
            <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>Surveillants</span>
          </div>
          <div style={{ padding: '8px 18px', maxHeight: 280, overflowY: 'auto' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: 20 }}><i className="fas fa-spinner fa-spin" /></div>
            ) : proctors.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>Aucun surveillant disponible</p>
            ) : proctors.map(p => (
              <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}>
                <input type="checkbox" checked={selectedProctors.includes(p.id)} onChange={() => toggleProctor(p.id)} style={{ width: 'auto' }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{p.full_name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.email}</div>
                </div>
              </label>
            ))}
          </div>
          <div style={{ padding: 16, borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button onClick={handleSubmit} disabled={submitting} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 18px', background: submitting ? '#93c5fd' : '#3b82f6', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer' }}>
              {submitting
                ? <><i className="fas fa-spinner fa-spin" /> Création...</>
                : <><i className="fas fa-check" /> Créer l'Examen</>
              }
            </button>
            <button onClick={() => router.back()} disabled={submitting} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 18px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, fontWeight: 600, color: 'var(--text)', cursor: 'pointer' }}>
              <i className="fas fa-times" /> Annuler
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const lbl: CSSProperties = {
  display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 6,
}
const inp: CSSProperties = {
  width: '100%', padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 8,
  fontSize: 14, color: 'var(--text)', background: 'var(--surface)', boxSizing: 'border-box',
  outline: 'none',
}
