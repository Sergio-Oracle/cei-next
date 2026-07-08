'use client'

import { useEffect } from 'react'
import { usePwaInstall } from '@/hooks/usePwaInstall'

export default function InstallPwaBanner() {
  const { canInstall, showIosInstructions, promptInstall, dismiss } = usePwaInstall()
  const visible = canInstall || showIosInstructions

  /* Signale la présence de la bannière au reste de la page (ex: sélecteur de
     langue de la landing, aussi en position fixed en haut) pour éviter tout
     chevauchement avec d'autres éléments fixes. */
  useEffect(() => {
    document.body.classList.toggle('pwa-banner-visible', visible)
    return () => { document.body.classList.remove('pwa-banner-visible') }
  }, [visible])

  if (!visible) return null

  return (
    <div style={{
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
