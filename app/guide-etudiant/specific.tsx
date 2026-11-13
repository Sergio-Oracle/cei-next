// Parties propres à chaque cas : examen dans l'application CEI Examen, examen dans le navigateur.

export function InstallerApplication() {
  return (
        <div className="section" id="installer">
          <div className="section-header"><div className="section-icon" style={{background:'#1d4ed8'}}><i className="fas fa-lock" /></div><h2>Installer et préparer l&apos;application CEI Examen</h2></div>
          <div className="section-body">
            <p style={{color:'#475569',marginBottom:20}}>Certains examens se passent dans l&apos;application <strong>CEI Examen</strong>, qui verrouille votre ordinateur en plein écran pendant la composition, comme Safe Exam Browser. Votre enseignant vous le précise ; si l&apos;application est exigée et que vous ouvrez l&apos;examen dans un navigateur ordinaire, l&apos;écran <strong>« Application CEI Examen requise »</strong> s&apos;affiche à la place du démarrage.</p>
            <div className="steps">
              <div className="step"><div className="step-num">1</div><div className="step-content"><h4>Télécharger l&apos;application</h4><p>Rendez-vous sur la page <a href="/telecharger-client" style={{color:'#059669',fontWeight:600}}>Télécharger l&apos;application CEI Examen</a> et choisissez la version de votre ordinateur (Windows, Linux ou Mac quand elle est disponible). Faites-le <strong>bien avant le jour de l&apos;examen</strong>, jamais dix minutes avant.</p></div></div>
              <div className="step"><div className="step-num">2</div><div className="step-content"><h4>Installer et ouvrir</h4>
                <ul>
                  <li><strong>Windows :</strong> extrayez l&apos;archive ZIP, puis lancez <em>CEI Examen.exe</em>. Si l&apos;écran « Windows a protégé votre ordinateur » apparaît, cliquez sur <em>Informations complémentaires</em> puis <em>Exécuter quand même</em>.</li>
                  <li><strong>Mac :</strong> clic droit sur l&apos;application, puis <em>Ouvrir</em> (ou, dans le Terminal : <code>xattr -cr &quot;/Applications/CEI Examen.app&quot;</code>).</li>
                  <li><strong>Linux :</strong> double-cliquez sur le fichier <em>.deb</em> puis <em>Installer</em> (ou <code>sudo apt install ./CEI-Examen-*.deb</code>) : l&apos;application apparaît dans le menu des applications. Variante sans installation : le fichier AppImage (autorisez son exécution ; au besoin <code>sudo apt install libfuse2</code>).</li>
                </ul></div></div>
              <div className="step"><div className="step-num">3</div><div className="step-content"><h4>Se connecter et tester la veille</h4><p>Connectez-vous dans l&apos;application avec votre compte habituel, comme sur le site. Vérifiez que votre tableau de bord s&apos;affiche : si c&apos;est le cas, vous êtes prêt.</p></div></div>
              <div className="step"><div className="step-num">3b</div><div className="step-content"><h4>Tester caméra, micro et partage d&apos;écran</h4><p>Lancez le <a href="/test-poste" style={{color:'#059669',fontWeight:600}}>test du poste</a> (dans l&apos;application ou sur le site) : il contrôle votre caméra, votre micro, le partage d&apos;écran complet, votre connexion et la visioconférence, et vous indique précisément quoi corriger. Sur Mac, autorisez à ce moment la caméra, le micro et l&apos;enregistrement de l&apos;écran quand le système le demande, puis relancez l&apos;application. <strong>Ne découvrez pas un problème le jour de l&apos;examen.</strong></p></div></div>
              <div className="step"><div className="step-num">4</div><div className="step-content"><h4>Le jour de l&apos;examen</h4><p>Ouvrez l&apos;application, allez dans <strong>Mes Examens</strong> et démarrez l&apos;examen comme d&apos;habitude. Depuis le navigateur, le bouton <strong>« Déjà installée : ouvrir dans l&apos;application »</strong> vous y amène directement.</p></div></div>
              <div className="step"><div className="step-num">5</div><div className="step-content"><h4>Fermer vos autres applications</h4><p>Avant de commencer, l&apos;application affiche la liste des programmes encore ouverts (bloc-notes, Word, navigateurs, assistants d&apos;intelligence artificielle comme Claude ou ChatGPT, messageries…). <strong>Enregistrez votre travail</strong>, puis fermez-les vous-même ou cliquez sur <strong>« Fermer ces applications »</strong>. Le bouton de démarrage reste bloqué tant qu&apos;il en reste.</p>
                <div className="warn"><i className="fas fa-exclamation-triangle" /><div>Les <strong>navigateurs</strong> sont fermés eux aussi : un chatbot ouvert dans un onglet disparaît avec son navigateur. Un document non enregistré dans une autre application peut être perdu.</div></div></div></div>
            </div>
            <div className="tip"><i className="fas fa-rotate" /><div><strong>Mises à jour automatiques.</strong> À partir de la version 1.3.0, l&apos;application vérifie toute seule s&apos;il existe une version plus récente : elle la télécharge, l&apos;installe et redémarre (jamais pendant un examen). Si une fenêtre « Mise à jour » apparaît, laissez-la terminer sans fermer l&apos;application. Une version plus ancienne que la 1.3.0 doit être réinstallée une fois depuis la page de téléchargement.</div></div>
            <div className="tip"><i className="fas fa-mobile-screen-button" /><div><strong>Une seule application à installer.</strong> CEI Examen sert pour tout : notes, réclamations et examens, verrouillés ou non. Si vous aviez installé la version web de CEI sur votre ordinateur, vous pouvez la désinstaller une fois CEI Examen en place (instructions sur la page de téléchargement). Sur téléphone, gardez la version web : les examens surveillés se passent sur ordinateur.</div></div>
            <h4 style={{fontSize:16,fontWeight:700,color:'#0f172a',margin:'26px 0 10px'}}>Ce qui se passe pendant l&apos;examen</h4>
            <ul style={{paddingLeft:20,color:'#475569',fontSize:14,lineHeight:1.8}}>
              <li>L&apos;écran passe en <strong>plein écran verrouillé</strong> : impossible de réduire, déplacer ou fermer la fenêtre.</li>
              <li><strong>Alt+Tab, la touche Windows, F5, F12, Ctrl+W…</strong> n&apos;ont plus d&apos;effet ; chaque tentative est signalée au surveillant.</li>
              <li>Aucun autre site ni aucune autre application ne peut s&apos;ouvrir : toute nouvelle application est fermée aussitôt.</li>
              <li>Le démarrage est <strong>refusé</strong> tant qu&apos;un <strong>second écran</strong> actif (ou un câble de projection HDMI/VGA) ou une <strong>clé ou un disque USB</strong> est branché : débranchez-les avant de commencer. S&apos;un d&apos;eux est branché en cours d&apos;examen, il est masqué ou éjecté et signalé.</li>
              <li>Le presse-papiers est vidé en continu : rien d&apos;extérieur ne peut être collé. Les captures d&apos;écran apparaissent noires.</li>
              <li>Les logiciels de contrôle à distance sont arrêtés, et les <strong>machines virtuelles</strong> sont détectées et signalées : utilisez votre ordinateur réel.</li>
              <li><strong>Teams, Zoom, Discord, WhatsApp, Telegram…</strong> restés actifs en arrière-plan sont arrêtés automatiquement par l&apos;application (version 1.4.1 ou plus récente). Avec une version plus ancienne, quittez-les vous-même par leur icône près de l&apos;horloge.</li>
              <li>Quand vous soumettez votre copie, <strong>votre ordinateur est libéré automatiquement</strong>.</li>
            </ul>
            <div className="danger"><i className="fas fa-ban" /><div><strong>Ne tentez pas de contourner l&apos;application.</strong> Toutes les tentatives (changement d&apos;application, raccourcis, second écran, logiciel interdit) sont enregistrées avec l&apos;heure et transmises à l&apos;enseignant ; elles peuvent entraîner des sanctions.</div></div>
            <div className="tip"><i className="fas fa-life-ring" /><div><strong>En cas de problème :</strong> utilisez le bouton <em>Contacter l&apos;enseignant</em> dans la barre de l&apos;examen (message ou appel). Si l&apos;application doit absolument être quittée (panne), seul un surveillant peut vous donner un <strong>code de sortie d&apos;urgence</strong> (8 chiffres, créé pour vous seul, valable 15 minutes, à usage unique, vérifié par le serveur). Si votre ordinateur redémarre, rouvrez l&apos;application et reprenez l&apos;examen avec votre code personnel (voir section 9) : vos réponses sont conservées.</div></div>
          </div>
        </div>  )
}

