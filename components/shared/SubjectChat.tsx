'use client'
import React, { useEffect, useRef, useState } from 'react'
import api from '@/lib/api'
import { errMsg } from '@/lib/errors'

export interface ChatDraft {
  title: string; content: string; rubric: string
  report: { questions: number; blocks?: number; by_type: Record<string, number>; ok: boolean; issues: string[]
    requested?: number; reused?: number
    outline?: { num: string; type: string; text: string; choices: string[]; items: number }[] }
}
interface Msg { role: 'user' | 'assistant'; content: string; draft?: ChatDraft | null; files?: string[] }
interface Att { id: string; name: string; chars?: number; corrige?: boolean }

const TYPE_LABELS: Record<string, string> = {
  qcm: 'QCM', qcm_multi: 'QCM à réponses multiples', vf: 'vrai/faux', open: 'ouverte(s)', subopen: 'sous-questions liées', code: 'code',
  association: 'association', appariement: 'appariement', tri: 'classement', ordre: 'remise en ordre', trous: 'texte à trous',
  cloze: 'champs à compléter', court: 'réponse courte', numerique: 'réponse numérique', calculee: 'calcul à variables', zones: 'placement sur image',
}
const IDEAS = [
  'Crée un examen de 20 questions à partir de mon cours : 10 QCM, 5 vrai/faux et 5 questions ouvertes',
  'Reprends ce sujet exactement tel quel, avec son corrigé',
  'Transforme les questions ouvertes en QCM',
  'Ajoute 5 questions sur le dernier chapitre',
]

