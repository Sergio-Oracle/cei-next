export default function GuideEtudiant() {
  return (
    <>
      <style>{`
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; background:#f8fafc; color:#1e293b; line-height:1.7; }
        .topbar { background:#059669; color:white; padding:14px 32px; display:flex; align-items:center; justify-content:space-between; position:sticky; top:0; z-index:100; box-shadow:0 2px 12px rgba(0,0,0,.2); }
        .topbar-brand { font-size:17px; font-weight:700; display:flex; align-items:center; gap:10px; }
        .topbar-brand i { font-size:22px; }
        .btn-back { background:rgba(255,255,255,.15); color:white; border:1px solid rgba(255,255,255,.3); padding:8px 18px; border-radius:8px; text-decoration:none; font-size:13px; font-weight:600; display:inline-flex; align-items:center; gap:6px; transition:.2s; }
        .btn-back:hover { background:rgba(255,255,255,.25); }
        .hero-doc { background:#059669; color:white; padding:60px 32px; text-align:center; }
        .hero-doc h1 { font-size:2.4rem; font-weight:800; margin-bottom:12px; }
        .hero-doc p { font-size:1.1rem; opacity:.9; max-width:600px; margin:0 auto; }
        .hero-badge { display:inline-flex; align-items:center; gap:6px; background:rgba(255,255,255,.15); border:1px solid rgba(255,255,255,.3); padding:6px 16px; border-radius:99px; font-size:13px; font-weight:600; margin-bottom:20px; }
        .content-wrap { max-width:900px; margin:0 auto; padding:48px 24px 80px; }
        .toc { background:white; border-radius:14px; border:1px solid #e2e8f0; padding:24px 28px; margin-bottom:40px; }
        .toc h3 { font-size:14px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:.05em; margin-bottom:14px; }
        .toc-list { list-style:none; display:flex; flex-direction:column; gap:6px; }
        .toc-list a { color:#059669; text-decoration:none; font-size:14px; font-weight:500; display:flex; align-items:center; gap:8px; }
        .toc-list a:hover { text-decoration:underline; }
        .toc-list a i { width:18px; text-align:center; font-size:13px; color:#94a3b8; }
        .section { background:white; border-radius:16px; border:1px solid #e2e8f0; margin-bottom:32px; overflow:hidden; }
        .section-header { background:#ecfdf5; border-bottom:1px solid #a7f3d0; padding:20px 28px; display:flex; align-items:center; gap:14px; }
        .section-icon { width:48px; height:48px; background:#059669; border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:20px; color:white; flex-shrink:0; }
        .section-header h2 { font-size:1.15rem; font-weight:700; color:#064e3b; margin:0; }
        .section-body { padding:28px; }
        .steps { display:flex; flex-direction:column; gap:20px; }
        .step { display:flex; gap:16px; align-items:flex-start; }
        .step-num { width:36px; height:36px; background:#059669; color:white; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:14px; font-weight:700; flex-shrink:0; margin-top:2px; }
        .step-content h4 { font-size:15px; font-weight:700; color:#0f172a; margin-bottom:6px; }
        .step-content p { font-size:14px; color:#475569; line-height:1.65; }
        .step-content ul { margin-top:8px; padding-left:18px; }
        .step-content li { font-size:13px; color:#64748b; margin-bottom:4px; }
        .warn { background:#fef3c7; border:1px solid #fcd34d; border-left:4px solid #f59e0b; border-radius:8px; padding:14px 16px; margin-top:14px; font-size:13px; color:#92400e; display:flex; align-items:flex-start; gap:10px; }
        .warn i { color:#f59e0b; margin-top:2px; flex-shrink:0; }
        .tip { background:#ecfdf5; border:1px solid #a7f3d0; border-left:4px solid #059669; border-radius:8px; padding:14px 16px; margin-top:14px; font-size:13px; color:#065f46; display:flex; align-items:flex-start; gap:10px; }
        .tip i { color:#059669; margin-top:2px; flex-shrink:0; }
        .danger { background:#fff1f2; border:1px solid #fecdd3; border-left:4px solid #ef4444; border-radius:8px; padding:14px 16px; margin-top:14px; font-size:13px; color:#9f1239; display:flex; align-items:flex-start; gap:10px; }
        .danger i { color:#ef4444; margin-top:2px; flex-shrink:0; }
        .rule-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(200px,1fr)); gap:12px; margin-top:16px; }
        .rule-card { border-radius:10px; padding:16px; border:1px solid; text-align:center; }
        .rule-card.bad { background:#fff1f2; border-color:#fecdd3; color:#9f1239; }
        .rule-card.bad i { font-size:24px; display:block; margin-bottom:8px; color:#ef4444; }
        .rule-card.good { background:#ecfdf5; border-color:#a7f3d0; color:#065f46; }
        .rule-card.good i { font-size:24px; display:block; margin-bottom:8px; color:#059669; }
        .rule-card p { font-size:12px; font-weight:600; }
        .guide-img { display:block; width:100%; max-width:720px; margin:18px auto 6px; border-radius:12px; border:1px solid #e2e8f0; box-shadow:0 4px 16px rgba(0,0,0,.08); }
        footer.doc-footer { background:#1e293b; color:rgba(255,255,255,.7); text-align:center; padding:32px; font-size:13px; }
        footer.doc-footer a { color:#34d399; text-decoration:none; font-weight:600; }
        @media(max-width:640px) { .hero-doc h1 { font-size:1.8rem; } .content-wrap { padding:24px 16px 60px; } }
      `}</style>

      <div className="topbar">
        <div className="topbar-brand"><i className="fas fa-graduation-cap" /> Centre d&apos;Examen Intelligent</div>
        <a href="/" className="btn-back"><i className="fas fa-arrow-left" /> Retour à l&apos;accueil</a>
      </div>

      <div className="hero-doc">
        <div className="hero-badge"><i className="fas fa-user-graduate" /> Pour les Étudiants</div>
        <h1>Guide Étudiant</h1>
        <p>Tout ce que vous devez savoir pour passer vos examens en ligne sur la plateforme CEI.</p>
      </div>

      <div className="content-wrap">
        <div className="toc">
          <h3><i className="fas fa-list" /> &nbsp;Sommaire</h3>
          <ul className="toc-list">
            <li><a href="#connexion"><i className="fas fa-sign-in-alt" /> 1. Se connecter à la plateforme</a></li>
            <li><a href="#tableau-bord"><i className="fas fa-home" /> 2. Votre tableau de bord</a></li>
            <li><a href="#demarrer"><i className="fas fa-play" /> 3. Démarrer un examen</a></li>
            <li><a href="#pendant"><i className="fas fa-pen" /> 4. Pendant l&apos;examen</a></li>
            <li><a href="#regles"><i className="fas fa-shield-alt" /> 5. Règles à respecter</a></li>
            <li><a href="#soumettre"><i className="fas fa-paper-plane" /> 6. Soumettre votre copie</a></li>
            <li><a href="#resultats"><i className="fas fa-star" /> 7. Consulter vos résultats</a></li>
            <li><a href="#detection-faciale"><i className="fas fa-user-check" /> 5b. Détection faciale — conseils</a></li>
            <li><a href="#reclamation"><i className="fas fa-comment-dots" /> 8. Faire une réclamation</a></li>
          </ul>
        </div>

        <div className="section" id="connexion">
          <div className="section-header"><div className="section-icon"><i className="fas fa-sign-in-alt" /></div><h2>1. Se connecter à la plateforme</h2></div>
          <div className="section-body">
            <div className="steps">
              <div className="step"><div className="step-num">1</div><div className="step-content"><h4>Accéder à l&apos;application</h4><p>Rendez-vous sur l&apos;adresse de la plateforme communiquée par votre établissement et cliquez sur <strong>Commencer Maintenant</strong>, ou accédez directement à la page de connexion.</p></div></div>
              <div className="step"><div className="step-num">2</div><div className="step-content"><h4>Saisir vos identifiants</h4><p>Entrez votre <strong>adresse email institutionnelle</strong> et votre <strong>mot de passe</strong> fournis par l&apos;administration. Si vous n&apos;avez pas de compte, contactez votre administration.</p></div></div>
            </div>
            <div className="tip"><i className="fas fa-lightbulb" /> Votre session reste active pendant 30 jours. Déconnectez-vous toujours sur un ordinateur partagé.</div>
          </div>
        </div>

        <div className="section" id="tableau-bord">
          <div className="section-header"><div className="section-icon"><i className="fas fa-home" /></div><h2>2. Votre tableau de bord</h2></div>
          <div className="section-body">
            <p style={{color:'#475569',marginBottom:16}}>Depuis le menu principal, vous avez accès à :</p>
            <div className="steps">
              <div className="step"><div className="step-num"><i className="fas fa-laptop-code" style={{fontSize:14}} /></div><div className="step-content"><h4>Examens en Ligne</h4><p>Liste de tous vos examens avec leur statut : <span style={{color:'#d97706',fontWeight:600}}>Pas encore ouvert</span> · <span style={{color:'#059669',fontWeight:600}}>Composer</span> · <span style={{color:'#94a3b8',fontWeight:600}}>Terminé</span></p></div></div>
              <div className="step"><div className="step-num"><i className="fas fa-file-alt" style={{fontSize:14}} /></div><div className="step-content"><h4>Mes Copies</h4><p>Consultez vos copies soumises, vos notes et les feedbacks de correction IA.</p></div></div>
              <div className="step"><div className="step-num"><i className="fas fa-award" style={{fontSize:14}} /></div><div className="step-content"><h4>Relevés de Notes</h4><p>Téléchargez vos relevés semestriels officiels en PDF avec votre GPA et vos crédits.</p></div></div>
            </div>
          </div>
        </div>

        <div className="section" id="demarrer">
          <div className="section-header"><div className="section-icon"><i className="fas fa-play" /></div><h2>3. Démarrer un examen</h2></div>
          <div className="section-body">
            <div className="steps">
              <div className="step"><div className="step-num">1</div><div className="step-content"><h4>Repérer l&apos;examen disponible</h4><p>Dans <strong>Examens en Ligne</strong>, le bouton <span style={{background:'#10b981',color:'white',padding:'2px 8px',borderRadius:4,fontSize:12,fontWeight:700}}>Composer</span> apparaît quand l&apos;examen est en cours. Si trop tôt, cliquez sur <span style={{background:'#fef9c3',color:'#d97706',padding:'2px 8px',borderRadius:4,fontSize:12,fontWeight:700,border:'1px solid #fcd34d'}}>Pas encore ouvert</span> pour voir l&apos;heure de début exacte.</p><img className="guide-img" src="/screenshots/capture-8.jpg" alt="Liste des examens en ligne côté étudiant avec le bouton Composer" /></div></div>
              <div className="step"><div className="step-num">2</div><div className="step-content"><h4>Accepter la surveillance</h4><p>Une fenêtre de consentement s&apos;affiche. Lisez attentivement les conditions de surveillance, puis cliquez sur <strong>J&apos;accepte — Démarrer l&apos;examen</strong>.</p><div className="warn"><i className="fas fa-exclamation-triangle" /> Votre navigateur demandera l&apos;accès à la caméra et au microphone. Vous <strong>devez</strong> les autoriser pour pouvoir composer.</div><img className="guide-img" src="/screenshots/capture-11.jpg" alt="Attestation d'honneur à signer avant de démarrer l'examen" /><img className="guide-img" src="/screenshots/capture-12.jpg" alt="Écran de demande d'accès caméra, microphone et partage d'écran" /></div></div>
              <div className="step"><div className="step-num">3</div><div className="step-content"><h4>Mode plein écran</h4><p>L&apos;examen s&apos;ouvre en plein écran automatiquement. Votre caméra s&apos;active, la surveillance commence. Ne quittez pas le plein écran pendant l&apos;examen.</p></div></div>
            </div>
          </div>
        </div>

        <div className="section" id="pendant">
          <div className="section-header"><div className="section-icon"><i className="fas fa-pen" /></div><h2>4. Pendant l&apos;examen</h2></div>
          <div className="section-body">
            <div className="steps">
              <div className="step"><div className="step-num">1</div><div className="step-content"><h4>Lire le sujet</h4><p>Le sujet s&apos;affiche dans le panneau principal. Seules les questions sont visibles — le barème est masqué. Utilisez le bouton <strong>Réduire/Agrandir</strong> pour ajuster l&apos;affichage.</p><img className="guide-img" src="/screenshots/capture-14.jpg" alt="Interface de composition avec surveillance IA active, réponses et bouton Soumettre" /></div></div>
              <div className="step"><div className="step-num">2</div><div className="step-content"><h4>Rédiger vos réponses</h4><p>Écrivez vos réponses dans la zone de texte. Indiquez clairement le numéro de chaque question (ex : <em>&quot;Question 1 : ...&quot;</em>). La sauvegarde est automatique toutes les 30 secondes.</p></div></div>
              <div className="step"><div className="step-num">3</div><div className="step-content"><h4>Partage d&apos;écran complet obligatoire</h4><p>Le partage de votre écran est <strong>obligatoire</strong>. Une boîte de dialogue du navigateur s&apos;affiche — vous <strong>devez</strong> sélectionner l&apos;onglet <strong>&quot;Tout l&apos;écran&quot;</strong> puis choisir votre moniteur entier et confirmer.</p><div className="danger"><i className="fas fa-ban" /> <div><strong>Interdit :</strong> Le partage d&apos;une <strong>fenêtre</strong> ou d&apos;un <strong>onglet</strong> est automatiquement refusé par le système. Seul l&apos;<strong>écran complet (moniteur entier)</strong> est accepté. Si vous partagez une fenêtre, un message d&apos;erreur s&apos;affiche et vous devrez recommencer.</div><img className="guide-img" src="/screenshots/capture-13.jpg" alt="Dialogue du navigateur pour choisir Tout l'écran lors du partage d'écran" /></div></div></div>
              <div className="step"><div className="step-num">4</div><div className="step-content"><h4>Contacter l&apos;enseignant</h4><p>En cas de question ou problème technique, utilisez la zone <strong>&quot;Contacter l&apos;enseignant&quot;</strong> en bas du panneau de surveillance. L&apos;enseignant verra votre message sur son dashboard et pourra vous répondre.</p><div className="tip"><i className="fas fa-lightbulb" /> Les réponses de l&apos;enseignant apparaissent en bleu dans le panneau gauche (message) ou en orange (avertissement).</div><div className="tip" style={{marginTop:10}}><i className="fas fa-phone" style={{color:'#2563eb'}} /> <span style={{color:'#1e3a8a'}}>Besoin d&apos;une explication orale ? Cliquez sur le bouton <strong>microphone violet</strong> dans la zone de messagerie pour envoyer une demande d&apos;appel vocal à l&apos;enseignant. Si celui-ci accepte, une fenêtre d&apos;appel audio/vidéo privé s&apos;ouvrira automatiquement.</span></div></div></div>
            </div>
          </div>
        </div>

        <div className="section" id="regles">
          <div className="section-header"><div className="section-icon"><i className="fas fa-shield-alt" /></div><h2>5. Règles de surveillance à respecter</h2></div>
          <div className="section-body">
            <div className="rule-grid">
              <div className="rule-card bad"><i className="fas fa-window-restore" /><p>Ne changez PAS d&apos;onglet ou de fenêtre</p></div>
              <div className="rule-card bad"><i className="fas fa-compress" /><p>Ne quittez PAS le plein écran</p></div>
              <div className="rule-card bad"><i className="fas fa-user-slash" /><p>Gardez votre visage visible en permanence</p></div>
              <div className="rule-card bad"><i className="fas fa-users" /><p>Soyez seul devant la caméra</p></div>
              <div className="rule-card bad"><i className="fas fa-terminal" /><p>N&apos;ouvrez PAS les outils développeur</p></div>
              <div className="rule-card bad"><i className="fas fa-copy" /><p>Le copier/coller est désactivé</p></div>
              <div className="rule-card bad"><i className="fas fa-window-maximize" /><p>Partage fenêtre/onglet interdit — écran complet uniquement</p></div>
              <div className="rule-card good"><i className="fas fa-check-circle" /><p>Répondez calmement dans la zone de texte</p></div>
              <div className="rule-card good"><i className="fas fa-comment" /><p>Posez vos questions via la messagerie</p></div>
              <div className="rule-card good"><i className="fas fa-phone" /><p>Demandez un appel vocal si besoin d&apos;explications</p></div>
            </div>
            <div className="danger" style={{marginTop:20}}><i className="fas fa-ban" /> <div><strong>Attention :</strong> Le dépassement des seuils configurés (changements de fenêtre, absence du visage, outils dev) entraîne un <strong>bannissement immédiat et irréversible</strong> de l&apos;examen. Votre tentative sera notée 0.</div></div>
          </div>
        </div>

        <div className="section" id="detection-faciale">
          <div className="section-header"><div className="section-icon"><i className="fas fa-user-check" /></div><h2>5b. Détection faciale — conseils pratiques</h2></div>
          <div className="section-body">
            <p style={{color:'#475569',marginBottom:16}}>La plateforme utilise la reconnaissance faciale IA pour vérifier votre présence en continu. Voici comment éviter les alertes.</p>
            <div className="steps">
              <div className="step"><div className="step-num">1</div><div className="step-content"><h4>Positionnement optimal</h4><p>Placez-vous face à la caméra, à environ <strong>40–80 cm</strong>. Votre visage doit être entièrement visible, bien éclairé (lumière devant vous, non derrière). Évitez les contre-jours ou les casquettes masquant le visage.</p></div></div>
              <div className="step"><div className="step-num">2</div><div className="step-content"><h4>Indicateurs de statut (bandeau couleur)</h4><p>Un bandeau coloré sous la caméra vous informe en temps réel :</p><ul><li><span style={{color:'#059669',fontWeight:700}}>Vert</span> — Visage reconnu, tout va bien</li><li><span style={{color:'#d97706',fontWeight:700}}>Jaune</span> — Repositionnez-vous : visage mal détecté</li><li><span style={{color:'#dc2626',fontWeight:700}}>Rouge</span> — Alerte : visage absent ou plusieurs visages détectés</li><li><span style={{color:'#2563eb',fontWeight:700}}>Bleu</span> — Capture de référence en cours, restez immobile</li></ul><img className="guide-img" src="/screenshots/capture-14.jpg" alt="Indicateur Visage OK affiché sur le flux caméra pendant la composition" /></div></div>
              <div className="step"><div className="step-num">3</div><div className="step-content"><h4>Si le système ne vous reconnaît plus</h4><p>Le système tente automatiquement une <strong>recapture de référence</strong> après 5 détections consécutives incorrectes. Suivez les instructions du bandeau jaune (repositionnez-vous, regardez la caméra). Après recapture, la reconnaissance reprend normalement.</p><div className="tip"><i className="fas fa-lightbulb" /> 3 alertes consécutives sont nécessaires avant qu&apos;un incident ne soit enregistré. Un bon repositionnement interrompt le compteur.</div></div></div>
              <div className="step"><div className="step-num">4</div><div className="step-content"><h4>Visages multiples</h4><p>Si une autre personne apparaît dans le champ de la caméra, une alerte <strong>&quot;Plusieurs visages détectés&quot;</strong> est envoyée immédiatement au surveillant. Assurez-vous d&apos;être <strong>seul</strong> devant la caméra pendant toute la durée de l&apos;examen.</p></div></div>
            </div>
          </div>
        </div>

        <div className="section" id="soumettre">
          <div className="section-header"><div className="section-icon"><i className="fas fa-paper-plane" /></div><h2>6. Soumettre votre copie</h2></div>
          <div className="section-body">
            <div className="steps">
              <div className="step"><div className="step-num">1</div><div className="step-content"><h4>Soumettre manuellement</h4><p>Quand vous avez terminé, cliquez sur <span style={{background:'#059669',color:'white',padding:'3px 10px',borderRadius:6,fontSize:12,fontWeight:700}}><i className="fas fa-paper-plane" /> Soumettre l&apos;examen</span>. Une confirmation s&apos;affiche. <strong>Cette action est irréversible.</strong></p></div></div>
              <div className="step"><div className="step-num">2</div><div className="step-content"><h4>Soumission automatique</h4><p>Si le temps s&apos;écoule, votre copie est soumise automatiquement avec le contenu sauvegardé. Assurez-vous que la sauvegarde automatique fonctionne (indicateur vert en bas de la zone de réponse).</p></div></div>
            </div>
          </div>
        </div>

        <div className="section" id="resultats">
          <div className="section-header"><div className="section-icon"><i className="fas fa-star" /></div><h2>7. Consulter vos résultats</h2></div>
          <div className="section-body">
            <div className="steps">
              <div className="step"><div className="step-num">1</div><div className="step-content"><h4>Voir la note et le feedback</h4><p>Dans <strong>Mes Copies</strong>, cliquez sur une copie corrigée pour voir votre note, le feedback détaillé de l&apos;IA par question et les commentaires de l&apos;enseignant.</p><div className="warn"><i className="fas fa-clock" /> Même une fois votre copie corrigée, la note reste masquée (affichage <strong>&quot;En attente de publication&quot;</strong>) tant que l&apos;enseignant n&apos;a pas explicitement cliqué sur &quot;Publier les notes&quot; — généralement après délibération. Aucune notification ne vous prévient : revenez consulter la page régulièrement.</div></div></div>
              <div className="step"><div className="step-num">2</div><div className="step-content"><h4>Télécharger le relevé de notes</h4><p>Dans <strong>Relevés de Notes</strong>, téléchargez votre relevé semestriel officiel en PDF avec votre GPA, vos crédits obtenus et le détail de toutes les UEs.</p></div></div>
            </div>
          </div>
        </div>

        <div className="section" id="reclamation">
          <div className="section-header"><div className="section-icon"><i className="fas fa-comment-dots" /></div><h2>8. Faire une réclamation</h2></div>
          <div className="section-body">
            <div className="steps">
              <div className="step"><div className="step-num">1</div><div className="step-content"><h4>Contester une note</h4><p>Dans <strong>Réclamations</strong>, cliquez sur <strong>Nouvelle Réclamation</strong>. Sélectionnez la copie concernée et rédigez votre argumentation.</p></div></div>
              <div className="step"><div className="step-num">2</div><div className="step-content"><h4>Analyse IA de votre réclamation</h4><p>La plateforme analyse automatiquement vos arguments et les compare au barème. L&apos;enseignant prend la décision finale.</p><div className="warn"><i className="fas fa-info-circle" /> Aucune notification (email ou in-app) n&apos;est envoyée quand la décision est prise — revenez consulter la page <strong>Réclamations</strong> pour voir la réponse et le statut mis à jour.</div></div></div>
            </div>
            <div className="tip"><i className="fas fa-lightbulb" /> Soyez précis dans votre argumentation. Référencez les questions spécifiques et expliquez pourquoi vous pensez que votre réponse mérite plus de points.</div>
          </div>
        </div>

      </div>

      <footer className="doc-footer">
        <p>Centre d&apos;Examen Intelligent — <a href="/">Retour à l&apos;accueil</a> · <a href="/guide-enseignant">Guide Enseignant</a> · <a href="/conditions">Conditions d&apos;Utilisation</a></p>
        <p style={{marginTop:16,fontSize:12,opacity:.8,fontWeight:600}}>Contact</p>
        <p style={{marginTop:6,fontSize:12,opacity:.6}}><i className="fas fa-map-marker-alt" /> Cité du Savoir – Diamniadio, Castors, avenue Bourguiba, rue n°13<br /><i className="fas fa-phone" /> +221 30 108 41 53<br /><i className="fas fa-envelope" /> visioplus@unchk.edu.sn</p>
        <p style={{marginTop:12,opacity:.6}}>© 2026 CEI — Université Cheikh Hamidou Kane (UNCHK)</p>
      </footer>
    </>
  )
}