export function PreparerNavigateur() {
  return (
    <div className="section" id="preparer">
      <div className="section-header"><div className="section-icon" style={{background:'#059669'}}><i className="fas fa-globe" /></div><h2>Préparer votre ordinateur</h2></div>
      <div className="section-body">
        <p style={{color:'#475569',marginBottom:20}}>Votre examen se passe dans votre <strong>navigateur</strong> : il n&apos;y a rien à installer. En revanche, un navigateur ne peut ni fermer vos autres applications ni bloquer vos raccourcis à votre place. C&apos;est donc à vous de préparer votre poste, <strong>la veille puis juste avant de commencer</strong>.</p>
        <div className="steps">
          <div className="step"><div className="step-num">1</div><div className="step-content"><h4>Un ordinateur et un navigateur à jour</h4><p>Les examens surveillés se passent sur <strong>ordinateur</strong> (pas sur téléphone ni sur tablette), avec <strong>Google Chrome</strong> ou <strong>Microsoft Edge</strong> à jour.</p></div></div>
          <div className="step"><div className="step-num">2</div><div className="step-content"><h4>Tester la veille</h4><p>Lancez le <a href="/test-poste" style={{color:'#059669',fontWeight:600}}>test du poste</a> : il contrôle votre caméra, votre micro, le partage de l&apos;écran entier et votre connexion, et vous dit précisément quoi corriger. Autorisez la caméra, le micro et le partage quand le navigateur le demande. Si vous avez refusé par erreur : cliquez sur le cadenas à gauche de l&apos;adresse, remettez les autorisations sur « Autoriser », puis rechargez la page. <strong>Ne découvrez pas un problème le jour de l&apos;examen.</strong></p></div></div>
          <div className="step"><div className="step-num">3</div><div className="step-content"><h4>Fermer vous-même tout le reste</h4><p>Avant de commencer, fermez tous les autres onglets, toutes les autres fenêtres et applications : messageries, assistants d&apos;intelligence artificielle, musique, bloc-notes.</p><div className="warn"><i className="fas fa-exclamation-triangle" /><div>Le navigateur ne le fait pas pour vous. Pendant l&apos;examen, <strong>chaque changement d&apos;onglet ou de fenêtre est compté et signalé au surveillant</strong>, même involontaire.</div></div></div></div>
          <div className="step"><div className="step-num">4</div><div className="step-content"><h4>Couper les notifications</h4><p>Quittez complètement <strong>Teams, Zoom, Discord, WhatsApp, Telegram…</strong> (par leur icône près de l&apos;horloge : fermer la fenêtre ne suffit pas), puis activez le mode « Ne pas déranger » de votre système. Une fenêtre qui s&apos;ouvre toute seule en prenant le focus compte comme un changement de fenêtre.</p></div></div>
          <div className="step"><div className="step-num">5</div><div className="step-content"><h4>Désactiver extensions et traduction automatique</h4><p>Désactivez les extensions du navigateur (assistants d&apos;IA, traducteurs, bloqueurs, outils de capture) et la <strong>traduction automatique</strong> de la page : elles peuvent perturber l&apos;affichage de l&apos;examen et provoquer des signalements.</p></div></div>
          <div className="step"><div className="step-num">6</div><div className="step-content"><h4>Un seul écran</h4><p>Débranchez tout second écran ou projecteur : un second écran est détecté et signalé au surveillant.</p></div></div>
          <div className="step"><div className="step-num">7</div><div className="step-content"><h4>Alimentation et réseau</h4><p>Branchez l&apos;ordinateur sur secteur, coupez les téléchargements, la vidéo et la musique en ligne, et préférez un câble réseau au Wi-Fi si vous le pouvez.</p></div></div>
        </div>
        <div className="tip"><i className="fas fa-circle-info" /><div><strong>Votre enseignant exige l&apos;application CEI Examen ?</strong> Ce guide ne s&apos;applique pas : suivez le <a href="/guide-etudiant/application" style={{color:'#059669',fontWeight:600}}>guide de l&apos;application CEI Examen</a>. Si l&apos;application est exigée et que vous ouvrez l&apos;examen dans un navigateur, l&apos;écran « Application CEI Examen requise » s&apos;affiche à la place du démarrage.</div></div>
      </div>
    </div>
  )
}

