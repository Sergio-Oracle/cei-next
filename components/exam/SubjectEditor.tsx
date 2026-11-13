'use client'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import api from '@/lib/api'
import { errMsg } from '@/lib/errors'

interface Issue { level: 'error' | 'warn' | 'info'; message: string }
interface Row {
  num: string; kind: 'qcm' | 'qcm_multi' | 'vf' | 'auto' | 'ai'; text: string; choices: { letter: string; text: string }[]
  points: number | null; letters: string[]; value: string | null; status: 'ok' | 'warn' | 'error'; mode: 'auto' | 'ia'; suggest?: string | null
}
interface Check {
  ok: boolean; questions: number; by_type: Record<string, number>; issues: Issue[]
  hidden_lines: string[]; rubric_text: string
  grading: { rows: Row[]; total_points: number; auto_count: number; ai_count: number }
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
  const [rubricOrig, setRubricOrig] = useState('')
  const [rubric, setRubric] = useState('')
  const [tab, setTab] = useState<'sujet' | 'bareme'>('sujet')
  const [ptsRaw, setPtsRaw] = useState<Record<string, string>>({})     // points en cours de saisie : jamais corrigés pendant la frappe
  const [loading, setLoading] = useState(true)
  const [check, setCheck] = useState<Check | null>(null)
  const [checking, setChecking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const taRef = useRef<HTMLTextAreaElement>(null)
  const focused = useRef(false)
  const dirty = text !== orig || rubric !== rubricOrig
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const r = await api.get<any>(`/api/subjects/${subjectId}`)
        const s = r.subject || r
        if (!alive) return
        setTitle(s.title || ''); setOrig(s.content || ''); setText(s.content || ''); setRubricOrig(s.rubric || ''); setRubric(s.rubric || '')
      } catch (e: unknown) { if (alive) setErr(errMsg(e) || 'Impossible de charger le sujet') }
      finally { if (alive) setLoading(false) }
    })()
    return () => { alive = false }
  }, [subjectId])

  // Contrôle en direct (après une courte pause de frappe) : mêmes lecteurs que l'affichage étudiant
  useEffect(() => {
    if (loading) return
    setChecking(true)
    const t = setTimeout(async () => {
      try { setCheck(await api.post<Check>('/api/subjects/check', { content: text, rubric, subject_id: subjectId })) }
      catch { setCheck(null) }
      finally { setChecking(false) }
    }, 500)
    return () => clearTimeout(t)
  }, [text, rubric, loading, subjectId])

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

  // Bonne réponse / points modifiés dans le tableau : le serveur réécrit le barème (sans toucher aux autres questions) et renvoie le contrôle
  async function edit(num: string, ed: { letters?: string[]; value?: string; points?: number }) {
    if (!canEdit) return
    try {
      const r = await api.post<Check>('/api/subjects/check', { content: text, rubric, subject_id: subjectId, edits: { [num]: ed } })
      setRubric(r.rubric_text); setCheck(r)
    } catch (e: unknown) { setErr(errMsg(e) || 'Modification impossible') }
  }
  function commitPoints(num: string) {
    const raw = ptsRaw[num]; if (raw === undefined) return
    const v = parseFloat(raw.replace(',', '.'))
    setPtsRaw(p => { const { [num]: _x, ...rest } = p; return rest })
    if (!isFinite(v) || v < 0) return
    edit(num, { points: v })
  }

  async function save() {
    if (!canEdit || !dirty || busy) return
    const errors = (check?.issues || []).filter(i => i.level === 'error')
    if (errors.length && !window.confirm(`Le contrôle signale ${errors.length} erreur(s) :\n\n- ${errors.map(e => e.message).join('\n- ')}\n\nEnregistrer quand même ?`)) return
    setBusy(true); setErr('')
    try { await api.put(`/api/subjects/${subjectId}`, { content: text, rubric }); onSaved() }
    catch (e: unknown) { setErr(errMsg(e) || "L'enregistrement a échoué"); setBusy(false) }
  }

  function close() {
    if (dirty && !window.confirm('Des modifications ne sont pas enregistrées. Fermer quand même ?')) return
    onClose()
  }

  // « N ligne(s) ne seraient affichées nulle part » : déjà détaillé dans la liste des lignes, on ne le répète pas
  const issues = (check?.issues || []).filter(i => !(check?.hidden_lines?.length && /ne seraient affichées nulle part/.test(i.message)))
  const errors = issues.filter(i => i.level === 'error')
  const gradingErrors = (check?.grading?.rows || []).filter(r => r.status === 'error').length
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

        {/* Corps : deux colonnes qui défilent chacune dans la hauteur de la fenêtre (sur petit écran : une colonne, le corps défile) */}
        <style>{`@media (max-width: 900px){ .se-body{flex-direction:column!important;overflow-y:auto!important} .se-body>div{flex:none!important;overflow:visible!important;border-right:none!important} .se-scroll{overflow:visible!important} }`}</style>
        <div className="se-body" style={{ flex: 1, minHeight: 0, display: 'flex', flexWrap: 'nowrap', overflow: 'hidden' }}>
          <div style={{ flex: '1 1 60%', minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', padding: 16, borderRight: '1px solid #e2e8f0', overflow: 'hidden' }}>
            <div role="tablist" style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
              {([['sujet', 'fa-file-lines', 'Texte du sujet'], ['bareme', 'fa-list-check', 'Barème et réponses']] as const).map(([k, ic, lab]) => (
                <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
                  style={{ border: '1.5px solid ' + (tab === k ? '#1d4ed8' : '#cbd5e1'), background: tab === k ? '#eff6ff' : '#fff', color: tab === k ? '#1d4ed8' : '#334155',
                    borderRadius: 10, padding: '7px 14px', fontWeight: 700, fontSize: 14.5, cursor: 'pointer' }}>
                  <i className={`fas ${ic}`} style={{ marginRight: 8 }} />{lab}
                  {k === 'bareme' && gradingErrors > 0 && <span style={{ marginLeft: 8, background: '#b91c1c', color: '#fff', borderRadius: 10, padding: '1px 7px', fontSize: 12.5 }}>{gradingErrors}</span>}
                </button>
              ))}
            </div>
            {tab === 'sujet' ? (<>
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
            </>) : (
              <div className="se-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: 4 }}>
                <div style={{ fontSize: 13.5, color: '#475569', marginBottom: 10, lineHeight: 1.5 }}>
                  La <b>correction</b> lit la bonne réponse et les points ci-dessous. Une question sans bonne réponse n&apos;est <b>pas notée automatiquement</b>.
                  Après avoir déplacé ou modifié des propositions, vérifiez la bonne réponse de la question.
                </div>
                {!check ? <div style={{ color: '#64748b' }}>Chargement…</div> : !check.grading ? <div style={{ color: '#b45309' }}>Le contrôle du barème n&apos;est pas disponible sur ce serveur.</div> : (
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: 10 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '46px 1fr 190px 84px 28px', gap: 8, padding: '8px 10px', background: '#f1f5f9', fontWeight: 700, fontSize: 13, color: '#475569', position: 'sticky', top: 0, zIndex: 2 }}>
                      <span>N°</span><span>Question</span><span>Bonne réponse</span><span>Points</span><span />
                    </div>
                    {check.grading.rows.map(r => (
                      <div key={r.num} style={{ display: 'grid', gridTemplateColumns: '46px 1fr 190px 84px 28px', gap: 8, alignItems: 'center', padding: '8px 10px', borderTop: '1px solid #e2e8f0',
                        background: r.status === 'error' ? '#fef2f2' : r.status === 'warn' ? '#fffbeb' : '#fff' }}>
                        <b style={{ color: '#0f172a' }}>Q{r.num}</b>
                        <span style={{ fontSize: 13.5, color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.text}>{r.text.replace(/^Q\d+\.\s*/, '')}</span>
                        <span>
                          {r.kind === 'qcm' && (
                            <select aria-label={`Bonne réponse de la question ${r.num}`} disabled={!canEdit} value={r.letters[0] || ''} onChange={e => edit(r.num, { letters: e.target.value ? [e.target.value] : [] })}
                              style={{ width: '100%', padding: '6px 8px', borderRadius: 8, border: '1.5px solid ' + (r.status === 'error' ? '#fca5a5' : '#cbd5e1'), fontSize: 14, background: '#fff' }}>
                              <option value="">— choisir —</option>
                              {r.choices.map(c => <option key={c.letter} value={c.letter}>{c.letter}. {c.text.slice(0, 40)}</option>)}
                            </select>
                          )}
                          {r.kind === 'qcm_multi' && (
                            <span style={{ display: 'inline-flex', gap: 8, flexWrap: 'wrap' }}>
                              {r.choices.map(c => (
                                <label key={c.letter} style={{ fontSize: 14, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                  <input type="checkbox" disabled={!canEdit} checked={r.letters.includes(c.letter)}
                                    onChange={e => edit(r.num, { letters: e.target.checked ? [...r.letters, c.letter].sort() : r.letters.filter(x => x !== c.letter) })} />{c.letter}
                                </label>
                              ))}
                            </span>
                          )}
                          {r.kind === 'vf' && (
                            <select aria-label={`Réponse de la question ${r.num}`} disabled={!canEdit} value={r.value || ''} onChange={e => e.target.value && edit(r.num, { value: e.target.value })}
                              style={{ width: '100%', padding: '6px 8px', borderRadius: 8, border: '1.5px solid ' + (r.status === 'error' ? '#fca5a5' : '#cbd5e1'), fontSize: 14, background: '#fff' }}>
                              <option value="">— choisir —</option><option value="Vrai">Vrai</option><option value="Faux">Faux</option>
                            </select>
                          )}
                          {r.kind === 'auto' && <span style={{ fontSize: 13, color: '#64748b' }}>Réponse lue dans le barème</span>}
                          {r.kind === 'ai' && <span style={{ fontSize: 13, color: '#64748b' }}>Corrigée par l&apos;IA</span>}
                        </span>
                        <input aria-label={`Points de la question ${r.num}`} inputMode="decimal" disabled={!canEdit}
                          value={ptsRaw[r.num] ?? (r.points == null ? '' : String(r.points).replace('.', ','))} placeholder="—"
                          onChange={e => setPtsRaw(p => ({ ...p, [r.num]: e.target.value }))} onBlur={() => commitPoints(r.num)}
                          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                          style={{ width: '100%', padding: '6px 8px', borderRadius: 8, border: '1.5px solid ' + (r.points == null ? '#fca5a5' : '#cbd5e1'), fontSize: 14, textAlign: 'right', boxSizing: 'border-box' }} />
                        <i className={`fas ${r.status === 'ok' ? 'fa-circle-check' : r.status === 'warn' ? 'fa-triangle-exclamation' : 'fa-circle-xmark'}`}
                          style={{ color: r.status === 'ok' ? '#047857' : r.status === 'warn' ? '#d97706' : '#b91c1c' }} />
                        {r.suggest && canEdit && (
                          <button onClick={() => edit(r.num, { letters: [r.suggest as string] })}
                            style={{ gridColumn: '2 / 6', justifySelf: 'start', background: '#fff', border: '1.5px solid #1d4ed8', color: '#1d4ed8', borderRadius: 8, padding: '4px 10px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                            <i className="fas fa-wand-magic-sparkles" style={{ marginRight: 6 }} />La proposition a changé de place : mettre la bonne réponse sur {r.suggest}
                          </button>
                        )}
                      </div>
                    ))}
                    <div style={{ padding: '9px 12px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', fontSize: 13.5, color: '#334155' }}>
                      <b>Total : {String(check.grading.total_points).replace('.', ',')} points</b> (ramenés sur 20) · {check.grading.auto_count} question(s) corrigée(s) automatiquement · {check.grading.ai_count}{' '}par l&apos;IA
                    </div>
                  </div>
                )}
                <details style={{ marginTop: 14 }}>
                  <summary style={{ cursor: 'pointer', fontWeight: 700, color: '#1d4ed8', fontSize: 14.5 }}>Modifier le texte du barème (avancé)</summary>
                  <textarea value={rubric} readOnly={!canEdit} onChange={e => setRubric(e.target.value)} aria-label="Texte du barème" spellCheck={false}
                    style={{ width: '100%', boxSizing: 'border-box', minHeight: 220, marginTop: 8, border: '1.5px solid #cbd5e1', borderRadius: 10, padding: 12, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', fontSize: 13.5, lineHeight: '20px', color: '#0f172a' }} />
                </details>
              </div>
            )}
          </div>

          <div style={{ flex: '1 1 40%', minWidth: 300, minHeight: 0, overflowY: 'auto', padding: 16, background: '#f8fafc' }}>
            <div style={{ fontWeight: 800, fontSize: 15.5, color: '#0f172a', marginBottom: 10 }}>
              Contrôle : affichage et correction {checking && <i className="fas fa-spinner fa-spin" style={{ color: '#94a3b8', marginLeft: 6 }} />}
            </div>
            {!check ? <div style={{ color: '#64748b', fontSize: 14 }}>Contrôle en cours…</div> : (
              <>
                <div style={{ background: toneBg, border: `1.5px solid ${tone}33`, color: tone, borderRadius: 12, padding: '12px 14px', fontWeight: 700, fontSize: 15, marginBottom: 12 }}>
                  <i className={`fas ${good ? 'fa-circle-check' : errors.length ? 'fa-circle-xmark' : 'fa-triangle-exclamation'}`} style={{ marginRight: 8 }} />
                  {check.questions} question{check.questions > 1 ? 's' : ''} lue{check.questions > 1 ? 's' : ''} par les étudiants
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
