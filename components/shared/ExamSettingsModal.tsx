'use client'
import React, { useEffect, useMemo, useState } from 'react'
import api from '@/lib/api'
import { localInputToIso, isoToLocalInput } from '@/lib/datetime'

interface Policy {
  success: boolean; status: 'draft' | 'scheduled' | 'active' | 'closed'; attempts: number; by_waves: boolean
  locked: Record<string, string>; values: Record<string, any>
}
type SubjectLite = { id: number; title: string }

const STATUS_LABEL: Record<string, string> = { draft: 'Brouillon', scheduled: 'Planifié', active: 'En cours', closed: 'Terminé' }

/** Réglages d'un examen après sa création (Planifié ou En cours). Les règles viennent du serveur : un réglage verrouillé est grisé avec sa raison. */
export default function ExamSettingsModal({ examId, onClose, onSaved }: {
  examId: number; onClose: () => void; onSaved?: (exam: any) => void
}) {
  const [pol, setPol] = useState<Policy | null>(null)
  const [form, setForm] = useState<Record<string, any>>({})
  const [orig, setOrig] = useState<Record<string, any>>({})
  const [subjects, setSubjects] = useState<SubjectLite[]>([])
  const [raw, setRaw] = useState<Record<string, string>>({})     // saisies texte des nombres : jamais corrigées pendant la frappe
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const p = await api.get<Policy>(`/api/admin/online_exams/${examId}/settings`)
        if (!alive) return
        const v = { ...p.values }
        v.start_time = v.start_time ? isoToLocalInput(v.start_time) : ''
        v.end_time = v.end_time ? isoToLocalInput(v.end_time) : ''
        v.scheduled_correction_at = v.scheduled_correction_at ? isoToLocalInput(v.scheduled_correction_at) : ''
        v.time_per_question_seconds = v.time_per_question_seconds ?? 0
        v.instructions = v.instructions ?? ''
        setPol(p); setForm(v); setOrig(v)
        setRaw({ max_tab_switches: String(v.max_tab_switches ?? ''), max_no_face_count: String(v.max_no_face_count ?? ''), questions_per_page: String(v.questions_per_page ?? ''), time_per_question_seconds: String(v.time_per_question_seconds ?? 0) })
        try { const s = await api.get<any>('/api/subjects'); if (alive) setSubjects((Array.isArray(s) ? s : s.subjects ?? []).map((x: any) => ({ id: x.id, title: x.title }))) } catch {}
      } catch (e: any) { if (alive) setErr(e?.message || 'Réglages indisponibles') } finally { if (alive) setLoading(false) }
    })()
    return () => { alive = false }
  }, [examId])

  const locked = pol?.locked ?? {}
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))
  const L = (k: string) => !!locked[k]

  const changed = useMemo(() => Object.keys(form).filter(k => String(form[k] ?? '') !== String(orig[k] ?? '')), [form, orig])
  const active = pol?.status === 'active'

  // Nombre saisi en texte : on ne corrige qu'à la sortie du champ (un « - » seul ou un champ vidé en cours de frappe ne doit pas être effacé)
  const numField = (k: string, lo: number, hi: number) => (
    <input type="text" inputMode="numeric" value={raw[k] ?? ''} disabled={L(k)}
      onChange={e => setRaw(r => ({ ...r, [k]: e.target.value }))}
      onBlur={() => { const n = parseInt(raw[k] ?? '', 10); const v = Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : (orig[k] ?? 0); setRaw(r => ({ ...r, [k]: String(v) })); set(k, v) }}
      style={inp(L(k))} />
  )

  async function save() {
    setErr('')
    if (!changed.length) { onClose(); return }
    if (active && !confirm("L'examen est EN COURS. Les changements de surveillance et de blocage s'appliquent aux étudiants à leur prochain chargement de page ; une prolongation les atteint tout de suite. Enregistrer ?")) return
    const body: Record<string, any> = {}
    for (const k of changed) body[k] = form[k]
    if ('start_time' in body) body.start_time = body.start_time ? localInputToIso(body.start_time) : ''
    if ('end_time' in body) body.end_time = body.end_time ? localInputToIso(body.end_time) : ''
    if ('scheduled_correction_at' in body) body.scheduled_correction_at = body.scheduled_correction_at ? localInputToIso(body.scheduled_correction_at) : ''
    delete body.duration_minutes
    setBusy(true)
    try {
      const r = await api.put<{ exam: any; changes: string[] }>(`/api/admin/online_exams/${examId}`, body)
      onSaved?.(r.exam)
      onClose()
    } catch (e: any) { setErr(e?.message || 'Enregistrement impossible') } finally { setBusy(false) }
  }

  const row = (k: string, label: string, hint?: string, helpOn?: React.ReactNode) => (
    <label key={k} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 10px', borderRadius: 8, background: L(k) ? '#f8fafc' : 'transparent', opacity: L(k) ? 0.75 : 1, cursor: L(k) ? 'not-allowed' : 'pointer' }}>
      <input type="checkbox" checked={!!form[k]} disabled={L(k)} onChange={e => set(k, e.target.checked)} style={{ width: 'auto', marginTop: 3, flexShrink: 0 }} />
      <span style={{ fontSize: 15.5, color: '#0f172a' }}>{label}
        {hint && <small style={{ display: 'block', color: 'var(--text-muted)', fontSize: 13.5 }}>{hint}</small>}
        {helpOn}
        {L(k) && <small style={{ display: 'block', color: '#b45309', fontSize: 13.5 }}><i className="fas fa-lock" style={{ marginRight: 4 }} />{locked[k]}</small>}
      </span>
    </label>
  )
  const field = (k: string, label: string, node: React.ReactNode, hint?: string) => (
    <div key={k} style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 5 }}>{label}</div>
      {node}
      {hint && <small style={{ display: 'block', color: 'var(--text-muted)', fontSize: 13.5, marginTop: 3 }}>{hint}</small>}
      {L(k) && <small style={{ display: 'block', color: '#b45309', fontSize: 13.5, marginTop: 3 }}><i className="fas fa-lock" style={{ marginRight: 4 }} />{locked[k]}</small>}
    </div>
  )
  const card = (title: string, icon: string, children: React.ReactNode) => (
    <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', marginBottom: 14, background: 'var(--surface)' }}>
      <div style={{ fontWeight: 700, fontSize: 16.5, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}><i className={`fas ${icon}`} style={{ color: 'var(--primary)' }} />{title}</div>
      {children}
    </div>
  )

  return (
    <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: '30px 14px' }}
      onMouseDown={e => { if (e.target === e.currentTarget && !busy) onClose() }}>
      <div style={{ background: 'var(--background)', borderRadius: 16, width: '100%', maxWidth: 820, boxShadow: '0 20px 50px rgba(0,0,0,.35)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <i className="fas fa-sliders" style={{ color: 'var(--primary)', fontSize: 20 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 19 }}>Paramètres de l&apos;examen</div>
            {pol && <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>État : <b>{STATUS_LABEL[pol.status]}</b> · {pol.attempts} copie(s) commencée(s)</div>}
          </div>
          <button type="button" onClick={onClose} aria-label="Fermer" style={{ border: 'none', background: 'transparent', fontSize: 20, cursor: 'pointer', color: '#64748b' }}><i className="fas fa-xmark" /></button>
        </div>

        <div style={{ padding: 20 }}>
          {loading && <div style={{ padding: 30, textAlign: 'center' }}><i className="fas fa-spinner fa-spin" /> Chargement…</div>}
          {!loading && !pol && <div style={{ color: '#b91c1c' }}>{err || 'Réglages indisponibles'}</div>}
          {pol && (<>
            {active && (
              <div style={{ border: '1px solid #fcd34d', background: '#fffbeb', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 14.5, color: '#92400e' }}>
                <i className="fas fa-triangle-exclamation" style={{ marginRight: 6 }} />L&apos;examen est en cours : les réglages qui changeraient les règles de ceux qui composent déjà sont verrouillés. La fin ne peut être que repoussée.
              </div>
            )}
            {pol.status === 'closed' && <div style={{ color: '#b91c1c', marginBottom: 12 }}>Un examen terminé ne peut plus être modifié.</div>}

            {card('Informations', 'fa-file-lines', <>
              {field('title', 'Titre', <input value={form.title ?? ''} onChange={e => set('title', e.target.value)} disabled={L('title')} maxLength={200} style={inp(L('title'))} />)}
              {field('instructions', 'Consigne aux étudiants', <textarea value={form.instructions ?? ''} onChange={e => set('instructions', e.target.value)} disabled={L('instructions')} rows={3} style={{ ...inp(L('instructions')), resize: 'vertical' }} />)}
              {field('subject_id', 'Sujet', <select value={form.subject_id ?? ''} onChange={e => set('subject_id', parseInt(e.target.value, 10))} disabled={L('subject_id')} style={inp(L('subject_id'))}>
                {!subjects.some(s => s.id === form.subject_id) && <option value={form.subject_id}>Sujet n°{form.subject_id}</option>}
                {subjects.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
              </select>)}
            </>)}

            {card('Horaire', 'fa-calendar-days', <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {field('start_time', 'Début', <input type="datetime-local" value={form.start_time ?? ''} onChange={e => set('start_time', e.target.value)} disabled={L('start_time') || pol.by_waves && active} style={inp(L('start_time'))} />)}
              {field('end_time', 'Fin', <input type="datetime-local" value={form.end_time ?? ''} onChange={e => set('end_time', e.target.value)} disabled={L('end_time')} min={active ? orig.end_time : undefined} style={inp(L('end_time'))} />,
                active ? 'Vous pouvez seulement repousser la fin (prolongation).' : pol.by_waves ? 'Examen par vagues : la date de début décale toutes les vagues.' : undefined)}
            </div>)}

            {card('Composition', 'fa-list-ol', <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {field('questions_per_page', 'Questions par page', numField('questions_per_page', 0, 50), '0 = tout sur une page')}
              {field('time_per_question_seconds', 'Minuteur par page (secondes)', numField('time_per_question_seconds', 0, 3600), 'QCM / Vrai-Faux uniquement · 0 = désactivé')}
              <div style={{ gridColumn: '1 / -1' }}>{row('randomize_questions', 'Ordre des questions aléatoire', 'Chaque étudiant reçoit un ordre différent, stable une fois l\'examen commencé')}</div>
            </div>)}

            {card('Surveillance', 'fa-shield-halved', <>
              {row('restrict_to_enrolled', 'Réserver l\'examen aux étudiants inscrits à l\'UE', 'Coché (recommandé) : seuls les étudiants inscrits à l\'UE de cet EC voient et peuvent démarrer l\'examen, même avec le lien direct. Décochez seulement pour un examen ouvert à d\'autres étudiants.')}
              {row('auto_ban_enabled', 'Bannissement automatique', 'Désactivé : un seuil atteint envoie une alerte au lieu d\'exclure automatiquement')}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, margin: '8px 0' }}>
                {field('max_tab_switches', 'Seuil — changements de fenêtre', numField('max_tab_switches', 0, 50), '0 = aucun toléré')}
                {field('max_no_face_count', 'Seuil — visage absent (caméra)', numField('max_no_face_count', -1, 200), '-1 = désactivé')}
              </div>
              {row('ban_on_devtools', 'Alerter si outils développeur ouverts')}
              {row('require_biometric', 'Exiger une vérification d\'identité par reconnaissance faciale')}
              {row('run_environment_scan', 'Exiger un scan de l\'environnement (webcam, ~8 s) avant de composer')}
              {row('allow_secondary_camera', 'Autoriser une caméra secondaire (smartphone)')}
              {row('require_client', 'Exiger l\'application CEI Examen', 'Poste verrouillé en plein écran pendant l\'examen (comme Safe Exam Browser) : impossible de changer d\'application, de fermer la fenêtre ou d\'ouvrir un autre site')}
            </>)}

            {card('Autorisations pendant l\'examen', 'fa-unlock', <>
              {row('enable_copy_paste', 'Autoriser Copier/Coller')}
              {row('enable_right_click', 'Autoriser Clic Droit')}
              {row('enable_file_download', 'Autoriser le téléchargement des fichiers du sujet')}
              {row('enable_calculator', 'Activer la calculatrice intégrée')}
            </>)}

            {card('Correction', 'fa-robot', <>
              {row('auto_correct', 'Correction automatique par IA', 'Dès qu\'un étudiant soumet sa copie, l\'IA la corrige ; le professeur peut toujours réviser')}
              {field('scheduled_correction_at', 'Programmer une correction à heure précise (facultatif)', <input type="datetime-local" value={form.scheduled_correction_at ?? ''} onChange={e => set('scheduled_correction_at', e.target.value)} disabled={L('scheduled_correction_at')} style={inp(L('scheduled_correction_at'))} />,
                'Toutes les copies soumises seront corrigées en une fois à cette heure. Effacez le champ pour retirer la programmation.')}
            </>)}
          </>)}
          {err && pol && <div style={{ color: '#b91c1c', fontSize: 15, marginTop: 6 }}><i className="fas fa-circle-exclamation" style={{ marginRight: 6 }} />{err}</div>}
        </div>

        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ flex: 1, fontSize: 14, color: 'var(--text-muted)' }}>{changed.length ? `${changed.length} réglage(s) modifié(s)` : 'Aucune modification'}</span>
          <button type="button" onClick={onClose} disabled={busy} className="btn btn-secondary">Annuler</button>
          <button type="button" onClick={save} disabled={busy || !pol || pol.status === 'closed' || !changed.length} className="btn btn-primary">
            {busy ? <><i className="fas fa-spinner fa-spin" /> Enregistrement…</> : <><i className="fas fa-check" /> Enregistrer</>}
          </button>
        </div>
      </div>
    </div>
  )
}

function inp(locked: boolean): React.CSSProperties {
  return { width: '100%', padding: '10px 12px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 16, background: locked ? '#f1f5f9' : 'var(--background)', color: 'var(--text)', outline: 'none', boxSizing: 'border-box', cursor: locked ? 'not-allowed' : undefined }
}
