import type { ReactNode } from 'react'

export type TocItem = { id: string; icon: string; label: string }

/** Habillage commun des guides étudiants : barre du haut, bandeau, sommaire, pied de page. */
export default function GuideShell({ badge, title, subtitle, toc, children }: { badge: string; title: string; subtitle: string; toc: TocItem[]; children: ReactNode }) {
  return (
    <>
      <style>{`
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; background:#f8fafc; color:#1e293b; line-height:1.7; }
        .topbar { background:#059669; color:white; padding:14px 32px; display:flex; align-items:center; justify-content:space-between; position:sticky; top:var(--pwa-banner-height,0px); z-index:100; box-shadow:0 2px 12px rgba(0,0,0,.2); }
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
        :root { --primary:#059669; --primary-dark:#047857; --surface:#ffffff; --border:#e2e8f0; --text:#1e293b; --text-muted:#64748b; }
        body.pwa-banner-visible { padding-top:var(--pwa-banner-height,0px); }
        .choice-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(280px,1fr)); gap:18px; margin-bottom:36px; }
        .choice-card { display:block; background:white; border:2px solid #e2e8f0; border-radius:14px; padding:24px; text-decoration:none; color:#1e293b; }
        .choice-card:hover { box-shadow:0 6px 20px rgba(0,0,0,.08); }
        .choice-card.app { border-color:#93c5fd; }
        .choice-card.web { border-color:#6ee7b7; }
        .choice-card .ico { width:46px; height:46px; border-radius:12px; display:flex; align-items:center; justify-content:center; color:white; font-size:21px; margin-bottom:14px; }
        .choice-card.app .ico { background:#1d4ed8; }
        .choice-card.web .ico { background:#059669; }
        .choice-card h3 { font-size:1.1rem; font-weight:800; margin-bottom:6px; }
        .choice-card p { font-size:14px; color:#475569; }
        .choice-card .go { display:inline-flex; align-items:center; gap:6px; margin-top:12px; font-weight:700; font-size:14px; }
        .choice-card.app .go { color:#1d4ed8; }
        .choice-card.web .go { color:#059669; }
        .table-wrap { overflow-x:auto; }
        .compare { width:100%; border-collapse:collapse; font-size:14px; background:white; }
        .compare th, .compare td { border:1px solid #e2e8f0; padding:10px 12px; text-align:left; vertical-align:top; }
        .compare thead th { background:#f1f5f9; font-weight:700; }
        .compare tbody th { background:#f8fafc; font-weight:600; width:26%; }
        .split { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-top:6px; }
        .split .col { border-radius:12px; padding:16px 18px; border:1px solid; }
        .split .col h4 { font-size:15px; font-weight:800; margin-bottom:8px; }
        .split .col ul { padding-left:18px; display:grid; gap:7px; font-size:14px; line-height:1.6; }
        .split .col.no { background:#fff1f2; border-color:#fecdd3; color:#7f1d1d; }
        .split .col.no h4 { color:#b91c1c; }
        .split .col.yes { background:#ecfdf5; border-color:#a7f3d0; color:#064e3b; }
        .split .col.yes h4 { color:#047857; }
        .switch { background:#eff6ff; border:1px solid #bfdbfe; border-radius:10px; padding:12px 16px; margin-bottom:28px; font-size:14px; color:#1e3a8a; }
        .switch a { color:#1d4ed8; font-weight:700; }
        @media(max-width:700px) { .split { grid-template-columns:1fr; } }
      `}</style>

      <div className="topbar">
        <div className="topbar-brand"><i className="fas fa-graduation-cap" /> Centre d&apos;Examen Intelligent</div>
        <a href="/" className="btn-back"><i className="fas fa-arrow-left" /> Retour à l&apos;accueil</a>
      </div>

      <div className="hero-doc">
        <div className="hero-badge"><i className="fas fa-user-graduate" /> {badge}</div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>

      <div className="content-wrap">
        <div className="toc">
          <h3><i className="fas fa-list" /> &nbsp;Sommaire</h3>
          <ul className="toc-list">
            {toc.map(t => <li key={t.id}><a href={'#' + t.id}><i className={'fas ' + t.icon} /> {t.label}</a></li>)}
          </ul>
        </div>

        {children}
      </div>

      <footer className="doc-footer">
        <p>Centre d&apos;Examen Intelligent — <a href="/">Retour à l&apos;accueil</a> · <a href="/guide-enseignant">Guide Enseignant</a> · <a href="/guide-surveillant">Guide Surveillant</a> · <a href="/conditions">Conditions d&apos;Utilisation</a></p>
        <p style={{marginTop:16,fontSize:14.5,opacity:.8,fontWeight:600}}>Contact</p>
        <p style={{marginTop:6,fontSize:14.5,opacity:.6}}><i className="fas fa-map-marker-alt" /> Cité du Savoir – Diamniadio, Castors, avenue Bourguiba, rue n°13<br /><i className="fas fa-phone" /> +221 30 108 41 53<br /><i className="fas fa-envelope" /> visioplus@unchk.edu.sn</p>
        <p style={{marginTop:12,opacity:.6}}>© 2026 CEI — Université Cheikh Hamidou Kane (UNCHK)</p>
      </footer>
    </>
  )
}
