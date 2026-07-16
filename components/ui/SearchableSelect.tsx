'use client'

import { useEffect, useRef, useState } from 'react'

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
   les composants parents (value/onChange sur une string). */
export default function SearchableSelect({ options, value, onChange, placeholder, emptyLabel, disabled }: Props) {
  const [open, setOpen]   = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const selected = options.find(o => o.value === value)
  const filtered = query.trim()
    ? options.filter(o => o.label.toLowerCase().includes(query.trim().toLowerCase()))
    : options

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <div onClick={() => !disabled && setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '11px 13px', border: `1.5px solid ${open ? 'var(--primary)' : 'var(--border)'}`, borderRadius: 8, fontSize: 13, background: disabled ? 'var(--background)' : 'var(--surface)', color: selected ? 'var(--text)' : 'var(--text-muted)', cursor: disabled ? 'not-allowed' : 'pointer', boxSizing: 'border-box' }}>
        <i className="fas fa-magnifying-glass" style={{ fontSize: 11, color: 'var(--text-muted)' }} />
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selected ? selected.label : (placeholder || 'Rechercher…')}
        </span>
        <i className={`fas fa-chevron-${open ? 'up' : 'down'}`} style={{ fontSize: 11, color: 'var(--text-muted)' }} />
      </div>
      {open && !disabled && (
        <div style={{ position: 'absolute', zIndex: 50, top: '100%', left: 0, right: 0, marginTop: 4, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: 'var(--shadow-lg)', maxHeight: 280, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
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
        </div>
      )}
    </div>
  )
}
