export default function GuideResponsableExamen() {
  return (
    <>
      <style>{`
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; background:#f8fafc; color:#1e293b; line-height:1.7; }
        .topbar { background:#b45309; color:white; padding:14px 32px; display:flex; align-items:center; justify-content:space-between; position:sticky; top:0; z-index:100; box-shadow:0 2px 12px rgba(0,0,0,.2); }
        .topbar-brand { font-size:17px; font-weight:700; display:flex; align-items:center; gap:10px; }
        .topbar-brand i { font-size:22px; }
        .btn-back { background:rgba(255,255,255,.15); color:white; border:1px solid rgba(255,255,255,.3); padding:8px 18px; border-radius:8px; text-decoration:none; font-size:13px; font-weight:600; display:inline-flex; align-items:center; gap:6px; transition:.2s; }
        .btn-back:hover { background:rgba(255,255,255,.25); }
        .hero-doc { background:#b45309; color:white; padding:60px 32px; text-align:center; }
        .hero-doc h1 { font-size:2.4rem; font-weight:800; margin-bottom:12px; }
        .hero-doc p { font-size:1.1rem; opacity:.9; max-width:600px; margin:0 auto; }
        .hero-badge { display:inline-flex; align-items:center; gap:6px; background:rgba(255,255,255,.15); border:1px solid rgba(255,255,255,.3); padding:6px 16px; border-radius:99px; font-size:13px; font-weight:600; margin-bottom:20px; }
        .content-wrap { max-width:900px; margin:0 auto; padding:48px 24px 80px; }
        .toc { background:white; border-radius:14px; border:1px solid #e2e8f0; padding:24px 28px; margin-bottom:40px; }
        .toc h3 { font-size:14px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:.05em; margin-bottom:14px; }
        .toc-list { list-style:none; display:flex; flex-direction:column; gap:6px; }
        .toc-list a { color:#b45309; text-decoration:none; font-size:14px; font-weight:500; display:flex; align-items:center; gap:8px; }
        .toc-list a:hover { text-decoration:underline; }
        .toc-list a i { width:18px; text-align:center; font-size:13px; color:#94a3b8; }
        .section { background:white; border-radius:16px; border:1px solid #e2e8f0; margin-bottom:32px; overflow:hidden; }
        .section-header { background:#fffbeb; border-bottom:1px solid #fde68a; padding:20px 28px; display:flex; align-items:center; gap:14px; }
        .section-icon { width:48px; height:48px; background:#b45309; border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:20px; color:white; flex-shrink:0; }
        .section-header h2 { font-size:1.15rem; font-weight:700; color:#92400e; margin:0; }
        .section-body { padding:28px; }
        .steps { display:flex; flex-direction:column; gap:20px; }
        .step { display:flex; gap:16px; align-items:flex-start; }
        .step-num { width:36px; height:36px; background:#b45309; color:white; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:14px; font-weight:700; flex-shrink:0; margin-top:2px; }
        .step-content h4 { font-size:15px; font-weight:700; color:#0f172a; margin-bottom:6px; }
        .step-content p { font-size:14px; color:#475569; line-height:1.65; }
        .step-content ul { margin-top:8px; padding-left:18px; }
        .step-content li { font-size:13px; color:#64748b; margin-bottom:4px; }
        .tip { background:#fffbeb; border:1px solid #fde68a; border-left:4px solid #b45309; border-radius:8px; padding:14px 16px; margin-top:14px; font-size:13px; color:#92400e; display:flex; align-items:flex-start; gap:10px; }
        .tip i { color:#b45309; margin-top:2px; flex-shrink:0; }
        .info { background:#eff6ff; border:1px solid #bfdbfe; border-left:4px solid #2563eb; border-radius:8px; padding:14px 16px; margin-top:14px; font-size:13px; color:#1e40af; display:flex; align-items:flex-start; gap:10px; }
        .info i { color:#2563eb; margin-top:2px; flex-shrink:0; }
        .feature-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(240px,1fr)); gap:14px; margin-top:16px; }
        .feature-item { background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:16px; }
        .feature-item i { color:#b45309; font-size:18px; margin-bottom:10px; display:block; }
        .feature-item h5 { font-size:13px; font-weight:700; color:#0f172a; margin-bottom:6px; }
        .feature-item p { font-size:12px; color:#64748b; line-height:1.5; }
        .status-row { display:flex; align-items:center; gap:12px; padding:10px 14px; border-radius:8px; margin-bottom:8px; }
        .status-dot { width:14px; height:14px; border-radius:50%; flex-shrink:0; }
        .status-row p { font-size:13px; color:#475569; margin:0; }
        .guide-img { display:block; width:100%; max-width:720px; margin:18px auto 6px; border-radius:12px; border:1px solid #e2e8f0; box-shadow:0 4px 16px rgba(0,0,0,.08); }
        footer.doc-footer { background:#1e293b; color:rgba(255,255,255,.7); text-align:center; padding:32px; font-size:13px; }
        footer.doc-footer a { color:#fbbf24; text-decoration:none; font-weight:600; }
        @media(max-width:640px) { .hero-doc h1 { font-size:1.8rem; } .content-wrap { padding:24px 16px 60px; } }
      `}</style>

      <div className="topbar">
        <div className="topbar-brand"><i className="fas fa-graduation-cap" /> Centre d&apos;Examen Intelligent</div>
        <a href="/" className="btn-back"><i className="fas fa-arrow-left" /> Retour à l&apos;accueil</a>
      </div>

      <div className="hero-doc">
        <div className="hero-badge"><i className="fas fa-clipboard-check" /> Pour les Responsables d&apos;examen</div>
        <h1>Guide Responsable d&apos;examen</h1>
        <p>Tout ce qu&apos;il faut pour faire avancer les examens quand un enseignant n&apos;a pas le temps : du sujet à la publication des résultats.</p>
      </div>

      <div className="content-wrap">
        <div className="toc">
          <h3><i className="fas fa-list" /> &nbsp;Sommaire</h3>
          <ul className="toc-list">
            <li><a href="#role"><i className="fas fa-info-circle" /> 1. Le rôle — vue d&apos;ensemble</a></li>
            <li><a href="#menu"><i className="fas fa-compass" /> 2. Votre menu</a></li>
            <li><a href="#parcours"><i className="fas fa-route" /> 3. Reprendre un examen de A à Z</a></li>
            <li><a href="#verifs"><i className="fas fa-clipboard-check" /> 4. Les contrôles avant chaque examen</a></li>
            <li><a href="#limites"><i className="fas fa-circle-info" /> 5. Ce que vous ne gérez pas</a></li>
          </ul>
        </div>

        <div className="section" id="role">
          <div className="section-header"><div className="section-icon"><i className="fas fa-info-circle" /></div><h2>1. Le rôle Responsable d&apos;examen — vue d&apos;ensemble</h2></div>
          <div className="section-body">
            <p style={{color:'#475569',marginBottom:20}}>Le responsable d&apos;examen est la personne qui <strong>fait avancer les examens</strong> quand l&apos;enseignant d&apos;un EC n&apos;a pas le temps de les préparer, de les programmer ou de les corriger. Vous avez les <strong>mêmes droits que l&apos;administrateur</strong>, dans <strong>tous les EC</strong>, sans avoir besoin d&apos;être affecté : vous voyez tous les sujets et tous les examens, y compris ceux créés par les enseignants et les nouveaux.</p>
            <div className="feature-grid">
              <div className="feature-item"><i className="fas fa-eye" /><h5>Tout voir</h5><p>Tous les sujets, tous les examens (brouillons, planifiés, en cours, terminés), toutes les copies et tous les résultats.</p></div>
              <div className="feature-item"><i className="fas fa-hand-holding-hand" /><h5>Faire à la place de l&apos;enseignant</h5><p>Créer le sujet, programmer l&apos;examen, le lancer, le suivre, corriger et publier : tout le parcours, de A à Z.</p></div>
              <div className="feature-item"><i className="fas fa-bell" /><h5>Être prévenu</h5><p>Vous recevez les alertes de tous les examens (cloche et page Notifications), sans dépendre de l&apos;enseignant.</p></div>
              <div className="feature-item"><i className="fas fa-user-lock" /><h5>Une seule limite</h5><p>Vous ne créez, ne modifiez et ne supprimez pas les comptes utilisateurs : la liste reste consultable en lecture seule.</p></div>
            </div>
            <div className="info"><i className="fas fa-info-circle" /><div>L&apos;enseignant responsable de l&apos;EC garde ses droits : si vous avez créé un examen à sa place, il le voit, peut le modifier et le corriger. Un tuteur voit, surveille et corrige, mais ne modifie pas et ne publie pas.</div></div>
          </div>
        </div>

        <div className="section" id="menu">
          <div className="section-header"><div className="section-icon"><i className="fas fa-compass" /></div><h2>2. Votre menu</h2></div>
          <div className="section-body">
            <p style={{color:'#475569',marginBottom:16}}>Après connexion, vous arrivez sur votre tableau de bord. Le menu de gauche reprend l&apos;espace administrateur, plus une rubrique <strong>« À la place d&apos;un enseignant »</strong> :</p>
            <div className="feature-grid">
              <div className="feature-item"><i className="fas fa-layer-group" /><h5>Gestion</h5><p>Maquette (formations, UE, EC), Affectations EC, Groupes Surveillants, Inscriptions UE. « Utilisateurs » : consultation seulement.</p></div>
              <div className="feature-item"><i className="fas fa-file-alt" /><h5>Sujets &amp; Examens</h5><p>Générer Suggestions, Créer Sujet, Sujets, Examens en Ligne, Historique, Calendrier.</p></div>
              <div className="feature-item"><i className="fas fa-check-double" /><h5>Évaluations</h5><p>Copies Corrigées, Relevés de Notes, Réclamations, Corriger Examens en Ligne.</p></div>
              <div className="feature-item"><i className="fas fa-database" /><h5>Ressources</h5><p>Banque de questions, Analytique, Sécurité, Restitution, Résultats, Notifications.</p></div>
            </div>
          </div>
        </div>

        <div className="section" id="parcours">
          <div className="section-header"><div className="section-icon"><i className="fas fa-route" /></div><h2>3. Reprendre un examen à la place d&apos;un enseignant — de A à Z</h2></div>
          <div className="section-body">
            <p style={{color:'#475569',marginBottom:20}}>Voici le parcours complet, dans l&apos;ordre. Vous pouvez prendre le relais à n&apos;importe quelle étape : un sujet déjà créé par l&apos;enseignant, un examen déjà programmé, des copies à corriger…</p>
            <div className="steps">
              <div className="step"><div className="step-num">1</div><div className="step-content"><h4>Vérifier l&apos;EC et son enseignant</h4><p>Dans <strong>Maquette</strong>, repérez l&apos;EC concerné. Dans <strong>Affectations EC</strong>, vous voyez quel enseignant en est responsable. Vous n&apos;avez pas besoin d&apos;être affecté pour agir sur cet EC.</p></div></div>
              <div className="step"><div className="step-num">2</div><div className="step-content"><h4>Créer le sujet</h4><p>Deux façons, dans le menu <strong>Sujets &amp; Examens</strong> :</p><ul><li><strong>Créer Sujet</strong> : déposez l&apos;épreuve (PDF, Word ou texte). Si l&apos;enseignant vous a donné le <strong>corrigé</strong>, déposez-le en même temps (le nom du fichier doit contenir « corrigé », « correction », « barème » ou « solution ») : le barème est alors écrit directement depuis lui, et le corrigé n&apos;est jamais montré aux étudiants.</li><li><strong>Générer Suggestions</strong> : l&apos;IA propose un sujet à partir du cours (documents ou cours Moodle) ; vous choisissez les types de questions et les points.</li></ul><p style={{marginTop:8}}>Après le dépôt, le sujet est <strong>déjà enregistré</strong>. Relisez le texte et le barème, corrigez si besoin, puis cliquez sur <strong>Terminer</strong> pour valider vos modifications, ou sur <strong>Annuler</strong> pour supprimer le sujet.</p>
            <div className="tip"><i className="fas fa-lightbulb" /><div>Types de questions pris en charge : QCM, QCM à réponses multiples, Vrai/Faux, appariement, association avec propositions en trop, classement en catégories, remise en ordre, texte à trous, champs à compléter, réponse courte, réponse numérique, calcul à variables, placement sur image, sous-questions liées, questions ouvertes, maths et programmation.</div></div></div></div>
              <div className="step"><div className="step-num">3</div><div className="step-content"><h4>Vérifier le sujet comme un étudiant</h4><p>Ouvrez l&apos;examen puis cliquez sur <strong>Prévisualiser</strong> : vous passez l&apos;épreuve exactement comme un étudiant (sans surveillance, rien n&apos;est enregistré) et la note automatique s&apos;affiche à la fin. Contrôlez au moins une question de chaque type.</p></div></div>
              <div className="step"><div className="step-num">4</div><div className="step-content"><h4>Créer l&apos;examen en ligne</h4><p>Menu <strong>Examens en Ligne</strong> → <strong>Créer un Examen en Ligne</strong> : choisissez le <strong>sujet associé</strong>, le <strong>titre</strong>, le <strong>début</strong> et la <strong>fin</strong>, les <strong>instructions</strong> aux étudiants, le nombre de <strong>questions par page</strong>, l&apos;ordre aléatoire éventuel et les seuils de surveillance (changements de fenêtre, visage absent). Activez la <strong>correction automatique par l&apos;IA</strong> si vous le souhaitez.</p><p style={{marginTop:8}}>Si beaucoup d&apos;étudiants composent, répartissez-les en <strong>vagues</strong> (créneaux successifs) pour ne pas saturer la connexion.</p></div></div>
              <div className="step"><div className="step-num">5</div><div className="step-content"><h4>Prévoir les surveillants</h4><p>Dans <strong>Groupes Surveillants</strong>, vérifiez que l&apos;EC est rattaché à un groupe de surveillants disponible à l&apos;horaire de l&apos;examen. Sans groupe, personne ne surveille automatiquement : c&apos;est le contrôle le plus important avant le jour J.</p></div></div>
              <div className="step"><div className="step-num">6</div><div className="step-content"><h4>Lancer l&apos;examen et le suivre</h4><p>Au moment prévu, cliquez sur <strong>Activer</strong>, puis sur <strong>Surveiller</strong> pour suivre les étudiants en direct. Vous pouvez <strong>prolonger</strong> le temps d&apos;un étudiant, envoyer un avertissement ou exclure en cas de fraude avérée. La cloche et la page <strong>Notifications</strong> vous signalent les incidents de tous les examens. À l&apos;heure de fin, les copies non rendues sont <strong>clôturées automatiquement avec les réponses déjà saisies</strong>.</p></div></div>
              <div className="step"><div className="step-num">7</div><div className="step-content"><h4>Corriger</h4><p>Les questions à choix (QCM, vrai/faux, association, classement, ordre, trous, réponses courtes et numériques, calculs) sont <strong>notées automatiquement</strong>. Les questions rédigées sont corrigées par l&apos;IA si la correction automatique est activée, ou par vous dans <strong>Corriger Examens en Ligne</strong>.</p><ul><li>Une copie <strong>sans aucune réponse</strong> reçoit <strong>0/20</strong>, que vous pouvez modifier à la main.</li><li>Une copie <strong>non soumise</strong> est corrigée avec ce que l&apos;étudiant avait déjà répondu.</li><li>Vous pouvez toujours <strong>modifier une note</strong>, question par question ou globalement.</li></ul></div></div>
              <div className="step"><div className="step-num">8</div><div className="step-content"><h4>Publier les résultats</h4><p>Les étudiants ne voient leur note qu&apos;après la publication. Dans l&apos;examen, cliquez sur <strong>Publier les résultats</strong>. Vous pouvez aussi <strong>exporter les notes en Excel</strong> (colonnes séparées, prêt à ouvrir), éditer les <strong>Relevés de Notes</strong>, traiter les <strong>Réclamations</strong> et proposer des copies-exemples dans <strong>Restitution</strong>.</p></div></div>
            </div>
          </div>
        </div>

        <div className="section" id="verifs">
          <div className="section-header"><div className="section-icon"><i className="fas fa-clipboard-check" /></div><h2>4. Les contrôles à faire avant chaque examen</h2></div>
          <div className="section-body">
            <div className="steps">
              <div className="step"><div className="step-num">✓</div><div className="step-content"><h4>Le sujet</h4><p>Prévisualisé, avec un barème complet (total des points correct) et, pour une épreuve importée, le message « Épreuve reconnue automatiquement » sans point à contrôler.</p></div></div>
              <div className="step"><div className="step-num">✓</div><div className="step-content"><h4>Les étudiants</h4><p>Ils sont inscrits aux UE de l&apos;EC (<strong>Inscriptions UE</strong>) et savent se connecter : testez avec un compte de test, jamais avec le compte d&apos;un vrai étudiant.</p></div></div>
              <div className="step"><div className="step-num">✓</div><div className="step-content"><h4>La surveillance</h4><p>Un groupe de surveillants est rattaché à l&apos;EC et disponible à l&apos;horaire ; les horaires de l&apos;examen (début, fin, fuseau) sont corrects.</p></div></div>
              <div className="step"><div className="step-num">✓</div><div className="step-content"><h4>La connexion</h4><p>Pour un grand nombre d&apos;étudiants en même temps, utilisez les vagues : la surveillance vidéo consomme beaucoup de bande passante.</p></div></div>
            </div>
            <div className="tip"><i className="fas fa-lightbulb" /><div>Une copie vide ou partielle ne bloque rien : le système les clôture et les note. Vous gardez toujours la main pour corriger à la main ensuite.</div></div>
          </div>
        </div>

        <div className="section" id="limites">
          <div className="section-header"><div className="section-icon"><i className="fas fa-circle-info" /></div><h2>5. Ce que vous ne gérez pas</h2></div>
          <div className="section-body">
            <p style={{color:'#475569'}}>La <strong>gestion des comptes utilisateurs</strong> (création, modification, suppression, import de comptes) et les <strong>clés d&apos;accès externes</strong> restent réservées à l&apos;administrateur. Si un étudiant ou un enseignant n&apos;arrive pas à se connecter, transmettez la demande à l&apos;administrateur de la plateforme.</p>
          </div>
        </div>
      </div>

      <footer className="doc-footer">
        <p>Une question ? Écrivez à <a href="mailto:visioplus@unchk.edu.sn">visioplus@unchk.edu.sn</a> · <a href="/">Retour à CEI</a></p>
      </footer>
    </>
  )
}
