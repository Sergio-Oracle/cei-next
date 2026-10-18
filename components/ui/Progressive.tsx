'use client'

import type { ReactNode } from 'react'
import { useProgressive } from '@/lib/useProgressive'
import ShowMore from '@/components/ui/ShowMore'

/** Version « composant » de useProgressive pour les listes imbriquées dans un .map()
 *  (où un hook ne peut pas être appelé) : les enfants reçoivent les éléments visibles
 *  et le pied « Afficher plus » est ajouté après. */
export default function Progressive<T>({ items, label, step = 10, children }: {
  items: T[]
  label?: string
  step?: number
  children: (shown: T[]) => ReactNode
}) {
  const pg = useProgressive(items, step)
  return (
    <>
      {children(pg.shown)}
      <ShowMore pg={pg} label={label} />
    </>
  )
}
