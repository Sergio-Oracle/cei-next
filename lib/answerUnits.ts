// Progression de l'étudiant : on compte des RÉPONSES, pas des blocs de question. Une association ou un appariement de 8 paires = 8 réponses,
// un texte à trous de 3 champs = 3 réponses. Le compteur annonce donc « 51 » quand le sujet dit « 51 réponses attendues » (16/11/2026 : il affichait 41,
// l'enseignant croyait à des questions manquantes).
export type BlockLike = { type: string; num?: number | string; items?: unknown[]; pairs?: unknown[]; choices?: { letter: string }[] }

const GRID_TYPES = ['association', 'tri', 'ordre', 'trous', 'cloze', 'zones']

/** Nombre de réponses attendues dans ce bloc. */
export function answerUnits(b: BlockLike): number {
  if (b.type === 'appariement') return Math.max(1, b.pairs?.length ?? 0)
  if (GRID_TYPES.includes(b.type)) return Math.max(1, b.items?.length ?? 0)
  return 1
}

/** Nombre de réponses déjà données dans ce bloc (mêmes clés que `answeredAll` de la page d'examen : `pq_<num>`, `pq_<num>_<i>`, `pq_<num>_<lettre>`). */
export function answeredUnits(b: BlockLike, a: Record<string, string>): number {
  const filled = (k: string) => (a[k] ?? '').trim() !== ''
  if (b.type === 'subopen') return b.choices?.some(c => filled(`pq_${b.num}_${c.letter}`)) ? 1 : 0
  if (b.type === 'appariement') return (b.pairs ?? []).filter((_, i) => filled(`pq_${b.num}_${i}`)).length
  if (GRID_TYPES.includes(b.type)) return (b.items ?? []).filter((_, i) => filled(`pq_${b.num}_${i}`)).length
  return filled(`pq_${b.num}`) ? 1 : 0
}

export const totalUnits = (bs: BlockLike[]): number => bs.reduce((n, b) => n + answerUnits(b), 0)
export const totalAnswered = (bs: BlockLike[], a: Record<string, string>): number => bs.reduce((n, b) => n + answeredUnits(b, a), 0)
