export default function GuideEnseignant() {
  return (
    <>
      <style>{`
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; background:#f8fafc; color:#1e293b; line-height:1.7; }
        .topbar { background:linear-gradient(135deg,#2563eb,#1d4ed8); color:white; padding:14px 32px; display:flex; align-items:center; justify-content:space-between; position:sticky; top:0; z-index:100; box-shadow:0 2px 12px rgba(0,0,0,.2); }
        .topbar-brand { font-size:17px; font-weight:700; display:flex; align-items:center; gap:10px; }
        .topbar-brand i { font-size:22px; }
        .btn-back { background:rgba(255,255,255,.15); color:white; border:1px solid rgba(255,255,255,.3); padding:8px 18px; border-radius:8px; text-decoration:none; font-size:13px; font-weight:600; display:inline-flex; align-items:center; gap:6px; transition:.2s; }
        .btn-back:hover { background:rgba(255,255,255,.25); }
        .hero-doc { background:linear-gradient(135deg,#2563eb,#1e40af); color:white; padding:60px 32px; text-align:center; }
        .hero-doc h1 { font-size:2.4rem; font-weight:800; margin-bottom:12px; }
        .hero-doc p { font-size:1.1rem; opacity:.9; max-width:600px; margin:0 auto; }
        .hero-badge { display:inline-flex; align-items:center; gap:6px; background:rgba(255,255,255,.15); border:1px solid rgba(255,255,255,.3); padding:6px 16px; border-radius:99px; font-size:13px; font-weight:600; margin-bottom:20px; }
        .content-wrap { max-width:900px; margin:0 auto; padding:48px 24px 80px; }
        .toc { background:white; border-radius:14px; border:1px solid #e2e8f0; padding:24px 28px; margin-bottom:40px; }
        .toc h3 { font-size:14px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:.05em; margin-bottom:14px; }
        .toc-list { list-style:none; display:flex; flex-direction:column; gap:6px; }
        .toc-list a { color:#2563eb; text-decoration:none; font-size:14px; font-weight:500; display:flex; align-items:center; gap:8px; }
        .toc-list a:hover { text-decoration:underline; }
        .toc-list a i { width:18px; text-align:center; font-size:13px; color:#94a3b8; }
        .section { background:white; border-radius:16px; border:1px solid #e2e8f0; margin-bottom:32px; overflow:hidden; }
        .section-header { background:linear-gradient(135deg,#eff6ff,#dbeafe); border-bottom:1px solid #bfdbfe; padding:20px 28px; display:flex; align-items:center; gap:14px; }
        .section-icon { width:48px; height:48px; background:#2563eb; border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:20px; color:white; flex-shrink:0; }
        .section-header h2 { font-size:1.15rem; font-weight:700; color:#1e3a8a; margin:0; }
        .section-body { padding:28px; }
        .steps { display:flex; flex-direction:column; gap:20px; }
        .step { display:flex; gap:16px; align-items:flex-start; }
        .step-num { width:36px; height:36px; background:#2563eb; color:white; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:14px; font-weight:700; flex-shrink:0; margin-top:2px; }
        .step-content h4 { font-size:15px; font-weight:700; color:#0f172a; margin-bottom:6px; }
        .step-content p { font-size:14px; color:#475569; line-height:1.65; }
        .step-content ul { margin-top:8px; padding-left:18px; }
        .step-content li { font-size:13px; color:#64748b; margin-bottom:4px; }
        .tip { background:#fffbeb; border:1px solid #fcd34d; border-left:4px solid #f59e0b; border-radius:8px; padding:14px 16px; margin-top:14px; font-size:13px; color:#92400e; display:flex; align-items:flex-start; gap:10px; }
        .tip i { color:#f59e0b; margin-top:2px; flex-shrink:0; }
        .info { background:#eff6ff; border:1px solid #bfdbfe; border-left:4px solid #2563eb; border-radius:8px; padding:14px 16px; margin-top:14px; font-size:13px; color:#1e40af; display:flex; align-items:flex-start; gap:10px; }
        .info i { color:#2563eb; margin-top:2px; flex-shrink:0; }
        .feature-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(240px,1fr)); gap:14px; margin-top:16px; }
        .feature-item { background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:16px; }
        .feature-item i { color:#2563eb; font-size:18px; margin-bottom:10px; display:block; }
        .feature-item h5 { font-size:13px; font-weight:700; color:#0f172a; margin-bottom:6px; }
        .feature-item p { font-size:12px; color:#64748b; line-height:1.5; }
        .guide-img { display:block; width:100%; max-width:720px; margin:18px auto 6px; border-radius:12px; border:1px solid #e2e8f0; box-shadow:0 4px 16px rgba(0,0,0,.08); }
        footer.doc-footer { background:#1e293b; color:rgba(255,255,255,.7); text-align:center; padding:32px; font-size:13px; }
        footer.doc-footer a { color:#60a5fa; text-decoration:none; font-weight:600; }
        @media(max-width:640px) { .hero-doc h1 { font-size:1.8rem; } .content-wrap { padding:24px 16px 60px; } }
      `}</style>

      <div className="topbar">
        <div className="topbar-brand">
          <i className="fas fa-graduation-cap" /> Centre d&apos;Examen Intelligent
        </div>
        <a href="/" className="btn-back"><i className="fas fa-arrow-left" /> Retour à l&apos;accueil</a>
      </div>

      <div className="hero-doc">
        <div className="hero-badge"><i className="fas fa-chalkboard-teacher" /> Pour les Enseignants</div>
        <h1>Guide Enseignant</h1>
        <p>Tout ce que vous devez savoir pour créer, surveiller et corriger des examens sur la plateforme CEI.</p>
      </div>

      <div className="content-wrap">

        <div className="toc">
          <h3><i className="fas fa-list" /> &nbsp;Sommaire</h3>
          <ul className="toc-list">
            <li><a href="#creer-sujet"><i className="fas fa-file-alt" /> 1. Créer un sujet d&apos;examen</a></li>
            <li><a href="#creer-examen"><i className="fas fa-plus-circle" /> 2. Créer et configurer un examen en ligne</a></li>
            <li><a href="#activer"><i className="fas fa-play-circle" /> 3. Activer l&apos;examen et surveiller</a></li>
            <li><a href="#dashboard"><i className="fas fa-tachometer-alt" /> 4. Dashboard de surveillance en temps réel</a></li>
            <li><a href="#corriger"><i className="fas fa-robot" /> 5. Corriger les copies avec l&apos;IA</a></li>
            <li><a href="#enregistrements"><i className="fas fa-film" /> 6. Accéder aux enregistrements</a></li>
            <li><a href="#appel-prive"><i className="fas fa-phone" /> 6b. Appel privé étudiant</a></li>
            <li><a href="#notes"><i className="fas fa-star" /> 7. Publier les notes</a></li>
            <li><a href="#surveillants"><i className="fas fa-eye" /> 8. Gérer les Surveillants</a></li>
          </ul>
        </div>

        {/* 1. Créer un sujet */}
        <div className="section" id="creer-sujet">
          <div className="section-header">
            <div className="section-icon"><i className="fas fa-file-alt" /></div>
            <h2>1. Créer un sujet d&apos;examen</h2>
          </div>
          <div className="section-body">
            <div className="steps">
              <div className="step">
                <div className="step-num">1</div>
                <div className="step-content">
                  <h4>Accéder à la gestion des sujets</h4>
                  <p>Dans le menu principal, cliquez sur <strong>Sujets d&apos;Examens</strong>. Vous verrez la liste de vos sujets existants et le bouton <strong>+ Nouveau Sujet</strong>.</p>
                </div>
              </div>
              <div className="step">
                <div className="step-num">2</div>
                <div className="step-content">
                  <h4>Rédiger ou téléverser le sujet</h4>
                  <p>Deux méthodes disponibles :</p>
                  <ul>
                    <li><strong>Téléversement</strong> : importez un fichier PDF ou Word — l&apos;IA analyse automatiquement le contenu et génère un barème de notation correspondant.</li>
                    <li><strong>Génération IA</strong> : choisissez un EC (Élément Constitutif) et cliquez sur &quot;Générer des Suggestions d&apos;Examen avec IA&quot;. Sélectionnez une suggestion pour générer un examen complet avec questions numérotées et points.</li>
                  </ul>
                  <div className="tip"><i className="fas fa-lightbulb" /> Après création, un aperçu du sujet ET du barème généré s&apos;affiche pour validation avant utilisation.</div>
                  <img className="guide-img" src="/screenshots/capture-4.jpg" alt="Suggestions de sujets générées par l'IA, avec bouton Utiliser ce Sujet" />
                </div>
              </div>
              <div className="step">
                <div className="step-num">3</div>
                <div className="step-content">
                  <h4>Vérifier la séparation questions / barème</h4>
                  <p>Le barème de notation (qui contient les réponses) est stocké séparément. Les étudiants ne voient <strong>jamais</strong> le barème pendant l&apos;examen.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 2. Créer un examen */}
        <div className="section" id="creer-examen">
          <div className="section-header">
            <div className="section-icon"><i className="fas fa-plus-circle" /></div>
            <h2>2. Créer et configurer un examen en ligne</h2>
          </div>
          <div className="section-body">
            <div className="steps">
              <div className="step">
                <div className="step-num">1</div>
                <div className="step-content">
                  <h4>Ouvrir la création d&apos;examen</h4>
                  <p>Dans <strong>Examens en Ligne</strong>, cliquez sur <strong>+ Créer un Examen</strong>. Remplissez le formulaire :</p>
                  <ul>
                    <li>Titre de l&apos;examen, sujet associé</li>
                    <li>Date/heure de début et de fin</li>
                    <li>Durée (en minutes)</li>
                    <li>Instructions optionnelles</li>
                  </ul>
                  <img className="guide-img" src="/screenshots/capture-5.jpg" alt="Formulaire de création d'un examen en ligne avec paramètres de sécurité" />
                </div>
              </div>
              <div className="step">
                <div className="step-num">2</div>
                <div className="step-content">
                  <h4>Configurer la sécurité anti-triche</h4>
                  <p>Ajustez les paramètres de surveillance selon vos besoins :</p>
                  <div className="feature-grid">
                    <div className="feature-item"><i className="fas fa-exchange-alt" /><h5>Changements de fenêtre</h5><p>Nombre max avant bannissement automatique</p></div>
                    <div className="feature-item"><i className="fas fa-eye-slash" /><h5>Visage absent</h5><p>Seuil de détections &quot;aucun visage&quot; avant alerte</p></div>
                    <div className="feature-item"><i className="fas fa-ban" /><h5>Copier/Coller</h5><p>Activer/désactiver le presse-papier</p></div>
                    <div className="feature-item"><i className="fas fa-mouse-pointer" /><h5>Clic droit</h5><p>Bloquer le menu contextuel</p></div>
                    <div className="feature-item"><i className="fas fa-terminal" /><h5>Outils Dev</h5><p>Bannir si outils développeur détectés</p></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Activer */}
        <div className="section" id="activer">
          <div className="section-header">
            <div className="section-icon"><i className="fas fa-play-circle" /></div>
            <h2>3. Activer l&apos;examen</h2>
          </div>
          <div className="section-body">
            <div className="steps">
              <div className="step">
                <div className="step-num">1</div>
                <div className="step-content">
                  <h4>Passer de &quot;Planifié&quot; à &quot;En cours&quot;</h4>
                  <p>Sur la carte de l&apos;examen, cliquez sur le bouton <strong>Activer</strong>. Le statut passe à <span style={{color:'#059669',fontWeight:700}}>En cours</span>. Les étudiants peuvent maintenant composer pendant la plage horaire définie.</p>
                  <div className="info"><i className="fas fa-info-circle" /> Si un étudiant clique sur &quot;Composer&quot; avant l&apos;heure, il voit une alerte avec la date et l&apos;heure exactes de début.</div>
                  <img className="guide-img" src="/screenshots/capture-6.jpg" alt="Carte d'examen planifié avec le bouton Activer" />
                </div>
              </div>
              <div className="step">
                <div className="step-num">2</div>
                <div className="step-content">
                  <h4>Ouvrir le Dashboard de Surveillance</h4>
                  <p>Cliquez sur <strong>Surveiller</strong> sur la carte de l&apos;examen. Le dashboard s&apos;ouvre dans un nouvel onglet avec les flux vidéo en direct de tous les étudiants.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 4. Dashboard */}
        <div className="section" id="dashboard">
          <div className="section-header">
            <div className="section-icon"><i className="fas fa-tachometer-alt" /></div>
            <h2>4. Dashboard de surveillance en temps réel</h2>
          </div>
          <div className="section-body">
            <p style={{color:'#475569',marginBottom:20}}>Le dashboard affiche une grille de toutes les tentatives actives avec vidéo en direct de chaque étudiant.</p>
            <img className="guide-img" src="/screenshots/capture-15.jpg" alt="Dashboard de surveillance en temps réel avec flux vidéo et actions par étudiant" />
            <div className="feature-grid">
              <div className="feature-item"><i className="fas fa-video" /><h5>Flux caméra HD</h5><p>Vidéo en direct de chaque étudiant (caméra + détection faciale IA)</p></div>
              <div className="feature-item"><i className="fas fa-desktop" /><h5>Partage d&apos;écran</h5><p>Bouton <span style={{color:'#3b82f6',fontWeight:700}}>Voir écran</span> quand l&apos;étudiant partage son écran — seul l&apos;écran complet est accepté</p></div>
              <div className="feature-item"><i className="fas fa-user-check" /><h5>Détection faciale IA</h5><p>Alerte automatique en cas de visage absent, non reconnu ou de plusieurs visages devant la caméra</p></div>
              <div className="feature-item"><i className="fas fa-phone" style={{color:'#2563eb'}} /><h5>Appel privé étudiant</h5><p>Bouton <span style={{color:'#2563eb',fontWeight:700}}>téléphone vert</span> sur chaque carte étudiant — lance un appel audio/vidéo privé isolé</p></div>
              <div className="feature-item"><i className="fas fa-chart-line" /><h5>Score de risque</h5><p>0–100% calculé en temps réel selon les incidents détectés</p></div>
              <div className="feature-item"><i className="fas fa-exclamation-triangle" /><h5>Envoyer un avertissement</h5><p>Message affiché immédiatement sur l&apos;écran de l&apos;étudiant avec popup orange</p></div>
              <div className="feature-item"><i className="fas fa-comment" /><h5>Envoyer un message</h5><p>Communication directe avec l&apos;étudiant (popup bleue sur son écran)</p></div>
              <div className="feature-item"><i className="fas fa-comment-dots" /><h5>Messages des étudiants</h5><p>Les étudiants peuvent vous écrire et demander un appel vocal via le bouton microphone violet</p></div>
              <div className="feature-item"><i className="fas fa-ban" /><h5>Exclure un étudiant</h5><p>Bannissement immédiat avec saisie de la raison — irréversible</p></div>
              <div className="feature-item"><i className="fas fa-list" /><h5>Logs d&apos;activité</h5><p>Historique complet des événements pour chaque étudiant</p></div>
            </div>
            <div className="tip"><i className="fas fa-lightbulb" /> Les étudiants à risque élevé (score ≥ 70%) apparaissent avec un encadré rouge dans la grille pour les repérer rapidement.</div>
          </div>
        </div>

        {/* 5. Corriger */}
        <div className="section" id="corriger">
          <div className="section-header">
            <div className="section-icon"><i className="fas fa-robot" /></div>
            <h2>5. Corriger les copies avec l&apos;IA</h2>
          </div>
          <div className="section-body">
            <div className="steps">
              <div className="step">
                <div className="step-num">1</div>
                <div className="step-content">
                  <h4>Clôturer l&apos;examen</h4>
                  <p>Cliquez sur <strong>Clôturer</strong> sur la carte de l&apos;examen. Les étudiants encore en session sont soumis automatiquement.</p>
                </div>
              </div>
              <div className="step">
                <div className="step-num">2</div>
                <div className="step-content">
                  <h4>Accéder aux copies</h4>
                  <p>Rendez-vous dans <strong>Copies d&apos;Étudiants</strong>. Sélectionnez les copies soumises et lancez la correction IA. L&apos;IA utilise le barème du sujet pour noter chaque réponse avec un feedback détaillé.</p>
                </div>
              </div>
              <div className="step">
                <div className="step-num">3</div>
                <div className="step-content">
                  <h4>Réviser et valider</h4>
                  <p>Vérifiez les notes proposées par l&apos;IA, ajustez si nécessaire, puis publiez les résultats. Une notification email est envoyée aux étudiants.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 6. Enregistrements */}
        <div className="section" id="enregistrements">
          <div className="section-header">
            <div className="section-icon"><i className="fas fa-film" /></div>
            <h2>6. Accéder aux enregistrements</h2>
          </div>
          <div className="section-body">
            <div className="steps">
              <div className="step">
                <div className="step-num">1</div>
                <div className="step-content">
                  <h4>Snapshots caméra automatiques</h4>
                  <p>Depuis le dashboard, cliquez sur le bouton <strong>Enregistrements</strong> en haut à droite. L&apos;onglet &quot;Snapshots caméra&quot; affiche toutes les captures d&apos;écran horodatées prises automatiquement pendant l&apos;examen.</p>
                </div>
              </div>
              <div className="step">
                <div className="step-num">2</div>
                <div className="step-content">
                  <h4>Vidéos enregistrées (REC)</h4>
                  <p>Si vous avez activé le bouton <strong>REC</strong> sur une carte étudiant pendant l&apos;examen, la vidéo est sauvegardée sur le serveur. L&apos;onglet &quot;Vidéos enregistrées&quot; génère des liens de téléchargement valables 2 heures.</p>
                  <div className="tip"><i className="fas fa-lightbulb" /> Les liens d&apos;accès expirent après 2 heures. Cliquez sur &quot;Actualiser&quot; pour en obtenir de nouveaux.</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 6b. Appel privé */}
        <div className="section" id="appel-prive">
          <div className="section-header">
            <div className="section-icon" style={{background:'#2563eb'}}><i className="fas fa-phone" /></div>
            <h2>6b. Appel privé avec un étudiant</h2>
          </div>
          <div className="section-body">
            <div className="steps">
              <div className="step">
                <div className="step-num">1</div>
                <div className="step-content">
                  <h4>Initier un appel depuis le dashboard</h4>
                  <p>Sur la carte d&apos;un étudiant dans le dashboard de surveillance, cliquez sur le <strong>bouton téléphone vert</strong> <i className="fas fa-phone" style={{color:'#059669'}} />. Une fenêtre modale s&apos;ouvre avec le flux vidéo de l&apos;étudiant et votre aperçu caméra.</p>
                  <div className="info"><i className="fas fa-info-circle" /> L&apos;étudiant reçoit une notification et peut accepter ou refuser l&apos;appel. Un appel privé est totalement isolé des autres étudiants.</div>
                </div>
              </div>
              <div className="step">
                <div className="step-num">2</div>
                <div className="step-content">
                  <h4>Pendant l&apos;appel</h4>
                  <p>Vous pouvez activer/désactiver votre caméra et microphone via les boutons dans la fenêtre d&apos;appel. L&apos;étudiant peut également couper son micro. L&apos;examen continue en arrière-plan pendant l&apos;appel.</p>
                </div>
              </div>
              <div className="step">
                <div className="step-num">3</div>
                <div className="step-content">
                  <h4>Répondre à une demande d&apos;appel étudiant</h4>
                  <p>Quand un étudiant clique sur le <strong>bouton microphone violet</strong>, le message <em>&quot;[DEMANDE_APPEL]&quot;</em> apparaît dans sa liste de messages avec un bouton <strong>&quot;Rejoindre l&apos;appel&quot;</strong>. Cliquez dessus pour démarrer l&apos;appel privé.</p>
                </div>
              </div>
              <div className="step">
                <div className="step-num">4</div>
                <div className="step-content">
                  <h4>Terminer l&apos;appel</h4>
                  <p>Cliquez sur le bouton <strong>rouge &quot;Terminer&quot;</strong> dans la fenêtre d&apos;appel. La connexion se ferme et l&apos;étudiant retourne à son interface d&apos;examen normale.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 7. Notes */}
        <div className="section" id="notes">
          <div className="section-header">
            <div className="section-icon"><i className="fas fa-star" /></div>
            <h2>7. Publier les notes et relevés</h2>
          </div>
          <div className="section-body">
            <div className="steps">
              <div className="step">
                <div className="step-num">1</div>
                <div className="step-content">
                  <h4>Saisie / import des notes</h4>
                  <p>Allez dans <strong>Notes</strong>. Les notes des copies corrigées sont automatiquement associées. Vous pouvez aussi importer en masse via CSV ou saisir manuellement.</p>
                </div>
              </div>
              <div className="step">
                <div className="step-num">2</div>
                <div className="step-content">
                  <h4>Générer les relevés</h4>
                  <p>Depuis <strong>Relevés de Notes</strong>, générez les relevés semestriels officiels (PDF) avec calcul automatique du GPA et crédit ECTS.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 8. Surveillants */}
        <div className="section" id="surveillants">
          <div className="section-header">
            <div className="section-icon" style={{background:'#d97706'}}><i className="fas fa-eye" /></div>
            <h2>8. Gérer les Surveillants</h2>
          </div>
          <div className="section-body">
            <p style={{color:'#475569',marginBottom:20}}>Pour les examens avec de nombreux étudiants, vous pouvez déléguer la surveillance à des <strong>surveillants dédiés</strong>. Chacun reçoit un groupe d&apos;étudiants à surveiller.</p>
            <div className="steps">
              <div className="step">
                <div className="step-num">1</div>
                <div className="step-content">
                  <h4>Ouvrir la gestion des surveillants</h4>
                  <p>Sur la carte d&apos;un examen (statut planifié ou en cours), cliquez sur le bouton <strong style={{color:'#d97706'}}><i className="fas fa-eye" /> Surveillants</strong>. Une modale s&apos;ouvre avec la liste des surveillants déjà assignés et le nombre d&apos;étudiants de chacun.</p>
                </div>
              </div>
              <div className="step">
                <div className="step-num">2</div>
                <div className="step-content">
                  <h4>Ajouter un surveillant</h4>
                  <p>Dans le menu déroulant, sélectionnez un utilisateur de rôle <strong>Surveillant</strong> (ou un autre enseignant) puis cliquez sur <strong>Ajouter</strong>. Un surveillant déjà ajouté n&apos;apparaît pas dans la liste de sélection.</p>
                  <div className="tip"><i className="fas fa-lightbulb" /> Vous pouvez vous ajouter vous-même comme surveillant d&apos;un groupe si vous souhaitez superviser une partie des étudiants tout en gardant la vue globale de l&apos;enseignant.</div>
                </div>
              </div>
              <div className="step">
                <div className="step-num">3</div>
                <div className="step-content">
                  <h4>Répartir automatiquement les étudiants</h4>
                  <p>Une fois vos surveillants ajoutés, cliquez sur <strong>&quot;Répartir automatiquement&quot;</strong>. Le système distribue les étudiants en <strong>ordre alphabétique</strong> par groupe de taille égale (round-robin). Un résumé affiche combien d&apos;étudiants chaque surveillant reçoit.</p>
                  <div className="info"><i className="fas fa-info-circle" /> La répartition peut être relancée à tout moment — les affectations existantes sont remplacées. Cela permet de rééquilibrer si des étudiants abandonnent l&apos;examen.</div>
                </div>
              </div>
              <div className="step">
                <div className="step-num">4</div>
                <div className="step-content">
                  <h4>Retirer un surveillant</h4>
                  <p>Cliquez sur le bouton <strong style={{color:'#ef4444'}}>Retirer</strong> à côté du nom du surveillant. Ses affectations d&apos;étudiants sont automatiquement supprimées. Ces étudiants deviennent &quot;non affectés&quot; jusqu&apos;à la prochaine répartition.</p>
                </div>
              </div>
              <div className="step">
                <div className="step-num">5</div>
                <div className="step-content">
                  <h4>Recevoir les notifications de bannissement</h4>
                  <p>Quand un surveillant banni un étudiant, vous recevez automatiquement une notification dans votre dashboard : le nom du surveillant, le nom de l&apos;étudiant et le motif saisi. Vous restez informé de toutes les actions disciplinaires.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>

      <footer className="doc-footer">
        <p>Centre d&apos;Examen Intelligent — <a href="/">Retour à l&apos;accueil</a> · <a href="/guide-etudiant">Guide Étudiant</a> · <a href="/guide-surveillant">Guide Surveillant</a> · <a href="/conditions">Conditions d&apos;Utilisation</a></p>
        <p style={{marginTop:16,fontSize:12,opacity:.8,fontWeight:600}}>Contact</p>
        <p style={{marginTop:6,fontSize:12,opacity:.6}}>
          <i className="fas fa-map-marker-alt" /> Cité du Savoir – Diamniadio, Castors, avenue Bourguiba, rue n°13<br />
          <i className="fas fa-phone" /> +221 30 108 41 53<br />
          <i className="fas fa-envelope" /> visioplus@unchk.edu.sn
        </p>
        <p style={{marginTop:12,opacity:.6}}>© 2026 CEI — Université Cheikh Hamidou Kane (UNCHK)</p>
      </footer>
    </>
  )
}
