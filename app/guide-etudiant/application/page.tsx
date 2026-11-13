import GuideShell, { type TocItem } from '../GuideShell'
import { Demarrer, CameraSecondaire, Pendant, Pause, Soumettre, Reprise } from '../blocks'
import { InstallerApplication, Consignes, Surveille, VisageConseils } from '../specific'

export const metadata = { title: "Guide Étudiant — Examen dans l'application CEI Examen" }

const TOC: TocItem[] = [
  { id: 'installer', icon: 'fa-lock', label: "Installer et préparer l'application CEI Examen" },
  { id: 'demarrer', icon: 'fa-play', label: 'Démarrer un examen' },
  { id: 'camera-secondaire', icon: 'fa-mobile-screen', label: 'Caméra secondaire (smartphone)' },
  { id: 'pendant', icon: 'fa-pen', label: "Pendant l'examen" },
  { id: 'pause', icon: 'fa-mug-hot', label: 'Faire une pause' },
  { id: 'regles', icon: 'fa-shield-alt', label: 'Consignes à respecter' },
  { id: 'surveillance', icon: 'fa-eye', label: 'Ce qui est surveillé' },
  { id: 'detection-faciale', icon: 'fa-user-check', label: 'Détection du visage — conseils' },
  { id: 'soumettre', icon: 'fa-paper-plane', label: 'Soumettre votre copie' },
  { id: 'deconnexion', icon: 'fa-key', label: "En cas de déconnexion — reprendre l'examen" },
]

export default function GuideApplication() {
  return (
    <GuideShell badge="Pour les Étudiants" title="Examen dans l'application CEI Examen" subtitle="À suivre quand votre enseignant exige l'application CEI Examen. L'ordinateur est verrouillé pendant la composition." toc={TOC}>
      <div className="switch"><i className="fas fa-circle-info" /> Votre examen se passe dans un navigateur, sans application ? Lisez plutôt le <a href="/guide-etudiant/navigateur">guide de l&apos;examen dans le navigateur</a>. Se connecter, résultats, réclamations : voir le <a href="/guide-etudiant">guide général</a>.</div>
      <InstallerApplication />
      <Demarrer />
      <CameraSecondaire />
      <Pendant />
      <Pause />
      <Consignes mode="application" />
      <Surveille mode="application" />
      <VisageConseils />
      <Soumettre />
      <Reprise />
    </GuideShell>
  )
}
