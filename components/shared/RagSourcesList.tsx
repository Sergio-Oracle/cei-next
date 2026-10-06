'use client'

import { useState } from 'react'
import type { RagSource } from '@/hooks/useSuggestionFlow'

/* Passages du cours cités par une suggestion (moteur RAG) : l'enseignant
   vérifie d'un coup d'œil sur quoi l'IA s'est appuyée. Aucune source citée
   = suggestion à relire avec attention. */
export default function RagSourcesList({ ids, all }: { ids?: string[]; all?: RagSource[] }) {
  const [open, setOpen] = useState<string | null>(null)
  if (!all?.length) return null
  const byId = Object.fromEntries(all.map(s => [s.id, s]))
  const cited = (ids || []).map(id => byId[id]).filter(Boolean)
  return (
    <div style={{ background: '#f0fdfa', border: '1px solid #99f6e4', borderRadius: 10, padding: '10px 14px', marginBottom: 12 }}>
      <div style={{ fontSize: 14.5, fontWeight: 700, color: '#0f766e', marginBottom: cited.length ? 8 : 0 }}>
        <i className="fas fa-book-open-reader" style={{ marginRight: 6 }} />
        {cited.length ? `Appuyée sur ${cited.length} passage(s) du cours` : 'Aucun passage du cours cité : à relire avec attention'}
      </div>
      {cited.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {cited.map(s => (
            <button key={s.id} type="button" onClick={() => setOpen(open === s.id ? null : s.id)} title={s.excerpt}
              style={{ fontSize: 13.5, padding: '3px 10px', borderRadius: 99, border: '1px solid #5eead4', background: open === s.id ? '#ccfbf1' : 'white', color: '#0f766e', cursor: 'pointer', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <strong>{s.id}</strong> · {s.filename}
            </button>
          ))}
        </div>
      )}
      {open && byId[open] && (
        <div style={{ marginTop: 8, fontSize: 14, color: '#334155', lineHeight: 1.6, background: 'white', border: '1px solid #ccfbf1', borderRadius: 8, padding: '8px 12px' }}>
          {byId[open].excerpt}{byId[open].excerpt.length >= 400 ? '…' : ''}
        </div>
      )}
    </div>
  )
}
