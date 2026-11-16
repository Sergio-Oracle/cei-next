'use client'

/**
 * Messagerie du PERSONNEL d'un examen (enseignant, responsable d'examen, administrateur, superviseur ↔ surveillants), avec l'appel audio/vidéo
 * dans les deux sens. Temps réel par sondage (3 s panneau ouvert, 8 s fermé) + notification (cloche, bannière) à chaque message.
 * Un fil par examen : « Toute l'équipe » ou un message adressé à une personne précise.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import api from '@/lib/api'
import { errMsg } from '@/lib/errors'

export interface StaffMember { id: number; name: string; role: string }
interface Msg { id: number; sender_id: number; sender_name: string; recipient_id: number | null; recipient_name: string | null; body: string; created_at: string }

const ROLE_LABEL: Record<string, string> = { professor: 'Enseignant', admin: 'Administrateur', responsable_examen: "Responsable d'examen", surveillant: 'Surveillant', superviseur: 'Superviseur' }
const seenKey = (examId: number) => `cei_staffchat_seen_${examId}`

export default function StaffChatPanel({ examId, onCall }: { examId: number; onCall: (p: StaffMember, me: StaffMember) => void }) {
  const [open, setOpen] = useState(false)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [team, setTeam] = useState<StaffMember[]>([])
  const [me, setMe] = useState<StaffMember | null>(null)
  const [to, setTo] = useState<string>('')                 // '' = toute l'équipe
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [err, setErr] = useState('')
  const [allowed, setAllowed] = useState(true)
  const [seen, setSeen] = useState(0)
  const lastId = useRef(0)
  const listRef = useRef<HTMLDivElement | null>(null)
  const openRef = useRef(false)
  useEffect(() => { openRef.current = open }, [open])

  const load = useCallback(async (initial = false) => {
    try {
      const r = await api.get<{ messages: Msg[]; participants?: StaffMember[]; me?: { id: number; name: string; role: string } }>(`/api/online_exams/${examId}/staff_chat${initial || !lastId.current ? '' : `?since_id=${lastId.current}`}`)
      if (r.participants) setTeam(r.participants)
      if (r.me) setMe(r.me)
      if (r.messages.length) {
        setMsgs(prev => {
          const known = new Set(prev.map(m => m.id))
          const add = r.messages.filter(m => !known.has(m.id))
          return add.length ? [...prev, ...add].slice(-400) : prev
        })
        lastId.current = Math.max(lastId.current, ...r.messages.map(m => m.id))
      }
      setAllowed(true)
    } catch (e: unknown) {
      if ((e as { status?: number })?.status === 403) setAllowed(false)
    }
  }, [examId])

  useEffect(() => {
    try { setSeen(Number(localStorage.getItem(seenKey(examId)) || 0)) } catch { /* stockage indisponible */ }
    load(true)
    const iv = setInterval(() => load(false), openRef.current ? 3000 : 8000)
    return () => clearInterval(iv)
  }, [examId, load])
  useEffect(() => {                                      // cadence plus vive panneau ouvert
    if (!open) return
    const iv = setInterval(() => load(false), 3000)
    return () => clearInterval(iv)
  }, [open, load])
  useEffect(() => {                                      // ouverture automatique depuis une notification (?chat=1)
    try { if (new URLSearchParams(window.location.search).get('chat') === '1') setOpen(true) } catch { /* ignoré */ }
  }, [])
  useEffect(() => {                                      // panneau ouvert : tout est lu, défilement en bas
    if (!open || !msgs.length) return
    const top = msgs[msgs.length - 1].id
    setSeen(top)
    try { localStorage.setItem(seenKey(examId), String(top)) } catch { /* ignoré */ }
    setTimeout(() => { if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight }, 30)
  }, [open, msgs, examId])

  async function send() {
    const body = text.trim()
    if (!body || sending) return
    setSending(true); setErr('')
    try {
      const r = await api.post<{ message: Msg }>(`/api/online_exams/${examId}/staff_chat`, { body, to: to ? Number(to) : null })
      setMsgs(prev => prev.some(m => m.id === r.message.id) ? prev : [...prev, r.message])
      lastId.current = Math.max(lastId.current, r.message.id)
      setText('')
    } catch (e: unknown) { setErr(errMsg(e) || "Envoi impossible") }
    finally { setSending(false) }
  }

  if (!allowed) return null
  const unread = msgs.filter(m => m.id > seen && m.sender_id !== me?.id).length
  const others = team.filter(p => p.id !== me?.id)
  const canCall = (p: StaffMember) => me?.role === 'surveillant' ? p.role !== 'surveillant' : p.role === 'surveillant'
  const hhmm = (iso: string) => { try { return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) } catch { return '' } }

  return (
    <>
      {!open && (
        <button onClick={() => setOpen(true)} aria-label="Ouvrir la messagerie du personnel"
          style={{ position: 'fixed', right: 16, bottom: 16, zIndex: 9400, background: '#2563eb', color: 'white', border: 'none', borderRadius: 999, padding: '12px 18px', fontWeight: 700, fontSize: 15, cursor: 'pointer', boxShadow: '0 8px 24px rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <i className="fas fa-comments" /> Messagerie
          {unread > 0 && <span style={{ background: '#ef4444', color: 'white', borderRadius: 999, padding: '1px 8px', fontSize: 13 }}>{unread}</span>}
        </button>
      )}
      {open && (
        <div role="dialog" aria-label="Messagerie du personnel" style={{ position: 'fixed', right: 16, bottom: 16, zIndex: 9400, width: 380, maxWidth: 'calc(100vw - 32px)', height: 520, maxHeight: 'calc(100vh - 32px)', background: '#0f172a', border: '1px solid rgba(255,255,255,.15)', borderRadius: 14, boxShadow: '0 20px 50px rgba(0,0,0,.55)', display: 'flex', flexDirection: 'column', overflow: 'hidden', color: 'white' }}>
          <div style={{ padding: '12px 14px', background: '#1e293b', display: 'flex', alignItems: 'center', gap: 8 }}>
            <i className="fas fa-comments" style={{ color: '#60a5fa' }} />
            <strong style={{ fontSize: 15.5, flex: 1 }}>Messagerie du personnel</strong>
            <button onClick={() => setOpen(false)} aria-label="Réduire" style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.7)', cursor: 'pointer', fontSize: 17 }}><i className="fas fa-minus" /></button>
          </div>
          <div style={{ padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,.08)', display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', fontSize: 12.5 }}>
            <span style={{ color: 'rgba(255,255,255,.5)' }}>Équipe :</span>
            {others.length === 0 && <span style={{ color: 'rgba(255,255,255,.4)' }}>aucun autre membre</span>}
            {others.map(p => (
              <span key={p.id} style={{ background: 'rgba(255,255,255,.07)', borderRadius: 999, padding: '2px 4px 2px 9px', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <span title={ROLE_LABEL[p.role] || p.role}>{p.name}</span>
                {canCall(p) && me && (
                  <button onClick={() => onCall(p, me)} title={`Appeler ${p.name}`} aria-label={`Appeler ${p.name}`}
                    style={{ background: 'rgba(16,185,129,.2)', color: '#34d399', border: 'none', borderRadius: 999, width: 22, height: 22, cursor: 'pointer', fontSize: 11 }}><i className="fas fa-phone" /></button>
                )}
              </span>
            ))}
          </div>
          <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {msgs.length === 0 && <div style={{ margin: 'auto', color: 'rgba(255,255,255,.4)', textAlign: 'center', fontSize: 14 }}>Aucun message.<br />Écrivez à toute l&apos;équipe ou à une personne.</div>}
            {msgs.map(m => {
              const mine = m.sender_id === me?.id
              return (
                <div key={m.id} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                  <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,.45)', textAlign: mine ? 'right' : 'left', marginBottom: 2 }}>
                    {mine ? 'Moi' : m.sender_name}{m.recipient_id ? ` → ${mine ? m.recipient_name : 'moi'}` : ' → équipe'} · {hhmm(m.created_at)}
                  </div>
                  <div style={{ background: mine ? '#2563eb' : '#1e293b', borderRadius: 12, padding: '8px 12px', fontSize: 14.5, lineHeight: 1.45, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.body}</div>
                </div>
              )
            })}
          </div>
          {err && <div style={{ padding: '4px 12px', color: '#fca5a5', fontSize: 13 }}>{err}</div>}
          <div style={{ padding: 10, borderTop: '1px solid rgba(255,255,255,.1)', background: '#0b1220', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <select value={to} onChange={e => setTo(e.target.value)} aria-label="Destinataire"
              style={{ background: '#1e293b', color: 'white', border: '1px solid rgba(255,255,255,.15)', borderRadius: 8, padding: '6px 8px', fontSize: 13.5 }}>
              <option value="">À toute l&apos;équipe</option>
              {others.map(p => <option key={p.id} value={p.id}>{p.name} — {ROLE_LABEL[p.role] || p.role}</option>)}
            </select>
            <div style={{ display: 'flex', gap: 8 }}>
              <textarea value={text} onChange={e => setText(e.target.value)} rows={2} maxLength={1000} placeholder="Votre message…"
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                style={{ flex: 1, background: '#1e293b', color: 'white', border: '1px solid rgba(255,255,255,.15)', borderRadius: 8, padding: '8px 10px', fontSize: 14.5, resize: 'none', fontFamily: 'inherit' }} />
              <button onClick={send} disabled={sending || !text.trim()} aria-label="Envoyer"
                style={{ background: '#2563eb', color: 'white', border: 'none', borderRadius: 8, padding: '0 14px', cursor: sending ? 'wait' : 'pointer', opacity: !text.trim() ? .5 : 1 }}><i className="fas fa-paper-plane" /></button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
