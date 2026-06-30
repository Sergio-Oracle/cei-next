'use client'

export default function StudentAidePage() {
  const faqs = [
    { q: 'Comment démarrer un examen ?', r: 'Rendez-vous dans "Mes Examens en Ligne". Lorsqu\'un examen est actif, cliquez sur "Commencer l\'examen". Assurez-vous d\'avoir une connexion stable et votre caméra activée.' },
    { q: 'Que faire si je suis déconnecté pendant un examen ?', r: 'Reconnectez-vous rapidement sur la plateforme. Votre tentative sera restaurée automatiquement. Vos réponses sont sauvegardées toutes les 30 secondes.' },
    { q: 'Comment faire une réclamation ?', r: 'Allez dans "Mes Notes" ou "Mes Réclamations", cliquez sur l\'icône de réclamation à côté de votre résultat. Vous avez 7 jours après la correction pour soumettre une réclamation.' },
    { q: 'Comment télécharger mon relevé de notes ?', r: 'Allez dans "Mes Relevés" et cliquez sur le bouton de téléchargement PDF à côté du semestre concerné.' },
    { q: 'Pourquoi mon examen est-il verrouillé ?', r: 'Un examen peut être verrouillé si l\'heure de début n\'est pas encore atteinte, si vous avez été banni pour fraude, ou si l\'examen est terminé.' },
    { q: 'Comment activer ma caméra ?', r: 'Lorsque vous démarrez un examen, votre navigateur vous demandera l\'accès à la caméra. Autorisez l\'accès dans la fenêtre contextuelle. Assurez-vous qu\'une autre application n\'utilise pas votre caméra.' },
  ]

  return (
    <div>
      <div className="page-header">
        <div>
          <h2><i className="fas fa-question-circle" style={{ marginRight: 10, color: 'var(--primary)' }} />Centre d'Aide</h2>
          <p>Réponses aux questions fréquentes</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ padding: '20px 24px', background: 'linear-gradient(135deg, var(--primary), #3b82f6)', borderRadius: 10, color: 'white', marginBottom: 24 }}>
          <h3 style={{ color: 'white', marginBottom: 6 }}><i className="fas fa-headset" style={{ marginRight: 8 }} />Besoin d'aide ?</h3>
          <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14 }}>Contactez l'administration pour toute question sur vos examens ou vos notes.</p>
        </div>

        <h3 className="card-title"><i className="fas fa-circle-question" /> Questions fréquentes</h3>
        {faqs.map((faq, i) => (
          <details key={i} style={{ borderBottom: '1px solid var(--border)', padding: '12px 0' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: 14, padding: '4px 0', listStyle: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
              <i className="fas fa-chevron-right" style={{ fontSize: 11, color: 'var(--primary)', transition: 'transform 0.2s' }} />
              {faq.q}
            </summary>
            <p style={{ marginTop: 8, fontSize: 14, color: 'var(--text-muted)', paddingLeft: 20, lineHeight: 1.6 }}>{faq.r}</p>
          </details>
        ))}
      </div>
    </div>
  )
}
