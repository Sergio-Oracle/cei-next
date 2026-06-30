export default function Conditions() {
  return (
    <>
      <style>{`
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; background:#f8fafc; color:#1e293b; line-height:1.7; }
        .topbar { background:#1e293b; color:white; padding:14px 32px; display:flex; align-items:center; justify-content:space-between; position:sticky; top:0; z-index:100; }
        .topbar-brand { font-size:17px; font-weight:700; display:flex; align-items:center; gap:10px; }
        .btn-back { background:rgba(255,255,255,.1); color:white; border:1px solid rgba(255,255,255,.2); padding:8px 18px; border-radius:8px; text-decoration:none; font-size:13px; font-weight:600; display:inline-flex; align-items:center; gap:6px; transition:.2s; }
        .btn-back:hover { background:rgba(255,255,255,.2); }
        .hero-doc { background:linear-gradient(135deg,#1e293b,#0f172a); color:white; padding:60px 32px; text-align:center; }
        .hero-doc h1 { font-size:2.4rem; font-weight:800; margin-bottom:12px; }
        .hero-doc p { font-size:1rem; opacity:.7; max-width:600px; margin:0 auto; }
        .hero-meta { display:inline-flex; align-items:center; gap:6px; background:rgba(255,255,255,.1); border:1px solid rgba(255,255,255,.2); padding:6px 16px; border-radius:99px; font-size:12px; margin-bottom:20px; }
        .content-wrap { max-width:800px; margin:0 auto; padding:48px 24px 80px; }
        .article { background:white; border-radius:14px; border:1px solid #e2e8f0; margin-bottom:24px; overflow:hidden; }
        .article-header { padding:18px 24px; background:#f8fafc; border-bottom:1px solid #e2e8f0; display:flex; align-items:center; gap:12px; }
        .article-num { width:32px; height:32px; background:#1e293b; color:white; border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:700; flex-shrink:0; }
        .article-header h2 { font-size:15px; font-weight:700; color:#0f172a; margin:0; }
        .article-body { padding:24px; font-size:14px; color:#475569; }
        .article-body p { margin-bottom:12px; }
        .article-body ul { padding-left:20px; margin-bottom:12px; }
        .article-body li { margin-bottom:6px; }
        .article-body strong { color:#0f172a; }
        .highlight { background:#fffbeb; border:1px solid #fcd34d; border-left:4px solid #f59e0b; border-radius:8px; padding:14px 16px; margin:14px 0; font-size:13px; color:#92400e; }
        footer.doc-footer { background:#1e293b; color:rgba(255,255,255,.7); text-align:center; padding:32px; font-size:13px; }
        footer.doc-footer a { color:#94a3b8; text-decoration:none; }
        footer.doc-footer a:hover { color:white; }
      `}</style>

      <div className="topbar">
        <div className="topbar-brand"><i className="fas fa-graduation-cap" /> Centre d&apos;Examen Intelligent</div>
        <a href="/" className="btn-back"><i className="fas fa-arrow-left" /> Retour à l&apos;accueil</a>
      </div>

      <div className="hero-doc">
        <div className="hero-meta"><i className="fas fa-calendar" /> Dernière mise à jour : Mars 2026</div>
        <h1>Conditions d&apos;Utilisation</h1>
        <p>En utilisant la plateforme CEI — Centre d&apos;Examen Intelligent, vous acceptez les présentes conditions.</p>
      </div>

      <div className="content-wrap">

        {[
          { num: 1, title: "Objet et présentation de la plateforme", body: <><p>La plateforme <strong>CEI — Centre d&apos;Examen Intelligent</strong> est un service numérique destiné à l&apos;organisation, la surveillance et la correction d&apos;examens en ligne pour l&apos;<strong>UN-CHK</strong> de Dakar, Sénégal.</p><p>Elle est accessible à l&apos;adresse <strong>cei.ec2lt.sn</strong> et réservée aux utilisateurs autorisés (administrateurs, enseignants, étudiants) disposant d&apos;un compte créé par l&apos;administration.</p></> },
          { num: 2, title: "Accès et comptes utilisateurs", body: <ul><li>Les comptes sont créés exclusivement par l&apos;<strong>administration de l&apos;établissement</strong>. Aucune inscription libre n&apos;est possible.</li><li>Chaque utilisateur est responsable de la <strong>confidentialité de ses identifiants</strong> (email + mot de passe). Tout accès frauduleux doit être signalé immédiatement.</li><li>Le partage de compte est <strong>strictement interdit</strong> et constitue une faute pouvant entraîner la suppression du compte.</li><li>En cas de perte de mot de passe, contactez l&apos;administration de votre établissement.</li></ul> },
          { num: 3, title: "Surveillance des examens — collecte de données", body: <><p>Dans le cadre des <strong>examens en ligne surveillés</strong>, la plateforme utilise les technologies suivantes pour garantir l&apos;intégrité académique :</p><ul><li><strong>Caméra vidéo</strong> : votre flux vidéo est transmis en temps réel à l&apos;enseignant. Des <em>snapshots</em> horodatés peuvent être sauvegardés automatiquement.</li><li><strong>Détection faciale IA</strong> : une analyse en temps réel de votre flux caméra détecte l&apos;absence de visage, la présence de plusieurs personnes ou une non-correspondance d&apos;identité. Ces événements sont enregistrés et peuvent déclencher des alertes.</li><li><strong>Microphone</strong> : flux audio transmis pour détection de comportements suspects.</li><li><strong>Partage d&apos;écran complet</strong> : le partage de votre écran entier (moniteur complet) est obligatoire. Le partage de fenêtre ou d&apos;onglet est techniquement refusé par le système.</li><li><strong>Logs d&apos;activité</strong> : tout événement est horodaté et enregistré dans la base de données.</li><li><strong>Enregistrements vidéo</strong> : l&apos;enseignant peut activer l&apos;enregistrement de votre flux vidéo vers un stockage sécurisé.</li><li><strong>Appels privés</strong> : l&apos;enseignant peut initier un appel audio/vidéo privé avec vous.</li></ul><div className="highlight"><i className="fas fa-exclamation-triangle" /> <strong>En cliquant sur &quot;J&apos;accepte — Démarrer l&apos;examen&quot;</strong>, vous consentez explicitement à la collecte et au traitement de ces données aux fins de surveillance académique.</div><p>Ces données sont conservées pendant la durée de l&apos;année académique et accessibles uniquement aux enseignants responsables et à l&apos;administration.</p></> },
          { num: 4, title: "Règles de conduite lors des examens", body: <><p>Tout étudiant composant un examen en ligne s&apos;engage à :</p><ul><li>Ne pas changer d&apos;onglet ou de fenêtre pendant l&apos;examen</li><li>Maintenir le mode plein écran durant toute la session</li><li>Partager uniquement l&apos;<strong>écran complet (moniteur entier)</strong> — le partage de fenêtre ou d&apos;onglet est interdit et techniquement bloqué</li><li>Rester seul et visible devant la caméra</li><li>Maintenir son visage bien visible et correctement éclairé face à la caméra</li><li>Ne pas utiliser de téléphone, de documents ou d&apos;aide extérieure</li><li>Ne pas tenter d&apos;ouvrir les outils développeur du navigateur</li><li>Ne pas copier/coller du contenu externe (désactivé automatiquement)</li></ul><p>Tout manquement à ces règles peut entraîner un <strong>bannissement immédiat et irréversible</strong> de l&apos;examen, avec une note de 0, et peut faire l&apos;objet de poursuites disciplinaires.</p></> },
          { num: 5, title: "Intelligence artificielle et correction automatique", body: <><p>La plateforme utilise des services d&apos;<strong>Intelligence Artificielle</strong> pour :</p><ul><li>Générer automatiquement des sujets d&apos;examen et barèmes de notation</li><li>Corriger les copies étudiantes sur la base du barème défini par l&apos;enseignant</li><li>Analyser les réclamations de notes soumises par les étudiants</li></ul><p>Les décisions finales concernant les notes restent <strong>sous la responsabilité exclusive de l&apos;enseignant</strong>. La correction IA constitue une aide à la décision, non une décision automatique définitive.</p></> },
          { num: 6, title: "Protection des données personnelles", body: <ul><li><strong>Données collectées</strong> : nom, prénom, email, rôle, données d&apos;activité, images de surveillance, enregistrements vidéo.</li><li><strong>Finalité</strong> : gestion académique, surveillance d&apos;examens, correction de copies, génération de relevés officiels.</li><li><strong>Conservation</strong> : les données sont conservées pendant la durée de scolarité de l&apos;étudiant + 5 ans conformément aux obligations légales académiques.</li><li><strong>Droits</strong> : vous pouvez demander l&apos;accès, la rectification ou la suppression de vos données en contactant l&apos;administration.</li><li><strong>Sécurité</strong> : les données sont stockées sur des serveurs sécurisés. Les mots de passe sont chiffrés (bcrypt). Les transmissions sont protégées (HTTPS).</li></ul> },
          { num: 7, title: "Propriété intellectuelle", body: <><p>Les sujets d&apos;examen, barèmes et corrections restent la <strong>propriété intellectuelle des enseignants</strong> et de l&apos;établissement CEI. Toute reproduction, diffusion ou utilisation hors cadre académique sans autorisation est interdite.</p><p>Les copies soumises par les étudiants constituent leur propriété intellectuelle, mais l&apos;établissement dispose d&apos;un droit d&apos;usage à des fins de correction, vérification et archivage académique.</p></> },
          { num: 8, title: "Responsabilités et limitations", body: <><p>L&apos;établissement s&apos;engage à maintenir la plateforme disponible dans la mesure du possible mais ne peut garantir une disponibilité ininterrompue. En cas de panne technique pendant un examen :</p><ul><li>Vos réponses sont sauvegardées automatiquement toutes les 30 secondes</li><li>Contactez immédiatement votre enseignant via la messagerie interne ou par tout moyen disponible</li><li>L&apos;enseignant peut prolonger le délai ou reporter l&apos;examen à sa discrétion</li></ul><p>L&apos;établissement ne peut être tenu responsable des problèmes techniques liés à votre connexion Internet, votre matériel informatique ou votre navigateur.</p></> },
          { num: 9, title: "Modifications des conditions", body: <p>Ces conditions peuvent être modifiées à tout moment. Les utilisateurs seront informés par email en cas de modification substantielle. L&apos;utilisation continue de la plateforme après notification vaut acceptation des nouvelles conditions.</p> },
          { num: 10, title: "Contact", body: <ul><li><i className="fas fa-map-marker-alt" /> Cité du Savoir – Diamniadio, Castors, avenue Bourguiba, rue n°13</li><li><i className="fas fa-phone" /> +221 30 108 41 53</li><li><i className="fas fa-envelope" /> visioplus@unchk.edu.sn</li></ul> },
        ].map(a => (
          <div key={a.num} className="article">
            <div className="article-header">
              <div className="article-num">{a.num}</div>
              <h2>{a.title}</h2>
            </div>
            <div className="article-body">{a.body}</div>
          </div>
        ))}

      </div>

      <footer className="doc-footer">
        <p><a href="/">Accueil</a> &nbsp;·&nbsp; <a href="/guide-enseignant">Guide Enseignant</a> &nbsp;·&nbsp; <a href="/guide-etudiant">Guide Étudiant</a></p>
        <p style={{marginTop:8,opacity:.5}}>© 2026 CEI — Université Cheikh Hamidou Kane (UNCHK)</p>
      </footer>
    </>
  )
}
