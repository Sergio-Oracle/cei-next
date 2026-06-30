'use client'
export default function AdminAnalyticsPage() {
  return (
    <div>
      <div className="page-header">
        <div>
          <h2><i className="fas fa-chart-bar" style={{ marginRight: 10, color: 'var(--primary)' }} />Analytique</h2>
          <p>Statistiques et analyses de la plateforme</p>
        </div>
      </div>
      <div className="card" style={{ textAlign: 'center', padding: 60 }}>
        <i className="fas fa-tools" style={{ fontSize: 48, color: 'var(--text-muted)', display: 'block', marginBottom: 16 }} />
        <h3>Page en cours de développement</h3>
        <p style={{ color: 'var(--text-muted)' }}>Cette fonctionnalité sera disponible prochainement.</p>
      </div>
    </div>
  )
}
