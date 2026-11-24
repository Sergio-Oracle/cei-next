'use client'

/**
 * Correction des questions de code d'une copie (enseignant / responsable d'examen) : exécute TOUS les tests (visibles et cachés) sur la réponse de
 * l'étudiant, DANS CE NAVIGATEUR (enceinte isolée), enregistre le résultat et met à jour la note de la question — l'enseignant peut ensuite la modifier
 * dans « Détail par question ». L'IA relit le code pour les langages qu'un navigateur ne peut pas exécuter (Java, C, C++, PHP).
 */
import React, { useEffect, useState } from 'react'
import { useToast } from '@/contexts/ToastContext'
import { errMsg } from '@/lib/errors'
import { gradeQuestionInBrowser, loadStaffCode, type GradedResponse, type StaffCodeQuestion } from '@/lib/codeGrading'
import { STATUS_TEXT } from '@/lib/codeTests'

type Row = { n: number; hidden: boolean; ok: boolean; status: string; got: string; expected: string; stderr: string }
const mono: React.CSSProperties = { fontFamily: "ui-monospace,'Cascadia Mono',Menlo,Consolas,monospace", whiteSpace: 'pre-wrap', wordBreak: 'break-word' }

export default function CodeGradingPanel({ attemptId, onGraded }: { attemptId: number; onGraded?: (r: GradedResponse) => void }) {
  const { success, error } = useToast()
  const [qs, setQs] = useState<StaffCodeQuestion[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [rows, setRows] = useState<Record<string, Row[]>>({})
  const [sum, setSum] = useState<Record<string, string>>({})

  useEffect(() => {
    let off = false
    loadStaffCode(attemptId).then(d => {
      if (off) return
      setQs(d.questions)
      const r: Record<string, Row[]> = {}, s: Record<string, string> = {}
      d.questions.forEach(q => { if (q.saved) { r[q.num] = q.saved.detail; s[q.num] = q.saved.summary } })
      setRows(r); setSum(s)
    }).catch(() => setQs([]))
    return () => { off = true }
  }, [attemptId])

  if (!qs || qs.length === 0) return null

  async function run(q: StaffCodeQuestion) {
    setBusy(q.num); setRows(p => ({ ...p, [q.num]: [] }))
    try {
      const r = await gradeQuestionInBrowser(attemptId, q, (res) => setRows(p => ({ ...p, [q.num]: [...(p[q.num] ?? []), { n: res.n, hidden: !!q.tests.find(t => t.n === res.n)?.hidden, ok: res.ok, status: res.status, got: res.got, expected: res.expected, stderr: res.stderr }] })))
      setRows(p => ({ ...p, [q.num]: r.detail }))
      setSum(p => ({ ...p, [q.num]: r.summary }))
      success(`Question ${q.num} : ${r.summary}`)
      onGraded?.(r)
    } catch (e) {
      error(errMsg(e) || "Les tests n'ont pas pu être exécutés")
      loadStaffCode(attemptId).then(d => setQs(d.questions)).catch(() => {})      // la réponse de l'étudiant a pu changer (sauvegarde automatique) : on relit la version actuelle
    }
    finally { setBusy(null) }
  }

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', marginBottom: 20 }}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', background: '#ecfeff', fontWeight: 700, fontSize: 17, color: '#155e75' }}>
        <i className="fas fa-vial" style={{ marginRight: 8 }} />Tests du code de l&apos;étudiant
      </div>
      <div style={{ padding: '14px 20px', display: 'grid', gap: 16 }}>
        {qs.map(q => {
          const r = rows[q.num] ?? []
          return (
            <div key={q.num} style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', padding: '10px 14px', background: '#f8fafc' }}>
                <div style={{ fontWeight: 700, color: '#0f172a' }}>Question {q.num} <span style={{ color: '#64748b', fontWeight: 500 }}>· {q.lang}</span>
                  {sum[q.num] && <span style={{ marginLeft: 10, color: '#059669' }}>{sum[q.num]}</span>}</div>
                {q.runnable ? (
                  <button type="button" onClick={() => run(q)} disabled={busy !== null || q.empty}
                    style={{ padding: '7px 16px', border: 'none', borderRadius: 8, background: busy !== null || q.empty ? '#94a3b8' : '#0e7490', color: '#fff', fontWeight: 700, cursor: busy !== null || q.empty ? 'default' : 'pointer' }}>
                    {busy === q.num ? 'Exécution…' : (sum[q.num] ? 'Relancer les tests' : 'Exécuter les tests')}
                  </button>
                ) : <span style={{ fontSize: 14, color: '#64748b' }}>Langage non exécutable dans le navigateur : à relire.</span>}
              </div>
              {q.empty && <div style={{ padding: '10px 14px', color: '#64748b' }}>L&apos;étudiant n&apos;a pas rédigé de code (0 à cette question).</div>}
              {r.length > 0 && (
                <div style={{ padding: '8px 14px', overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                    <thead><tr style={{ textAlign: 'left', color: '#64748b' }}><th style={{ padding: '4px 8px' }}>Test</th><th style={{ padding: '4px 8px' }}>Attendu</th><th style={{ padding: '4px 8px' }}>Obtenu</th><th style={{ padding: '4px 8px' }}>Résultat</th></tr></thead>
                    <tbody>
                      {r.map(x => (
                        <tr key={x.n} style={{ borderTop: '1px solid #f1f5f9', verticalAlign: 'top' }}>
                          <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>{x.n}{x.hidden && <span style={{ marginLeft: 6, fontSize: 12, color: '#7c2d12', background: '#ffedd5', padding: '1px 6px', borderRadius: 99 }}>caché</span>}</td>
                          <td style={{ padding: '6px 8px', ...mono }}>{x.expected}</td>
                          <td style={{ padding: '6px 8px', ...mono }}>{x.status === 'ok' ? (x.got || '(rien)') : (STATUS_TEXT[x.status] ?? '')}{x.stderr && <div style={{ color: '#991b1b', fontSize: 12.5 }}>{x.stderr.split('\n').slice(-3).join('\n')}</div>}</td>
                          <td style={{ padding: '6px 8px', fontWeight: 700, color: x.ok ? '#059669' : '#dc2626', whiteSpace: 'nowrap' }}>{x.ok ? '✔ Réussi' : '✘ Échec'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
