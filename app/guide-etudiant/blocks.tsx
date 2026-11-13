// Sections communes aux guides étudiants (reprises de l'ancien guide unique, corrigées).

export function Connexion() {
  return (
        <div className="section" id="connexion">
          <div className="section-header"><div className="section-icon"><i className="fas fa-sign-in-alt" /></div><h2>Se connecter à la plateforme</h2></div>
          <div className="section-body">
            <div className="steps">
              <div className="step"><div className="step-num">1</div><div className="step-content"><h4>Accéder à la plateforme</h4><p>Rendez-vous sur l&apos;adresse de la plateforme communiquée par votre établissement et cliquez sur <strong>Commencer Maintenant</strong>, ou accédez directement à la page de connexion.</p></div></div>
              <div className="step"><div className="step-num">2</div><div className="step-content"><h4>Saisir vos identifiants</h4><p>Entrez votre <strong>adresse email institutionnelle</strong> et votre <strong>mot de passe</strong> fournis par l&apos;administration. Si vous n&apos;avez pas de compte, contactez votre administration.</p></div></div>
            </div>
            <div className="tip"><i className="fas fa-lightbulb" /> Votre session reste active pendant 30 jours. Déconnectez-vous toujours sur un ordinateur partagé.</div>
          </div>
        </div>
  )
}

export function TableauBord() {
  return (
        <div className="section" id="tableau-bord">
          <div className="section-header"><div className="section-icon"><i className="fas fa-home" /></div><h2>Votre tableau de bord</h2></div>
          <div className="section-body">
            <p style={{color:'#475569',marginBottom:16}}>Depuis le menu principal, vous avez accès à :</p>
            <div className="steps">
              <div className="step"><div className="step-num"><i className="fas fa-laptop-code" style={{fontSize:17}} /></div><div className="step-content"><h4>Examens en Ligne</h4><p>Liste de tous vos examens avec leur statut : <span style={{color:'#d97706',fontWeight:600}}>Pas encore ouvert</span> · <span style={{color:'#059669',fontWeight:600}}>Composer</span> · <span style={{color:'#94a3b8',fontWeight:600}}>Terminé</span></p></div></div>
              <div className="step"><div className="step-num"><i className="fas fa-file-alt" style={{fontSize:17}} /></div><div className="step-content"><h4>Mes Copies</h4><p>Consultez vos copies soumises, vos notes et les feedbacks de correction IA.</p></div></div>
              <div className="step"><div className="step-num"><i className="fas fa-award" style={{fontSize:17}} /></div><div className="step-content"><h4>Relevés de Notes</h4><p>Téléchargez vos relevés semestriels officiels en PDF avec votre GPA et vos crédits.</p></div></div>
            </div>
          </div>
        </div>
  )
}

export function Demarrer() {
  return (
        <div className="section" id="demarrer">
          <div className="section-header"><div className="section-icon"><i className="fas fa-play" /></div><h2>Démarrer un examen</h2></div>
          <div className="section-body">
            <div className="steps">
              <div className="step"><div className="step-num">1</div><div className="step-content"><h4>Repérer l&apos;examen disponible</h4><p>Dans <strong>Examens en Ligne</strong>, le bouton <span style={{background:'#10b981',color:'white',padding:'2px 8px',borderRadius:4,fontSize:14.5,fontWeight:700}}>Composer</span> apparaît quand l&apos;examen est en cours. Si trop tôt, cliquez sur <span style={{background:'#fef9c3',color:'#d97706',padding:'2px 8px',borderRadius:4,fontSize:14.5,fontWeight:700,border:'1px solid #fcd34d'}}>Pas encore ouvert</span> pour voir l&apos;heure de début exacte.</p><img className="guide-img" src="/screenshots/capture-8.jpg" alt="Liste des examens en ligne côté étudiant avec le bouton Composer" /></div></div>
              <div className="step"><div className="step-num">2</div><div className="step-content"><h4>Vérification d&apos;identité (reconnaissance faciale)</h4><p>Avant chaque accès à un examen, votre identité est vérifiée automatiquement par reconnaissance faciale. La <strong>première fois</strong>, vous êtes redirigé(e) vers un écran d&apos;inscription (une seule fois, modifiable ensuite depuis Paramètres &gt; Sécurité) ; ensuite, la vérification est quasi instantanée à chaque examen.</p><div className="warn"><i className="fas fa-exclamation-triangle" /> Après plusieurs échecs de reconnaissance, un appel vidéo avec votre surveillant s&apos;ouvre automatiquement pour vérifier votre identité manuellement et débloquer l&apos;accès.</div></div></div>
              <div className="step"><div className="step-num">3</div><div className="step-content"><h4>Accepter la surveillance</h4><p>Une fenêtre de consentement s&apos;affiche. Lisez attentivement les conditions de surveillance, puis cliquez sur <strong>J&apos;accepte et je démarre l&apos;examen</strong>. Aucune signature n&apos;est demandée : l&apos;attestation sur l&apos;honneur est validée par ce clic.</p><div className="warn"><i className="fas fa-exclamation-triangle" /> Votre navigateur (ou l&apos;application CEI Examen) demandera l&apos;accès à la caméra et au microphone. Vous <strong>devez</strong> les autoriser pour pouvoir composer.</div><img className="guide-img" src="/screenshots/capture-11.jpg" alt="Attestation sur l'honneur à accepter avant de démarrer l'examen, avec le bouton J'accepte et je démarre l'examen" /><img className="guide-img" src="/screenshots/capture-12.jpg" alt="Écran de demande d'accès caméra, microphone et partage d'écran" /></div></div>
              <div className="step"><div className="step-num">4</div><div className="step-content"><h4>Scan de l&apos;environnement (360°)</h4><p>Avant de démarrer, il vous sera demandé de tourner lentement votre caméra pour montrer votre environnement — cela vérifie qu&apos;aucune autre personne n&apos;est présente à vos côtés. Cette étape dure quelques secondes.</p></div></div>
              <div className="step"><div className="step-num">5</div><div className="step-content"><h4>Mode plein écran</h4><p>L&apos;examen s&apos;ouvre en plein écran automatiquement. Votre caméra s&apos;active, la surveillance commence. Ne quittez pas le plein écran pendant l&apos;examen.</p></div></div>
            </div>
          </div>
        </div>
  )
}

