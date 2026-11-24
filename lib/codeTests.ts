/**
 * Tests d'une question de code (pur, sans dépendance — testé par scripts/test_code_tests.js).
 * Mêmes règles que le serveur : services/question_types.py (normalize_output, judge_code) — le verdict qui compte pour la note est recalculé côté serveur.
 */
export type CodeTest = { n: number; kind: 'stdin' | 'call'; input: string; expected: string; hidden?: boolean }
export type RunStatus = 'ok' | 'runtime_error' | 'timeout' | 'output' | 'unavailable'
export type TestResult = { n: number; ok: boolean; status: RunStatus; got: string; expected: string; stderr: string }

export const RUNNABLE_LANGS = ['python', 'javascript']
export const isRunnable = (lang: string): boolean => RUNNABLE_LANGS.includes(lang)

/** Comparaison tolérante de CodeRunner : fins de ligne unifiées, espaces de fin de ligne et lignes vides finales ignorés. */
export function normalizeOutput(s: string): string {
  const lines = String(s ?? '').replace(/\r\n?/g, '\n').split('\n').map(l => l.replace(/\s+$/, ''))
  while (lines.length && !lines[lines.length - 1]) lines.pop()
  return lines.join('\n')
}

/** (programme, entrée standard) d'un test. « appel » : l'expression est ajoutée après le code de l'étudiant (test d'une fonction, comme CodeRunner). */
export function programFor(source: string, test: CodeTest): { program: string; stdin: string } {
  if (test.kind === 'call') return { program: source.replace(/\s+$/, '') + '\n' + (test.input || '') + '\n', stdin: '' }
  const stdin = test.input || ''
  return { program: source, stdin: !stdin || stdin.endsWith('\n') ? stdin : stdin + '\n' }
}

export function verdict(test: CodeTest, status: RunStatus, stdout: string, stderr = ''): TestResult {
  const expected = normalizeOutput(test.expected)
  const got = normalizeOutput(stdout)
  return { n: test.n, ok: status === 'ok' && got === expected, status, got, expected, stderr }
}

/** Texte non technique montré à l'étudiant pour un test raté. */
export const STATUS_TEXT: Record<string, string> = {
  timeout: "Votre programme met trop de temps à s'exécuter (boucle infinie ?).",
  output: 'Votre programme affiche beaucoup trop de texte.',
  runtime_error: "Votre programme s'est arrêté sur une erreur.",
  unavailable: "L'exécution n'a pas pu avoir lieu sur cet appareil.",
}
