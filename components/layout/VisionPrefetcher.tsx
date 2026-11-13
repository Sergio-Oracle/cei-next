'use client'

import { useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { autoPrefetch } from '@/lib/visionTier'

/**
 * Préchargement discret des modèles de surveillance par vision (≈ 48 Mo) dans un cache durable, pour qu'au jour de
 * l'examen il n'y ait RIEN à télécharger — y compris sur une liaison à faible débit (voir lib/visionTier.ts).
 * Étudiants seulement ; jamais sur données mobiles ni en mode économie de données ; au plus une tentative toutes les 6 h ;
 * lancé en arrière-plan, quelques secondes après l'ouverture du tableau de bord, sans jamais gêner la page.
 */
export default function VisionPrefetcher() {
  const { user } = useAuth()
  useEffect(() => {
    if (user?.role !== 'student') return
    const t = setTimeout(() => {
      const run = () => { autoPrefetch().catch(() => {}) }
      const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void }).requestIdleCallback
      if (ric) ric(run, { timeout: 15_000 }); else run()
    }, 8_000)
    return () => clearTimeout(t)
  }, [user?.role])
  return null
}