type Mode = 'application' | 'navigateur'

export function Consignes({ mode }: { mode: Mode }) {
  const app = mode === 'application'
  return (
    <div className="section" id="regles">
      <div className="section-header"><div className="section-icon"><i className="fas fa-shield-alt" /></div><h2>Consignes à respecter pendant l&apos;évaluation</h2></div>
      <div className="section-body">
        <p style={{color:'#475569',marginBottom:16}}>{app
          ? "L'ordinateur est verrouillé en plein écran. Toute tentative de sortie est bloquée, enregistrée avec l'heure et transmise au surveillant."
          : "Votre navigateur ne bloque rien : c'est vous qui respectez les règles. Chaque écart est détecté, enregistré avec l'heure et transmis au surveillant."}</p>
        <div className="split">
          <div className="col no">
            <h4><i className="fas fa-ban" /> Interdit</h4>
            <ul>
              {app ? <>
                <li>Essayer de quitter l&apos;application ou d&apos;utiliser Alt+Tab, la touche Windows, F5, F12, Ctrl+W : bloqué et signalé.</li>
                <li>Ouvrir un autre site ou une autre application, un chatbot, un traducteur : fermé aussitôt et signalé.</li>
                <li>Laisser Teams, Zoom, Discord, WhatsApp ou Telegram actifs en arrière-plan.</li>
                <li>Brancher un second écran, un câble HDMI/VGA, une clé ou un disque USB.</li>
                <li>Utiliser une machine virtuelle ou un outil de prise de contrôle à distance.</li>
              </> : <>
                <li>Quitter le plein écran (Échap, F11) ou changer d&apos;onglet ou de fenêtre (Alt+Tab, clic ailleurs) : non bloqué, mais compté et signalé.</li>
                <li>Ouvrir un autre site, un chatbot, un traducteur ou une extension d&apos;IA.</li>
                <li>Cliquer sur une notification (Teams, WhatsApp, e-mail) qui s&apos;affiche.</li>
                <li>Brancher ou garder un second écran : il est détecté et signalé.</li>
                <li>Ouvrir les outils de développement (F12) : détecté.</li>
              </>}
              <li>Copier-coller, clic droit, téléchargements (désactivés).</li>
              <li>Se lever, cacher son visage, détourner longuement le regard.</li>
              <li>Parler, lire à voix haute, laisser entrer quelqu&apos;un dans la pièce.</li>
              <li>Garder un téléphone, un livre ou des notes à portée de vue, sauf autorisation de l&apos;enseignant.</li>
              <li>Partager une fenêtre ou un onglet au lieu de l&apos;écran entier : refusé.</li>
              <li>Prêter ou partager son code de reprise{app ? ' ou de sortie' : ''}, ou se faire remplacer.</li>
            </ul>
          </div>
          <div className="col yes">
            <h4><i className="fas fa-check-circle" /> À faire</h4>
            <ul>
              <li>Répondre directement dans {app ? "l'application" : "la page de l'examen"}. La sauvegarde est automatique toutes les 30 secondes.</li>
              <li>Surveiller le chronomètre en haut de l&apos;écran : à la fin du temps, la copie est envoyée avec les réponses déjà saisies.</li>
              <li>Être seul(e), le visage visible, éclairé de face, dans le cadre de la caméra.</li>
              <li>Poser vos questions par « Contacter l&apos;enseignant » (message ou appel).</li>
              <li>Utiliser la calculatrice intégrée seulement si l&apos;enseignant l&apos;a activée.</li>
              <li>Utiliser la pause de 3 minutes, une seule fois, pour un besoin urgent.</li>
              <li>En cas de panne : prévenir le surveillant, reprendre avec votre code personnel{app ? ", ne pas chercher à quitter l'application" : ''}.</li>
              <li>Cliquer sur « Soumettre » quand vous avez fini{app ? " : l'ordinateur est alors libéré" : ''}.</li>
            </ul>
          </div>
        </div>
        <div className="warn" style={{marginTop:20}}><i className="fas fa-triangle-exclamation" /><div><strong>Les écarts répétés ont des conséquences.</strong> Selon les seuils fixés par l&apos;enseignant pour cet examen (changements de fenêtre, absence du visage, outils de développement…), vous pouvez être averti(e), appelé(e) en visio par le surveillant, puis <strong>exclu(e) de l&apos;examen avec une copie notée 0</strong>.</div></div>
      </div>
    </div>
  )
}

