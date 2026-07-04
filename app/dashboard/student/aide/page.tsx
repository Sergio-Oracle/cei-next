'use client'
import { useState } from 'react'
import Link from 'next/link'

const QUICK_LINKS = [
  { href: '/dashboard/student/exams',        icon: 'fas fa-laptop-code',  label: 'Mes Examens',  sub: 'Voir les examens actifs',   color: '#2563eb', bg: '#eff6ff', bd: '#bfdbfe' },
  { href: '/dashboard/student/papers',        icon: 'fas fa-file-alt',     label: 'Mes Copies',   sub: 'Résultats & corrections',   color: '#059669', bg: '#ecfdf5', bd: '#a7f3d0' },
  { href: '/dashboard/student/transcripts',   icon: 'fas fa-award',        label: 'Mes Relevés',  sub: 'Télécharger PDF',           color: '#d97706', bg: '#fffbeb', bd: '#fde68a' },
  { href: '/dashboard/student/reclamations',  icon: 'fas fa-comment-dots', label: 'Réclamations', sub: 'Contester une note',        color: '#dc2626', bg: '#fff1f2', bd: '#fecdd3' },
]

const CATEGORIES = [
  {
    id: 'examens',
    icon: 'fas fa-laptop-code',
    label: 'Examens en ligne',
    color: '#2563eb',
    bg: '#eff6ff',
    bd: '#bfdbfe',
    faqs: [
      { icon: 'fas fa-play-circle', q: 'Comment démarrer un examen ?',                        r: 'Rendez-vous dans "Mes Examens en Ligne". Lorsqu\'un examen est actif, cliquez sur "Commencer l\'examen". Assurez-vous d\'avoir une connexion stable et votre caméra activée.' },
      { icon: 'fas fa-wifi',        q: 'Que faire si je suis déconnecté pendant un examen ?', r: 'Reconnectez-vous rapidement sur la plateforme. Votre tentative sera restaurée automatiquement et vos réponses sont sauvegardées toutes les 30 secondes.' },
      { icon: 'fas fa-lock',        q: 'Pourquoi mon examen est-il verrouillé ?',              r: 'Un examen peut être verrouillé si l\'heure de début n\'est pas encore atteinte, si vous avez été banni pour fraude, ou si l\'examen est terminé.' },
    ],
  },
  {
    id: 'camera',
    icon: 'fas fa-camera',
    label: 'Caméra & surveillance',
    color: '#059669',
    bg: '#ecfdf5',
    bd: '#a7f3d0',
    faqs: [
      { icon: 'fas fa-video',       q: 'Comment activer ma caméra ?',                          r: 'Lorsque vous démarrez un examen, votre navigateur vous demandera l\'accès à la caméra. Autorisez l\'accès dans la fenêtre contextuelle. Assurez-vous qu\'une autre application n\'utilise pas votre caméra.' },
      { icon: 'fas fa-user-check',  q: 'Pourquoi ai-je des alertes de visage non détecté ?',  r: 'Assurez-vous d\'être centré dans le cadre, bien éclairé et sans lunettes de soleil. 3 alertes consécutives sont nécessaires avant d\'enregistrer un incident — un bon repositionnement interrompt le compteur.' },
      { icon: 'fas fa-users',       q: 'Que signifie "Visages multiples détectés" ?',          r: 'La plateforme détecte qu\'une autre personne est dans le champ de la caméra. Assurez-vous de passer votre examen dans un espace isolé. Cela constitue une infraction aux règles d\'examen.' },
    ],
  },
  {
    id: 'resultats',
    icon: 'fas fa-award',
    label: 'Notes & résultats',
    color: '#d97706',
    bg: '#fffbeb',
    bd: '#fde68a',
    faqs: [
      { icon: 'fas fa-star',        q: 'Comment consulter mes résultats ?',           r: 'Vos résultats sont disponibles dans "Mes Copies" dès que la correction est finalisée. Une notification s\'affichera sur votre tableau de bord.' },
      { icon: 'fas fa-file-pdf',    q: 'Comment télécharger mon relevé de notes ?',  r: 'Allez dans "Mes Relevés" et cliquez sur le bouton de téléchargement PDF à côté du semestre concerné.' },
      { icon: 'fas fa-comment-dots',q: 'Comment faire une réclamation ?',            r: 'Allez dans "Mes Réclamations" et cliquez sur l\'icône de réclamation à côté de votre résultat. Vous avez 7 jours après la correction pour soumettre une réclamation. Soyez précis dans votre argumentation.' },
    ],
  },
]

const RULES = [
  { bad: true,  icon: 'fas fa-window-restore', text: 'Changer d\'onglet ou de fenêtre' },
  { bad: true,  icon: 'fas fa-users',          text: 'Avoir plusieurs visages à la caméra' },
  { bad: true,  icon: 'fas fa-tools',          text: 'Ouvrir les outils développeur' },
  { bad: false, icon: 'fas fa-lightbulb',      text: 'Être dans une pièce bien éclairée' },
  { bad: false, icon: 'fas fa-wifi',           text: 'Connexion internet stable' },
  { bad: false, icon: 'fas fa-camera',         text: 'Caméra bien positionnée et fonctionnelle' },
]