export function CameraSecondaire() {
  return (
        <div className="section" id="camera-secondaire">
          <div className="section-header"><div className="section-icon" style={{background:'#0d9488'}}><i className="fas fa-mobile-screen" /></div><h2>Caméra secondaire (smartphone)</h2></div>
          <div className="section-body">
            <p style={{color:'#475569',marginBottom:16}}>Certains examens exigent une <strong>caméra secondaire</strong> — votre téléphone, filmant votre poste de travail sous un angle latéral que la caméra de l&apos;ordinateur ne couvre pas. Ce n&apos;est pas systématique : le bouton n&apos;apparaît que si l&apos;enseignant l&apos;a activé pour cet examen précis.</p>
            <img className="guide-img" src="/screenshots/camera-secondaire-etapes.jpg" alt="Les 3 étapes pour ajouter la caméra secondaire : scanner le QR code, trouver un support stable, positionner le téléphone et démarrer l'examen" style={{maxWidth:900}} />
            <div className="steps">
              <div className="step"><div className="step-num">1</div><div className="step-content"><h4>Après le scan de l&apos;environnement</h4><p>Une fois la vérification de l&apos;environnement (360°) terminée, un bouton <strong>&quot;Ajouter la caméra secondaire&quot;</strong> apparaît sur l&apos;écran. S&apos;il est marqué <strong>&quot;requise pour cet examen&quot;</strong>, le bouton <strong>&quot;Continuer vers l&apos;examen&quot;</strong> reste grisé tant que le téléphone n&apos;est pas connecté.</p></div></div>
              <div className="step"><div className="step-num">2</div><div className="step-content"><h4>Scanner le code QR</h4><p>Cliquez sur le bouton : un code QR et un code à 6 chiffres s&apos;affichent, valables 5 minutes. Avec l&apos;appareil photo de votre <strong>téléphone</strong>, scannez le code QR — il ouvre automatiquement la page de couplage dans votre navigateur mobile.</p><div className="tip"><i className="fas fa-keyboard" /> Sans appareil pour scanner, ouvrez le lien affiché sous le code QR directement depuis le navigateur de votre téléphone : le code y est déjà pré-rempli, il ne reste qu&apos;à vérifier et cliquer sur &quot;Se connecter&quot;.</div></div></div>
              <div className="step"><div className="step-num">3</div><div className="step-content"><h4>Positionner le téléphone</h4><p>Une fois connecté, la caméra frontale de votre téléphone occupe tout l&apos;écran. Posez le téléphone (support, étui, objet stable) de façon à couvrir votre poste de travail — bureau, mains, feuilles éventuelles — puis ne le touchez plus pendant l&apos;examen.</p></div></div>
              <div className="step"><div className="step-num">4</div><div className="step-content"><h4>Pendant la composition</h4><p>Un badge <strong>&quot;Connectée&quot;</strong> (vert) apparaît dans la barre en haut de l&apos;examen. Laissez le téléphone <strong>branché à une source d&apos;alimentation</strong>, connecté au réseau, et ne fermez pas la page — la batterie ou le WiFi peuvent se décharger/couper pendant une session longue.</p></div></div>
            </div>
            <div className="warn"><i className="fas fa-exclamation-triangle" /> <span>En cas de coupure réseau côté téléphone, la reconnexion est automatique dans la plupart des cas. Si le badge passe au rouge (<strong>&quot;Déconnectée&quot;</strong>), cliquez dessus pour rouvrir la fenêtre de couplage et reconnecter le téléphone avec un nouveau code — sans quitter l&apos;examen.</span></div>
          </div>
        </div>
  )
}

