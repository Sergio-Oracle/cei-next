export default function GuideSuperviseur() {
  return (
    <>
      <style>{`
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; background:#f8fafc; color:#1e293b; line-height:1.7; }
        .topbar { background:#0891b2; color:white; padding:14px 32px; display:flex; align-items:center; justify-content:space-between; position:sticky; top:0; z-index:100; box-shadow:0 2px 12px rgba(0,0,0,.2); }
        .topbar-brand { font-size:17px; font-weight:700; display:flex; align-items:center; gap:10px; }
        .topbar-brand i { font-size:22px; }
        .btn-back { background:rgba(255,255,255,.15); color:white; border:1px solid rgba(255,255,255,.3); padding:8px 18px; border-radius:8px; text-decoration:none; font-size:13px; font-weight:600; display:inline-flex; align-items:center; gap:6px; transition:.2s; }
        .btn-back:hover { background:rgba(255,255,255,.25); }
        .hero-doc { background:#0891b2; color:white; padding:60px 32px; text-align:center; }
        .hero-doc h1 { font-size:2.4rem; font-weight:800; margin-bottom:12px; }
        .hero-doc p { font-size:1.1rem; opacity:.9; max-width:600px; margin:0 auto; }
        .hero-badge { display:inline-flex; align-items:center; gap:6px; background:rgba(255,255,255,.15); border:1px solid rgba(255,255,255,.3); padding:6px 16px; border-radius:99px; font-size:13px; font-weight:600; margin-bottom:20px; }
        .content-wrap { max-width:900px; margin:0 auto; padding:48px 24px 80px; }
        .toc { background:white; border-radius:14px; border:1px solid #e2e8f0; padding:24px 28px; margin-bottom:40px; }
        .toc h3 { font-size:14px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:.05em; margin-bottom:14px; }
        .toc-list { list-style:none; display:flex; flex-direction:column; gap:6px; }
        .toc-list a { color:#0891b2; text-decoration:none; font-size:14px; font-weight:500; display:flex; align-items:center; gap:8px; }
        .toc-list a:hover { text-decoration:underline; }
        .toc-list a i { width:18px; text-align:center; font-size:13px; color:#94a3b8; }
        .section { background:white; border-radius:16px; border:1px solid #e2e8f0; margin-bottom:32px; overflow:hidden; }
        .section-header { background:#ecfeff; border-bottom:1px solid #a5f3fc; padding:20px 28px; display:flex; align-items:center; gap:14px; }
        .section-icon { width:48px; height:48px; background:#0891b2; border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:20px; color:white; flex-shrink:0; }
        .section-header h2 { font-size:1.15rem; font-weight:700; color:#0e7490; margin:0; }
        .section-body { padding:28px; }
        .steps { display:flex; flex-direction:column; gap:20px; }
        .step { display:flex; gap:16px; align-items:flex-start; }
        .step-num { width:36px; height:36px; background:#0891b2; color:white; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:14px; font-weight:700; flex-shrink:0; margin-top:2px; }
        .step-content h4 { font-size:15px; font-weight:700; color:#0f172a; margin-bottom:6px; }
        .step-content p { font-size:14px; color:#475569; line-height:1.65; }
        .step-content ul { margin-top:8px; padding-left:18px; }
        .step-content li { font-size:13px; color:#64748b; margin-bottom:4px; }
        .tip { background:#ecfeff; border:1px solid #a5f3fc; border-left:4px solid #0891b2; border-radius:8px; padding:14px 16px; margin-top:14px; font-size:13px; color:#0e7490; display:flex; align-items:flex-start; gap:10px; }
        .tip i { color:#0891b2; margin-top:2px; flex-shrink:0; }
        .info { background:#eff6ff; border:1px solid #bfdbfe; border-left:4px solid #2563eb; border-radius:8px; padding:14px 16px; margin-top:14px; font-size:13px; color:#1e40af; display:flex; align-items:flex-start; gap:10px; }
        .info i { color:#2563eb; margin-top:2px; flex-shrink:0; }
        .feature-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(240px,1fr)); gap:14px; margin-top:16px; }
        .feature-item { background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:16px; }
        .feature-item i { color:#0891b2; font-size:18px; margin-bottom:10px; display:block; }
        .feature-item h5 { font-size:13px; font-weight:700; color:#0f172a; margin-bottom:6px; }
        .feature-item p { font-size:12px; color:#64748b; line-height:1.5; }
        .status-row { display:flex; align-items:center; gap:12px; padding:10px 14px; border-radius:8px; margin-bottom:8px; }
        .status-dot { width:14px; height:14px; border-radius:50%; flex-shrink:0; }
        .status-row p { font-size:13px; color:#475569; margin:0; }
        .guide-img { display:block; width:100%; max-width:720px; margin:18px auto 6px; border-radius:12px; border:1px solid #e2e8f0; box-shadow:0 4px 16px rgba(0,0,0,.08); }
        footer.doc-footer { background:#1e293b; color:rgba(255,255,255,.7); text-align:center; padding:32px; font-size:13px; }
        footer.doc-footer a { color:#22d3ee; text-decoration:none; font-weight:600; }
        @media(max-width:640px) { .hero-doc h1 { font-size:1.8rem; } .content-wrap { padding:24px 16px 60px; } }
      `}</style>

      <div className="topbar">
        <div className="topbar-brand"><i className="fas fa-graduation-cap" /> Centre d&apos;Examen Intelligent</div>
        <a href="/" className="btn-back"><i className="fas fa-arrow-left" /> Retour à l&apos;accueil</a>
      </div>

      <div className="hero-doc">
        <div className="hero-badge"><i className="fas fa-user-shield" /> Pour les Superviseurs</div>
        <h1>Guide Superviseur</h1>
        <p>Tout ce que vous devez savoir pour superviser l&apos;engagement des surveillants et répondre aux demandes d&apos;aide des étudiants déconnectés.</p>
      </div>

      <div className="content-wrap">
        <div className="toc">
          <h3><i className="fas fa-list" /> &nbsp;Sommaire</h3>
          <ul className="toc-list">
            <li><a href="#role"><i className="fas fa-info-circle" /> 1. Le rôle Superviseur — vue d&apos;ensemble</a></li>
            <li><a href="#dashboard"><i className="fas fa-tachometer-alt" /> 2. Votre tableau de bord</a></li>
            <li><a href="#vigilance"><i className="fas fa-shield-halved" /> 3. Comprendre les niveaux de vigilance (A/B/C)</a></li>
            <li><a href="#appels"><i className="fas fa-phone-volume" /> 4. Répondre à une demande d&apos;appel étudiant</a></li>
            <li><a href="#limites"><i className="fas fa-circle-info" /> 5. Ce que vous ne gérez pas</a></li>
          </ul>
        </div>

        <div className="section" id="role">
          <div className="section-header"><div className="section-icon"><i className="fas fa-info-circle" /></div><h2>1. Le rôle Superviseur — vue d&apos;ensemble</h2></div>
          <div className="section-body">
            <p style={{color:'#475569',marginBottom:20}}>Le superviseur est positionné <strong>au-dessus des surveillants</strong> : votre rôle est de vérifier que les surveillants qui vous sont rattachés travaillent réellement pendant les examens — pas de surveiller les étudiants directement, ni de regarder leurs caméras.</p>
            <div className="feature-grid">
              <div className="feature-item"><i className="fas fa-layer-group" /><h5>Groupes de surveillants</h5><p>Un administrateur vous rattache à un ou plusieurs <strong>Groupes Surveillants</strong> — vous supervisez tous les membres de ces groupes.</p></div>
              <div className="feature-item"><i className="fas fa-eye-slash" /><h5>Pas d&apos;accès aux caméras étudiants</h5><p>Contrairement au surveillant ou à l&apos;enseignant, vous n&apos;avez pas accès à la salle de surveillance avec les flux vidéo des étudiants — ce n&apos;est pas votre rôle.</p></div>
              <div className="feature-item"><i className="fas fa-phone-volume" /><h5>Relais en cas d&apos;absence de surveillant</h5><p>Si un étudiant se déconnecte et qu&apos;aucun surveillant ne lui est assigné, c&apos;est vous qui recevez sa demande d&apos;appel — voir section 4.</p></div>
            </div>
          </div>
        </div>

        <div className="section" id="dashboard">
          <div className="section-header"><div className="section-icon"><i className="fas fa-tachometer-alt" /></div><h2>2. Votre tableau de bord</h2></div>
          <div className="section-body">
            <p style={{color:'#475569',marginBottom:16}}>Votre page d&apos;accueil affiche, pour chaque groupe que vous supervisez, la liste de ses surveillants avec leur statut en temps réel.</p>
            <div className="status-row" style={{background:'#ecfdf5',border:'1px solid #a7f3d0'}}><div className="status-dot" style={{background:'#10b981'}} /><p><strong>Actif et engagé :</strong> le surveillant travaille réellement — il interagit avec l&apos;interface (et, selon le niveau de vigilance, consulte des étudiants / est confirmé présent devant sa caméra).</p></div>
            <div className="status-row" style={{background:'#fffbeb',border:'1px solid #fcd34d'}}><div className="status-dot" style={{background:'#f59e0b'}} /><p><strong>Présent, inactif :</strong> l&apos;onglet du surveillant est ouvert, mais il ne remplit pas les critères d&apos;engagement exigés par le niveau de vigilance du groupe — à surveiller.</p></div>
            <div className="status-row" style={{background:'#f1f5f9',border:'1px solid #e2e8f0'}}><div className="status-dot" style={{background:'#94a3b8'}} /><p><strong>Déconnecté :</strong> le surveillant n&apos;a plus de connexion active avec la plateforme.</p></div>
            <div className="tip"><i className="fas fa-lightbulb" /> Le tableau de bord se rafraîchit automatiquement toutes les 30 secondes — inutile de recharger la page.</div>
          </div>
        </div>

        <div className="section" id="vigilance">
          <div className="section-header"><div className="section-icon"><i className="fas fa-shield-halved" /></div><h2>3. Comprendre les niveaux de vigilance (A/B/C)</h2></div>
          <div className="section-body">
            <p style={{color:'#475569',marginBottom:20}}>Chaque groupe de surveillants a un <strong>niveau de vigilance</strong>, réglé par l&apos;enseignant ou l&apos;administrateur responsable du groupe. Ce niveau détermine ce qu&apos;un surveillant doit faire pour être compté comme &quot;actif et engagé&quot; plutôt que juste &quot;présent&quot;.</p>
            <div className="steps">
              <div className="step"><div className="step-num">A</div><div className="step-content"><h4>Niveau A — Interaction</h4><p>Le surveillant doit interagir réellement (souris, clavier) sur un onglet visible et au premier plan. Un onglet simplement laissé ouvert sans activité ne compte pas comme engagé.</p></div></div>
              <div className="step"><div className="step-num">B</div><div className="step-content"><h4>Niveau B — Interaction + suivi réel</h4><p>En plus du niveau A, le surveillant doit avoir consulté quelque chose de précis sur un étudiant (message, avertissement, écran partagé, logs…) récemment — pas seulement bougé la souris dans le vide.</p></div></div>
              <div className="step"><div className="step-num">C</div><div className="step-content"><h4>Niveau C — + Présence caméra</h4><p>En plus du niveau B, une vérification périodique confirme qu&apos;un visage est bien présent devant la caméra du surveillant. <strong>Aucune image n&apos;est jamais transmise ni stockée</strong> — seul un résultat oui/non est envoyé. Le surveillant est informé quand cette vérification est active (bandeau visible sur son interface).</p></div></div>
            </div>
            <div className="info"><i className="fas fa-info-circle" /> Vous ne pouvez pas modifier le niveau de vigilance d&apos;un groupe — ce réglage appartient à l&apos;enseignant ou à l&apos;administrateur qui gère le groupe. Votre rôle est de constater le résultat.</div>
          </div>
        </div>

        <div className="section" id="appels">
          <div className="section-header"><div className="section-icon"><i className="fas fa-phone-volume" /></div><h2>4. Répondre à une demande d&apos;appel étudiant</h2></div>
          <div className="section-body">
            <p style={{color:'#475569',marginBottom:20}}>Un étudiant qui a été déconnecté de son examen doit obtenir un <strong>code de reprise à usage unique</strong> pour continuer — ce code s&apos;obtient uniquement après un appel vocal/vidéo permettant de vérifier son identité. Vous ne recevez ces demandes que si <strong>aucun surveillant n&apos;est assigné</strong> à cet étudiant.</p>
            <div className="steps">
              <div className="step"><div className="step-num">1</div><div className="step-content"><h4>Repérer la demande</h4><p>Un panneau <strong>&quot;Demande(s) d&apos;appel&quot;</strong> apparaît sur votre tableau de bord dès qu&apos;un étudiant sans surveillant assigné en fait la demande depuis son propre tableau de bord.</p></div></div>
              <div className="step"><div className="step-num">2</div><div className="step-content"><h4>Répondre à l&apos;appel</h4><p>Cliquez sur <strong>&quot;Répondre à l&apos;appel&quot;</strong>. Une fenêtre d&apos;appel audio/vidéo s&apos;ouvre avec l&apos;étudiant — vérifiez son identité comme vous le feriez pour toute vérification en personne.</p></div></div>
              <div className="step"><div className="step-num">3</div><div className="step-content"><h4>Générer le code</h4><p>Une fois l&apos;identité vérifiée, cliquez sur <strong>&quot;Générer un code de reprise&quot;</strong>. Un code à 6 chiffres s&apos;affiche, valable <strong>10 minutes</strong> et à usage unique. Communiquez-le oralement à l&apos;étudiant pendant l&apos;appel.</p><div className="tip"><i className="fas fa-lightbulb" /> Si le code expire ou a déjà été utilisé, générez-en simplement un nouveau — l&apos;ancien est automatiquement invalidé.</div></div></div>
            </div>
          </div>
        </div>

        <div className="section" id="limites">
          <div className="section-header"><div className="section-icon"><i className="fas fa-circle-info" /></div><h2>5. Ce que vous ne gérez pas</h2></div>
          <div className="section-body">
            <p style={{color:'#475569'}}>Pour rester cohérent avec votre rôle de supervision d&apos;équipe (et non de surveillance directe des étudiants), certaines actions restent réservées aux surveillants, enseignants ou administrateurs :</p>
            <ul style={{marginTop:12,paddingLeft:20,color:'#475569',fontSize:17,lineHeight:1.8}}>
              <li>Vous ne voyez pas les flux caméra des étudiants pendant l&apos;examen.</li>
              <li>Vous ne pouvez pas bannir un étudiant ni lui envoyer d&apos;avertissement.</li>
              <li>Vous ne pouvez générer un code de reprise que si <strong>aucun surveillant</strong> n&apos;est assigné à l&apos;étudiant concerné — sinon, c&apos;est au surveillant assigné de le faire.</li>
              <li>Le rattachement d&apos;un superviseur à un groupe est décidé par l&apos;administrateur, pas par vous-même.</li>
            </ul>
          </div>
        </div>

      </div>

      <footer className="doc-footer">
        <p>Centre d&apos;Examen Intelligent — <a href="/">Retour à l&apos;accueil</a> · <a href="/guide-enseignant">Guide Enseignant</a> · <a href="/guide-surveillant">Guide Surveillant</a> · <a href="/guide-etudiant">Guide Étudiant</a> · <a href="/conditions">Conditions d&apos;Utilisation</a></p>
        <p style={{marginTop:16,fontSize:14.5,opacity:.8,fontWeight:600}}>Contact</p>
        <p style={{marginTop:6,fontSize:14.5,opacity:.6}}><i className="fas fa-map-marker-alt" /> Cité du Savoir – Diamniadio, Castors, avenue Bourguiba, rue n°13<br /><i className="fas fa-phone" /> +221 30 108 41 53<br /><i className="fas fa-envelope" /> visioplus@unchk.edu.sn</p>
        <p style={{marginTop:12,opacity:.6}}>© 2026 CEI — Université Cheikh Hamidou Kane (UNCHK)</p>
      </footer>
    </>
  )
}
