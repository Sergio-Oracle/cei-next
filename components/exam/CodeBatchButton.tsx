'use client'

/**
 * Exécution groupée des tests de code d'un examen : pour chaque copie rendue dont des questions de code n'ont pas encore de résultat,
 * les tests (visibles + cachés) sont exécutés dans CE navigateur, l'un après l'autre, et la note de chaque question est mise à jour.
 * Jamais d'exécution sur nos serveurs ; la page reste utilisable et l'opération peut être arrêtée à tout moment.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react'
import api from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'
import { gradeQuestionInBrowser, loadStaffCode } from '@/lib/codeGrading'

type Pending = { has_code: boolean; total: number; attempts: { attempt_id: number; student_name: string; questions: string[] }[] }

export default function CodeBatchButton({ examId, onDone }: { examId: number; onDone?: () => void }) {
  const { success, error } = useToast()
  const [pending, setPending] = useState<Pending | null>(null)
  const [prog, setProg] = useState<{ i: number; n: number; name: string } | null>(null)
  const stop = useRef(false)

  const refresh = useCallback(() => {
    api.get<Pending>(`/api/online_exams/${examId}/code_pending`).then(setPending).catch(() => setPending(null))
  }, [examId])
  useEffect(() => { refresh() }, [refresh])

  if (!pending || !pending.has_code) return null
  const running = prog !== null

  async function runAll() {
    if (!pending || running) return
    stop.current = false
    const list = pending.attempts
    let okQ = 0, koQ = 0
    for (let i = 0; i < list.length && !stop.current; i++) {
      const a = list[i]
      setProg({ i: i + 1, n: list.length, name: a.student_name })
      try {
        const d = await loadStaffCode(a.attempt_id)
        for (const q of d.questions) {
          if (stop.current) break
          if (!q.runnable || q.empty || !a.questions.includes(q.num)) continue
          try { await gradeQuestionInBrowser(a.attempt_id, q); okQ++ } catch { koQ++ }
        }
      } catch { koQ++ }
    }
    setProg(null)
    refresh(); onDone?.()
    if (koQ) error(`${okQ} question(s) de code testée(s), ${koQ} n'ont pas pu l'être (relancez ou ouvrez la copie).`)
    else success(`${okQ} question(s) de code testée(s) et notée(s).`)
  }

  if (pending.total === 0 && !running) return null
  return (
    <>
      <button onClick={runAll} disabled={running}
        style={{ padding: '8px 14px', background: running ? '#67e8f9' : '#0e7490', color: 'white', border: 'none', borderRadius: 8, fontWeight: 600, cursor: running ? 'not-allowed' : 'pointer', fontSize: 15.5, display: 'flex', alignItems: 'center', gap: 6 }}>
        {running ? <><i className="fas fa-spinner fa-spin" />Copie {prog!.i}/{prog!.n} — {prog!.name}</> : <><i className="fas fa-vial" />Tester le code ({pending.total} copie{pending.total > 1 ? 's' : ''})</>}
      </button>
      {running && (
        <button onClick={() => { stop.current = true }}
          style={{ padding: '8px 14px', background: '#fff', color: '#0e7490', border: '1.5px solid #0e7490', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 15.5 }}>
          Arrêter
        </button>
      )}
    </>
  )
}
