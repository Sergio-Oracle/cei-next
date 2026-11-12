'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import api from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'
import { localInputToIso } from '@/lib/datetime'

interface Candidate { id: number; name: string; email: string; absent: boolean; below_average: boolean; composed: boolean; score: number | null; makeup: string | null }
interface CandidatesResponse { candidates: Candidate[]; total: number; priority_total: number; absent_total: number; below_total: number; composed_total: number }
interface Makeup { id: number; title: string; start_time: string; end_time: string; status: string; students: number; participants: number }

const fmt = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

/** Rattrapage : une SESSION À PART (autre date, mêmes questions) pour les étudiants qui n'ont pas pu composer — absents, sans moyens de
 *  connexion, empêchés. Distinct des vagues : il ne modifie ni l'examen, ni ses vagues, ni les copies déjà rendues. */
export default function ExamMakeupPanel({ examId, durationMinutes, makeupOfId, basePath, ended }: {
  examId: number; durationMinutes: number; makeupOfId?: number | null; basePath: string; ended: boolean
}) {
  const { success, error } = useToast()
  const isMakeup = !!makeupOfId
  const [makeups, setMakeups] = useState<Makeup[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [search, setSearch] = useState('')
  const [everyone, setEveryone] = useState(false)
  const [data, setData] = useState<CandidatesResponse>({ candidates: [], total: 0, priority_total: 0, absent_total: 0, below_total: 0, composed_total: 0 })
  const [picked, setPicked] = useState<Set<number>>(new Set())
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')

  const loadMakeups = useCallback(async () => {
    if (isMakeup) return
    try { setMakeups((await api.get<{ makeups: Makeup[] }>(`/api/online_exams/${examId}/makeups`)).makeups || []) } catch { setMakeups([]) }
  }, [examId, isMakeup])
  useEffect(() => { loadMakeups() }, [loadMakeups])

  async function load(q = search, all = everyone) {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '500' })
      if (q.trim()) params.set('search', q.trim())
      if (all) params.set('include_composed', '1')
      setData(await api.get<CandidatesResponse>(`/api/online_exams/${examId}/makeup/candidates?${params.toString()}`))
    } catch (e: any) { error(e?.message || 'Chargement impossible') } finally { setLoading(false) }
  }
  useEffect(() => { if (open) load(search, everyone) }, [open, everyone]) // eslint-disable-line react-hooks/exhaustive-deps

  const selectable = data.candidates.filter(c => !c.makeup)
  function toggle(id: number) {
    setPicked(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }
  const allShown = selectable.length > 0 && selectable.every(c => picked.has(c.id))
  function toggleAll() {
    setPicked(prev => {
      const n = new Set(prev)
      if (allShown) selectable.forEach(c => n.delete(c.id)); else selectable.forEach(c => n.add(c.id))
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
    if (!isMakeup && (!start || !end)) { error('Indiquez le début et la fin du rattrapage'); return }
    if (!confirm(`${isMakeup ? 'Ajouter' : 'Convoquer'} ${picked.size} étudiant(s) au rattrapage ? Ils seront prévenus par notification et par e-mail.`)) return
    setBusy(true)
    try {
      if (isMakeup) {
        await api.post(`/api/online_exams/${examId}/makeup_students`, { student_ids: Array.from(picked) })
        success('Étudiants ajoutés au rattrapage')
      } else {
        await api.post(`/api/online_exams/${examId}/makeups`, {
          student_ids: Array.from(picked), start_time: localInputToIso(start), end_time: localInputToIso(end),
        })
        success('Rattrapage organisé')
        await loadMakeups()
      }
      setPicked(new Set()); setStart(''); setEnd(''); setOpen(false)
    } catch (e: any) { error(e?.message || 'Opération impossible') } finally { setBusy(false) }
  }

  // Lien direct depuis la liste des examens (#rattrapage) : amène le bloc à l'écran
  useEffect(() => {
    if (typeof window === 'undefined' || window.location.hash !== '#rattrapage') return
    const t = setTimeout(() => document.getElementById('rattrapage')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 600)
    return () => clearTimeout(t)
  }, [])

  return (
    <div id="rattrapage" className="card" style={{ marginBottom: 24, scrollMarginTop: 80 }}>
      <div className="card-header">
        <h3 style={{ margin: 0 }}><i className="fa-solid fa-rotate-right" style={{ marginRight: 8 }} />Rattrapage</h3>
      </div>
      <div style={{ padding: '20px 24px' }}>
        {isMakeup ? (
          <p style={{ marginTop: 0, color: 'var(--text-muted)', fontSize: 15 }}>
            Cette session est un <strong>rattrapage</strong> : mêmes questions que l’examen d’origine, réservée aux étudiants convoqués.{' '}
            <Link href={`${basePath}/${makeupOfId}`}>Voir l’examen d’origine</Link>
          </p>
        ) : (
          <p style={{ marginTop: 0, color: 'var(--text-muted)', fontSize: 15 }}>
            Convoquez les <strong>absents</strong> (qui n’ont pas pu se connecter pour composer) et les étudiants <strong>sous la moyenne</strong> (moins de 10/20) :
            ils sont proposés en premier. Le rattrapage est une <strong>session distincte</strong> : mêmes questions, autre date, uniquement pour les étudiants
            que vous convoquez. Il ne modifie ni l’examen, ni ses vagues, ni les copies déjà rendues.
          </p>
        )}

        {!isMakeup && makeups.length > 0 && (
          <div style={{ overflowX: 'auto', marginBottom: 14 }}>
            <table className="table" style={{ width: '100%' }}>
              <thead><tr><th>Rattrapage</th><th>Créneau (heure locale)</th><th>Convoqués</th><th>Présents</th></tr></thead>
              <tbody>
                {makeups.map(m => (
                  <tr key={m.id}>
                    <td><Link href={`${basePath}/${m.id}`}><strong>{m.title}</strong></Link></td>
                    <td>{fmt(m.start_time)} → {new Date(m.end_time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</td>
                    <td>{m.students}</td><td>{m.participants}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!isMakeup && !ended && (
          <p style={{ color: 'var(--text-muted)', fontSize: 14.5, marginBottom: 0 }}>Le rattrapage s’organise une fois l’examen terminé.</p>
        )}

        {(isMakeup || ended) && !open && (
          <button className="btn btn-primary" onClick={() => setOpen(true)}>
            <i className="fas fa-user-plus" /> {isMakeup ? 'Ajouter des étudiants' : 'Organiser un rattrapage'}
          </button>
        )}

        {open && (
          <>
            <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginBottom: 12 }}>
              <label style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
                <input type="radio" checked={!everyone} onChange={() => setEveryone(false)} />
                Absents et sous la moyenne (moins de 10/20)
              </label>
              <label style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
                <input type="radio" checked={everyone} onChange={() => setEveryone(true)} />
                Tous les inscrits (les autres suivent ; leur copie reste conservée)
              </label>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
              <input className="form-control" style={{ maxWidth: 320 }} placeholder="Rechercher un nom ou un e-mail…" value={search}
                onChange={e => setSearch(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') load() }} />
              <button className="btn btn-secondary" onClick={() => load()} disabled={loading}><i className="fas fa-search" /> Rechercher</button>
              <span style={{ color: 'var(--text-muted)', fontSize: 14.5 }}>
                {data.absent_total.toLocaleString('fr-FR')} absent(s) · {data.below_total.toLocaleString('fr-FR')} sous la moyenne · <strong>{picked.size}</strong> convoqué(s)
              </span>
            </div>
            {selectable.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <button className="btn btn-secondary" onClick={() => setPicked(prev => { const n = new Set(prev); data.candidates.filter(c => !c.makeup && (c.absent || c.below_average)).forEach(c => n.add(c.id)); return n })}>
                  <i className="fas fa-check-double" /> Sélectionner tous les absents et les étudiants sous la moyenne
                </button>
              </div>
            )}
            <div style={{ maxHeight: 360, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 10 }}>
              {loading ? <div style={{ padding: 16 }}>Chargement…</div> : data.candidates.length === 0 ? (
                <div style={{ padding: 16, color: 'var(--text-muted)' }}>Aucun étudiant à afficher.</div>
              ) : (
                <table className="table" style={{ width: '100%', margin: 0 }}>
                  <thead><tr>
                    <th style={{ width: 44 }}><input type="checkbox" checked={allShown} onChange={toggleAll} aria-label="Tout sélectionner" /></th>
                    <th>Étudiant</th><th>E-mail</th><th>Situation</th>
                  </tr></thead>
                  <tbody>
                    {data.candidates.map(c => (
                      <tr key={c.id} onClick={() => { if (!c.makeup) toggle(c.id) }} style={{ cursor: c.makeup ? 'default' : 'pointer', opacity: c.makeup ? 0.55 : 1 }}>
                        <td><input type="checkbox" disabled={!!c.makeup} checked={picked.has(c.id)} onChange={() => toggle(c.id)} onClick={e => e.stopPropagation()} /></td>
                        <td><strong>{c.name}</strong></td><td>{c.email}</td>
                        <td>{c.makeup ? 'Déjà convoqué' : c.absent ? 'Absent' : c.below_average ? `Sous la moyenne (${String(c.score).replace('.', ',')}/20)` : `A composé${c.score != null ? ` (${String(c.score).replace('.', ',')}/20)` : ''}`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            {data.total > data.candidates.length && (
              <small style={{ color: 'var(--text-muted)' }}>Seuls les {data.candidates.length} premiers sont affichés : utilisez la recherche pour affiner.</small>
            )}
            {!isMakeup && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginTop: 16 }}>
                <div><label style={{ fontWeight: 600, fontSize: 15 }}>Début du rattrapage</label>
                  <input type="datetime-local" className="form-control" value={start} onChange={e => onStart(e.target.value)} /></div>
                <div><label style={{ fontWeight: 600, fontSize: 15 }}>Fin du rattrapage</label>
                  <input type="datetime-local" className="form-control" value={end} min={start || undefined} onChange={e => setEnd(e.target.value)} />
                  <small style={{ color: 'var(--text-muted)' }}>Au moins la durée de l’examen ({durationMinutes} min)</small></div>
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button className="btn btn-success" disabled={busy || picked.size === 0} onClick={submit}>
                <i className={`fas ${busy ? 'fa-spinner fa-spin' : 'fa-check'}`} /> {isMakeup ? 'Ajouter au rattrapage' : 'Organiser le rattrapage'}
              </button>
              <button className="btn btn-secondary" onClick={() => setOpen(false)}>Annuler</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
