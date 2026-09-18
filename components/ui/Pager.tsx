/* ── Pager façon Moodle : « Précédent  1 … 4 5 [6] 7 8 … 40  Suivant » ────── */
export default function Pager({ page, totalPages, onChange, loading }: { page: number; totalPages: number; onChange: (p: number) => void; loading?: boolean }) {
  if (totalPages <= 1) return null
  const windowSize = 2
  const nums = new Set<number>([1, totalPages])
  for (let p = page - windowSize; p <= page + windowSize; p++) if (p > 1 && p < totalPages) nums.add(p)
  const sorted = Array.from(nums).sort((a, b) => a - b)
  const items: (number | '…')[] = []
  let prev = 0
  for (const p of sorted) { if (prev && p - prev > 1) items.push('…'); items.push(p); prev = p }

  const btn = (active?: boolean): React.CSSProperties => ({
    minWidth: 32, height: 32, padding: '0 9px', borderRadius: 7,
    border: active ? '1px solid var(--primary)' : '1px solid var(--border)',
    background: active ? 'var(--primary)' : 'var(--surface)',
    color: active ? '#fff' : 'var(--text)',
    cursor: 'pointer', fontSize: 14, fontWeight: 600,
  })

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 5, padding: '14px 8px', flexWrap: 'wrap' }}>
      <button disabled={page <= 1 || loading} onClick={() => onChange(page - 1)} style={{ ...btn(), opacity: page <= 1 ? .5 : 1 }}>
        ‹ Précédent
      </button>
      {items.map((it, i) => it === '…'
        ? <span key={`e${i}`} style={{ padding: '0 3px', color: 'var(--text-muted)' }}>…</span>
        : <button key={it} disabled={loading} onClick={() => onChange(it as number)} style={btn(it === page)}>{it}</button>
      )}
      <button disabled={page >= totalPages || loading} onClick={() => onChange(page + 1)} style={{ ...btn(), opacity: page >= totalPages ? .5 : 1 }}>
        Suivant ›
      </button>
    </div>
  )
}
