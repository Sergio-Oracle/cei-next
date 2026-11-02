'use client'
import React from 'react'

/** Minuscules sans accents : « elise » trouve « Élise », « NIANG » trouve « Niang ». */
export function norm(s: string | null | undefined): string {
  return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

/** Tous les mots saisis doivent se retrouver (dans n'importe quel champ) : « pape niang » trouve « Pape Saer NIANG ». */
export function matchesQuery(query: string, ...fields: (string | null | undefined)[]): boolean {
  const words = norm(query).split(/\s+/).filter(Boolean)
  if (!words.length) return true
  const hay = fields.map(norm).join(' ')
  return words.every(w => hay.includes(w))
}

/** Champ de recherche des listes de choix (surveillants, superviseurs, EC…), avec le nombre de résultats. */
export default function SearchField({ value, onChange, placeholder, shown, total, compact }: {
  value: string; onChange: (v: string) => void; placeholder: string; shown: number; total: number; compact?: boolean
}) {
  return (
    <div style={{ position: 'relative', marginBottom: compact ? 0 : 8 }}>
      <i className="fas fa-magnifying-glass" aria-hidden style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: 14 }} />
      <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} autoComplete="off"
        style={{ width: '100%', boxSizing: 'border-box', padding: '9px 96px 9px 34px', borderRadius: 8, border: '1.5px solid var(--border)', fontSize: 15, background: 'var(--surface, #fff)', color: 'inherit' }} />
      <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: 'var(--text-muted)', pointerEvents: 'none' }}>
        {value.trim() ? `${shown} sur ${total}` : `${total}`}
      </span>
    </div>
  )
}
