'use client'

import { useState, useEffect, FormEvent, CSSProperties } from 'react'
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
    subject_id:      '',
    title:           '',
    instructions:    '',
    start_time:      '',
    end_time:        '',
    max_tab_switches:  2,
    questions_per_page: 5,
    time_per_question_seconds: 0,
    randomize_questions: false,
    max_no_face_count: 10,
    ban_on_devtools:   true,
    auto_ban_enabled:  false,
    enable_copy_paste: false,
    enable_right_click: false,
    enable_file_download: false,
    auto_correct:      false,
    scheduled_correction_at: '',
    enable_calculator: false,
    allow_secondary_camera: false,
  })

  useEffect(() => {
    api.get<any>('/api/subjects').then(data => {
      setSubjects(Array.isArray(data) ? data : (data as any).subjects ?? [])
    }).catch(() => {})
  }, [])

  function set(key: string, val: any) {
    setForm(f => ({ ...f, [key]: val }))
  }

  // Tampon texte dédié pour max_no_face_count : seul champ à autoriser une
  // valeur négative (-1 = désactivé) — voir explication dans la page prof.
  const [noFaceRaw, setNoFaceRaw] = useState(String(form.max_no_face_count))

  function calcDuration() {
    if (!form.start_time || !form.end_time) return null
    const diff = new Date(form.end_time).getTime() - new Date(form.start_time).getTime()
    return diff > 0 ? Math.round(diff / 60000) : null
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form.subject_id) { error('Sélectionnez un sujet'); return }
    if (!form.start_time || !form.end_time) { error('Renseignez les dates de début et de fin'); return }

    // Envoi UTC en ajoutant :00Z à la valeur brute du datetime-local (identique à la plateforme originale)
    const startTime = form.start_time + ':00Z'
    const endTime   = form.end_time   + ':00Z'
    if (startTime >= endTime) { error('La date de fin doit être après la date de début'); return }

    setLoading(true)
    try {
      const res = await api.post<{ success: boolean; exam: { id: number; duration_minutes: number } }>('/api/online_exams', {
        subject_id:        Number(form.subject_id),
        title:             form.title,
        instructions:      form.instructions,
        start_time:        startTime,
        end_time:          endTime,
        max_tab_switches:  form.max_tab_switches,
        questions_per_page: form.questions_per_page,
        time_per_question_seconds: form.time_per_question_seconds || null,
        randomize_questions: form.randomize_questions,
        max_no_face_count: form.max_no_face_count,
        ban_on_devtools:   form.ban_on_devtools,
        auto_ban_enabled:  form.auto_ban_enabled,
        enable_copy_paste: form.enable_copy_paste,
        enable_right_click: form.enable_right_click,
        enable_file_download: form.enable_file_download,
        auto_correct:      form.auto_correct,
        scheduled_correction_at: form.scheduled_correction_at ? form.scheduled_correction_at + ':00Z' : null,
        enable_calculator: form.enable_calculator,
        allow_secondary_camera: form.allow_secondary_camera,
      })
      success(`Examen créé — Durée : ${res.exam?.duration_minutes ?? '?'} min`)
      router.push('/dashboard/admin/exams')
    } catch (e: any) {
      error(e.message || 'Erreur lors de la création')
    } finally {
      setLoading(false)
    }
  }

  const duration = calcDuration()

  return (
    <div>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ background: '#3b82f6', width: 42, height: 42, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <i className="fas fa-plus" style={{ color: 'white', fontSize: 19 }} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize:24, fontWeight: 700, color: 'var(--text)' }}>Créer un Examen en Ligne</h2>
            <p style={{ margin: '2px 0 0', fontSize:15.5, color: 'var(--text-muted)' }}>Configurez les paramètres de votre examen</p>
          </div>
        </div>
        <Link href="/dashboard/admin/exams" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize:15.5, fontWeight: 600, color: 'var(--text)', textDecoration: 'none' }}>
          <i className="fas fa-arrow-left" /> Retour
        </Link>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Main card */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, marginBottom: 16 }}>

          {/* Grid : Sujet + Titre + Dates + Instructions */}
          <div className="grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>

            {/* Sujet */}
            <div style={{ gridColumn: '1 / -1', marginBottom: 18 }}>
              <label style={lbl}><i className="fas fa-book" /> Sujet Associé <span style={{ color: '#ef4444' }}>*</span></label>
              <select value={form.subject_id} onChange={e => set('subject_id', e.target.value)} required style={inp}>
                <option value="">-- Sélectionner un sujet --</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
              </select>
            </div>

            {/* Titre */}
            <div style={{ gridColumn: '1 / -1', marginBottom: 18 }}>
              <label style={lbl}><i className="fas fa-heading" /> Titre de l'Examen <span style={{ color: '#ef4444' }}>*</span></label>
              <input type="text" value={form.title} onChange={e => set('title', e.target.value)} placeholder="Ex: Examen Final Blockchain" required style={inp} />
            </div>

            {/* Début */}
            <div style={{ marginBottom: 18 }}>
              <label style={lbl}><i className="fas fa-calendar-plus" /> Début <span style={{ color: '#ef4444' }}>*</span></label>
              <input type="datetime-local" value={form.start_time} onChange={e => set('start_time', e.target.value)} required style={inp} />
            </div>

            {/* Fin */}
            <div style={{ marginBottom: 18 }}>
              <label style={lbl}><i className="fas fa-calendar-minus" /> Fin <span style={{ color: '#ef4444' }}>*</span></label>
              <input type="datetime-local" value={form.end_time} onChange={e => set('end_time', e.target.value)} required style={inp} />
              {duration !== null
                ? <small style={{ color: '#3b82f6', fontSize:14.5, display: 'block', marginTop: 4 }}><i className="fas fa-stopwatch" /> Durée : {duration} minutes</small>
                : <small style={{ color: 'var(--text-muted)', fontSize:14.5, display: 'block', marginTop: 4 }}>Durée calculée automatiquement</small>
              }
            </div>

            {/* Instructions */}
            <div style={{ gridColumn: '1 / -1', marginBottom: 18 }}>
              <label style={lbl}><i className="fas fa-align-left" /> Instructions</label>
              <textarea value={form.instructions} onChange={e => set('instructions', e.target.value)} rows={3} placeholder="Consignes pour les étudiants..." style={{ ...inp, resize: 'vertical', fontFamily: 'inherit' }} />
            </div>

            {/* Questions par page */}
            <div style={{ marginBottom: 4 }}>
              <label style={lbl}><i className="fas fa-book-open" /> Questions par page</label>
              <input type="number" min={0} max={50}
                value={Number.isNaN(form.questions_per_page) ? '' : form.questions_per_page}
                onChange={e => set('questions_per_page', parseInt(e.target.value, 10))}
                onBlur={() => set('questions_per_page', Math.max(0, Math.min(50, Number.isNaN(form.questions_per_page) ? 5 : form.questions_per_page)))}
                style={inp} />
              <small style={{ color: 'var(--text-muted)', fontSize:14.5, display: 'block', marginTop: 4 }}>Évite le défilement long (0 = tout sur une page)</small>
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={lbl}><i className="fas fa-hourglass-half" /> Minuteur par page (QCM/Vrai-Faux)</label>
              <input type="number" min={0} max={3600}
                value={Number.isNaN(form.time_per_question_seconds) ? '' : form.time_per_question_seconds}
                onChange={e => set('time_per_question_seconds', parseInt(e.target.value, 10))}
                onBlur={() => set('time_per_question_seconds', Math.max(0, Math.min(3600, Number.isNaN(form.time_per_question_seconds) ? 0 : form.time_per_question_seconds)))}
                style={inp} />
              <small style={{ color: 'var(--text-muted)', fontSize:14.5, display: 'block', marginTop: 4 }}>
                Secondes avant avance automatique à la page suivante — QCM/Vrai-Faux uniquement, jamais les questions ouvertes (0 = désactivé)
              </small>
            </div>

            <div style={{ marginBottom: 4, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <input type="checkbox" id="a_randomize" checked={form.randomize_questions} onChange={e => set('randomize_questions', e.target.checked)} style={{ width: 'auto', marginTop: 3, flexShrink: 0 }} />
              <div>
                <label htmlFor="a_randomize" style={lbl}><i className="fas fa-random" /> Ordre des questions aléatoire</label>
                <small style={{ color: 'var(--text-muted)', fontSize:14.5, display: 'block' }}>Chaque étudiant reçoit un ordre différent (QCM/Vrai-Faux/Appariement et leurs choix) — stable une fois l'examen commencé</small>
              </div>
            </div>
          </div>

          {/* Paramètres de Sécurité */}
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '16px 18px', marginTop: 18, marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <i className="fas fa-shield-alt" style={{ color: '#1d4ed8', fontSize: 18 }} />
              <span style={{ fontWeight: 700, color: '#0f172a', fontSize:17 }}>Paramètres de Sécurité</span>
            </div>

            {/* Bannissement automatique — interrupteur maître */}
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '12px 14px', marginBottom: 16, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <input type="checkbox" id="auto_ban" checked={form.auto_ban_enabled} onChange={e => set('auto_ban_enabled', e.target.checked)} style={{ width: 'auto', marginTop: 2, flexShrink: 0, accentColor: '#dc2626' }} />
              <div>
                <label htmlFor="auto_ban" style={{ fontSize:15.5, fontWeight: 700, color: '#0f172a', cursor: 'pointer', margin: 0, display: 'block' }}>
                  <i className="fas fa-ban" style={{ color: form.auto_ban_enabled ? '#dc2626' : '#64748b' }} /> Bannissement automatique
                </label>
                <small style={{ color: '#64748b' }}>
                  {form.auto_ban_enabled
                    ? 'Activé — un étudiant est exclu automatiquement dès qu\'un seuil ci-dessous est atteint.'
                    : 'Désactivé (par défaut) — un seuil atteint envoie une alerte (agent autonome + notification) au lieu d\'exclure automatiquement.'}
                </small>
              </div>
            </div>

            {/* Seuils */}
            <div className="grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ ...lbl, fontSize:15.5 }}><i className="fas fa-exchange-alt" style={{ color: '#f59e0b' }} /> Seuil — changements de fenêtre</label>
                <input type="number" min={0} max={20}
                  value={Number.isNaN(form.max_tab_switches) ? '' : form.max_tab_switches}
                  onChange={e => set('max_tab_switches', parseInt(e.target.value, 10))}
                  onBlur={() => set('max_tab_switches', Math.max(0, Math.min(20, Number.isNaN(form.max_tab_switches) ? 2 : form.max_tab_switches)))}
                  style={inp} />
                <small style={{ color: 'var(--text-muted)', fontSize:14.5, display: 'block', marginTop: 4 }}>{form.auto_ban_enabled ? 'Bannissement' : 'Alerte'} après ce nombre (0 = aucun toléré)</small>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ ...lbl, fontSize:15.5 }}><i className="fas fa-eye-slash" style={{ color: '#ef4444' }} /> Seuil — visage absent (caméra)</label>
                <input type="number" min={-1} max={100}
                  value={noFaceRaw}
                  onChange={e => {
                    setNoFaceRaw(e.target.value)
                    const n = parseInt(e.target.value, 10)
                    if (!Number.isNaN(n)) set('max_no_face_count', n)
                  }}
                  onBlur={() => {
                    const n = Math.max(-1, Math.min(100, parseInt(noFaceRaw, 10) || 10))
                    set('max_no_face_count', n); setNoFaceRaw(String(n))
                  }}
                  style={inp} />
                <small style={{ color: 'var(--text-muted)', fontSize:14.5, display: 'block', marginTop: 4 }}>{form.auto_ban_enabled ? 'Bannissement' : 'Alerte'} après N détections sans visage (-1 = désactivé)</small>
              </div>
            </div>

            {/* DevTools */}
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '12px 14px', marginBottom: 14, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <input type="checkbox" id="ban_devtools" checked={form.ban_on_devtools} onChange={e => set('ban_on_devtools', e.target.checked)} style={{ width: 'auto', marginTop: 2, flexShrink: 0, accentColor: '#dc2626' }} />
              <div>
                <label htmlFor="ban_devtools" style={{ fontSize:15.5, fontWeight: 600, color: '#0f172a', cursor: 'pointer', margin: 0, display: 'block' }}>
                  <i className="fas fa-terminal" style={{ color: '#64748b' }} /> {form.auto_ban_enabled ? 'Bannir immédiatement' : 'Alerter'} si outils développeur ouverts
                </label>
                <small style={{ color: '#64748b' }}>Tentative d'accès aux outils développeur détectée (F12, Ctrl+Shift+I…)</small>
              </div>
            </div>

            {/* Copy-paste + Right-click */}
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 16 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize:15.5, color: '#475569' }}>
                <input type="checkbox" checked={form.enable_copy_paste} onChange={e => set('enable_copy_paste', e.target.checked)} style={{ width: 'auto' }} />
                <span>Autoriser Copier/Coller</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize:15.5, color: '#475569' }}>
                <input type="checkbox" checked={form.enable_right_click} onChange={e => set('enable_right_click', e.target.checked)} style={{ width: 'auto' }} />
                <span>Autoriser Clic Droit</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize:15.5, color: '#475569' }}>
                <input type="checkbox" checked={form.enable_file_download} onChange={e => set('enable_file_download', e.target.checked)} style={{ width: 'auto' }} />
                <span>Autoriser le téléchargement des fichiers du sujet</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize:15.5, color: '#475569' }}>
                <input type="checkbox" checked={form.enable_calculator} onChange={e => set('enable_calculator', e.target.checked)} style={{ width: 'auto' }} />
                <span><i className="fas fa-calculator" style={{ marginRight: 4 }} />Activer la calculatrice intégrée</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize:15.5, color: '#475569' }}>
                <input type="checkbox" checked={form.allow_secondary_camera} onChange={e => set('allow_secondary_camera', e.target.checked)} style={{ width: 'auto' }} />
                <span><i className="fas fa-mobile-screen" style={{ marginRight: 4 }} />Autoriser une caméra secondaire (smartphone)</span>
              </label>
            </div>
            {form.enable_calculator && (
              <p style={{ margin: '-8px 0 16px', fontSize:14, color: '#64748b' }}>
                <i className="fas fa-info-circle" style={{ marginRight: 4 }} />Les étudiants pourront utiliser une calculatrice scientifique directement sur la page d'examen — utile pour éviter le recours à une calculatrice physique ou un téléphone pendant la composition.
              </p>
            )}
            {form.allow_secondary_camera && (
              <p style={{ margin: '-8px 0 16px', fontSize:14, color: '#64748b' }}>
                <i className="fas fa-info-circle" style={{ marginRight: 4 }} />Les étudiants pourront ajouter leur téléphone comme caméra secondaire (angle latéral, via QR code) pour couvrir l&apos;angle mort hors écran.
              </p>
            )}

          </div>

          {/* Correction IA */}
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '16px 18px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <input type="checkbox" id="auto_correct" checked={form.auto_correct} onChange={e => set('auto_correct', e.target.checked)} style={{ width: 'auto', marginTop: 3, flexShrink: 0, accentColor: '#15803d' }} />
            <div>
              <label htmlFor="auto_correct" style={{ fontSize:15.5, fontWeight: 600, color: '#0f172a', cursor: 'pointer', margin: 0, display: 'block' }}>
                <i className="fas fa-robot" style={{ color: '#64748b' }} /> Activer la correction automatique par IA
              </label>
              <small style={{ color: '#64748b', lineHeight: 1.5, display: 'block', marginTop: 3 }}>
                Dès qu'un étudiant soumet sa copie, l'IA la corrige automatiquement.<br />
                <strong>Désactivé par défaut</strong> — le professeur peut toujours réviser ou corriger manuellement après.
              </small>
            </div>
          </div>

          {/* Correction planifiée à heure précise */}
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '16px 18px' }}>
            <label style={{ fontSize:15.5, fontWeight: 600, color: '#0f172a', display: 'block', marginBottom: 6 }}>
              <i className="fas fa-calendar-day" style={{ marginRight: 6, color: '#64748b' }} />Programmer une correction à heure précise (optionnel)
            </label>
            <input type="datetime-local" value={form.scheduled_correction_at}
              onChange={e => set('scheduled_correction_at', e.target.value)}
              style={{ width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize:16, boxSizing: 'border-box' }} />
            <small style={{ color: '#64748b', lineHeight: 1.5, display: 'block', marginTop: 6 }}>
              À l'heure indiquée, toutes les copies soumises et pas encore corrigées de cet examen seront corrigées automatiquement en une fois — utile pour attendre la fin de TOUTES les sessions avant de lancer la correction en bloc, plutôt que copie par copie. Indépendant de la correction automatique immédiate ci-dessus.
            </small>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <Link href="/dashboard/admin/exams" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 18px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize:17, fontWeight: 600, color: 'var(--text)', textDecoration: 'none' }}>
            <i className="fas fa-times" /> Annuler
          </Link>
          <button type="submit" disabled={loading} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 20px', background: loading ? '#93c5fd' : '#3b82f6', color: 'white', border: 'none', borderRadius: 8, fontSize:17, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer' }}>
            {loading
              ? <><i className="fas fa-spinner fa-spin" /> Création...</>
              : <><i className="fas fa-check" /> Créer l'Examen</>
            }
          </button>
        </div>
      </form>
    </div>
  )
}

const lbl: CSSProperties = {
  display: 'block', fontSize:15.5, fontWeight: 600, color: 'var(--text)', marginBottom: 6,
}
const inp: CSSProperties = {
  width: '100%', padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 8,
  fontSize:17, color: 'var(--text)', background: 'var(--surface)', boxSizing: 'border-box',
  outline: 'none',
}