export function Surveille({ mode }: { mode: Mode }) {
  const app = mode === 'application'
  return (
    <div className="section" id="surveillance">
      <div className="section-header"><div className="section-icon" style={{background:'#d97706'}}><i className="fas fa-eye" /></div><h2>Ce qui est surveillé</h2></div>
      <div className="section-body">
        <div className="warn"><i className="fas fa-eye" /><div><strong>L&apos;absence d&apos;alerte à l&apos;écran ne veut pas dire qu&apos;il n&apos;y a rien eu.</strong> Votre écran n&apos;affiche qu&apos;une petite partie des signalements. Le surveillant reçoit le détail en direct, et tout est conservé avec l&apos;heure : l&apos;enseignant peut le revoir après l&apos;examen.</div></div>
        <p style={{color:'#475569',margin:'16px 0 8px'}}>Sont signalés au surveillant :</p>
        <ul style={{paddingLeft:20,color:'#475569',fontSize:14,lineHeight:1.8}}>
          {app ? <>
            <li>les tentatives de fermeture ou de raccourcis, les applications ouvertes ou fermées par l&apos;application, les logiciels interdits ;</li>
            <li>un second écran, une clé USB, une machine virtuelle ;</li>
          </> : <>
            <li>chaque changement d&apos;onglet ou de fenêtre, chaque sortie du plein écran ;</li>
            <li>un second écran, l&apos;ouverture des outils de développement ;</li>
          </>}
          <li>votre visage absent ou plusieurs visages, un regard ou une tête tournés de façon prolongée ;</li>
          <li>un objet visible (téléphone, livre) et les voix ou bruits prolongés.</li>
        </ul>
      </div>
    </div>
  )
}