/** Discussion avec l'IA pour créer un sujet : l'enseignant joint ses fichiers, dit ce qu'il veut, ajuste, puis utilise le brouillon. */
export default function SubjectChat({ storageKey, context, draft, onUseDraft, useLabel = 'Utiliser ce brouillon' }: {
  storageKey: string
  context?: string
  draft?: { title: string; content: string; rubric: string } | null
  onUseDraft: (d: ChatDraft) => void | Promise<void>
  useLabel?: string
}) {
  const [open, setOpen] = useState(false)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [atts, setAtts] = useState<Att[]>([])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [upBusy, setUpBusy] = useState(false)
  const [err, setErr] = useState('')
  const [using, setUsing] = useState<number | null>(null)
  const [view, setView] = useState<Record<number, 'q' | 'r' | undefined>>({})
  const endRef = useRef<HTMLDivElement>(null)

  // Conversation conservée dans l'onglet (jamais envoyée ailleurs) : un rechargement ne fait pas tout perdre.
  useEffect(() => {
    try { const raw = sessionStorage.getItem('subjchat:' + storageKey); if (raw) { const d = JSON.parse(raw); setMsgs(d.msgs ?? []); setAtts(d.atts ?? []) } } catch {}
  }, [storageKey])
  useEffect(() => {
    try { sessionStorage.setItem('subjchat:' + storageKey, JSON.stringify({ msgs: msgs.slice(-30), atts })) } catch {}
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [msgs, atts, busy, storageKey])

  async function attach(e: React.ChangeEvent<HTMLInputElement>) {
    const list = Array.from(e.target.files ?? []); e.target.value = ''
    if (!list.length) return
    setUpBusy(true); setErr('')
    try {
      const fd = new FormData(); list.forEach(f => fd.append('files', f))
      const r = await api.upload<{ files: (Att & { error?: string })[] }>('/api/subjects/chat/files', fd, 'POST', { timeoutMs: 180000 })
      const ok = r.files.filter(f => f.id) as Att[]
      const bad = r.files.filter(f => !f.id)
      setAtts(a => [...a, ...ok])
      if (bad.length) setErr(`Fichier illisible : ${bad.map(b => b.name).join(', ')}`)
    } catch (ex: unknown) { setErr(errMsg(ex) || 'Envoi du fichier impossible') } finally { setUpBusy(false) }
  }

  async function send(preset?: string) {
    const content = (preset ?? text).trim()
    if (!content || busy) return
    const next: Msg[] = [...msgs, { role: 'user', content, files: atts.map(a => a.name) }]
    setMsgs(next); setText(''); setBusy(true); setErr('')
    try {
      const r = await api.aiPost<{ reply: string; draft?: ChatDraft | null }>('/api/subjects/chat', {
        messages: next.map(m => ({ role: m.role, content: m.content })),
        file_ids: atts.map(a => a.id), context: context ?? '', draft: draft ?? null,
      })
      setMsgs([...next, { role: 'assistant', content: r.reply, draft: r.draft ?? null }])
    } catch (ex: unknown) {
      setErr(errMsg(ex) || "L'assistant est indisponible, réessayez")
      setMsgs(next)
    } finally { setBusy(false) }
  }

  const summary = (d: ChatDraft) => `${d.report.questions} question(s) notée(s)` + (d.report.blocks && d.report.blocks !== d.report.questions ? ` (${d.report.blocks} énoncés)` : '') + ' : ' + Object.entries(d.report.by_type).map(([k, v]) => `${v} ${TYPE_LABELS[k] ?? k}`).join(', ')

  return (
    <div style={{ border: '1.5px solid #bfdbfe', borderRadius: 14, background: 'var(--surface)', overflow: 'hidden', marginBottom: 18 }}>
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', background: '#eff6ff', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
        <i className="fas fa-comments" style={{ color: '#1d4ed8', fontSize: 20 }} />
        <span style={{ flex: 1 }}>
          <span style={{ display: 'block', fontWeight: 700, fontSize: 17, color: '#1e3a8a' }}>Discuter avec l&apos;IA pour créer le sujet</span>
          <span style={{ display: 'block', fontSize: 14, color: '#475569' }}>Joignez vos fichiers (cours, ancien sujet, corrigé) et dites ce que vous voulez : créer, reproduire, transformer, ajouter des questions…</span>
        </span>
        <i className={`fas fa-chevron-${open ? 'up' : 'down'}`} style={{ color: '#64748b' }} />
      </button>
      {open && (
        <div style={{ padding: 16 }}>
          <div style={{ maxHeight: 420, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, paddingRight: 4 }}>
            {msgs.length === 0 && (
              <div>
                <div style={{ fontSize: 15, color: '#475569', marginBottom: 8 }}>Par exemple :</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {IDEAS.map(i => <button key={i} type="button" onClick={() => setText(i)} style={{ padding: '7px 12px', borderRadius: 999, border: '1px solid #bfdbfe', background: '#fff', color: '#1e3a8a', fontSize: 14.5, cursor: 'pointer', textAlign: 'left' }}>{i}</button>)}
                </div>
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '92%' }}>
                <div style={{ padding: '10px 14px', borderRadius: 12, background: m.role === 'user' ? '#1d4ed8' : '#f1f5f9', color: m.role === 'user' ? '#fff' : '#0f172a', whiteSpace: 'pre-wrap', fontSize: 16, lineHeight: 1.55 }}>
                  {m.content}
                  {m.role === 'user' && m.files && m.files.length > 0 && <div style={{ fontSize: 13.5, opacity: .85, marginTop: 6 }}><i className="fas fa-paperclip" /> {m.files.join(', ')}</div>}
                </div>
                {m.draft && (
                  <div style={{ marginTop: 8, padding: '10px 14px', border: `1.5px solid ${m.draft.report.ok ? '#86efac' : '#fcd34d'}`, borderRadius: 12, background: m.draft.report.ok ? '#f0fdf4' : '#fffbeb' }}>
                    <div style={{ fontWeight: 700, fontSize: 15.5, color: '#14532d' }}><i className="fas fa-file-circle-check" style={{ marginRight: 6 }} />Brouillon prêt — {summary(m.draft)}</div>
                    {m.draft.report.requested != null && m.draft.report.requested !== m.draft.report.questions && (
                      <div style={{ fontSize: 14.5, color: '#92400e', marginTop: 4 }}>
                        Vous demandiez <b>{m.draft.report.requested}</b> questions, ce brouillon en contient <b>{m.draft.report.questions}</b>.{' '}
                        <button type="button" disabled={busy} onClick={() => send(`Ajuste le sujet pour avoir exactement ${m.draft!.report.requested} questions notées (retire ou ajoute les dernières), en gardant le même barème sur 20 points.`)} style={{ border: 'none', background: 'transparent', color: '#1d4ed8', textDecoration: 'underline', cursor: 'pointer', fontSize: 14.5 }}>Ajuster à {m.draft.report.requested}</button>
                      </div>)}
                    {(m.draft.report.reused ?? 0) > 0 && (
                      <div style={{ fontSize: 14.5, color: '#92400e', marginTop: 4 }}>
                        {m.draft.report.reused} question(s) reprennent une question de votre fichier d&apos;origine.{' '}
                        <button type="button" disabled={busy} onClick={() => send("Remplace les questions qui reprennent celles du fichier par de nouvelles questions sur d'autres points du cours, avec le même nombre total.")} style={{ border: 'none', background: 'transparent', color: '#1d4ed8', textDecoration: 'underline', cursor: 'pointer', fontSize: 14.5 }}>Les remplacer par des nouvelles</button>
                      </div>)}
                    {m.draft.report.issues.length > 0 && <div style={{ fontSize: 14, color: '#92400e', marginTop: 4 }}>À contrôler : {m.draft.report.issues.join(' ; ')}</div>}
                    {!m.draft.rubric && <div style={{ fontSize: 14, color: '#92400e', marginTop: 4 }}>Aucun barème : demandez-le-moi ou joignez le corrigé.</div>}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                      <button type="button" onClick={() => setView(v => ({ ...v, [i]: v[i] === 'q' ? undefined : 'q' }))} style={{ padding: '6px 12px', borderRadius: 8, border: '1.5px solid #86efac', background: view[i] === 'q' ? '#dcfce7' : '#fff', color: '#14532d', fontWeight: 600, fontSize: 14.5, cursor: 'pointer' }}><i className="fas fa-eye" style={{ marginRight: 6 }} />Voir les questions</button>
                      <button type="button" onClick={() => setView(v => ({ ...v, [i]: v[i] === 'r' ? undefined : 'r' }))} style={{ padding: '6px 12px', borderRadius: 8, border: '1.5px solid #86efac', background: view[i] === 'r' ? '#dcfce7' : '#fff', color: '#14532d', fontWeight: 600, fontSize: 14.5, cursor: 'pointer' }}><i className="fas fa-scale-balanced" style={{ marginRight: 6 }} />Voir le barème</button>
                    </div>
                    {view[i] === 'q' && (
                      <div style={{ marginTop: 8, maxHeight: 340, overflowY: 'auto', background: '#fff', border: '1px solid #d1fae5', borderRadius: 10, padding: '8px 12px' }}>
                        {(m.draft.report.outline ?? []).map((q, k) => (
                          <div key={k} style={{ padding: '6px 0', borderBottom: '1px solid #ecfdf5', fontSize: 15, lineHeight: 1.5 }}>
                            <b>{q.num}.</b> <span style={{ fontSize: 12.5, fontWeight: 700, color: '#1e3a8a', background: '#dbeafe', borderRadius: 999, padding: '1px 8px', marginRight: 6 }}>{TYPE_LABELS[q.type] ?? q.type}{q.items > 1 ? ` · ${q.items}` : ''}</span>{q.text}
                            {q.choices.map((c, j) => <div key={j} style={{ marginLeft: 22, color: '#475569', fontSize: 14 }}>{c}</div>)}
                          </div>
                        ))}
                        {(m.draft.report.outline ?? []).length === 0 && (
                          <pre style={{ margin: 0, fontSize: 13.5, whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{m.draft.content || 'Aucun contenu dans ce brouillon.'}</pre>
                        )}
                      </div>
                    )}
                    {view[i] === 'r' && <pre style={{ marginTop: 8, maxHeight: 340, overflow: 'auto', background: '#fff', border: '1px solid #d1fae5', borderRadius: 10, padding: '8px 12px', fontSize: 13.5, whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{m.draft.rubric || 'Aucun barème dans ce brouillon.'}</pre>}
                    <button type="button" disabled={using !== null} onClick={async () => { setUsing(i); try { await onUseDraft(m.draft!) } finally { setUsing(null) } }}
                      style={{ marginTop: 8, padding: '8px 16px', border: 'none', borderRadius: 8, background: '#059669', color: '#fff', fontWeight: 700, fontSize: 15, cursor: using !== null ? 'wait' : 'pointer' }}>
                      <i className={`fas ${using === i ? 'fa-spinner fa-spin' : 'fa-check'}`} style={{ marginRight: 6 }} />{useLabel}
                    </button>
                    <span style={{ fontSize: 13.5, color: '#475569', marginLeft: 10 }}>Vous pourrez encore tout modifier avant l&apos;enregistrement définitif.</span>
                  </div>
                )}
              </div>
            ))}
            {busy && <div style={{ alignSelf: 'flex-start', padding: '10px 14px', borderRadius: 12, background: '#f1f5f9', color: '#475569' }}><i className="fas fa-spinner fa-spin" /> L&apos;assistant réfléchit (jusqu&apos;à une minute pour un sujet complet)…</div>}
            <div ref={endRef} />
          </div>

          {atts.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
              {atts.map(a => (
                <span key={a.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 999, background: a.corrige ? '#fef3c7' : '#e0f2fe', fontSize: 14, color: '#0f172a' }}>
                  <i className={`fas ${a.corrige ? 'fa-key' : 'fa-file'}`} />{a.name}{a.corrige ? ' (corrigé)' : ''}
                  <button type="button" onClick={() => setAtts(x => x.filter(y => y.id !== a.id))} aria-label="Retirer" style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#b91c1c' }}><i className="fas fa-xmark" /></button>
                </span>
              ))}
            </div>
          )}
          {err && <div style={{ marginTop: 8, fontSize: 14.5, color: '#b91c1c' }}>{err}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'flex-end' }}>
            <label title="Joindre un fichier (Word, PDF, texte)" style={{ padding: '11px 13px', border: '1.5px solid var(--border)', borderRadius: 10, cursor: upBusy ? 'wait' : 'pointer', background: '#fff', color: '#334155' }}>
              <i className={`fas ${upBusy ? 'fa-spinner fa-spin' : 'fa-paperclip'}`} />
              <input type="file" multiple accept=".pdf,.doc,.docx,.txt,.md" onChange={attach} disabled={upBusy} style={{ display: 'none' }} />
            </label>
            <textarea value={text} onChange={e => setText(e.target.value)} rows={2} placeholder="Dites à l'IA ce que vous voulez faire de vos fichiers…"
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
              style={{ flex: 1, padding: '10px 12px', border: '1.5px solid var(--border)', borderRadius: 10, fontSize: 16, fontFamily: 'inherit', resize: 'vertical', outline: 'none', background: 'var(--background)', color: 'var(--text)' }} />
            <button type="button" onClick={() => send()} disabled={busy || !text.trim()}
              style={{ padding: '11px 18px', border: 'none', borderRadius: 10, background: busy || !text.trim() ? '#cbd5e1' : '#1d4ed8', color: '#fff', fontWeight: 700, fontSize: 16, cursor: busy ? 'wait' : 'pointer' }}>
              <i className="fas fa-paper-plane" />
            </button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 13, color: '#64748b' }}>
            <span>Entrée pour envoyer · Maj+Entrée pour un retour à la ligne</span>
            {msgs.length > 0 && <button type="button" onClick={() => { setMsgs([]); setAtts([]); setErr('') }} style={{ border: 'none', background: 'transparent', color: '#64748b', cursor: 'pointer', textDecoration: 'underline' }}>Nouvelle conversation</button>}
          </div>
        </div>
      )}
    </div>
  )
}
