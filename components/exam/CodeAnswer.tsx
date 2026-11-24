'use client'

/**
 * Réponse à une question « Maths / Programmation » : l'éditeur + (si la question a des tests automatiques) les tests d'exemple et le bouton « Tester mon code »,
 * comme CodeRunner / Moodle. Les tests CACHÉS ne sont jamais envoyés à l'étudiant : ils sont exécutés à la correction avec les tests visibles.
 * Sans tests (question corrigée par l'IA ou le professeur), seul l'éditeur est affiché.
 */
import React, { useEffect, useState } from 'react'
import api from '@/lib/api'
import MathCodeEditor, { type EditorLang } from '@/components/exam/MathCodeEditor'

type Info = { lang: EditorLang; tests: { n: number; kind: string; input: string; expected: string }[]; hidden: number }
type Result = { n: number; ok: boolean; status: string; kind: string; input: string; expected: string; got: string; stderr: string }
type Outcome = { results: Result[]; passed: number; total: number; hidden: number; empty?: boolean }

const CACHE = new Map<number, Promise<{ enabled: boolean; questions: Record<string, Info> } | null>>()
function loadInfo(attemptId: number) {
  if (!CACHE.has(attemptId)) CACHE.set(attemptId, api.get<{ enabled: boolean; questions: Record<string, Info> }>(`/api/exam_attempts/${attemptId}/code_info`).catch(() => null))
  return CACHE.get(attemptId)!
}

const STATUS_TEXT: Record<string, string> = {
  timeout: "Temps d'exécution dépassé : votre programme met trop de temps (boucle infinie ?).",
  memory: 'Mémoire insuffisante : votre programme utilise trop de mémoire.',
  output: 'Trop de texte affiché par votre programme.',
  runtime_error: "Votre programme s'est arrêté sur une erreur.",
  compile_error: 'Erreur de compilation : le programme ne peut pas être exécuté.',
}

