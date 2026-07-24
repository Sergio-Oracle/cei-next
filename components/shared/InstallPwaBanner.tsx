'use client'

import { useEffect, useRef } from 'react'
import { usePwaInstall } from '@/hooks/usePwaInstall'

export default function InstallPwaBanner() {
  const { canInstall, showIosInstructions, promptInstall, dismiss } = usePwaInstall()
  const visible = canInstall || showIosInstructions
  const ref = useRef<HTMLDivElement>(null)

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
    <div ref={ref} style={{
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
          <span style={{ flex: 1 }}>Installez CEI sur cet appareil pour un accès plus rapide, même hors ligne.</span>
          <button onClick={promptInstall}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8,
              background: 'var(--primary)', color: 'white', border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 600, flexShrink: 0 }}>
            <i className="fas fa-download" style={{ fontSize: 12 }} />
            Installer
          </button>
        </>
      )}

      {showIosInstructions && (
        <span style={{ flex: 1 }}>
          Pour installer CEI : appuyez sur <i className="fas fa-share-square" style={{ margin: '0 3px' }} />
          Partager, puis <strong>Sur l&apos;écran d&apos;accueil</strong>.
        </span>
      )}

      <button onClick={dismiss} title="Ignorer"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26,
          borderRadius: '50%', background: 'transparent', border: 'none', cursor: 'pointer',
          color: 'var(--text-muted)', flexShrink: 0 }}>
        <i className="fas fa-times" style={{ fontSize: 13 }} />
      </button>
    </div>
  )
}
