'use client'

import { useCallback, useEffect, useState } from 'react'

const DISMISS_KEY = 'cei:pwa-install-dismissed'
const DISMISS_DAYS = 14

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isStandaloneMode(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  )
}

function isIosDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase())
}

function wasDismissedRecently(): boolean {
  const raw = localStorage.getItem(DISMISS_KEY)
  if (!raw) return false
  const dismissedAt = Number(raw)
  if (!dismissedAt) return false
  const elapsedDays = (Date.now() - dismissedAt) / (1000 * 60 * 60 * 24)
  return elapsedDays < DISMISS_DAYS
}

/**
 * Gère l'installation PWA : capture le prompt natif Chrome/Edge/Android,
 * détecte iOS (pas de prompt natif possible — instructions manuelles requises),
 * et respecte un cooldown si l'utilisateur a déjà ignoré la suggestion.
 */
export function usePwaInstall() {
  const [deferredEvent, setDeferredEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [isIos, setIsIos] = useState(false)
  const [dismissed, setDismissed] = useState(true)

  useEffect(() => {
    if (isStandaloneMode()) return
    setIsIos(isIosDevice())
    setDismissed(wasDismissedRecently())

    function onBeforeInstallPrompt(e: Event) {
      e.preventDefault()
      setDeferredEvent(e as BeforeInstallPromptEvent)
    }
    function onAppInstalled() {
      setDeferredEvent(null)
      localStorage.removeItem(DISMISS_KEY)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.addEventListener('appinstalled', onAppInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      window.removeEventListener('appinstalled', onAppInstalled)
    }
  }, [])

  const promptInstall = useCallback(async () => {
    if (!deferredEvent) return
    await deferredEvent.prompt()
    await deferredEvent.userChoice
    setDeferredEvent(null)
  }, [deferredEvent])

  const dismiss = useCallback(() => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
    setDismissed(true)
  }, [])

  const canInstall = !dismissed && !!deferredEvent
  const showIosInstructions = !dismissed && isIos && !deferredEvent

  return { canInstall, showIosInstructions, promptInstall, dismiss }
}