export function VisageConseils() {
  return (
    <div className="section" id="detection-faciale">
      <div className="section-header"><div className="section-icon"><i className="fas fa-user-check" /></div><h2>Détection du visage — conseils pratiques</h2></div>
      <div className="section-body">
        <p style={{color:'#475569',marginBottom:16}}>La plateforme vérifie votre présence en continu grâce à la caméra. Voici comment éviter les signalements inutiles.</p>
        <div className="steps">
          <div className="step"><div className="step-num">1</div><div className="step-content"><h4>Positionnement optimal</h4><p>Placez-vous face à la caméra, à environ <strong>40–80 cm</strong>. Votre visage doit être entièrement visible, bien éclairé (lumière devant vous, non derrière). Évitez les contre-jours ainsi que les casquettes, masques ou mèches qui masquent le visage.</p></div></div>
          <div className="step"><div className="step-num">2</div><div className="step-content"><h4>Ce que vous voyez à l&apos;écran</h4><p>Un petit indicateur sous la caméra affiche « Visage OK » quand tout va bien, ou « Caméra active » sinon. <strong>Il ne donne pas le détail des signalements</strong> : le surveillant, lui, reçoit tout. Ne déduisez donc rien de l&apos;absence de message : restez simplement bien cadré(e).</p></div></div>
          <div className="step"><div className="step-num">3</div><div className="step-content"><h4>Si le système ne vous reconnaît pas</h4><p>Après plusieurs échecs de reconnaissance, un appel vidéo avec votre surveillant peut s&apos;ouvrir pour vérifier votre identité manuellement. Répondez calmement, face à la caméra.</p></div></div>
          <div className="step"><div className="step-num">4</div><div className="step-content"><h4>Visages multiples</h4><p>Si une autre personne apparaît dans le champ de la caméra, le surveillant est prévenu immédiatement. Assurez-vous d&apos;être <strong>seul(e)</strong> pendant toute la durée de l&apos;examen.</p></div></div>
          <div className="step"><div className="step-num">5</div><div className="step-content"><h4>Regard, orientation de la tête et objets</h4><p>La plateforme observe aussi si votre regard reste sur l&apos;écran, si vous détournez la tête de façon prolongée et si un objet (téléphone, livre) apparaît dans le champ de la caméra.</p><div className="tip"><i className="fas fa-glasses" /> Si vous portez des lunettes ou avez une particularité visuelle, un étalonnage individuel est réalisé automatiquement au début de l&apos;examen pour éviter les fausses alertes : aucune action de votre part n&apos;est nécessaire.</div></div></div>
        </div>
      </div>
    </div>
  )
}
