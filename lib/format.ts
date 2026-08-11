// Le backend renvoie parfois une note avec de nombreuses décimales
// (ex. 11.111111111111111/20, résidu de la mise à l'échelle sur 20) —
// arrondie à 2 décimales pour l'affichage, sans zéros superflus (15, pas 15.00).
export function fmtScore(score: number): number {
  return Math.round(score * 100) / 100
}