export function Pendant() {
  return (
        <div className="section" id="pendant">
          <div className="section-header"><div className="section-icon"><i className="fas fa-pen" /></div><h2>Pendant l&apos;examen</h2></div>
          <div className="section-body">
            <div className="steps">
              <div className="step"><div className="step-num">1</div><div className="step-content"><h4>Lire le sujet</h4><p>Le sujet s&apos;affiche dans le panneau principal. Seules les questions sont visibles — le barème est masqué. Utilisez le bouton <strong>Réduire/Agrandir</strong> pour ajuster l&apos;affichage.</p><img className="guide-img" src="/screenshots/capture-14.jpg" alt="Interface de composition avec surveillance IA active, réponses et bouton Soumettre" /></div></div>
              <div className="step"><div className="step-num">2</div><div className="step-content"><h4>Rédiger vos réponses</h4><p>Écrivez vos réponses dans la zone de texte. Indiquez clairement le numéro de chaque question (ex : <em>&quot;Question 1 : ...&quot;</em>). La sauvegarde est automatique toutes les 30 secondes.</p><div className="tip"><i className="fas fa-calculator" /> Si l&apos;enseignant l&apos;a activée pour cet examen, un bouton <strong>Calculatrice</strong> apparaît en haut de la page — calculatrice scientifique intégrée (fonctions, mémoire), à utiliser à la place d&apos;une calculatrice physique ou d&apos;un téléphone, qui ne peuvent pas être vérifiés par le surveillant.</div></div></div>
              <div className="step"><div className="step-num">3</div><div className="step-content"><h4>Partage d&apos;écran complet obligatoire</h4><p>Le partage de votre écran est <strong>obligatoire</strong>. Une boîte de dialogue du navigateur s&apos;affiche — vous <strong>devez</strong> sélectionner l&apos;onglet <strong>&quot;Tout l&apos;écran&quot;</strong> puis choisir votre moniteur entier et confirmer.</p><div className="danger"><i className="fas fa-ban" /> <div><strong>Interdit :</strong> Le partage d&apos;une <strong>fenêtre</strong> ou d&apos;un <strong>onglet</strong> est automatiquement refusé par le système. Seul l&apos;<strong>écran complet (moniteur entier)</strong> est accepté. Si vous partagez une fenêtre, un message d&apos;erreur s&apos;affiche et vous devrez recommencer.</div><img className="guide-img" src="/screenshots/capture-13.jpg" alt="Dialogue du navigateur pour choisir Tout l'écran lors du partage d'écran" /></div></div></div>
              <div className="step"><div className="step-num">4</div><div className="step-content"><h4>Contacter l&apos;enseignant</h4><p>En cas de question ou problème technique, utilisez la zone <strong>&quot;Contacter l&apos;enseignant&quot;</strong> en bas du panneau de surveillance. L&apos;enseignant verra votre message sur son dashboard et pourra vous répondre.</p><div className="tip"><i className="fas fa-lightbulb" /> Les réponses de l&apos;enseignant apparaissent en bleu dans le panneau gauche (message) ou en orange (avertissement).</div><div className="tip" style={{marginTop:10}}><i className="fas fa-phone" style={{color:'#2563eb'}} /> <span style={{color:'#1e3a8a'}}>Besoin d&apos;une explication orale ? Cliquez sur le bouton <strong>microphone violet</strong> dans la zone de messagerie pour envoyer une demande d&apos;appel vocal à l&apos;enseignant. Si celui-ci accepte, une fenêtre d&apos;appel audio/vidéo privé s&apos;ouvrira automatiquement.</span></div></div></div>
              <div className="step"><div className="step-num">5</div><div className="step-content"><h4>Si votre connexion Internet faiblit</h4><p>La plateforme détecte une connexion lente et réduit automatiquement la qualité vidéo de surveillance pour préserver l&apos;enregistrement de vos réponses, qui reste toujours prioritaire. Un bandeau discret vous en informe. <strong>Vos réponses sont aussi sauvegardées sur votre appareil</strong> en plus du serveur : même en cas de coupure prolongée, rien n&apos;est perdu.</p><div className="tip"><i className="fas fa-wifi" /> Débit minimum recommandé : environ <strong>300 kbps</strong> en connexion dégradée (caméra + partage d&apos;écran réduits automatiquement), <strong>1 Mbps</strong> en connexion normale pour un confort optimal.</div></div></div>
              <div className="step"><div className="step-num">6</div><div className="step-content"><h4>Téléchargement de fichiers</h4><p>Si l&apos;enseignant l&apos;a désactivé, le téléchargement des images/vidéos/audios du sujet n&apos;est pas possible (y compris via le bouton natif des lecteurs vidéo).</p></div></div>
            </div>
          </div>
        </div>
  )
}

