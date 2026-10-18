'use client'

import type { Progressive } from '@/lib/useProgressive'

/** Pied de liste : « 10 sur 261 » + Afficher plus / Tout afficher. Rien si la liste tient dans la première page. */
export default function ShowMore({ pg, label = 'éléments' }: { pg: Progressive<any>; label?: string }) {
  if (pg.total <= pg.step) return null
  const btn = { padding: '7px 14px', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 14.5 } as const
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, padding: '12px 16px', borderTop: '1px solid #dbe7f7' }}>
      <span style={{ fontSize: 14.5, color: 'var(--text-muted)' }}>
        {pg.count} sur {pg.total} {label}
      </span>
      <div style={{ display: 'flex', gap: 8 }}>
        {pg.remaining > 0 && (
          <button onClick={pg.showMore} style={{ ...btn, background: '#eff6ff', color: '#1d4ed8', border: '1px solid #dbe7f7' }}>
            <i className="fas fa-plus" style={{ marginRight: 6 }} />Afficher {Math.min(pg.step, pg.remaining)} de plus
          </button>
        )}
        {pg.remaining > 0 && (
          <button onClick={pg.showAll} style={{ ...btn, background: 'transparent', color: '#2563eb', border: '1px solid #dbe7f7' }}>
            Tout afficher ({pg.total})
          </button>
        )}
        {pg.remaining === 0 && pg.total > pg.step && (
          <button onClick={pg.showLess} style={{ ...btn, background: 'transparent', color: '#2563eb', border: '1px solid #dbe7f7' }}>
            Réduire
          </button>
        )}
      </div>
    </div>
  )
}
