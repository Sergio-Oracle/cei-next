'use client'

import { useEffect, useMemo, useState } from 'react'

/** Affichage progressif d'une liste : les `step` premiers éléments d'abord, puis « Afficher plus ».
 *  Évite de construire des centaines de lignes d'un coup (page lente). Revient aux premiers
 *  éléments quand la liste change (recherche, filtre, rechargement). */
export function useProgressive<T>(items: T[], step = 10) {
  const [count, setCount] = useState(step)
  const total = items.length
  // Clé de réinitialisation : taille + premier et dernier identifiants/valeurs
  const sig = useMemo(() => {
    const k = (x: any) => (x && typeof x === 'object' ? (x.id ?? x.attempt_id ?? x.key ?? '') : String(x))
    return `${total}|${total ? k(items[0]) : ''}|${total ? k(items[total - 1]) : ''}`
  }, [items, total])
  useEffect(() => { setCount(step) }, [sig, step])
  return {
    shown: items.slice(0, count) as T[],
    total,
    count: Math.min(count, total),
    remaining: Math.max(0, total - count),
    step,
    showMore: () => setCount(c => c + step),
    showAll: () => setCount(total),
    showLess: () => setCount(step),
  }
}

export type Progressive<T> = ReturnType<typeof useProgressive<T>>
