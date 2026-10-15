'use client'

import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'
import { localInputToIso, isoToLocalInput } from '@/lib/datetime'

interface Wave {
  id: number; position: number; name: string
  start_time: string; end_time: string; students: number; attempts: number
}
interface Summary {
  enabled: boolean; waves: Wave[]; eligible: number; unassigned: number
  unassigned_ids: number[]; attempts_total: number
}

// Débit moyen par étudiant (caméra + partage d'écran), en mode normal — voir app/exam/[id]/page.tsx
const MBPS_PER_STUDENT = 0.8

const fmt = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

/** Gestion des vagues d'un examen : même examen passé par groupes d'étudiants à des
 *  créneaux successifs, pour étaler la charge réseau. */
export default function ExamWavesPanel({ examId, durationMinutes, locked }: {
  examId: number; durationMinutes: number; locked?: boolean
}) {
  const { success, error } = useToast()
  const [sum, setSum] = useState<Summary | null>(null)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({ count: '3', first_start: '', gap: '15', window: '', order: 'alphabetique' })
  const [edit, setEdit] = useState<{ id: number; name: string; start: string; end: string } | null>(null)
  const [targetWave, setTargetWave] = useState<string>('')

  async function load() {
    try { setSum(await api.get<Summary>(`/api/online_exams/${examId}/waves`)) } catch { setSum(null) }
  }
  useEffect(() => { load() }, [examId]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!sum || (locked && !sum.enabled)) return null
  const count = parseInt(form.count, 10)
  const validCount = Number.isFinite(count) && count >= 2
  const perWave = validCount && sum.eligible ? Math.ceil(sum.eligible / count) : null

  async function plan() {
    if (!form.first_start) { error('Indiquez l’heure de début de la première vague'); return }
    if (!validCount) { error('Au moins 2 vagues'); return }
    if (sum!.enabled && !confirm('Les vagues existantes seront remplacées et les étudiants répartis à nouveau. Continuer ?')) return
    setBusy(true)
    try {
      const body: Record<string, unknown> = {
        count, first_start: localInputToIso(form.first_start),
        gap_minutes: parseInt(form.gap, 10) || 0, order: form.order,
      }
      if (form.window) body.window_minutes = parseInt(form.window, 10)
      const r = await api.post<Summary>(`/api/online_exams/${examId}/waves/plan`, body)
      setSum(r); success('Vagues créées')
    } catch (e: any) { error(e?.message || 'Création impossible') } finally { setBusy(false) }
  }

  async function saveEdit() {
    if (!edit) return
    setBusy(true)
    try {
      const r = await api.put<Summary>(`/api/online_exams/${examId}/waves/${edit.id}`, {
        name: edit.name, start_time: localInputToIso(edit.start), end_time: localInputToIso(edit.end),
      })
      setSum(r); setEdit(null); success('Vague mise à jour')
    } catch (e: any) { error(e?.message || 'Modification impossible') } finally { setBusy(false) }
  }

  async function attachUnassigned() {
    if (!targetWave) { error('Choisissez une vague'); return }
    setBusy(true)
    try {
      const r = await api.post<Summary>(`/api/online_exams/${examId}/waves/${targetWave}/students`, { student_ids: sum!.unassigned_ids })
      setSum(r); success('Étudiants rattachés')
    } catch (e: any) { error(e?.message || 'Rattachement impossible') } finally { setBusy(false) }
  }

  async function extendWave(w: Wave) {
    const raw = prompt(`Prolonger « ${w.name} » de combien de minutes ? Les étudiants qui composent reçoivent le même temps en plus.`, '15')
    if (!raw) return
    const minutes = parseInt(raw, 10)
    if (isNaN(minutes) || minutes <= 0 || minutes > 300) { error('Nombre de minutes invalide (1–300)'); return }
    setBusy(true)
    try {
      await api.post(`/api/online_exams/${examId}/extend`, { extra_minutes: minutes, wave_id: w.id })
      success(`${w.name} : +${minutes} min`)
      await load()
    } catch (e: any) { error(e?.message || 'Prolongation impossible') } finally { setBusy(false) }
  }

  async function removeAll() {
    if (!confirm('Supprimer toutes les vagues ? L’examen retrouvera une seule fenêtre.')) return
    setBusy(true)
    try { setSum(await api.delete<Summary>(`/api/online_exams/${examId}/waves`)); success('Vagues supprimées') }
    catch (e: any) { error(e?.message || 'Suppression impossible') } finally { setBusy(false) }
  }

  return (
    <div className="card" style={{ marginBottom: 24 }}>
      <div className="card-header">
        <h3 style={{ margin: 0 }}><i className="fa-solid fa-layer-group" style={{ marginRight: 8 }} />Vagues d’examen</h3>
      </div>
      <div style={{ padding: '20px 24px' }}>
        <p style={{ marginTop: 0, color: 'var(--text-muted)', fontSize: 15 }}>
          Faites passer le même examen par groupes d’étudiants, à des créneaux successifs, pour limiter le nombre de connexions simultanées.
          Chaque étudiant ne voit et ne peut démarrer l’examen que pendant le créneau de sa vague.
          {sum.eligible > 0 && <> {sum.eligible.toLocaleString('fr-FR')} étudiant(s) inscrit(s).</>}
        </p>
        <p style={{ marginTop: 0, color: 'var(--text-muted)', fontSize: 14 }}>
          Un étudiant inscrit après la création des vagues est rattaché automatiquement à la vague non commencée la moins remplie.
          Chaque étudiant reçoit son créneau par notification et par e-mail (dès que l’examen lui est visible, sinon à l’activation), et à chaque changement. Les surveillants se partagent les étudiants vague par vague. Définissez les vagues avant d’activer l’examen.
        </p>

        {sum.enabled && (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ width: '100%' }}>
                <thead><tr><th>Vague</th><th>Créneau (heure locale)</th><th>Étudiants</th><th>Démarrés</th><th>Débit max estimé</th><th /></tr></thead>
                <tbody>
                  {sum.waves.map(w => (
                    <tr key={w.id}>
                      <td><strong>{w.name}</strong></td>
                      <td>{fmt(w.start_time)} → {new Date(w.end_time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</td>
                      <td>{w.students}</td>
                      <td>{w.attempts}</td>
                      <td>≈ {(w.students * MBPS_PER_STUDENT).toFixed(0)} Mbit/s</td>
                      <td style={{ textAlign: 'right' }}>
                        {!locked && <button className="btn btn-secondary" onClick={() => setEdit({ id: w.id, name: w.name, start: isoToLocalInput(w.start_time), end: isoToLocalInput(w.end_time) })}>
                          <i className="fas fa-pen" /> Modifier</button>}
                        {!locked && new Date(w.end_time) > new Date() && <button className="btn btn-secondary" style={{ marginLeft: 8 }} disabled={busy} onClick={() => extendWave(w)}>
                          <i className="fas fa-clock" /> Prolonger</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {sum.unassigned > 0 && (
              <div style={{ margin: '16px 0', padding: 14, border: '1px solid var(--warning)', borderRadius: 10 }}>
                <strong>{sum.unassigned} étudiant(s) inscrit(s) n’ont aucune vague</strong> (toutes les vagues sont terminées ou ces étudiants ont été inscrits trop tard) : ils ne peuvent pas démarrer l’examen tant qu’ils ne sont pas rattachés.
                <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
                  <select className="form-control" style={{ maxWidth: 260 }} value={targetWave} onChange={e => setTargetWave(e.target.value)}>
                    <option value="">Rattacher à la vague…</option>
                    {sum.waves.map(w => <option key={w.id} value={w.id}>{w.name} — {fmt(w.start_time)}</option>)}
                  </select>
                  <button className="btn btn-primary" disabled={busy || !targetWave} onClick={attachUnassigned}>Rattacher</button>
                </div>
              </div>
            )}
          </>
        )}

        {!locked && sum.attempts_total === 0 && (
          <details open={!sum.enabled} style={{ marginTop: 14 }}>
            <summary style={{ cursor: 'pointer', fontWeight: 600 }}>{sum.enabled ? 'Redéfinir les vagues' : 'Organiser par vagues'}</summary>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14, marginTop: 14 }}>
              <div><label style={{ fontWeight: 600, fontSize: 15 }}>Nombre de vagues</label>
                <input type="number" min={2} max={40} className="form-control" value={form.count} onChange={e => setForm(f => ({ ...f, count: e.target.value }))} />
                {perWave && <small style={{ color: 'var(--text-muted)' }}>≈ {perWave} étudiants par vague · ≈ {(perWave * MBPS_PER_STUDENT).toFixed(0)} Mbit/s simultanés</small>}
              </div>
              <div><label style={{ fontWeight: 600, fontSize: 15 }}>Début de la première vague</label>
                <input type="datetime-local" className="form-control" value={form.first_start} onChange={e => setForm(f => ({ ...f, first_start: e.target.value }))} /></div>
              <div><label style={{ fontWeight: 600, fontSize: 15 }}>Fenêtre d’une vague (min)</label>
                <input type="number" min={5} className="form-control" placeholder={`${durationMinutes} (durée de l’examen)`} value={form.window} onChange={e => setForm(f => ({ ...f, window: e.target.value }))} />
                <small style={{ color: 'var(--text-muted)' }}>Au moins la durée de l’examen</small></div>
              <div><label style={{ fontWeight: 600, fontSize: 15 }}>Écart entre vagues (min)</label>
                <input type="number" min={0} className="form-control" value={form.gap} onChange={e => setForm(f => ({ ...f, gap: e.target.value }))} /></div>
              <div><label style={{ fontWeight: 600, fontSize: 15 }}>Répartition</label>
                <select className="form-control" value={form.order} onChange={e => setForm(f => ({ ...f, order: e.target.value }))}>
                  <option value="alphabetique">Par ordre alphabétique</option>
                  <option value="aleatoire">Au hasard</option>
                </select></div>
            </div>
            <button className="btn btn-primary" style={{ marginTop: 14 }} disabled={busy} onClick={plan}>
              <i className={`fas ${busy ? 'fa-spinner fa-spin' : 'fa-check'}`} /> {sum.enabled ? 'Redéfinir' : 'Créer les vagues'}
            </button>
            {sum.enabled && <button className="btn btn-danger" style={{ marginTop: 14, marginLeft: 10 }} disabled={busy} onClick={removeAll}>Supprimer les vagues</button>}
          </details>
        )}
        {sum.attempts_total > 0 && sum.enabled && (
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 0 }}>
            Des étudiants ont déjà commencé : les vagues ne peuvent plus être redéfinies, mais vous pouvez ajuster le créneau d’une vague.
          </p>
        )}
      </div>

      {edit && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--surface)', borderRadius: 14, padding: 28, width: 400, maxWidth: '95vw' }}>
            <h3 style={{ marginBottom: 20 }}>Modifier la vague</h3>
            <label style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>Nom</label>
            <input className="form-control" value={edit.name} onChange={e => setEdit({ ...edit, name: e.target.value })} style={{ marginBottom: 14 }} />
            <label style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>Début</label>
            <input type="datetime-local" className="form-control" value={edit.start} onChange={e => setEdit({ ...edit, start: e.target.value })} style={{ marginBottom: 14 }} />
            <label style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>Fin</label>
            <input type="datetime-local" className="form-control" value={edit.end} min={edit.start || undefined} onChange={e => setEdit({ ...edit, end: e.target.value })} style={{ marginBottom: 20 }} />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setEdit(null)}>Annuler</button>
              <button className="btn btn-success" disabled={busy} onClick={saveEdit}>Enregistrer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