export default function StudentAidePage() {
  const [open, setOpen] = useState<Record<string, number | null>>({})

  function toggle(catId: string, idx: number) {
    setOpen(p => ({ ...p, [catId]: p[catId] === idx ? null : idx }))
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2><i className="fas fa-question-circle" style={{ marginRight: 10, color: 'var(--primary)' }} />Centre d'Aide</h2>
          <p>Guides et réponses aux questions fréquentes</p>
        </div>
      </div>

      {/* Bannière support — fond bleu solide, PAS de gradient */}
      <div style={{ background: '#1e3a8a', borderRadius: 12, padding: '20px 24px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(255,255,255,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <i className="fas fa-headset" style={{ fontSize: 22, color: 'white' }} />
        </div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontWeight: 700, color: 'white', fontSize: 15, marginBottom: 3 }}>Besoin d'une aide personnalisée ?</div>
          <div style={{ color: 'rgba(255,255,255,.75)', fontSize: 13 }}>Contactez votre administration pour toute question sur vos examens ou vos notes.</div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.2)', borderRadius: 8, padding: '8px 14px' }}>
            <i className="fas fa-phone" style={{ color: '#93c5fd', fontSize: 13 }} />
            <span style={{ color: 'white', fontSize: 13, fontWeight: 600 }}>+221 30 108 41 53</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.2)', borderRadius: 8, padding: '8px 14px' }}>
            <i className="fas fa-envelope" style={{ color: '#93c5fd', fontSize: 13 }} />
            <span style={{ color: 'white', fontSize: 13, fontWeight: 600 }}>visioplus@unchk.edu.sn</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.2)', borderRadius: 8, padding: '8px 14px' }}>
            <i className="fas fa-map-marker-alt" style={{ color: '#93c5fd', fontSize: 13 }} />
            <span style={{ color: 'white', fontSize: 13, fontWeight: 600 }}>Cité du Savoir – Diamniadio</span>
          </div>
        </div>
      </div>

      {/* Liens rapides */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 24 }}>
        {QUICK_LINKS.map(l => (
          <Link key={l.href} href={l.href} style={{ textDecoration: 'none' }}>
            <div
              style={{ background: l.bg, border: `1.5px solid ${l.bd}`, borderRadius: 10, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', transition: 'box-shadow .15s, transform .15s' }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,.08)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none' }}
            >
              <div style={{ width: 38, height: 38, borderRadius: 9, background: l.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <i className={l.icon} style={{ color: 'white', fontSize: 16 }} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#1e293b' }}>{l.label}</div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{l.sub}</div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* FAQ par catégorie */}
      {CATEGORIES.map(cat => (
        <div key={cat.id} className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, paddingBottom: 12, borderBottom: `1.5px solid ${cat.bd}` }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: cat.bg, border: `1px solid ${cat.bd}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className={cat.icon} style={{ color: cat.color, fontSize: 16 }} />
            </div>
            <span style={{ fontWeight: 700, fontSize: 15, color: '#1e293b' }}>{cat.label}</span>
            <span style={{ marginLeft: 'auto', background: cat.bg, border: `1px solid ${cat.bd}`, borderRadius: 99, padding: '2px 10px', fontSize: 12, color: cat.color, fontWeight: 700 }}>
              {cat.faqs.length} question{cat.faqs.length > 1 ? 's' : ''}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {cat.faqs.map((faq, i) => {
              const isOpen = open[cat.id] === i
              return (
                <div key={i} style={{ border: `1px solid ${isOpen ? cat.bd : 'var(--border)'}`, borderRadius: 8, overflow: 'hidden', transition: 'border-color .2s' }}>
                  <button
                    onClick={() => toggle(cat.id, i)}
                    style={{ width: '100%', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, background: isOpen ? cat.bg : 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', transition: 'background .2s' }}
                  >
                    <i className={faq.icon} style={{ fontSize: 14, color: cat.color, flexShrink: 0, width: 18, textAlign: 'center' }} />
                    <span style={{ flex: 1, fontWeight: 600, fontSize: 13.5, color: '#1e293b' }}>{faq.q}</span>
                    <i className={`fas fa-chevron-${isOpen ? 'up' : 'down'}`} style={{ fontSize: 11, color: '#94a3b8', flexShrink: 0 }} />
                  </button>
                  {isOpen && (
                    <div style={{ padding: '0 16px 14px 50px', fontSize: 13.5, color: '#475569', lineHeight: 1.65, background: cat.bg }}>
                      {faq.r}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {/* Règles à respecter */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <i className="fas fa-shield-alt" style={{ color: '#2563eb', fontSize: 18 }} />
          <span style={{ fontWeight: 700, fontSize: 15, color: '#1e293b' }}>Règles à respecter pendant l'examen</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
          {RULES.map((r, i) => (
            <div key={i} style={{
              borderRadius: 8, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10,
              background: r.bad ? '#fff1f2' : '#ecfdf5',
              border: `1px solid ${r.bad ? '#fecdd3' : '#a7f3d0'}`,
            }}>
              <i className={r.icon} style={{ fontSize: 16, color: r.bad ? '#ef4444' : '#059669', flexShrink: 0 }} />
              <span style={{ fontSize: 12.5, fontWeight: 600, color: r.bad ? '#9f1239' : '#065f46' }}>{r.text}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 14, background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 8, padding: '10px 14px', display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13, color: '#92400e' }}>
          <i className="fas fa-exclamation-triangle" style={{ color: '#f59e0b', marginTop: 1, flexShrink: 0 }} />
          <span>
            <strong>Important :</strong> Le dépassement des seuils configurés (changements de fenêtre, absence du visage, outils développeur) entraîne un <strong>bannissement immédiat et irréversible</strong> de l'examen. Votre tentative sera notée 0.
          </span>
        </div>
      </div>
    </div>
  )
}
