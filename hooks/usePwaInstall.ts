'use client'

import { useCallback, useEffect, useState } from 'react'

const DISMISS_KEY = 'cei:pwa-install-dismissed'
const DISMISS_DAYS = 14

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

declare global {
  interface Window { __pwaDeferredPrompt?: BeforeInstallPromptEvent }
}

function isStandaloneMode(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  )
}

/** Dans l'application « CEI Examen » (Electron) : elle EST l'application installée, rien à proposer. */
function isCeiApp(): boolean {
  return typeof window !== 'undefined' && !!(window as any).ceiClient
}

/** Ordinateur (pas de téléphone ni de tablette) : on y propose l'application CEI Examen plutôt que la version web installable,
 *  pour qu'un étudiant n'ait jamais DEUX applications à installer. Sur téléphone, la version web (PWA) reste la seule possible. */
function isDesktopDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  return !/android|iphone|ipad|ipod|mobile|tablet/i.test(navigator.userAgent)
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
 *
 * `beforeinstallprompt` peut se déclencher avant même que React n'ait fini
 * de monter (dès que le navigateur évalue l'éligibilité de la page) — un
 * script précoce dans <head> (layout.tsx) le capture en premier et le stocke
 * sur window.__pwaDeferredPrompt, pour ne jamais le perdre selon le timing.
 */
export function usePwaInstall() {
  const [deferredEvent, setDeferredEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [isIos, setIsIos] = useState(false)
  const [dismissed, setDismissed] = useState(true)
  const [desktop, setDesktop] = useState(false)           // ordinateur, hors application CEI Examen
  const [inPwa, setInPwa] = useState(false)               // ancienne version web installée (PWA) sur un ordinateur

  useEffect(() => {
    if (isCeiApp()) return                                  // déjà dans l'application : aucune invitation à installer quoi que ce soit
    if (isDesktopDevice()) {
      setDesktop(true); setInPwa(isStandaloneMode()); setDismissed(wasDismissedRecently())
      return                                                // ordinateur : on n'utilise jamais l'installation de la version web
    }
    if (isStandaloneMode()) return
    setIsIos(isIosDevice())
    setDismissed(wasDismissedRecently())

    // L'événement est peut-être déjà arrivé avant ce montage.
    if (window.__pwaDeferredPrompt) setDeferredEvent(window.__pwaDeferredPrompt)

    function onPromptReady() {
      if (window.__pwaDeferredPrompt) setDeferredEvent(window.__pwaDeferredPrompt)
    }
    function onBeforeInstallPrompt(e: Event) {
      e.preventDefault()
      window.__pwaDeferredPrompt = e as BeforeInstallPromptEvent
      setDeferredEvent(e as BeforeInstallPromptEvent)
    }
    function onAppInstalled() {
      window.__pwaDeferredPrompt = undefined
      setDeferredEvent(null)
      localStorage.removeItem(DISMISS_KEY)
    }

    window.addEventListener('cei:pwa-prompt-ready', onPromptReady)
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.addEventListener('appinstalled', onAppInstalled)
    return () => {
      window.removeEventListener('cei:pwa-prompt-ready', onPromptReady)
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      window.removeEventListener('appinstalled', onAppInstalled)
    }
  }, [])

  const promptInstall = useCallback(async () => {
    if (!deferredEvent) return
    await deferredEvent.prompt()
    // La boîte de dialogue native (Accepter/Annuler) est affichée par le
    // navigateur lui-même — on doit respecter la réponse réelle de
    // l'utilisateur, pas juste supposer qu'il a accepté.
    const { outcome } = await deferredEvent.userChoice
    window.__pwaDeferredPrompt = undefined
    setDeferredEvent(null)
    if (outcome === 'dismissed') {
      // Refus explicite dans la boîte de dialogue du navigateur — mémorisé
      // au même titre qu'un clic sur le bouton "×" de la bannière.
      localStorage.setItem(DISMISS_KEY, String(Date.now()))
      setDismissed(true)
    } else {
      // 'accepted' — appinstalled se déclenchera séparément et nettoiera déjà la clé.
      localStorage.removeItem(DISMISS_KEY)
    }
  }, [deferredEvent])

  const dismiss = useCallback(() => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
    setDismissed(true)
  }, [])

  const canInstall = !dismissed && !!deferredEvent && !desktop
  const showIosInstructions = !dismissed && isIos && !deferredEvent && !desktop
  // Ordinateur : suggestion de l'application CEI Examen (unique application à installer)
  const suggestApp = desktop && !dismissed

  // Pour un déclencheur manuel explicite (ex: bouton dans un menu) : l'utilisateur
  // qui va chercher volontairement l'action d'installer doit pouvoir le faire même
  // s'il a fermé la bannière automatique — le cooldown "dismissed" ne s'applique
  // qu'à l'apparition SPONTANÉE de la bannière, pas à une demande explicite.
  const canInstallManually  = !!deferredEvent && !desktop
  const showIosInstructionsManually = isIos && !deferredEvent && !desktop
  const suggestAppManually = desktop

  return {
    canInstall, showIosInstructions, promptInstall, dismiss,
    canInstallManually, showIosInstructionsManually,
    suggestApp, suggestAppManually, inPwa,
  }
}
