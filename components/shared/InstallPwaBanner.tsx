'use client'

import { useEffect, useRef, useState } from 'react'
import { usePwaInstall } from '@/hooks/usePwaInstall'

type Lang = 'fr' | 'en' | 'wo'

const BANNER_LANGS: Record<Lang, { install: string; installBtn: string; ios: string; dismiss: string }> = {
  fr: {
    install: 'Installez CEI sur cet appareil pour un accès plus rapide, même hors ligne.',
    installBtn: 'Installer',
    ios: "Pour installer CEI : appuyez sur Partager, puis Sur l'écran d'accueil.",
    dismiss: 'Ignorer',
  },
  en: {
    install: 'Install CEI on this device for faster access, even offline.',
    installBtn: 'Install',
    ios: 'To install CEI: tap Share, then Add to Home Screen.',
    dismiss: 'Dismiss',
  },
  wo: {
    install: 'Installer CEI ci sa jumtukaay ngir gaaw ci jëfandikoo, itam bu amul internet.',
    installBtn: 'Installer',
    ios: 'Ngir installer CEI : bësal Partager, gannaaw Sur l\'écran d\'accueil.',
    dismiss: 'Bàyyi',
  },
}

export default function InstallPwaBanner() {
  const { canInstall, showIosInstructions, promptInstall, dismiss } = usePwaInstall()
  const visible = canInstall || showIosInstructions
  const ref = useRef<HTMLDivElement>(null)
  const [lang, setLang] = useState<Lang>('fr')
  const tb = BANNER_LANGS[lang]

  // Texte localisé indépendamment de Google Translate (qui mutile le sigle
  // "CEI" en le traduisant littéralement) — reste synchronisé avec le
  // sélecteur de langue des pages login/accueil sans recharger la page.
  useEffect(() => {
    const s = localStorage.getItem('lang') as Lang | null
    if (s && ['fr', 'en', 'wo'].includes(s)) setLang(s)
    const onChange = (e: Event) => {
      const code = (e as CustomEvent<Lang>).detail
      if (code) setLang(code)
    }
    const onStorage = () => {
      const v = localStorage.getItem('lang') as Lang | null
      if (v && ['fr', 'en', 'wo'].includes(v)) setLang(v)
    }
    window.addEventListener('cei:lang-change', onChange)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener('cei:lang-change', onChange)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  /* Signale la présence (+ hauteur réelle, qui varie selon si le texte
     retombe sur 2 lignes sur petit écran) au reste de la page — le header
     sticky et le menu mobile s'en servent pour se décaler et ne pas passer
     dessous la bannière. */
  useEffect(() => {
    document.body.classList.toggle('pwa-banner-visible', visible)
    if (!visible) {
      document.documentElement.style.removeProperty('--pwa-banner-height')
      return () => { document.body.classList.remove('pwa-banner-visible') }
    }
    const el = ref.current
    if (!el) return
    const update = () => {
      document.documentElement.style.setProperty('--pwa-banner-height', `${el.offsetHeight}px`)
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => {
      ro.disconnect()
      document.body.classList.remove('pwa-banner-visible')
      document.documentElement.style.removeProperty('--pwa-banner-height')
    }
  }, [visible])

  if (!visible) return null

  return (
    <div ref={ref} className="notranslate" translate="no" style={{
      position:       'fixed',
      top:            0,
      left:           0,
      right:          0,
      zIndex:         9998,
      background:     'var(--surface)',
      borderBottom:   '1px solid var(--border)',
      boxShadow:      '0 2px 8px rgba(0,0,0,0.08)',
      padding:        '10px 16px',
      display:        'flex',
      flexWrap:       'wrap',
      alignItems:     'center',
      gap:            '12px',
      fontSize:       '13.5px',
      color:          'var(--text)',
    }}>
      <i className="fas fa-mobile-alt" style={{ color: 'var(--primary)', fontSize: 16, flexShrink: 0 }} />

      {canInstall && (
        <>
          <span style={{ flex: 1 }}>{tb.install}</span>
          <button onClick={promptInstall}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8,
              background: 'var(--primary)', color: 'white', border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 600, flexShrink: 0 }}>
            <i className="fas fa-download" style={{ fontSize: 12 }} />
            {tb.installBtn}
          </button>
        </>
      )}

      {showIosInstructions && (
        <span style={{ flex: 1 }}>
          <i className="fas fa-share-square" style={{ margin: '0 3px' }} />
          {tb.ios}
        </span>
      )}

      <button onClick={dismiss} title={tb.dismiss}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26,
          borderRadius: '50%', background: 'transparent', border: 'none', cursor: 'pointer',
          color: 'var(--text-muted)', flexShrink: 0 }}>
        <i className="fas fa-times" style={{ fontSize: 13 }} />
      </button>
    </div>
  )
}
