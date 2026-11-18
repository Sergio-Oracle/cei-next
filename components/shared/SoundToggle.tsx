'use client'
import { useEffect, useState } from 'react'
import { getSoundMode, setSoundMode, nextSoundMode, playAlertBeep, type SoundMode } from '@/lib/notifSound'

const META: Record<SoundMode, { icon: string; label: string }> = {
  normal:  { icon: 'fa-volume-high', label: 'Son des alertes : normal' },
  discret: { icon: 'fa-volume-low',  label: 'Son des alertes : discret' },
  coupe:   { icon: 'fa-volume-xmark', label: 'Son des alertes : coupé' },
}

/** Bouton qui fait passer le son des alertes de « normal » à « discret » puis « coupé » (mémorisé sur ce poste). */
export default function SoundToggle({ className, style }: { className?: string; style?: React.CSSProperties }) {
  const [mode, setMode] = useState<SoundMode>('normal')
  useEffect(() => {
    setMode(getSoundMode())
    const on = () => setMode(getSoundMode())
    window.addEventListener('cei:sound-mode', on)
    return () => window.removeEventListener('cei:sound-mode', on)
  }, [])
  const m = META[mode]
  return (
    <button className={className} style={style} title={`${m.label} (cliquez pour changer)`} aria-label={m.label}
      onClick={() => { const n = nextSoundMode(mode); setSoundMode(n); setMode(n); if (n !== 'coupe') setTimeout(() => playAlertBeep('urgent'), 50) }}>
      <i className={`fas ${m.icon}`} />
    </button>
  )
}
