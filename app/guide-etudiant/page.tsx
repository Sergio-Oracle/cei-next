import GuideShell, { type TocItem } from './GuideShell'
import { Connexion, TableauBord, Resultats, Reclamation } from './blocks'

export const metadata = { title: 'Guide Étudiant — CEI' }

const TOC: TocItem[] = [
  { id: 'choix', icon: 'fa-signs-post', label: 'Quel guide pour mon examen ?' },
  { id: 'comparatif', icon: 'fa-table', label: 'Application ou navigateur : les différences' },
  { id: 'communes', icon: 'fa-list-check', label: 'Les règles valables dans tous les cas' },
  { id: 'connexion', icon: 'fa-sign-in-alt', label: 'Se connecter à la plateforme' },
  { id: 'tableau-bord', icon: 'fa-home', label: 'Votre tableau de bord' },
  { id: 'resultats', icon: 'fa-star', label: 'Consulter vos résultats' },
  { id: 'reclamation', icon: 'fa-comment-dots', label: 'Faire une réclamation' },
]

export default function GuideEtudiant() {
  return (
    <GuideShell badge="Pour les Étudiants" title="Guide Étudiant" subtitle="Tout ce que vous devez savoir pour passer vos examens en ligne sur la plateforme CEI. Commencez par choisir le guide qui correspond à votre examen." toc={TOC}>

      <div className="section" id="choix">
        <div className="section-header"><div className="section-icon"><i className="fas fa-signs-post" /></div><h2>Quel guide pour mon examen ?</h2></div>
        <div className="section-body">
          <p style={{color:'#475569',marginBottom:20}}>Un examen se passe soit dans l&apos;application <strong>CEI Examen</strong>, soit directement dans votre <strong>navigateur</strong>. Les consignes ne sont pas les mêmes : lisez le guide qui correspond à votre cas. <strong>Votre enseignant vous indique lequel s&apos;applique.</strong> Si l&apos;application est exigée et que vous ouvrez l&apos;examen dans un navigateur, l&apos;écran « Application CEI Examen requise » s&apos;affiche à la place du démarrage.</p>
          <div className="choice-grid">
            <a className="choice-card app" href="/guide-etudiant/application">
              <div className="ico"><i className="fas fa-lock" /></div>
              <h3>Mon examen se passe dans l&apos;application CEI Examen</h3>
              <p>L&apos;ordinateur est verrouillé en plein écran. À installer et à tester avant le jour J.</p>
              <span className="go">Ouvrir ce guide <i className="fas fa-arrow-right" /></span>
            </a>
            <a className="choice-card web" href="/guide-etudiant/navigateur">
              <div className="ico"><i className="fas fa-globe" /></div>
              <h3>Mon examen se passe dans le navigateur</h3>
              <p>Rien à installer, mais c&apos;est à vous de préparer le poste et de respecter les règles.</p>
              <span className="go">Ouvrir ce guide <i className="fas fa-arrow-right" /></span>
            </a>
          </div>
        </div>
      </div>

      <div className="section" id="comparatif">
        <div className="section-header"><div className="section-icon" style={{background:'#0891b2'}}><i className="fas fa-table" /></div><h2>Application ou navigateur : les différences</h2></div>
        <div className="section-body">
          <div className="table-wrap">
            <table className="compare">
              <thead><tr><th></th><th>Application CEI Examen</th><th>Navigateur</th></tr></thead>
              <tbody>
                <tr><th>Installation</th><td>Oui, bien avant le jour J, avec test du poste.</td><td>Non. Test du poste conseillé la veille.</td></tr>
                <tr><th>Plein écran</th><td>Verrouillé : impossible de le quitter.</td><td>Demandé. Le quitter est détecté et signalé.</td></tr>
                <tr><th>Autres applications</th><td>Listées puis fermées par l&apos;application.</td><td>À fermer vous-même. Chaque changement de fenêtre ou d&apos;onglet est compté.</td></tr>
                <tr><th>Teams, Zoom, Discord…</th><td>Arrêtés automatiquement s&apos;ils tournent en arrière-plan.</td><td>À quitter vous-même, notifications coupées.</td></tr>
                <tr><th>Raccourcis (Alt+Tab, F5, F12)</th><td>Bloqués et signalés.</td><td>Non bloqués, mais détectés.</td></tr>
                <tr><th>Second écran, clé USB</th><td>Démarrage refusé tant qu&apos;ils sont branchés.</td><td>Second écran détecté et signalé.</td></tr>
                <tr><th>Copier-coller</th><td>Presse-papiers vidé en continu.</td><td>Désactivé dans la page de l&apos;examen.</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="section" id="communes">
        <div className="section-header"><div className="section-icon"><i className="fas fa-list-check" /></div><h2>Les règles valables dans tous les cas</h2></div>
        <div className="section-body">
          <div className="rule-grid">
            <div className="rule-card bad"><i className="fas fa-users" /><p>Soyez seul(e) devant la caméra</p></div>
            <div className="rule-card bad"><i className="fas fa-user-slash" /><p>Gardez votre visage visible et éclairé de face</p></div>
            <div className="rule-card bad"><i className="fas fa-mobile-alt" /><p>Aucun téléphone, livre ou note à portée de vue</p></div>
            <div className="rule-card bad"><i className="fas fa-robot" /><p>Aucun assistant d&apos;IA, traducteur ni moteur de recherche</p></div>
            <div className="rule-card bad"><i className="fas fa-volume-up" /><p>Ne parlez à personne pendant l&apos;examen</p></div>
            <div className="rule-card bad"><i className="fas fa-copy" /><p>Pas de copier-coller</p></div>
            <div className="rule-card good"><i className="fas fa-plug" /><p>Ordinateur sur secteur, connexion stable (1 Mbit/s minimum)</p></div>
            <div className="rule-card good"><i className="fas fa-comment" /><p>Une question ? Écrivez ou appelez l&apos;enseignant depuis la barre de l&apos;examen</p></div>
            <div className="rule-card good"><i className="fas fa-key" /><p>Une panne ? Prévenez, puis reprenez avec votre code personnel</p></div>
          </div>
          <div className="tip"><i className="fas fa-lightbulb" /> Les règles propres à chaque cas (installation, fenêtres, écrans, raccourcis) sont dans le guide correspondant.</div>
        </div>
      </div>

      <Connexion />
      <TableauBord />
      <Resultats />
      <Reclamation />
    </GuideShell>
  )
}
