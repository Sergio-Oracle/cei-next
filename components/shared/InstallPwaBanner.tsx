'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { usePwaInstall } from '@/hooks/usePwaInstall'

export default function InstallPwaBanner() {
  const { canInstall, showIosInstructions, promptInstall, dismiss, suggestApp, inPwa } = usePwaInstall()
  const pathname = usePathname()
  // Dans l'application CEI Examen : prévient quand une version plus récente est publiée (jamais pendant un examen)
  const [update, setUpdate] = useState<string | null>(null)
  const [updateHidden, setUpdateHidden] = useState(false)
  useEffect(() => {
    const c = typeof window !== 'undefined' ? (window as any).ceiClient : undefined
    if (!c?.info) return
    const newer = (a: string, b: string) => { const x = a.split('.').map(Number), y = b.split('.').map(Number); for (let i = 0; i < 4; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0) } return false }
    ;(async () => {
      const info = await c.info()
      const r = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/exam-client/releases`).then(x => x.json())
      if (info?.version && r?.version && newer(r.version, info.version)) setUpdate(r.version)
    })().catch(() => {})
  }, [])
  const showUpdate = !!update && !updateHidden && !pathname?.startsWith('/exam')
  const visible = canInstall || showIosInstructions || suggestApp || showUpdate
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
      fontSize: '16px',
      color:          'var(--text)',
    }}>
      <i className="fas fa-mobile-alt" style={{ color: 'var(--primary)', fontSize: 19, flexShrink: 0 }} />

      {showUpdate && (
        <>
          <span style={{ flex: 1 }}>Une nouvelle version de l&apos;application CEI Examen ({update}) est disponible. Installez-la avant votre prochain examen : les anciennes versions peuvent être refusées.</span>
          <a href="/telecharger-client"
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8,
              background: 'var(--primary)', color: 'white', textDecoration: 'none',
              fontSize: 15.5, fontWeight: 600, flexShrink: 0 }}>
            <i className="fas fa-download" style={{ fontSize: 14 }} />
            Mettre à jour
          </a>
        </>
      )}

      {suggestApp && !showUpdate && (
        <>
          <span style={{ flex: 1 }}>
            {inPwa
              ? "Vous utilisez l'ancienne version web installée de CEI. L'application CEI Examen la remplace : une seule application à installer, nécessaire pour les examens verrouillés."
              : "Installez l'application CEI Examen sur votre ordinateur : une seule application pour vos cours, vos notes et vos examens, y compris les examens verrouillés."}
          </span>
          <a href="/telecharger-client"
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8,
              background: 'var(--primary)', color: 'white', textDecoration: 'none',
              fontSize: 15.5, fontWeight: 600, flexShrink: 0 }}>
            <i className="fas fa-download" style={{ fontSize: 14 }} />
            Télécharger
          </a>
        </>
      )}

      {canInstall && (
        <>
          <span style={{ flex: 1 }}>Installez CEI sur cet appareil pour un accès plus rapide, même hors ligne.</span>
          <button onClick={promptInstall}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8,
              background: 'var(--primary)', color: 'white', border: 'none', cursor: 'pointer',
              fontSize:15.5, fontWeight: 600, flexShrink: 0 }}>
            <i className="fas fa-download" style={{ fontSize: 14 }} />
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

      <button onClick={() => { if (showUpdate) setUpdateHidden(true); else dismiss() }} title="Ignorer"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26,
          borderRadius: '50%', background: 'transparent', border: 'none', cursor: 'pointer',
          color: 'var(--text-muted)', flexShrink: 0 }}>
        <i className="fas fa-times" style={{ fontSize: 16 }} />
      </button>
    </div>
  )
}
