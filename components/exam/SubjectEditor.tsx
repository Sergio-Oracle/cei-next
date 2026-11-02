'use client'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import api from '@/lib/api'

interface Issue { level: 'error' | 'warn'; message: string }
interface Check {
  ok: boolean; questions: number; by_type: Record<string, number>; issues: Issue[]
  hidden_lines: string[]; rubric: { missing_in_rubric: number[]; missing_in_subject: number[] } | null
}

const LINE_H = 22
const TYPE_LABEL: Record<string, string> = {
  qcm: 'QCM', qcm_multi: 'QCM à plusieurs réponses', vf: 'Vrai/Faux', open: 'Question ouverte', subopen: 'Question à sous-parties', code: 'Code',
  appariement: 'Appariement', association: 'Association', tri: 'Tri', ordre: 'Ordre', trous: 'Texte à trous', cloze: 'Texte à trous',
  zones: 'Zones', court: 'Réponse courte', numerique: 'Réponse numérique', calculee: 'Question calculée',
}

/** Éditeur du sujet ouvert depuis « Prévisualiser » : l'enseignant corrige le texte, voit en direct ce que les étudiants verront
 *  (questions lues, lignes jamais affichées, accord avec le barème) puis enregistre. L'affichage étudiant vient du même texte. */
export default function SubjectEditor({ subjectId, canEdit, reason, focusNum, focusContext, onClose, onSaved }: {
  subjectId: number; canEdit: boolean; reason?: string | null
  focusNum?: string | null; focusContext?: boolean
  onClose: () => void; onSaved: () => void
}) {
  const [title, setTitle] = useState('')
  const [orig, setOrig] = useState('')
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [check, setCheck] = useState<Check | null>(null)
  const [checking, setChecking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const taRef = useRef<HTMLTextAreaElement>(null)
  const focused = useRef(false)
  const dirty = text !== orig

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const r = await api.get<any>(`/api/subjects/${subjectId}`)
        const s = r.subject || r
        if (!alive) return
        setTitle(s.title || ''); setOrig(s.content || ''); setText(s.content || '')
      } catch (e: any) { if (alive) setErr(e?.message || 'Impossible de charger le sujet') }
      finally { if (alive) setLoading(false) }
    })()
    return () => { alive = false }
  }, [subjectId])

  // Contrôle en direct (après une courte pause de frappe) : mêmes lecteurs que l'affichage étudiant
  useEffect(() => {
    if (loading) return
    setChecking(true)
    const t = setTimeout(async () => {
      try { setCheck(await api.post<Check>('/api/subjects/check', { content: text, subject_id: subjectId })) }
      catch { setCheck(null) }
      finally { setChecking(false) }
    }, 500)
    return () => clearTimeout(t)
  }, [text, loading, subjectId])

  const lines = useMemo(() => text.split('\n'), [text])

  function select(startLine: number, endLine: number) {
    const ta = taRef.current; if (!ta) return
    let a = 0; for (let i = 0; i < startLine; i++) a += lines[i].length + 1
    let b = a; for (let i = startLine; i <= endLine; i++) b += lines[i].length + (i < endLine ? 1 : 0)
    ta.focus({ preventScroll: true }); ta.setSelectionRange(a, b)
    ta.scrollTop = Math.max(0, startLine * LINE_H - 70)
  }

  // Ouvert depuis une question (ou son énoncé) : on se place sur le bon passage
  useEffect(() => {
    if (loading || focused.current || !focusNum) return
    focused.current = true
    const re = new RegExp(`^\\s*(?:(?:Question|Q)\\.?\\s*)?${focusNum}\\s*[.:)–—-]`, 'i')
    const qi = lines.findIndex(l => re.test(l))
    if (qi < 0) return
    if (!focusContext) { select(qi, qi); return }
    let j = qi - 1; while (j >= 0 && !lines[j].trim()) j--
    const end = j; while (j >= 0 && lines[j].trim()) j--
    if (end >= 0) select(j + 1, end); else select(qi, qi)
  }, [loading]) // eslint-disable-line

  function goTo(line: string) {
    const i = lines.findIndex(l => l.trim() === line.trim())
    if (i >= 0) select(i, i)
  }

  async function save() {
    if (!canEdit || !dirty || busy) return
    const errors = (check?.issues || []).filter(i => i.level === 'error')
    if (errors.length && !window.confirm(`Le contrôle signale ${errors.length} erreur(s) :\n\n- ${errors.map(e => e.message).join('\n- ')}\n\nEnregistrer quand même ?`)) return
    setBusy(true); setErr('')
    try { await api.put(`/api/subjects/${subjectId}`, { content: text }); onSaved() }
    catch (e: any) { setErr(e?.message || "L'enregistrement a échoué"); setBusy(false) }
  }

  function close() {
    if (dirty && !window.confirm('Des modifications ne sont pas enregistrées. Fermer quand même ?')) return
    onClose()
  }

  // « N ligne(s) ne seraient affichées nulle part » : déjà détaillé dans la liste des lignes, on ne le répète pas
  const issues = (check?.issues || []).filter(i => !(check?.hidden_lines?.length && /ne seraient affichées nulle part/.test(i.message)))
  const errors = issues.filter(i => i.level === 'error')
  const warns = issues.filter(i => i.level === 'warn')
  const hidden = check?.hidden_lines || []
  const good = !!check && !errors.length && !warns.length && !hidden.length
  const tone = !check ? '#64748b' : errors.length ? '#b91c1c' : (warns.length || hidden.length) ? '#b45309' : '#047857'
  const toneBg = !check ? '#f1f5f9' : errors.length ? '#fef2f2' : (warns.length || hidden.length) ? '#fffbeb' : '#ecfdf5'

  return (
    <div role="dialog" aria-modal="true" aria-label="Modifier le sujet"
      style={{ position: 'fixed', inset: 0, zIndex: 10001, background: 'rgba(15,23,42,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }}>
      <div style={{ background: '#fff', borderRadius: 16, width: 'min(1280px, 100%)', height: 'min(900px, 100%)', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,.35)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', borderBottom: '1px solid #e2e8f0' }}>
          <i className="fas fa-pen-to-square" style={{ color: '#1d4ed8', fontSize: 20 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 18, color: '#0f172a' }}>Modifier le sujet</div>
            <div style={{ fontSize: 13.5, color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
          </div>
          <button onClick={close} aria-label="Fermer" style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#475569' }}><i className="fas fa-xmark" /></button>
        </div>

        {!canEdit && (
          <div style={{ padding: '10px 20px', background: '#fffbeb', color: '#92400e', fontSize: 14.5, borderBottom: '1px solid #fde68a' }}>
            <i className="fas fa-lock" style={{ marginRight: 8 }} />{reason || 'Ce sujet ne peut pas être modifié.'} Vous pouvez le consulter et le contrôler.
          </div>
        )}

        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 560px', minWidth: 0, display: 'flex', flexDirection: 'column', padding: 16, borderRight: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: 13.5, color: '#475569', marginBottom: 8, lineHeight: 1.5 }}>
              Une question commence par son numéro (<b>1.</b>, <b>2.</b>…), ses propositions par <b>A.</b> <b>B.</b> <b>C.</b>. Un texte placé <b>avant</b> une question s&apos;affiche comme énoncé de sa partie ;
              une ligne « Partie B — … » ouvre une nouvelle partie.
            </div>
            {loading ? <div style={{ padding: 30, color: '#64748b' }}><i className="fas fa-spinner fa-spin" /> Chargement du sujet…</div> : (
              <textarea ref={taRef} value={text} readOnly={!canEdit} onChange={e => setText(e.target.value)} spellCheck
                aria-label="Texte du sujet"
                style={{ flex: 1, minHeight: 280, resize: 'none', width: '100%', boxSizing: 'border-box', border: '1.5px solid #cbd5e1', borderRadius: 10, padding: 12,
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', fontSize: 14, lineHeight: `${LINE_H}px`, color: '#0f172a', background: canEdit ? '#fff' : '#f8fafc' }} />
            )}
            <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 6 }}>{lines.length} ligne(s){dirty ? ' · modifications non enregistrées' : ''}</div>
          </div>

          <div style={{ flex: '1 1 340px', minWidth: 0, overflowY: 'auto', padding: 16, background: '#f8fafc' }}>
            <div style={{ fontWeight: 800, fontSize: 15.5, color: '#0f172a', marginBottom: 10 }}>
              Ce que verront les étudiants {checking && <i className="fas fa-spinner fa-spin" style={{ color: '#94a3b8', marginLeft: 6 }} />}
            </div>
            {!check ? <div style={{ color: '#64748b', fontSize: 14 }}>Contrôle en cours…</div> : (
              <>
                <div style={{ background: toneBg, border: `1.5px solid ${tone}33`, color: tone, borderRadius: 12, padding: '12px 14px', fontWeight: 700, fontSize: 15, marginBottom: 12 }}>
                  <i className={`fas ${good ? 'fa-circle-check' : errors.length ? 'fa-circle-xmark' : 'fa-triangle-exclamation'}`} style={{ marginRight: 8 }} />
                  {check.questions} question{check.questions > 1 ? 's' : ''} lue{check.questions > 1 ? 's' : ''}
                  {good ? ' — rien ne manque.' : errors.length ? ' — à corriger avant l’examen.' : ' — à vérifier.'}
                  <div style={{ fontWeight: 500, fontSize: 13, marginTop: 4, color: '#475569' }}>
                    {Object.entries(check.by_type).map(([t, n]) => `${n} ${TYPE_LABEL[t] || t}`).join(' · ')}
                  </div>
                </div>

                {[...errors, ...warns].map((i, k) => (
                  <div key={k} style={{ display: 'flex', gap: 8, fontSize: 14, lineHeight: 1.5, color: '#1e293b', background: '#fff', border: `1px solid ${i.level === 'error' ? '#fecaca' : '#fde68a'}`, borderRadius: 10, padding: '9px 12px', marginBottom: 8 }}>
                    <i className={`fas ${i.level === 'error' ? 'fa-circle-xmark' : 'fa-triangle-exclamation'}`} style={{ color: i.level === 'error' ? '#b91c1c' : '#d97706', marginTop: 3 }} />
                    <span>{i.message}</span>
                  </div>
                ))}

                {hidden.length > 0 && (
                  <div style={{ marginTop: 6 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#92400e', marginBottom: 6 }}>Lignes qui ne seraient pas affichées ({hidden.length})</div>
                    {hidden.slice(0, 12).map((h, k) => (
                      <button key={k} onClick={() => goTo(h)} title="Aller à cette ligne"
                        style={{ display: 'block', width: '100%', textAlign: 'left', background: '#fff', border: '1px solid #fde68a', borderRadius: 8, padding: '7px 10px', marginBottom: 6, fontSize: 13.5, color: '#1e293b', cursor: 'pointer' }}>
                        <i className="fas fa-location-crosshairs" style={{ color: '#d97706', marginRight: 8 }} />{h.length > 140 ? h.slice(0, 140) + '…' : h}
                      </button>
                    ))}
                    <div style={{ fontSize: 13, color: '#64748b' }}>Placez ce texte avant la question concernée (énoncé) ou rattachez-le à la question.</div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 20px', borderTop: '1px solid #e2e8f0', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 220, fontSize: 13.5, color: err ? '#b91c1c' : '#64748b' }}>
            {err || 'L’enregistrement met à jour le sujet : l’aperçu se recharge, puis vous pourrez valider l’affichage.'}
          </div>
          <button onClick={close} style={{ background: '#fff', border: '1.5px solid #cbd5e1', color: '#334155', borderRadius: 10, padding: '9px 18px', fontWeight: 600, cursor: 'pointer', fontSize: 15 }}>
            {dirty ? 'Annuler' : 'Fermer'}
          </button>
          {canEdit && (
            <button onClick={save} disabled={!dirty || busy}
              style={{ background: !dirty || busy ? '#94a3b8' : '#1d4ed8', border: 'none', color: '#fff', borderRadius: 10, padding: '9px 20px', fontWeight: 700, cursor: !dirty || busy ? 'not-allowed' : 'pointer', fontSize: 15 }}>
              {busy ? <><i className="fas fa-spinner fa-spin" /> Enregistrement…</> : <><i className="fas fa-floppy-disk" style={{ marginRight: 8 }} />Enregistrer le sujet</>}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
