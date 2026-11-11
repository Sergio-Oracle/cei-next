'use client'

import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'
import { localInputToIso } from '@/lib/datetime'

interface Candidate { id: number; name: string; email: string }
interface CandidatesResponse { candidates: Candidate[]; total: number }

/** Rattrapage : le personnel choisit les étudiants qui n'ont pas pu composer (sans moyens, absents, bloqués avant les questions)
 *  et leur ouvre un nouveau créneau sur le même sujet. Les autres étudiants ne sont pas concernés. */
export default function ExamMakeupPanel({ examId, durationMinutes }: { examId: number; durationMinutes: number }) {
  const { success, error } = useToast()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [search, setSearch] = useState('')
  const [data, setData] = useState<CandidatesResponse>({ candidates: [], total: 0 })
  const [picked, setPicked] = useState<Set<number>>(new Set())
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')

  async function load(q = search) {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '500' })
      if (q.trim()) params.set('search', q.trim())
      setData(await api.get<CandidatesResponse>(`/api/online_exams/${examId}/makeup/candidates?${params.toString()}`))
    } catch (e: any) { error(e?.message || 'Chargement impossible') } finally { setLoading(false) }
  }
  useEffect(() => { if (open) load('') }, [open, examId]) // eslint-disable-line react-hooks/exhaustive-deps

  function toggle(id: number) {
    setPicked(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }
  const allShown = data.candidates.length > 0 && data.candidates.every(c => picked.has(c.id))
  function toggleAll() {
    setPicked(prev => {
      const n = new Set(prev)
      if (allShown) data.candidates.forEach(c => n.delete(c.id)); else data.candidates.forEach(c => n.add(c.id))
      return n
    })
  }
  function onStart(v: string) {
    setStart(v)
    if (v && !end) {
      const d = new Date(v)
      if (!isNaN(d.getTime())) {
        d.setMinutes(d.getMinutes() + Math.max(durationMinutes || 0, 5))
        const p = (x: number) => String(x).padStart(2, '0')
        setEnd(`${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`)
      }
    }
  }

  async function submit() {
    if (picked.size === 0) { error('Choisissez au moins un étudiant'); return }
    if (!start || !end) { error('Indiquez le début et la fin du rattrapage'); return }
    if (!confirm(`Ouvrir le rattrapage à ${picked.size} étudiant(s) ? Ils seront prévenus par notification et par e-mail.`)) return
    setBusy(true)
    try {
      await api.post(`/api/online_exams/${examId}/makeup`, {
        student_ids: Array.from(picked), start_time: localInputToIso(start), end_time: localInputToIso(end),
      })
      success('Rattrapage organisé')
      setPicked(new Set()); setStart(''); setEnd(''); setOpen(false)
      window.dispatchEvent(new Event('exam-waves-changed'))
    } catch (e: any) { error(e?.message || 'Organisation impossible') } finally { setBusy(false) }
  }

  return (
    <div className="card" style={{ marginBottom: 24 }}>
      <div className="card-header">
        <h3 style={{ margin: 0 }}><i className="fa-solid fa-rotate-right" style={{ marginRight: 8 }} />Rattrapage</h3>
      </div>
      <div style={{ padding: '20px 24px' }}>
        <p style={{ marginTop: 0, color: 'var(--text-muted)', fontSize: 15 }}>
          Faites recomposer les étudiants qui n’ont pas pu passer l’examen (sans moyens de connexion, absents, empêchés avant d’avoir vu les questions).
          Choisissez-les puis fixez un nouveau créneau : ils composent le même sujet. Les autres étudiants ne sont pas concernés.
        </p>
        {!open ? (
          <button className="btn btn-primary" onClick={() => setOpen(true)}>
            <i className="fas fa-user-check" /> Choisir les étudiants du rattrapage
          </button>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
              <input className="form-control" style={{ maxWidth: 320 }} placeholder="Rechercher un nom ou un e-mail…" value={search}
                onChange={e => setSearch(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') load() }} />
              <button className="btn btn-secondary" onClick={() => load()} disabled={loading}><i className="fas fa-search" /> Rechercher</button>
              <span style={{ color: 'var(--text-muted)', fontSize: 14.5 }}>
                {data.total.toLocaleString('fr-FR')} étudiant(s) sans copie · <strong>{picked.size}</strong> choisi(s)
              </span>
            </div>
            <div style={{ maxHeight: 360, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 10 }}>
              {loading ? <div style={{ padding: 16 }}>Chargement…</div> : data.candidates.length === 0 ? (
                <div style={{ padding: 16, color: 'var(--text-muted)' }}>Aucun étudiant sans copie.</div>
              ) : (
                <table className="table" style={{ width: '100%', margin: 0 }}>
                  <thead><tr>
                    <th style={{ width: 44 }}><input type="checkbox" checked={allShown} onChange={toggleAll} aria-label="Tout sélectionner" /></th>
                    <th>Étudiant</th><th>E-mail</th>
                  </tr></thead>
                  <tbody>
                    {data.candidates.map(c => (
                      <tr key={c.id} onClick={() => toggle(c.id)} style={{ cursor: 'pointer' }}>
                        <td><input type="checkbox" checked={picked.has(c.id)} onChange={() => toggle(c.id)} onClick={e => e.stopPropagation()} /></td>
                        <td><strong>{c.name}</strong></td><td>{c.email}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            {data.total > data.candidates.length && (
              <small style={{ color: 'var(--text-muted)' }}>Seuls les {data.candidates.length} premiers sont affichés : utilisez la recherche pour affiner.</small>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginTop: 16 }}>
              <div><label style={{ fontWeight: 600, fontSize: 15 }}>Début du rattrapage</label>
                <input type="datetime-local" className="form-control" value={start} onChange={e => onStart(e.target.value)} /></div>
              <div><label style={{ fontWeight: 600, fontSize: 15 }}>Fin du rattrapage</label>
                <input type="datetime-local" className="form-control" value={end} min={start || undefined} onChange={e => setEnd(e.target.value)} />
                <small style={{ color: 'var(--text-muted)' }}>Au moins la durée de l’examen ({durationMinutes} min)</small></div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button className="btn btn-success" disabled={busy || picked.size === 0} onClick={submit}>
                <i className={`fas ${busy ? 'fa-spinner fa-spin' : 'fa-check'}`} /> Organiser le rattrapage
              </button>
              <button className="btn btn-secondary" onClick={() => setOpen(false)}>Annuler</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