export default function CodeAnswer({ attemptId, num, value, onChange, borderColor }: { attemptId?: number | null; num: string; value: string; onChange: (v: string) => void; borderColor?: string }) {
  const [info, setInfo] = useState<Info | null>(null)
  const [enabled, setEnabled] = useState(false)
  const [running, setRunning] = useState(false)
  const [out, setOut] = useState<Outcome | null>(null)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (!attemptId) return
    let off = false
    loadInfo(attemptId).then(d => { if (!off && d) { setEnabled(d.enabled); setInfo(d.questions?.[num] ?? null) } })
    return () => { off = true }
  }, [attemptId, num])

  async function run() {
    if (!attemptId || running) return
    setRunning(true); setMsg(''); setOut(null)
    try {
      const r = await api.post<Outcome & { success: boolean }>(`/api/exam_attempts/${attemptId}/code_run`, { num, code: value })
      setOut(r)
    } catch (e: any) {
      const code = e?.data?.error
      setMsg(code === 'busy' ? 'Un test est déjà en cours : patientez quelques secondes.'
        : code === 'too_long' ? 'Votre programme est trop long pour être testé.'
        : "Le test n'est pas disponible pour le moment. Votre code est bien enregistré : il sera évalué à la correction.")
    } finally { setRunning(false) }
  }

  const hasTests = !!info && enabled
  const mono: React.CSSProperties = { fontFamily: "ui-monospace,'Cascadia Mono',Menlo,Consolas,monospace", whiteSpace: 'pre-wrap', wordBreak: 'break-word' }
  return (
    <div>
      <MathCodeEditor value={value} onChange={onChange} rows={10} borderColor={borderColor}
        lang={info?.lang ?? 'latex'} fixedLang={!!info} ariaLabel={`Réponse à la question ${num}`} storageKey={`cei:codelang:${num}`}
        placeholder={`Rédigez votre réponse (code / démonstration) à la question ${num}…`} />
      {hasTests && info && (
        <div style={{ marginTop: 12, border: '1.5px solid #e2e8f0', borderRadius: 10, background: '#fff', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', padding: '10px 14px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
            <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 15.5 }}>Tests d&apos;exemple</div>
            <button type="button" onClick={run} disabled={running || !value.trim()} title={!value.trim() ? 'Écrivez votre code pour le tester' : ''}
              style={{ padding: '8px 18px', border: 'none', borderRadius: 8, background: running || !value.trim() ? '#94a3b8' : '#059669', color: '#fff', fontWeight: 700, fontSize: 15, cursor: running || !value.trim() ? 'default' : 'pointer' }}>
              {running ? 'Test en cours…' : 'Tester mon code'}
            </button>
          </div>
          <div style={{ padding: '8px 14px', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14.5 }}>
              <thead><tr style={{ textAlign: 'left', color: '#64748b' }}><th style={{ padding: '4px 8px', width: 36 }}>N°</th><th style={{ padding: '4px 8px' }}>{info.tests[0]?.kind === 'call' ? 'Appel' : 'Entrée'}</th><th style={{ padding: '4px 8px' }}>Résultat attendu</th><th style={{ padding: '4px 8px', width: 120, whiteSpace: 'nowrap' }}>Votre code</th></tr></thead>
              <tbody>
                {info.tests.map(t => {
                  const r = out?.results.find(x => x.n === t.n)
                  return (
                    <tr key={t.n} style={{ borderTop: '1px solid #f1f5f9', verticalAlign: 'top' }}>
                      <td style={{ padding: '6px 8px', color: '#64748b' }}>{t.n}</td>
                      <td style={{ padding: '6px 8px', ...mono }}>{t.input || '—'}</td>
                      <td style={{ padding: '6px 8px', ...mono }}>{t.expected}</td>
                      <td style={{ padding: '6px 8px', whiteSpace: 'nowrap', fontWeight: 700, color: r ? (r.ok ? '#059669' : '#dc2626') : '#94a3b8' }}>{r ? (r.ok ? '✔ Réussi' : '✘ Échec') : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {info.hidden > 0 && <div style={{ fontSize: 13.5, color: '#64748b', marginTop: 6 }}>{info.hidden} autre{info.hidden > 1 ? 's' : ''} test{info.hidden > 1 ? 's' : ''} {info.hidden > 1 ? 'seront évalués' : 'sera évalué'} à la correction.</div>}
          </div>
          {msg && <div style={{ padding: '10px 14px', background: '#fffbeb', color: '#92400e', borderTop: '1px solid #fde68a', fontSize: 14.5 }}>{msg}</div>}
          {out && (
            <div style={{ padding: '10px 14px', borderTop: '1px solid #e2e8f0' }}>
              <div style={{ fontWeight: 700, color: out.passed === out.total && out.total > 0 ? '#059669' : '#b45309', marginBottom: 6 }}>
                {out.empty ? 'Écrivez votre code avant de le tester.' : `${out.passed} test${out.passed > 1 ? 's' : ''} réussi${out.passed > 1 ? 's' : ''} sur ${out.total}`}
              </div>
              {out.results.filter(r => !r.ok).map(r => (
                <div key={r.n} style={{ marginBottom: 8, padding: '8px 10px', border: '1px solid #fecaca', background: '#fef2f2', borderRadius: 8, fontSize: 14 }}>
                  <div style={{ fontWeight: 700, color: '#991b1b' }}>Test {r.n} : {STATUS_TEXT[r.status] ?? 'résultat différent de celui attendu'}</div>
                  {r.status === 'ok' && <div style={{ marginTop: 4 }}><span style={{ color: '#64748b' }}>Votre programme affiche : </span><span style={mono}>{r.got || '(rien)'}</span></div>}
                  {r.stderr && <pre style={{ ...mono, margin: '6px 0 0', padding: 8, background: '#fff', border: '1px solid #fecaca', borderRadius: 6, maxHeight: 140, overflow: 'auto', fontSize: 12.5 }}>{r.stderr}</pre>}
                </div>
              ))}
              {out.hidden > 0 && <div style={{ fontSize: 13.5, color: '#64748b' }}>Les {out.hidden} test{out.hidden > 1 ? 's' : ''} caché{out.hidden > 1 ? 's' : ''} ne sont pas exécutés ici.</div>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
