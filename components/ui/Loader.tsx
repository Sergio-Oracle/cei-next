export default function Loader({ text = 'Chargement…' }: { text?: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
      <i className="fa-solid fa-spinner spin" style={{ fontSize: 32, display: 'block', marginBottom: 12, color: 'var(--primary)' }} />
      {text}
    </div>
  )
}
