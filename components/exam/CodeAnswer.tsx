'use client'

/**
 * Réponse à une question « Maths / Programmation » : l'éditeur + (si la question a des tests automatiques) les tests d'exemple et le bouton « Tester mon code »,
 * comme CodeRunner / Moodle. Le code s'exécute DANS le navigateur de l'étudiant (lib/codeRunner.ts : enceinte isolée, sans réseau). Les tests CACHÉS ne sont jamais
 * envoyés à l'étudiant : l'enseignant les exécute à la correction avec les tests visibles (components/exam/CodeGradingPanel.tsx).
 * Sans tests (question corrigée par l'IA ou le professeur), seul l'éditeur est affiché.
 */
import React, { useEffect, useRef, useState } from 'react'
import api from '@/lib/api'
import MathCodeEditor, { type EditorLang } from '@/components/exam/MathCodeEditor'
import { runTests } from '@/lib/codeRunner'
import { STATUS_TEXT, type CodeTest, type TestResult } from '@/lib/codeTests'

type Info = { lang: EditorLang; runnable: boolean; tests: CodeTest[]; hidden: number }

const CACHE = new Map<number, Promise<{ questions: Record<string, Info> } | null>>()
function loadInfo(attemptId: number) {
  if (!CACHE.has(attemptId)) CACHE.set(attemptId, api.get<{ questions: Record<string, Info> }>(`/api/exam_attempts/${attemptId}/code_info`).catch(() => null))
  return CACHE.get(attemptId)!
}

export default function CodeAnswer({ attemptId, num, value, onChange, borderColor }: { attemptId?: number | null; num: string; value: string; onChange: (v: string) => void; borderColor?: string }) {
  const [info, setInfo] = useState<Info | null>(null)
  const [running, setRunning] = useState(false)
  const [results, setResults] = useState<TestResult[] | null>(null)
  const [msg, setMsg] = useState('')
  const alive = useRef(true)

  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  useEffect(() => {
    if (!attemptId) return
    let off = false
    loadInfo(attemptId).then(d => { if (!off && d) setInfo(d.questions?.[num] ?? null) })
    return () => { off = true }
  }, [attemptId, num])

  // Le code s'exécute DANS ce navigateur (enceinte isolée, sans réseau) : rien n'est envoyé à nos serveurs pour le tester.
  async function run() {
    if (!info || running) return
    setRunning(true); setMsg(''); setResults([])
    try {
      const all = await runTests(info.lang, value, info.tests, (r) => { if (alive.current) setResults(prev => [...(prev ?? []), r]) })
      if (!alive.current) return
      if (all.length && all.every(r => r.status === 'unavailable')) {
        setResults(null)
        setMsg("Le test n'est pas disponible sur cet appareil pour le moment. Votre code est bien enregistré : il sera évalué à la correction.")
      }
    } catch {
      if (alive.current) { setResults(null); setMsg("Le test n'est pas disponible sur cet appareil pour le moment. Votre code est bien enregistré : il sera évalué à la correction.") }
    } finally { if (alive.current) setRunning(false) }
  }

  const passed = (results ?? []).filter(r => r.ok).length
  const total = info?.tests.length ?? 0
  const done = !running && results !== null && results.length > 0
  const hasTests = !!info && info.tests.length > 0
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
            {info.runnable && (
              <button type="button" onClick={run} disabled={running || !value.trim()} title={!value.trim() ? 'Écrivez votre code pour le tester' : ''}
                style={{ padding: '8px 18px', border: 'none', borderRadius: 8, background: running || !value.trim() ? '#94a3b8' : '#059669', color: '#fff', fontWeight: 700, fontSize: 15, cursor: running || !value.trim() ? 'default' : 'pointer' }}>
                {running ? 'Test en cours…' : 'Tester mon code'}
              </button>
            )}
          </div>
          <div style={{ padding: '8px 14px', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14.5 }}>
              <thead><tr style={{ textAlign: 'left', color: '#64748b' }}><th style={{ padding: '4px 8px', width: 36 }}>N°</th><th style={{ padding: '4px 8px' }}>{info.tests[0]?.kind === 'call' ? 'Appel' : 'Entrée'}</th><th style={{ padding: '4px 8px' }}>Résultat attendu</th><th style={{ padding: '4px 8px', width: 120, whiteSpace: 'nowrap' }}>Votre code</th></tr></thead>
              <tbody>
                {info.tests.map(t => {
                  const r = results?.find(x => x.n === t.n)
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
            {running && <div style={{ fontSize: 13.5, color: '#64748b', marginTop: 6 }}>Exécution sur votre appareil… la première fois, la préparation peut prendre quelques secondes.</div>}
            {!info.runnable && <div style={{ fontSize: 13.5, color: '#64748b', marginTop: 6 }}>Ce programme ne peut pas être exécuté ici : il sera testé et relu à la correction.</div>}
            {info.hidden > 0 && <div style={{ fontSize: 13.5, color: '#64748b', marginTop: 6 }}>{info.hidden} autre{info.hidden > 1 ? 's' : ''} test{info.hidden > 1 ? 's' : ''} {info.hidden > 1 ? 'seront évalués' : 'sera évalué'} à la correction.</div>}
          </div>
          {msg && <div style={{ padding: '10px 14px', background: '#fffbeb', color: '#92400e', borderTop: '1px solid #fde68a', fontSize: 14.5 }}>{msg}</div>}
          {done && (
            <div style={{ padding: '10px 14px', borderTop: '1px solid #e2e8f0' }}>
              <div style={{ fontWeight: 700, color: passed === total && total > 0 ? '#059669' : '#b45309', marginBottom: 6 }}>
                {`${passed} test${passed > 1 ? 's' : ''} réussi${passed > 1 ? 's' : ''} sur ${total}`}
              </div>
              {(results ?? []).filter(r => !r.ok).map(r => (
                <div key={r.n} style={{ marginBottom: 8, padding: '8px 10px', border: '1px solid #fecaca', background: '#fef2f2', borderRadius: 8, fontSize: 14 }}>
                  <div style={{ fontWeight: 700, color: '#991b1b' }}>Test {r.n} : {STATUS_TEXT[r.status] ?? 'résultat différent de celui attendu'}</div>
                  {r.status === 'ok' && <div style={{ marginTop: 4 }}><span style={{ color: '#64748b' }}>Votre programme affiche : </span><span style={mono}>{r.got || '(rien)'}</span></div>}
                  {r.stderr && <pre style={{ ...mono, margin: '6px 0 0', padding: 8, background: '#fff', border: '1px solid #fecaca', borderRadius: 6, maxHeight: 140, overflow: 'auto', fontSize: 12.5 }}>{r.stderr}</pre>}
                </div>
              ))}
              {info.hidden > 0 && <div style={{ fontSize: 13.5, color: '#64748b' }}>Les {info.hidden} test{info.hidden > 1 ? 's' : ''} caché{info.hidden > 1 ? 's' : ''} ne sont pas exécutés ici.</div>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
