/**
 * Exécution des tests de code d'une copie par l'enseignant / le responsable d'examen, DANS SON NAVIGATEUR (jamais sur nos serveurs),
 * puis enregistrement des sorties obtenues : le serveur recalcule le verdict de chaque test et met la note à jour (routes/code_run.py).
 * Le code de l'étudiant est exécuté dans l'enceinte isolée de lib/codeRunner.ts : sans accès à la session de l'enseignant ni au réseau.
 */
import api from '@/lib/api'
import { runTests } from '@/lib/codeRunner'
import type { CodeTest, TestResult } from '@/lib/codeTests'

export type StaffCodeQuestion = {
  num: string; lang: string; runnable: boolean; all_or_nothing: boolean; code: string; code_sha: string; empty: boolean
  tests: CodeTest[]
  saved: { fraction: number; summary: string; run_at: string | null; detail: { n: number; hidden: boolean; ok: boolean; status: string; got: string; expected: string; stderr: string }[] } | null
}
export type GradedResponse = { success: boolean; fraction: number; summary: string; score: number | null; question_scores: any[]; detail: any[] }

export const loadStaffCode = (attemptId: number) => api.get<{ attempt_id: number; questions: StaffCodeQuestion[] }>(`/api/exam_attempts/${attemptId}/code_tests`)

export async function gradeQuestionInBrowser(attemptId: number, q: StaffCodeQuestion, onEach?: (r: TestResult, i: number) => void): Promise<GradedResponse> {
  const res = q.empty ? [] : await runTests(q.lang, q.code, q.tests, onEach)
  if (res.length && res.every(r => r.status === 'unavailable')) throw new Error('Exécution impossible sur cet appareil')
  return api.post<GradedResponse>(`/api/exam_attempts/${attemptId}/code_results`, {
    num: q.num, code_sha: q.code_sha, results: res.map(r => ({ n: r.n, status: r.status, got: r.got, stderr: r.stderr })),
  })
}
