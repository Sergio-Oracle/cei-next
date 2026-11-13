import GuideShell, { type TocItem } from '../GuideShell'
import { Demarrer, CameraSecondaire, Pendant, Pause, Soumettre, Reprise } from '../blocks'
import { PreparerNavigateur, Consignes, Surveille, VisageConseils } from '../specific'

export const metadata = { title: 'Guide Étudiant — Examen dans le navigateur' }

const TOC: TocItem[] = [
  { id: 'preparer', icon: 'fa-globe', label: 'Préparer votre ordinateur' },
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

export default function GuideNavigateur() {
  return (
    <GuideShell badge="Pour les Étudiants" title="Examen dans le navigateur" subtitle="À suivre quand votre examen se passe directement dans votre navigateur, sans application à installer." toc={TOC}>
      <div className="switch"><i className="fas fa-circle-info" /> Votre enseignant exige l&apos;application CEI Examen ? Lisez plutôt le <a href="/guide-etudiant/application">guide de l&apos;application CEI Examen</a>. Se connecter, résultats, réclamations : voir le <a href="/guide-etudiant">guide général</a>.</div>
      <PreparerNavigateur />
      <Demarrer />
      <CameraSecondaire />
      <Pendant />
      <Pause />
      <Consignes mode="navigateur" />
      <Surveille mode="navigateur" />
      <VisageConseils />
      <Soumettre />
      <Reprise />
    </GuideShell>
  )
}
