'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export interface SearchableOption { value: string; label: string }

interface Props {
  options: SearchableOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  emptyLabel?: string
  disabled?: boolean
}

/* Retour #27 — recherche texte sur les longues listes d'EC (au lieu d'un
   <select> plat), en gardant la sémantique d'un <select> classique pour
   les composants parents (value/onChange sur une string).

   Le panneau ouvert est rendu dans un portail (document.body) plutôt qu'en
   position absolute dans le flux normal : plusieurs pages placent ce
   composant dans une carte à coins arrondis avec overflow:hidden, qui
   coupait silencieusement le menu ouvert sans aucune erreur visible
   (retour : "je vois toujours rien" / "cela ne montre pas l'EC" — le menu
   s'ouvrait bien, juste invisible car hors des limites visibles du parent). */
export default function SearchableSelect({ options, value, onChange, placeholder, emptyLabel, disabled }: Props) {
  const [open, setOpen]       = useState(false)
  const [query, setQuery]     = useState('')
  const [rect, setRect]       = useState<{ top: number; left: number; width: number } | null>(null)
  const [mounted, setMounted] = useState(false)
  const rootRef    = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLDivElement>(null)
  const panelRef   = useRef<HTMLDivElement>(null)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      const t = e.target as Node
      if (rootRef.current?.contains(t)) return
      if (panelRef.current?.contains(t)) return
      setOpen(false)
    }
    function onReposition() { setOpen(false) }
    document.addEventListener('mousedown', onClickOutside)
    window.addEventListener('scroll', onReposition, true)
    window.addEventListener('resize', onReposition)
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      window.removeEventListener('scroll', onReposition, true)
      window.removeEventListener('resize', onReposition)
    }
  }, [])

  function toggle() {
    if (disabled) return
    if (!open && triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect()
      setRect({ top: r.bottom + 4, left: r.left, width: r.width })
    }
    setOpen(o => !o)
  }

  const selected = options.find(o => o.value === value)
  const filtered = query.trim()
    ? options.filter(o => o.label.toLowerCase().includes(query.trim().toLowerCase()))
    : options

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <div ref={triggerRef} onClick={toggle}
        style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '11px 13px', border: `1.5px solid ${open ? 'var(--primary)' : 'var(--border)'}`, borderRadius: 8, fontSize: 13, background: disabled ? 'var(--background)' : 'var(--surface)', color: selected ? 'var(--text)' : 'var(--text-muted)', cursor: disabled ? 'not-allowed' : 'pointer', boxSizing: 'border-box' }}>
        <i className="fas fa-magnifying-glass" style={{ fontSize: 11, color: 'var(--text-muted)' }} />
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selected ? selected.label : (placeholder || 'Rechercher…')}
        </span>
        {/* Compteur visible sans avoir à ouvrir le menu — évite de croire la
            liste vide/cassée alors qu'elle contient des options non encore
            consultées. */}
        {!selected && (
          <span style={{ fontSize: 11, fontWeight: 600, color: options.length ? 'var(--primary)' : '#ef4444', background: options.length ? 'var(--background)' : '#fef2f2', border: `1px solid ${options.length ? 'var(--border)' : '#fecaca'}`, borderRadius: 99, padding: '1px 7px', flexShrink: 0 }}>
            {options.length} option{options.length !== 1 ? 's' : ''}
          </span>
        )}
        <i className={`fas fa-chevron-${open ? 'up' : 'down'}`} style={{ fontSize: 11, color: 'var(--text-muted)' }} />
      </div>
      {open && !disabled && mounted && rect && createPortal(
        <div ref={panelRef} style={{ position: 'fixed', zIndex: 10000, top: rect.top, left: rect.left, width: rect.width, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: 'var(--shadow-lg)', maxHeight: 280, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <input autoFocus type="text" value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Filtrer…"
            style={{ padding: '9px 12px', border: 'none', borderBottom: '1px solid var(--border)', fontSize: 13, outline: 'none', background: 'var(--background)', color: 'var(--text)' }} />
          <div style={{ overflowY: 'auto' }}>
            <div onClick={() => { onChange(''); setQuery(''); setOpen(false) }}
              style={{ padding: '9px 12px', fontSize: 13, cursor: 'pointer', color: 'var(--text-muted)', background: value === '' ? 'var(--background)' : 'transparent' }}>
              {emptyLabel || '— Aucun —'}
            </div>
            {filtered.length === 0 && (
              <div style={{ padding: '9px 12px', fontSize: 12, color: 'var(--text-muted)' }}>Aucun résultat</div>
            )}
            {filtered.map(o => (
              <div key={o.value} onClick={() => { onChange(o.value); setQuery(''); setOpen(false) }}
                style={{ padding: '9px 12px', fontSize: 13, cursor: 'pointer', color: 'var(--text)', background: o.value === value ? 'var(--background)' : 'transparent' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--background)')}
                onMouseLeave={e => (e.currentTarget.style.background = o.value === value ? 'var(--background)' : 'transparent')}>
                {o.label}
              </div>
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