export function Pause() {
  return (
        <div className="section" id="pause">
          <div className="section-header"><div className="section-icon" style={{background:'#0891b2'}}><i className="fas fa-mug-hot" /></div><h2>Faire une pause</h2></div>
          <div className="section-body">
            <p style={{color:'#475569',marginBottom:16}}>Un besoin physiologique pendant l&apos;examen ? Vous disposez d&apos;une pause de <strong>3 minutes</strong>, utilisable une seule fois par examen.</p>
            <div className="steps">
              <div className="step"><div className="step-num">1</div><div className="step-content"><h4>Cliquer sur &quot;Pause (3 min)&quot;</h4><p>Le bouton se trouve dans la barre en haut de l&apos;examen, à côté du chronomètre. Un écran de pause plein écran s&apos;affiche avec un compte à rebours.</p></div></div>
              <div className="step"><div className="step-num">2</div><div className="step-content"><h4>La surveillance est suspendue</h4><p>Pendant la pause, la caméra, la détection de changement d&apos;onglet et le plein écran obligatoire sont temporairement désactivés — vous ne serez pas pénalisé pour vous être absenté(e) de l&apos;écran.</p></div></div>
              <div className="step"><div className="step-num">3</div><div className="step-content"><h4>Le temps de composition est prolongé</h4><p>Dès que vous démarrez la pause, vos 3 minutes sont automatiquement ajoutées au temps restant de votre examen — vous ne perdez rien.</p></div></div>
              <div className="step"><div className="step-num">4</div><div className="step-content"><h4>Reprendre</h4><p>L&apos;examen reprend automatiquement à la fin des 3 minutes, ou plus tôt si vous cliquez sur <strong>&quot;Reprendre maintenant&quot;</strong>.</p></div></div>
            </div>
            <div className="warn"><i className="fas fa-exclamation-triangle" /> Une seule pause par examen — le bouton se grise une fois utilisé.</div>
          </div>
        </div>
  )
}

export function Soumettre() {
  return (
        <div className="section" id="soumettre">
          <div className="section-header"><div className="section-icon"><i className="fas fa-paper-plane" /></div><h2>Soumettre votre copie</h2></div>
          <div className="section-body">
            <div className="steps">
              <div className="step"><div className="step-num">1</div><div className="step-content"><h4>Relire vos réponses (obligatoire)</h4><p>En cliquant sur <span style={{background:'#059669',color:'white',padding:'3px 10px',borderRadius:6,fontSize:14.5,fontWeight:700}}><i className="fas fa-paper-plane" /> Soumettre l&apos;examen</span>, un écran de relecture s&apos;affiche d&apos;abord avec toutes vos réponses — vérifiez qu&apos;aucune question n&apos;a été oubliée. Vous pouvez encore revenir modifier vos réponses, ou confirmer.</p></div></div>
              <div className="step"><div className="step-num">2</div><div className="step-content"><h4>Confirmer la soumission</h4><p>Après avoir confirmé depuis l&apos;écran de relecture, la remise est validée et une confirmation s&apos;affiche (aucune signature n&apos;est demandée). <strong>Cette action est irréversible.</strong></p></div></div>
              <div className="step"><div className="step-num">3</div><div className="step-content"><h4>Soumission automatique</h4><p>Si le temps s&apos;écoule, votre copie est soumise automatiquement avec le contenu sauvegardé. Assurez-vous que la sauvegarde automatique fonctionne (indicateur vert en bas de la zone de réponse).</p></div></div>
            </div>
          </div>
        </div>
  )
}

