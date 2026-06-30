export default function GuideSurveillant() {
  return (
    <>
      <style>{`
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; background:#f8fafc; color:#1e293b; line-height:1.7; }
        .topbar { background:linear-gradient(135deg,#d97706,#b45309); color:white; padding:14px 32px; display:flex; align-items:center; justify-content:space-between; position:sticky; top:0; z-index:100; box-shadow:0 2px 12px rgba(0,0,0,.2); }
        .topbar-brand { font-size:17px; font-weight:700; display:flex; align-items:center; gap:10px; }
        .topbar-brand i { font-size:22px; }
        .btn-back { background:rgba(255,255,255,.15); color:white; border:1px solid rgba(255,255,255,.3); padding:8px 18px; border-radius:8px; text-decoration:none; font-size:13px; font-weight:600; display:inline-flex; align-items:center; gap:6px; transition:.2s; }
        .btn-back:hover { background:rgba(255,255,255,.25); }
        .hero-doc { background:linear-gradient(135deg,#d97706,#92400e); color:white; padding:60px 32px; text-align:center; }
        .hero-doc h1 { font-size:2.4rem; font-weight:800; margin-bottom:12px; }
        .hero-doc p { font-size:1.1rem; opacity:.9; max-width:600px; margin:0 auto; }
        .hero-badge { display:inline-flex; align-items:center; gap:6px; background:rgba(255,255,255,.15); border:1px solid rgba(255,255,255,.3); padding:6px 16px; border-radius:99px; font-size:13px; font-weight:600; margin-bottom:20px; }
        .content-wrap { max-width:900px; margin:0 auto; padding:48px 24px 80px; }
        .toc { background:white; border-radius:14px; border:1px solid #e2e8f0; padding:24px 28px; margin-bottom:40px; }
        .toc h3 { font-size:14px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:.05em; margin-bottom:14px; }
        .toc-list { list-style:none; display:flex; flex-direction:column; gap:6px; }
        .toc-list a { color:#d97706; text-decoration:none; font-size:14px; font-weight:500; display:flex; align-items:center; gap:8px; }
        .toc-list a:hover { text-decoration:underline; }
        .toc-list a i { width:18px; text-align:center; font-size:13px; color:#94a3b8; }
        .section { background:white; border-radius:16px; border:1px solid #e2e8f0; margin-bottom:32px; overflow:hidden; }
        .section-header { background:linear-gradient(135deg,#fffbeb,#fef3c7); border-bottom:1px solid #fcd34d; padding:20px 28px; display:flex; align-items:center; gap:14px; }
        .section-icon { width:48px; height:48px; background:#d97706; border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:20px; color:white; flex-shrink:0; }
        .section-header h2 { font-size:1.15rem; font-weight:700; color:#78350f; margin:0; }
        .section-body { padding:28px; }
        .steps { display:flex; flex-direction:column; gap:20px; }
        .step { display:flex; gap:16px; align-items:flex-start; }
        .step-num { width:36px; height:36px; background:#d97706; color:white; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:14px; font-weight:700; flex-shrink:0; margin-top:2px; }
        .step-content h4 { font-size:15px; font-weight:700; color:#0f172a; margin-bottom:6px; }
        .step-content p { font-size:14px; color:#475569; line-height:1.65; }
        .step-content ul { margin-top:8px; padding-left:18px; }
        .step-content li { font-size:13px; color:#64748b; margin-bottom:4px; }
        .tip { background:#fffbeb; border:1px solid #fcd34d; border-left:4px solid #f59e0b; border-radius:8px; padding:14px 16px; margin-top:14px; font-size:13px; color:#92400e; display:flex; align-items:flex-start; gap:10px; }
        .tip i { color:#f59e0b; margin-top:2px; flex-shrink:0; }
        .info { background:#eff6ff; border:1px solid #bfdbfe; border-left:4px solid #2563eb; border-radius:8px; padding:14px 16px; margin-top:14px; font-size:13px; color:#1e40af; display:flex; align-items:flex-start; gap:10px; }
        .info i { color:#2563eb; margin-top:2px; flex-shrink:0; }
        .danger { background:#fff1f2; border:1px solid #fecdd3; border-left:4px solid #ef4444; border-radius:8px; padding:14px 16px; margin-top:14px; font-size:13px; color:#9f1239; display:flex; align-items:flex-start; gap:10px; }
        .danger i { color:#ef4444; margin-top:2px; flex-shrink:0; }
        .success { background:#ecfdf5; border:1px solid #a7f3d0; border-left:4px solid #059669; border-radius:8px; padding:14px 16px; margin-top:14px; font-size:13px; color:#065f46; display:flex; align-items:flex-start; gap:10px; }
        .success i { color:#059669; margin-top:2px; flex-shrink:0; }
        .feature-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:14px; margin-top:16px; }
        .feature-item { background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:16px; }
        .feature-item i { color:#d97706; font-size:18px; margin-bottom:10px; display:block; }
        .feature-item h5 { font-size:13px; font-weight:700; color:#0f172a; margin-bottom:6px; }
        .feature-item p { font-size:12px; color:#64748b; line-height:1.5; }
        .status-row { display:flex; align-items:center; gap:12px; padding:10px 14px; border-radius:8px; margin-bottom:8px; }
        .status-dot { width:14px; height:14px; border-radius:50%; flex-shrink:0; }
        .status-row p { font-size:13px; color:#475569; margin:0; }
        .action-card { border-radius:12px; padding:18px; border:1px solid; margin-bottom:12px; display:flex; align-items:flex-start; gap:14px; }
        .action-icon { width:40px; height:40px; border-radius:10px; display:flex; align-items:center; justify-content:center; flex-shrink:0; font-size:17px; }
        footer.doc-footer { background:#1e293b; color:rgba(255,255,255,.7); text-align:center; padding:32px; font-size:13px; }
        footer.doc-footer a { color:#fbbf24; text-decoration:none; font-weight:600; }
        @media(max-width:640px) { .hero-doc h1 { font-size:1.8rem; } .content-wrap { padding:24px 16px 60px; } }
      `}</style>

      <div className="topbar">
        <div className="topbar-brand"><i className="fas fa-graduation-cap" /> Centre d&apos;Examen Intelligent</div>
        <a href="/" className="btn-back"><i className="fas fa-arrow-left" /> Retour à l&apos;accueil</a>
      </div>

      <div className="hero-doc">
        <div className="hero-badge"><i className="fas fa-eye" /> Pour les Surveillants</div>
        <h1>Guide Surveillant</h1>
        <p>Tout ce que vous devez savoir pour surveiller des examens en ligne, gérer votre groupe d&apos;étudiants et garantir l&apos;intégrité académique.</p>
      </div>

      <div className="content-wrap">
        <div className="toc">
          <h3><i className="fas fa-list" /> &nbsp;Sommaire</h3>
          <ul className="toc-list">
            <li><a href="#role"><i className="fas fa-info-circle" /> 1. Le rôle Surveillant — vue d&apos;ensemble</a></li>
            <li><a href="#connexion"><i className="fas fa-sign-in-alt" /> 2. Se connecter et accéder à l&apos;interface</a></li>
            <li><a href="#dashboard"><i className="fas fa-tachometer-alt" /> 3. Tableau de bord — comprendre les statistiques</a></li>
            <li><a href="#surveiller"><i className="fas fa-shield-alt" /> 4. Surveiller un examen en direct</a></li>
            <li><a href="#detection"><i className="fas fa-user-check" /> 5. Indicateurs de détection et alertes</a></li>
            <li><a href="#actions"><i className="fas fa-tools" /> 6. Actions disponibles</a></li>
            <li><a href="#appel"><i className="fas fa-phone" /> 7. Appel privé avec un étudiant</a></li>
            <li><a href="#bannissement"><i className="fas fa-ban" /> 8. Bannissement et notification à l&apos;enseignant</a></li>
          </ul>
        </div>

        {/* 1. Rôle */}
        <div className="section" id="role">
          <div className="section-header"><div className="section-icon"><i className="fas fa-info-circle" /></div><h2>1. Le rôle Surveillant — vue d&apos;ensemble</h2></div>
          <div className="section-body">
            <p style={{color:'#475569',marginBottom:20}}>Le surveillant est un acteur clé de l&apos;intégrité des examens en ligne. Contrairement à l&apos;enseignant qui gère l&apos;ensemble de la promotion, le surveillant se concentre sur un <strong>groupe réduit d&apos;étudiants qui lui est assigné</strong>.</p>
            <div className="feature-grid">
              <div className="feature-item"><i className="fas fa-users-cog" /><h5>Assignation par l&apos;enseignant</h5><p>C&apos;est l&apos;enseignant (ou l&apos;admin) qui vous affecte à un examen et vous attribue un groupe d&apos;étudiants à surveiller.</p></div>
              <div className="feature-item"><i className="fas fa-filter" /><h5>Vue filtrée</h5><p>Vous ne voyez que les étudiants de votre groupe — pas l&apos;ensemble de la promotion. Cela facilite une surveillance attentive.</p></div>
              <div className="feature-item"><i className="fas fa-bolt" /><h5>Action directe</h5><p>Vous pouvez avertir, envoyer un message ou bannir immédiatement un étudiant de votre groupe. L&apos;enseignant est notifié de vos actions.</p></div>
              <div className="feature-item"><i className="fas fa-phone" /><h5>Appel privé</h5><p>Vous pouvez ouvrir un appel audio/vidéo privé avec l&apos;un de vos étudiants à tout moment pendant l&apos;examen.</p></div>
            </div>
            <div className="tip"><i className="fas fa-lightbulb" /> Un enseignant peut aussi se désigner lui-même comme surveillant d&apos;un groupe dans son propre examen si sa disponibilité le lui permet.</div>
          </div>
        </div>

        {/* 2. Connexion */}
        <div className="section" id="connexion">
          <div className="section-header"><div className="section-icon"><i className="fas fa-sign-in-alt" /></div><h2>2. Se connecter et accéder à l&apos;interface</h2></div>
          <div className="section-body">
            <div className="steps">
              <div className="step"><div className="step-num">1</div><div className="step-content"><h4>Recevoir vos identifiants</h4><p>Un administrateur crée votre compte avec le rôle <strong>Surveillant</strong>. Vous recevez un email contenant votre adresse email et votre mot de passe temporaire.</p></div></div>
              <div className="step"><div className="step-num">2</div><div className="step-content"><h4>Se connecter sur la plateforme</h4><p>Rendez-vous sur <strong>cei.ec2lt.sn/app</strong> (ou l&apos;adresse communiquée par votre établissement). Entrez votre email et votre mot de passe, puis cliquez sur <strong>Connexion</strong>.</p></div></div>
              <div className="step"><div className="step-num">3</div><div className="step-content"><h4>Interface dédiée au surveillant</h4><p>Après connexion, vous accédez directement à votre <strong>Tableau de Bord Surveillant</strong>. Il n&apos;y a qu&apos;un seul onglet disponible : <em>Mes Examens</em>. Vous ne pouvez pas accéder aux autres fonctionnalités de la plateforme (correction, notes, etc.).</p><div className="info"><i className="fas fa-info-circle" /> Votre interface est intentionnellement épurée. Seuls les outils de surveillance vous sont accessibles.</div></div></div>
            </div>
          </div>
        </div>

        {/* 3. Dashboard */}
        <div className="section" id="dashboard">
          <div className="section-header"><div className="section-icon"><i className="fas fa-tachometer-alt" /></div><h2>3. Tableau de bord — comprendre les statistiques</h2></div>
          <div className="section-body">
            <p style={{color:'#475569',marginBottom:20}}>La page d&apos;accueil de votre espace affiche un résumé de vos missions en cours.</p>
            <div className="feature-grid">
              <div className="feature-item"><i className="fas fa-play-circle" style={{color:'#10b981'}} /><h5>En cours</h5><p>Nombre d&apos;examens actuellement actifs auxquels vous êtes affecté.</p></div>
              <div className="feature-item"><i className="fas fa-laptop-code" style={{color:'#3b82f6'}} /><h5>Examens assignés</h5><p>Total des examens (passés, présents et à venir) pour lesquels vous avez été désigné surveillant.</p></div>
              <div className="feature-item"><i className="fas fa-user-graduate" style={{color:'#2563eb'}} /><h5>Étudiants à surveiller</h5><p>Nombre total d&apos;étudiants dans vos groupes, tous examens confondus.</p></div>
            </div>
            <div style={{marginTop:24}}>
              <h4 style={{fontSize:14,fontWeight:700,color:'#0f172a',marginBottom:12}}><i className="fas fa-exclamation-circle" style={{color:'#d97706'}} /> &nbsp;Panneau &quot;Examens en cours — Action requise&quot;</h4>
              <p style={{fontSize:14,color:'#475569'}}>Quand un examen est actif, une bannière verte apparaît en haut du tableau de bord avec un bouton <strong>&quot;Surveiller maintenant&quot;</strong>. C&apos;est votre point d&apos;entrée principal pendant un examen.</p>
            </div>
            <div style={{marginTop:20}}>
              <h4 style={{fontSize:14,fontWeight:700,color:'#0f172a',marginBottom:12}}><i className="fas fa-table" style={{color:'#64748b'}} /> &nbsp;Tableau &quot;Tous mes examens assignés&quot;</h4>
              <p style={{fontSize:14,color:'#475569'}}>Le tableau liste tous vos examens avec leur statut et le nombre d&apos;étudiants dans votre groupe. Le bouton <strong>Surveiller</strong> n&apos;est actif que pour les examens <span style={{color:'#059669',fontWeight:700}}>En cours</span>.</p>
            </div>
          </div>
        </div>

        {/* 4. Surveiller */}
        <div className="section" id="surveiller">
          <div className="section-header"><div className="section-icon"><i className="fas fa-shield-alt" /></div><h2>4. Surveiller un examen en direct</h2></div>
          <div className="section-body">
            <div className="steps">
              <div className="step"><div className="step-num">1</div><div className="step-content"><h4>Ouvrir la salle de surveillance</h4><p>Cliquez sur <strong>&quot;Surveiller maintenant&quot;</strong> depuis le tableau de bord, ou sur <strong>&quot;Surveiller&quot;</strong> dans le tableau des examens. La salle de surveillance s&apos;ouvre dans une <strong>nouvelle fenêtre</strong>.</p><div className="tip"><i className="fas fa-lightbulb" /> Gardez cette fenêtre ouverte pendant toute la durée de l&apos;examen. Vous pouvez utiliser un second écran si disponible.</div></div></div>
              <div className="step"><div className="step-num">2</div><div className="step-content"><h4>La grille de surveillance</h4><p>Vous voyez <strong>uniquement vos étudiants assignés</strong> sous forme de cartes vidéo. Chaque carte affiche :</p><ul><li>Le <strong>flux caméra</strong> de l&apos;étudiant en direct</li><li>Le <strong>nom et prénom</strong> de l&apos;étudiant</li><li>Le <strong>statut de détection faciale</strong> (indicateur coloré)</li><li>Le <strong>score de risque</strong> (0 à 100%)</li><li>Le <strong>temps restant</strong> dans l&apos;examen</li><li>Les <strong>boutons d&apos;action</strong> (avertir, bannir, appel)</li></ul></div></div>
              <div className="step"><div className="step-num">3</div><div className="step-content"><h4>Voir l&apos;écran d&apos;un étudiant</h4><p>Si l&apos;étudiant a activé le partage d&apos;écran complet, un bouton <strong style={{color:'#3b82f6'}}>&quot;Voir écran&quot;</strong> apparaît sur sa carte. Cliquez dessus pour voir son écran en temps réel dans une fenêtre dédiée.</p><div className="info"><i className="fas fa-info-circle" /> Seul le partage d&apos;écran complet (moniteur entier) est accepté. Si un étudiant tente de partager une fenêtre ou un onglet, le système le refuse automatiquement.</div></div></div>
              <div className="step"><div className="step-num">4</div><div className="step-content"><h4>Consulter les logs d&apos;activité</h4><p>Cliquez sur le bouton <strong>&quot;Logs&quot;</strong> sur la carte d&apos;un étudiant pour voir son historique complet d&apos;événements horodatés : changements de fenêtre, alertes visage, avertissements reçus, etc.</p></div></div>
            </div>
          </div>
        </div>

        {/* 5. Détection */}
        <div className="section" id="detection">
          <div className="section-header"><div className="section-icon"><i className="fas fa-user-check" /></div><h2>5. Indicateurs de détection et alertes</h2></div>
          <div className="section-body">
            <p style={{color:'#475569',marginBottom:20}}>Sur chaque carte étudiant, un indicateur coloré vous donne l&apos;état de la détection faciale en temps réel.</p>
            <div className="status-row" style={{background:'#ecfdf5',border:'1px solid #a7f3d0'}}><div className="status-dot" style={{background:'#10b981'}} /><p><strong>Vert — Visage détecté :</strong> Le visage de l&apos;étudiant est correctement visible et reconnu. Tout va bien.</p></div>
            <div className="status-row" style={{background:'#fffbeb',border:'1px solid #fcd34d'}}><div className="status-dot" style={{background:'#f59e0b'}} /><p><strong>Jaune — Vérification en cours :</strong> La détection hésite (mauvais éclairage, mouvement, etc.). Une recapture automatique est déclenchée. Surveillez si cela persiste.</p></div>
            <div className="status-row" style={{background:'#fff1f2',border:'1px solid #fecdd3'}}><div className="status-dot" style={{background:'#ef4444'}} /><p><strong>Rouge — Visage absent ou non reconnu :</strong> Aucun visage détecté ou le visage ne correspond pas au profil. Un avertissement automatique est envoyé à l&apos;étudiant. Intervenez si la situation dure.</p></div>
            <div className="status-row" style={{background:'#fff7ed',border:'1px solid #fed7aa'}}><div className="status-dot" style={{background:'#f97316'}} /><p><strong>Orange — Plusieurs visages :</strong> Plus d&apos;un visage est détecté devant la caméra. Cela peut indiquer une tierce personne présente. Intervenez immédiatement.</p></div>
            <div className="status-row" style={{background:'#eff6ff',border:'1px solid #bfdbfe'}}><div className="status-dot" style={{background:'#3b82f6'}} /><p><strong>Bleu — Recapture en cours :</strong> Le système est en train de mettre à jour la référence faciale. Normal après un repositionnement de l&apos;étudiant.</p></div>
            <div style={{marginTop:24}}>
              <h4 style={{fontSize:14,fontWeight:700,color:'#0f172a',marginBottom:12}}>Score de risque</h4>
              <p style={{fontSize:14,color:'#475569'}}>Chaque étudiant dispose d&apos;un <strong>score de risque de 0 à 100%</strong> calculé en temps réel en fonction des incidents accumulés (changements de fenêtre, absence de visage, etc.). Un étudiant avec un score ≥ 70% apparaît avec un encadré rouge dans la grille.</p>
            </div>
          </div>
        </div>

        {/* 6. Actions */}
        <div className="section" id="actions">
          <div className="section-header"><div className="section-icon"><i className="fas fa-tools" /></div><h2>6. Actions disponibles</h2></div>
          <div className="section-body">
            <p style={{color:'#475569',marginBottom:20}}>Toutes les actions ci-dessous ne s&apos;appliquent qu&apos;aux étudiants de votre groupe. Vous ne pouvez pas agir sur les étudiants d&apos;un autre surveillant.</p>
            <div className="action-card" style={{background:'#fffbeb',borderColor:'#fcd34d'}}><div className="action-icon" style={{background:'#fef3c7',color:'#f59e0b'}}><i className="fas fa-exclamation-triangle" /></div><div><h4 style={{fontSize:14,fontWeight:700,color:'#0f172a',marginBottom:4}}>Envoyer un avertissement</h4><p style={{fontSize:13,color:'#475569'}}>Un popup orange s&apos;affiche immédiatement sur l&apos;écran de l&apos;étudiant avec votre message. À utiliser en cas de comportement suspect (absence prolongée du visage, score de risque élevé).</p></div></div>
            <div className="action-card" style={{background:'#eff6ff',borderColor:'#bfdbfe'}}><div className="action-icon" style={{background:'#dbeafe',color:'#2563eb'}}><i className="fas fa-comment" /></div><div><h4 style={{fontSize:14,fontWeight:700,color:'#0f172a',marginBottom:4}}>Envoyer un message</h4><p style={{fontSize:13,color:'#475569'}}>Un popup bleu s&apos;affiche sur l&apos;écran de l&apos;étudiant. Utile pour une communication discrète : lui indiquer de se repositionner devant la caméra, de partager l&apos;écran complet, etc.</p></div></div>
            <div className="action-card" style={{background:'#ecfdf5',borderColor:'#a7f3d0'}}><div className="action-icon" style={{background:'#d1fae5',color:'#059669'}}><i className="fas fa-phone" /></div><div><h4 style={{fontSize:14,fontWeight:700,color:'#0f172a',marginBottom:4}}>Appel audio/vidéo privé</h4><p style={{fontSize:13,color:'#475569'}}>Lance un appel privé et isolé avec l&apos;étudiant. Voir la <a href="#appel" style={{color:'#059669',fontWeight:600}}>section 7</a> pour le détail.</p></div></div>
            <div className="action-card" style={{background:'#fff1f2',borderColor:'#fecdd3'}}><div className="action-icon" style={{background:'#ffe4e6',color:'#ef4444'}}><i className="fas fa-ban" /></div><div><h4 style={{fontSize:14,fontWeight:700,color:'#0f172a',marginBottom:4}}>Bannir l&apos;étudiant</h4><p style={{fontSize:13,color:'#475569'}}>Exclut immédiatement l&apos;étudiant de l&apos;examen (irréversible). Voir la <a href="#bannissement" style={{color:'#ef4444',fontWeight:600}}>section 8</a> pour le détail. Saisissez toujours un motif précis avant de confirmer.</p></div></div>
            <div className="tip"><i className="fas fa-lightbulb" /> Avant de bannir, envoyez au moins un avertissement ou un message, et tentez un appel privé si la situation le permet. Le bannissement est définitif et l&apos;étudiant ne peut plus accéder à l&apos;examen.</div>
          </div>
        </div>

        {/* 7. Appel */}
        <div className="section" id="appel">
          <div className="section-header"><div className="section-icon" style={{background:'#2563eb'}}><i className="fas fa-phone" /></div><h2>7. Appel privé avec un étudiant</h2></div>
          <div className="section-body">
            <div className="steps">
              <div className="step"><div className="step-num">1</div><div className="step-content"><h4>Initier l&apos;appel</h4><p>Sur la carte de l&apos;étudiant, cliquez sur le <strong>bouton téléphone vert</strong> <i className="fas fa-phone" style={{color:'#059669'}} />. Une fenêtre s&apos;ouvre avec votre aperçu caméra et le flux vidéo de l&apos;étudiant.</p></div></div>
              <div className="step"><div className="step-num">2</div><div className="step-content"><h4>Pendant l&apos;appel</h4><p>L&apos;examen de l&apos;étudiant continue en arrière-plan pendant l&apos;appel. Vous pouvez activer/désactiver votre caméra et microphone. L&apos;appel est totalement privé — ni les autres étudiants ni les autres surveillants ne peuvent l&apos;écouter.</p><div className="info"><i className="fas fa-info-circle" /> Si l&apos;étudiant refuse l&apos;appel, il recevra tout de même une notification. Vous pouvez lui envoyer un message pour lui demander d&apos;accepter.</div></div></div>
              <div className="step"><div className="step-num">3</div><div className="step-content"><h4>Répondre à une demande de l&apos;étudiant</h4><p>L&apos;étudiant peut cliquer sur le <strong>bouton microphone violet</strong> dans son interface pour vous demander un appel. Son message <em>&quot;[DEMANDE_APPEL]&quot;</em> apparaît dans votre liste de messages avec un bouton <strong>&quot;Rejoindre l&apos;appel&quot;</strong>.</p></div></div>
              <div className="step"><div className="step-num">4</div><div className="step-content"><h4>Terminer l&apos;appel</h4><p>Cliquez sur le <strong>bouton rouge &quot;Terminer&quot;</strong> dans la fenêtre d&apos;appel pour raccrocher.</p></div></div>
            </div>
          </div>
        </div>

        {/* 8. Bannissement */}
        <div className="section" id="bannissement">
          <div className="section-header"><div className="section-icon" style={{background:'#dc2626'}}><i className="fas fa-ban" /></div><h2>8. Bannissement et notification à l&apos;enseignant</h2></div>
          <div className="section-body">
            <div className="steps">
              <div className="step"><div className="step-num">1</div><div className="step-content"><h4>Décider du bannissement</h4><p>N&apos;utilisez le bannissement qu&apos;en cas de <strong>fraude avérée ou de comportement grave</strong> : présence d&apos;une tierce personne identifiée, utilisation d&apos;un autre appareil, violation répétée des règles après avertissements.</p><div className="danger"><i className="fas fa-exclamation-triangle" /> Le bannissement est <strong>immédiat et irréversible</strong>. L&apos;étudiant est expulsé de l&apos;examen sans possibilité de revenir. Agissez avec discernement.</div></div></div>
              <div className="step"><div className="step-num">2</div><div className="step-content"><h4>Saisir le motif</h4><p>Cliquez sur le bouton <strong style={{color:'#dc2626'}}>&quot;Bannir&quot;</strong> sur la carte de l&apos;étudiant. Une boîte de dialogue s&apos;ouvre. Saisissez un motif précis et circonstancié (ex : <em>&quot;Présence d&apos;une tierce personne devant la caméra à 10h23, après 2 avertissements&quot;</em>).</p></div></div>
              <div className="step"><div className="step-num">3</div><div className="step-content"><h4>Confirmation et exécution</h4><p>Après confirmation, l&apos;étudiant est immédiatement banni. Son interface affiche un message d&apos;exclusion et sa session se ferme.</p></div></div>
              <div className="step"><div className="step-num">4</div><div className="step-content"><h4>Notification automatique à l&apos;enseignant</h4><p>Une notification est <strong>automatiquement envoyée à l&apos;enseignant responsable</strong> de l&apos;examen. Elle apparaît dans son dashboard sous forme d&apos;un message d&apos;information avec :</p><ul><li>Votre nom (le surveillant qui a agi)</li><li>Le nom de l&apos;étudiant banni</li><li>Le motif saisi</li><li>L&apos;horodatage de l&apos;action</li></ul><div className="success"><i className="fas fa-check-circle" /> L&apos;enseignant reste informé de toutes vos actions de bannissement. Il peut contester ou prendre note dans le rapport d&apos;examen.</div></div></div>
            </div>
          </div>
        </div>

      </div>

      <footer className="doc-footer">
        <p>Centre d&apos;Examen Intelligent — <a href="/">Retour à l&apos;accueil</a> · <a href="/guide-enseignant">Guide Enseignant</a> · <a href="/guide-etudiant">Guide Étudiant</a> · <a href="/conditions">Conditions d&apos;Utilisation</a></p>
        <p style={{marginTop:16,fontSize:12,opacity:.8,fontWeight:600}}>Contact</p>
        <p style={{marginTop:6,fontSize:12,opacity:.6}}><i className="fas fa-map-marker-alt" /> Cité du Savoir – Diamniadio, Castors, avenue Bourguiba, rue n°13<br /><i className="fas fa-phone" /> +221 30 108 41 53<br /><i className="fas fa-envelope" /> visioplus@unchk.edu.sn</p>
        <p style={{marginTop:12,opacity:.6}}>© 2026 CEI — Université Cheikh Hamidou Kane (UNCHK)</p>
      </footer>
    </>
  )
}
