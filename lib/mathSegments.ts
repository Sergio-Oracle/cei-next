/**
 * Découpe un texte en segments « texte » et « formule », avec les délimiteurs standards de Moodle (filtre MathJax), Canvas et des sujets LaTeX :
 *   \( … \)   formule dans la ligne        \[ … \]   formule en bloc        $$ … $$   formule en bloc
 * et, par prudence, $ … $ (formule dans la ligne) SEULEMENT si le contenu ressemble à du LaTeX (présence de \ ^ _ { }), pour ne jamais prendre « 5 $ et 6 $ » pour une formule.
 * Fonction pure (aucune dépendance) : testée seule par scripts/test_math_segments.mjs.
 */
export type MathSeg = {
  kind: 'text' | 'math'
  value: string        // texte, ou contenu LaTeX sans les délimiteurs
  raw: string          // texte d'origine, délimiteurs compris (repli d'affichage si la formule est invalide)
  display: boolean     // formule en bloc
  start: number        // positions dans le texte d'origine
  end: number
}

const RE = /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|(?<![\\$\w])\$(?!\s)([^$\n]+?)(?<!\s)\$(?![\w$])/g
const LATEXISH = /[\\^_{}]/

export function splitMath(input: string): MathSeg[] {
  const text = input ?? ''
  const out: MathSeg[] = []
  let last = 0
  RE.lastIndex = 0
  let m: RegExpExecArray | null
  const pushText = (from: number, to: number) => {
    if (to > from) out.push({ kind: 'text', value: text.slice(from, to), raw: text.slice(from, to), display: false, start: from, end: to })
  }
  while ((m = RE.exec(text)) !== null) {
    const body = m[1] ?? m[2] ?? m[3] ?? m[4]
    if (m[4] !== undefined && !LATEXISH.test(m[4])) { RE.lastIndex = m.index + 1; continue }      // « $ … $ » sans signe LaTeX : un montant, pas une formule
    if (body === undefined || !body.trim()) continue
    pushText(last, m.index)
    out.push({ kind: 'math', value: body.trim(), raw: m[0], display: m[1] !== undefined || m[2] !== undefined, start: m.index, end: m.index + m[0].length })
    last = m.index + m[0].length
  }
  pushText(last, text.length)
  return out
}

export const hasMath = (text: string): boolean => splitMath(text).some(s => s.kind === 'math')

/** Vrai si la position `pos` du texte est à l'intérieur d'une formule (pour insérer un symbole sans refermer/rouvrir des délimiteurs). */
export function insideMath(text: string, pos: number): boolean {
  return splitMath(text).some(s => s.kind === 'math' && pos > s.start && pos < s.end)
}

/** « * item » / « - item » en début de texte → puce « • », sans toucher au reste (les astérisques d'une formule restent intacts : le texte est découpé avant). */
export const bulletize = (t: string): string => (t ?? '').replace(/^(\s*)[*•]\s+/, '$1• ')

/** Même lecture d'un nombre que le serveur (services/question_types.py : parse_number) : '12,5' / '1 250.75' / '−3' → nombre, sinon null. */
export function parseNumberFr(s: string): number | null {
  let t = String(s ?? '').trim().replace(/[ \u00a0\u202f]/g, '').replace(/\u2212/g, '-').replace(/,/g, '.')
  t = t.replace(/[^0-9eE+\-.]/g, '')
  if (!t) return null
  const v = Number(t)
  return Number.isFinite(v) && /\d/.test(t) ? v : null
}

/** « 5,5 kW » → { value: 5.5, unit: 'kW' } ; « 12 » → { value: 12, unit: null } ; « abc » → { value: null, unit: null } (même découpage que services/question_types.py : split_number_unit). */
export function splitNumberUnit(s: string): { value: number | null; unit: string | null } {
  const m = /^\s*([-+\u2212]?\s*\d[\d\s\u00a0\u202f.,]*(?:[eE][-+\u2212]?\d+)?)\s*(\S.*)?$/.exec(String(s ?? ''))
  if (!m) return { value: null, unit: null }
  const unit = (m[2] ?? '').trim()
  return { value: parseNumberFr(m[1]), unit: unit || null }
}