export function Resultats() {
  return (
        <div className="section" id="resultats">
          <div className="section-header"><div className="section-icon"><i className="fas fa-star" /></div><h2>Consulter vos résultats</h2></div>
          <div className="section-body">
            <div className="steps">
              <div className="step"><div className="step-num">1</div><div className="step-content"><h4>Voir la note et le feedback</h4><p>Dans <strong>Mes Copies</strong>, cliquez sur une copie corrigée pour voir votre note, le feedback détaillé de l&apos;IA par question et les commentaires de l&apos;enseignant.</p><div className="warn"><i className="fas fa-clock" /> Même une fois votre copie corrigée, la note reste masquée (affichage <strong>&quot;En attente de publication&quot;</strong>) tant que l&apos;enseignant n&apos;a pas explicitement cliqué sur &quot;Publier les notes&quot; — généralement après délibération. Aucune notification ne vous prévient : revenez consulter la page régulièrement.</div></div></div>
              <div className="step"><div className="step-num">2</div><div className="step-content"><h4>Télécharger le relevé de notes</h4><p>Dans <strong>Relevés de Notes</strong>, téléchargez votre relevé semestriel officiel en PDF avec votre GPA, vos crédits obtenus et le détail de toutes les UEs.</p></div></div>
            </div>
          </div>
        </div>
  )
}

export function Reclamation() {
  return (
        <div className="section" id="reclamation">
          <div className="section-header"><div className="section-icon"><i className="fas fa-comment-dots" /></div><h2>Faire une réclamation</h2></div>
          <div className="section-body">
            <div className="steps">
              <div className="step"><div className="step-num">1</div><div className="step-content"><h4>Contester une note</h4><p>Dans <strong>Réclamations</strong>, cliquez sur <strong>Nouvelle Réclamation</strong>. Sélectionnez la copie concernée et rédigez votre argumentation.</p></div></div>
              <div className="step"><div className="step-num">2</div><div className="step-content"><h4>Analyse IA de votre réclamation</h4><p>La plateforme analyse automatiquement vos arguments et les compare au barème. L&apos;enseignant prend la décision finale.</p><div className="warn"><i className="fas fa-info-circle" /> Aucune notification (email ou in-app) n&apos;est envoyée quand la décision est prise — revenez consulter la page <strong>Réclamations</strong> pour voir la réponse et le statut mis à jour.</div></div></div>
            </div>
            <div className="tip"><i className="fas fa-lightbulb" /> Soyez précis dans votre argumentation. Référencez les questions spécifiques et expliquez pourquoi vous pensez que votre réponse mérite plus de points.</div>
          </div>
        </div>
  )
}

export function Reprise() {
  return (
        <div className="section" id="deconnexion">
          <div className="section-header"><div className="section-icon" style={{background:'#dc2626'}}><i className="fas fa-key" /></div><h2>En cas de déconnexion — reprendre l&apos;examen</h2></div>
          <div className="section-body">
            <p style={{color:'#475569',marginBottom:20}}>Si vous êtes déconnecté(e) pendant un examen (fermeture accidentelle de l&apos;onglet ou de l&apos;application, coupure réseau prolongée, redémarrage de l&apos;ordinateur…), la reprise est <strong>entièrement automatique</strong> — pas besoin d&apos;appeler qui que ce soit.</p>
            <div className="steps">
              <div className="step"><div className="step-num">1</div><div className="step-content"><h4>Retourner sur l&apos;examen</h4><p>Reconnectez-vous à la plateforme et rouvrez l&apos;examen en cours. Un écran affiche directement <strong>votre code personnel</strong>, généré automatiquement et propre à vous — personne d&apos;autre ne peut l&apos;utiliser.</p></div></div>
              <div className="step"><div className="step-num">2</div><div className="step-content"><h4>Copier-coller le code</h4><p>Cliquez sur l&apos;icône de copie à côté du code, puis collez-le dans le champ juste en dessous.</p></div></div>
              <div className="step"><div className="step-num">3</div><div className="step-content"><h4>Cliquer sur &quot;Reprendre&quot;</h4><p>Vous retrouvez immédiatement votre examen exactement là où vous vous étiez arrêté(e) — vos réponses précédentes sont automatiquement restaurées, rien n&apos;est perdu.</p><div className="tip"><i className="fas fa-bell" /> Votre surveillant est automatiquement notifié de votre reprise (après coup, pas avant) — il peut vous appeler s&apos;il le juge utile, mais ce n&apos;est plus une étape obligatoire pour vous.</div></div></div>
              <div className="step"><div className="step-num">4</div><div className="step-content"><h4>Si le code ne fonctionne pas</h4><p>Utilisez le bouton <strong>&quot;Retour au tableau de bord&quot;</strong> sur cet écran, puis contactez votre surveillant ou votre enseignant via la messagerie de l&apos;examen.</p></div></div>
            </div>
          </div>
        </div>
  )
}

