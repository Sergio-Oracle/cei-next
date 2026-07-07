'use client'

import './landing.css'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { animate } from 'animejs/animation'
import { createTimeline } from 'animejs/timeline'
import { stagger } from 'animejs/utils'

/* ── i18n ───────────────────────────────────────────────────────────── */
const LD: Record<string, Record<string, string>> = {
  fr: {
    hero_title: "Centre d'Examen Intelligent",
    hero_sub: "La plateforme sénégalaise d'examens en ligne — surveillance vidéo en temps réel, correction automatique par IA, relevés officiels et détection de fraude avancée",
    cta_start: "Commencer Maintenant",
    cta_how: "Comment ça marche ?",
    guide_teacher: "Guide Enseignant",
    guide_student: "Guide Étudiant",
  },
  en: {
    hero_title: "Intelligent Examination Centre",
    hero_sub: "The Senegalese online exam platform — real-time video proctoring, AI automatic grading, official transcripts and advanced fraud detection",
    cta_start: "Get Started",
    cta_how: "How does it work?",
    guide_teacher: "Teacher Guide",
    guide_student: "Student Guide",
  },
  wo: {
    hero_title: "Xëtu Jëfandikoo yu Xam-Xam",
    hero_sub: "Plateforme bu Senegaal bu jëfandikoo online — xarekat video ci wakhtuwaan, soppi automatik ak IA",
    cta_start: "Tambali Léegi",
    cta_how: "Ana nit nii?",
    guide_teacher: "Cëep Jàngalekat",
    guide_student: "Cëep Jángkat",
  },
}

/* ── Count-up (anime.js) ───────────────────────────────────────────── */
function animateCount(el: HTMLElement, target: number, duration: number) {
  const counter = { val: 0 }
  animate(counter, {
    val: target,
    duration,
    ease: 'outExpo',
    onUpdate: () => { el.textContent = Math.floor(counter.val).toLocaleString('fr-FR') },
    onComplete: () => { el.textContent = target.toLocaleString('fr-FR') },
  })
}

/* ── Component ─────────────────────────────────────────────────────── */
export default function LandingPage() {
  const [lang, setLang] = useState<'fr' | 'en' | 'wo'>('fr')
  const [menuOpen, setMenuOpen] = useState(false)
  const t = LD[lang]
  const heroRef = useRef<HTMLElement>(null)

  /* Animation d'entrée du hero (anime.js) — respecte prefers-reduced-motion */
  useEffect(() => {
    const root = heroRef.current
    if (!root) return

    const icon     = root.querySelector('.hero-icon')
    const title    = root.querySelector('h1')
    const subtitle = root.querySelector('p')
    const buttons  = root.querySelectorAll('.cta-buttons > *')

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const tl = createTimeline({ defaults: { ease: 'outExpo' } })
    if (icon)            tl.add(icon,     { opacity: [0, 1], scale: [0.6, 1], duration: 700 })
    if (title)           tl.add(title,    { opacity: [0, 1], translateY: [24, 0], duration: 700 }, '-=450')
    if (subtitle)        tl.add(subtitle, { opacity: [0, 1], translateY: [18, 0], duration: 600 }, '-=450')
    if (buttons.length)  tl.add(buttons,  { opacity: [0, 1], translateY: [14, 0], duration: 500, delay: stagger(90) }, '-=350')

    return () => { tl.revert() }
  }, [])

  /* Restore lang from localStorage + sync cookie + déclencher GT si besoin */
  useEffect(() => {
    const s = localStorage.getItem('lang') as 'fr' | 'en' | 'wo' | null
    if (s && ['fr', 'en', 'wo'].includes(s)) {
      setLang(s)
      if (s !== 'fr') {
        const val = `/fr/${s}`
        document.cookie = `googtrans=${val};path=/;expires=Fri, 31 Dec 9999 23:59:59 GMT`
        const host = window.location.hostname
        if (host && host.includes('.')) {
          document.cookie = `googtrans=${val};path=/;domain=.${host};expires=Fri, 31 Dec 9999 23:59:59 GMT`
        }
        const tryCombo = (attempts: number) => {
          const combo = document.querySelector('select.goog-te-combo') as HTMLSelectElement | null
          if (combo) { combo.value = s; combo.dispatchEvent(new Event('change', { bubbles: true })) }
          else if (attempts > 0) setTimeout(() => tryCombo(attempts - 1), 300)
        }
        setTimeout(() => tryCombo(10), 600)
      }
    }
  }, [])

  /* Animations scroll (anime.js) + count-up */
  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const disconnectFns: Array<() => void> = []

    /* Groupe : tous les enfants d'un conteneur apparaissent en cascade ensemble */
    function revealGroup(container: Element | null, staggerMs = 90, extra?: (items: Element[]) => void) {
      if (!container || reduceMotion) return
      const items = Array.from(container.children)
      if (!items.length) return
      const io = new IntersectionObserver((entries) => {
        if (!entries[0].isIntersecting) return
        io.disconnect()
        animate(items, {
          opacity: [0, 1],
          translateY: [28, 0],
          duration: 650,
          ease: 'outExpo',
          delay: stagger(staggerMs),
        })
        extra?.(items)
      }, { threshold: 0.12 })
      io.observe(container)
      disconnectFns.push(() => io.disconnect())
    }

    /* Élément isolé (pas dans un groupe en grille) */
    function revealOne(el: Element | null) {
      if (!el || reduceMotion) return
      const io = new IntersectionObserver((entries) => {
        if (!entries[0].isIntersecting) return
        io.disconnect()
        animate(el, { opacity: [0, 1], translateY: [24, 0], duration: 600, ease: 'outExpo' })
      }, { threshold: 0.12 })
      io.observe(el)
      disconnectFns.push(() => io.disconnect())
    }

    revealGroup(document.getElementById('mission-grid-1'))
    revealGroup(document.getElementById('mission-grid-2'))
    revealGroup(document.querySelector('.features-grid'), 60)
    revealGroup(document.querySelector('.security-grid'), 70)
    revealGroup(document.querySelector('.exams-features'), 80)
    revealGroup(document.getElementById('testimonials-grid'), 100)
    revealGroup(document.getElementById('steps-prof'), 120, () => {
      document.getElementById('steps-prof')?.classList.add('anim-done')
    })
    revealGroup(document.getElementById('steps-student'), 120, () => {
      document.getElementById('steps-student')?.classList.add('anim-done')
    })
    document.querySelectorAll('.process-label[data-reveal]').forEach(el => revealOne(el))

    /* ── Stats : reveal + count-up déclenchés ensemble ── */
    const STATS: Record<string, number> = {
      'stat-students': 1480, 'stat-exams': 320,
      'stat-attempts': 4750, 'stat-corrections': 3920,
    }
    const statsGrid = document.querySelector('.stats-grid')
    if (statsGrid) {
      const items = Array.from(statsGrid.children)
      const statsIo = new IntersectionObserver((entries) => {
        if (!entries[0].isIntersecting) return
        statsIo.disconnect()
        if (!reduceMotion) {
          animate(items, { opacity: [0, 1], translateY: [28, 0], duration: 650, ease: 'outExpo', delay: stagger(90) })
        }
        Object.entries(STATS).forEach(([id, val]) => {
          const el = document.getElementById(id)
          if (el) animateCount(el, val, 1600)
        })
      }, { threshold: 0.3 })
      statsIo.observe(statsGrid)
      disconnectFns.push(() => statsIo.disconnect())
    }

    /* ── Close lang menu on outside click ── */
    const closeMenu = (e: MouseEvent) => {
      const sw = document.getElementById('lang-sw')
      if (sw && !sw.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('click', closeMenu)

    return () => {
      disconnectFns.forEach(fn => fn())
      document.removeEventListener('click', closeMenu)
    }
  }, [])

  function goTo(id: string) {
    const el = document.getElementById(id)
    if (!el) return
    /* Forcer l'état visible avant de calculer la position, au cas où le
       reveal au scroll de son groupe ne se serait pas encore déclenché */
    ;(el as HTMLElement).style.opacity = '1'
    ;(el as HTMLElement).style.transform = 'none'
    requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      /* Flash de mise en évidence pour indiquer la carte exacte */
      el.classList.add('card-highlight')
      setTimeout(() => el.classList.remove('card-highlight'), 1400)
    })
  }

  function changeLang(code: 'fr' | 'en' | 'wo') {
    localStorage.setItem('lang', code)
    setLang(code)
    setMenuOpen(false)

    const host = window.location.hostname
    const pastExp = 'expires=Thu, 01 Jan 1970 00:00:00 GMT'
    const futExp  = 'expires=Fri, 31 Dec 9999 23:59:59 GMT'

    if (code === 'fr') {
      /* Retour au français : supprimer le cookie → Google Translate revient à l'original */
      document.cookie = `googtrans=;path=/;${pastExp}`
      if (host && host.includes('.')) {
        document.cookie = `googtrans=;path=/;domain=.${host};${pastExp}`
      }
      window.location.reload()
      return
    }

    /* Autre langue : poser le cookie et déclencher GT */
    const val = `/fr/${code}`
    document.cookie = `googtrans=${val};path=/;${futExp}`
    if (host && host.includes('.')) {
      document.cookie = `googtrans=${val};path=/;domain=.${host};${futExp}`
    }

    const tryCombo = (attempts: number) => {
      const combo = document.querySelector('select.goog-te-combo') as HTMLSelectElement | null
      if (combo) {
        combo.value = code
        combo.dispatchEvent(new Event('change', { bubbles: true }))
      } else if (attempts > 0) {
        setTimeout(() => tryCombo(attempts - 1), 250)
      } else {
        window.location.reload()
      }
    }
    tryCombo(8)
  }

  /* ── Render ─────────────────────────────────────────────────────── */
  return (
    <>
      {/* Sélecteur de langue */}
      <div className="landing-lang-switcher" id="lang-sw">
        <button className="landing-lang-btn" onClick={e => { e.stopPropagation(); setMenuOpen(v => !v) }}>
          <i className="fas fa-globe" />
          <span>{lang === 'fr' ? '🇫🇷 FR' : lang === 'en' ? '🇬🇧 EN' : '🇸🇳 WO'}</span>
          <i className="fas fa-chevron-down" style={{ fontSize: 10 }} />
        </button>
        {menuOpen && (
          <div className="landing-lang-menu">
            <button className={`landing-lang-option${lang === 'fr' ? ' active' : ''}`} onClick={e => { e.stopPropagation(); changeLang('fr') }}><span style={{ fontSize: 18 }}>🇫🇷</span> Français</button>
            <button className={`landing-lang-option${lang === 'en' ? ' active' : ''}`} onClick={e => { e.stopPropagation(); changeLang('en') }}><span style={{ fontSize: 18 }}>🇬🇧</span> English</button>
            <button className={`landing-lang-option${lang === 'wo' ? ' active' : ''}`} onClick={e => { e.stopPropagation(); changeLang('wo') }}><span style={{ fontSize: 18 }}>🇸🇳</span> Wolof</button>
          </div>
        )}
      </div>

      {/* ── Hero ── */}
      <section className="hero" ref={heroRef}>
        <div className="hero-content">
          <div className="hero-icon">
            <i className="fas fa-graduation-cap" />
          </div>
          <h1>{t.hero_title}</h1>
          <p>{t.hero_sub}</p>
          <div className="cta-buttons">
            <Link href="/login" className="btn btn-primary">
              <i className="fas fa-rocket" />{t.cta_start}
            </Link>
            <a href="#comment-ca-marche" className="btn btn-secondary">
              <i className="fas fa-play-circle" />{t.cta_how}
            </a>
          </div>
        </div>
      </section>

      {/* ── Mission ── */}
      <section id="mission" style={{ background: 'white', padding: '80px 0' }}>
        <div className="container">
          <div style={{ textAlign: 'center', maxWidth: 760, margin: '0 auto 64px' }}>
            <span style={{ display: 'inline-block', background: '#eff6ff', color: 'var(--primary-dark)', fontSize: 12, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', padding: '5px 16px', borderRadius: 99, marginBottom: 16 }}>Notre mission</span>
            <h2 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--gray-900)', marginBottom: 16, lineHeight: 1.25 }}>Pourquoi le Centre d&apos;Examen Intelligent ?</h2>
            <p style={{ color: 'var(--gray-500)', fontSize: '1.05rem', lineHeight: 1.7 }}>Au Sénégal, les enseignants font face à des promotions surchargées, des délais de correction serrés et des fraudes difficiles à contrôler — surtout en présentiel. Le CEI est né pour répondre à ces défis concrets avec une solution entièrement numérique, accessible depuis n&apos;importe quel navigateur.</p>
          </div>

          <div id="mission-grid-1" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 28, marginBottom: 72 }}>
            <div style={{ border: '1px solid var(--gray-200)', borderRadius: 16, padding: 32, background: 'var(--gray-50)' }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary-dark)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
              </div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--gray-900)', marginBottom: 10 }}>Objectif</h3>
              <p style={{ color: 'var(--gray-500)', fontSize: '.93rem', lineHeight: 1.7 }}>Numériser l&apos;intégralité du cycle d&apos;examen — de la création du sujet à la publication des relevés de notes — en éliminant les tâches manuelles répétitives et en garantissant l&apos;intégrité académique à chaque étape.</p>
            </div>
            <div style={{ border: '1px solid var(--gray-200)', borderRadius: 16, padding: 32, background: 'var(--gray-50)' }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--success-dark)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
              </div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--gray-900)', marginBottom: 10 }}>Public visé</h3>
              <p style={{ color: 'var(--gray-500)', fontSize: '.93rem', lineHeight: 1.7 }}>Universités, grandes écoles, centres de formation professionnelle et instituts techniques au Sénégal et en Afrique de l&apos;Ouest. La plateforme s&apos;adresse aux établissements publics comme privés souhaitant moderniser leur système d&apos;évaluation.</p>
            </div>
            <div style={{ border: '1px solid var(--gray-200)', borderRadius: 16, padding: 32, background: 'var(--gray-50)' }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              </div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--gray-900)', marginBottom: 10 }}>Pourquoi c&apos;est crucial au Sénégal</h3>
              <p style={{ color: 'var(--gray-500)', fontSize: '.93rem', lineHeight: 1.7 }}>Avec des classes pouvant dépasser 200 étudiants, un enseignant passe des semaines à corriger manuellement. Le CEI réduit ce délai à quelques heures grâce à l&apos;IA, tout en rendant la surveillance possible à distance — un enjeu majeur pour les filières en ligne comme l&apos;EC2LT ou l&apos;UVS.</p>
            </div>
          </div>

          <div id="mission-grid-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 20 }}>
            {[
              { bg: '#eff6ff', stroke: '#2563eb', path: <polyline points="20 6 9 17 4 12"/>, title: 'Gain de temps > 90 %', desc: "La correction IA génère un feedback détaillé par copie en quelques secondes, avec note calculée automatiquement selon le barème défini." },
              { bg: '#ecfdf5', stroke: '#059669', path: <><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></>, title: 'Anti-triche avancé', desc: "Surveillance caméra + écran + détection faciale + reconnaissance d'identité en temps réel. Chaque incident est logué et horodaté avec preuve." },
              { bg: '#fef3c7', stroke: '#d97706', path: <><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></>, title: 'Relevés officiels PDF', desc: "Génération automatique des relevés semestriels avec calcul de la moyenne pondérée, crédits, GPA — conformes aux exigences académiques." },
              { bg: '#f0fdf4', stroke: '#16a34a', path: <><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></>, title: '100 % navigateur', desc: "Aucune installation requise. La plateforme fonctionne sur tout navigateur moderne — adapté aux contextes où les équipements sont limités." },
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'flex-start', padding: 20, borderRadius: 12, border: '1px solid var(--gray-200)', background: 'white' }}>
                <div style={{ width: 36, height: 36, minWidth: 36, borderRadius: 8, background: item.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={item.stroke} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">{item.path}</svg>
                </div>
                <div>
                  <div style={{ fontSize: '.88rem', fontWeight: 700, color: 'var(--gray-900)', marginBottom: 4 }}>{item.title}</div>
                  <div style={{ fontSize: '.82rem', color: 'var(--gray-500)', lineHeight: 1.5 }}>{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="features" id="features">
        <div className="container">
          <h2>Fonctionnalités Complètes</h2>
          <p className="section-subtitle">Une solution tout-en-un pour moderniser l&apos;évaluation académique</p>
          <div className="features-grid">
            {[
              { icon: 'fa-laptop-code', id: 'feature-exams', title: 'Examens en Ligne Surveillés', desc: "Créez des examens sécurisés avec questions libres, timer configurable et extension de temps à la volée. Sauvegarde automatique des réponses à chaque frappe.", items: ['Timer en temps réel + extension prof', 'Sauvegarde automatique des réponses', 'Mode plein écran forcé', 'Bannissement automatique sur fraude'] },
              { icon: 'fa-robot', id: 'feature-ai', title: 'Correction IA Avancée', desc: "Moteur IA configurable par examen, déclenché automatiquement à la soumission et révisable par le professeur à tout moment.", items: ['Activable examen par examen', 'Correction dès la soumission (arrière-plan)', 'Feedback détaillé par réponse', 'Révision et ajustement par le prof'] },
              { icon: 'fa-shield-alt', id: 'feature-anticheat', title: 'Surveillance Anti-Triche Active', desc: "Surveillance multi-couches pendant toute la durée de l'examen. Chaque événement est horodaté et archivé pour consultation ultérieure.", items: ['Détection faciale par caméra (IA)', 'Détection changement de fenêtre / onglet', 'Snapshots caméra horodatés', 'Score de risque calculé en temps réel'] },
              { icon: 'fa-award', id: 'feature-transcripts', title: 'Relevés de Notes Officiels', desc: "Génération automatique de relevés semestriels au format PDF. Gestion des droits de suppression par rôle (admin / professeur générateur).", items: ['Calcul automatique du GPA', 'Validation semestrielle des crédits', 'Export PDF professionnel', 'Gestion avec droits admin / prof'] },
              { icon: 'fa-pen-nib', title: 'Signature Électronique', desc: "À la soumission de chaque examen, l'étudiant signe sur un canvas interactif (souris ou tactile), valisant son engagement de non-fraude.", items: ['Canvas signature souris & tactile', 'Engagement de non-fraude affiché', 'Signature archivée avec la copie', 'Obligatoire avant envoi définitif'] },
              { icon: 'fa-sitemap', title: 'Maquette Pédagogique Complète', desc: "Hiérarchie académique intégrale : Formations → Semestres → UEs → ECs. Affectation des professeurs aux UEs et inscription des étudiants par formation.", items: ['Gestion Formations & Semestres', 'Gestion UEs & ECs (coefficients)', 'Affectation professeurs aux UEs', 'Inscription & gestion étudiants'] },
              { icon: 'fa-chart-pie', title: 'Statistiques & Analyses', desc: "Tableaux de bord avec moyennes, médianes, taux de réussite et distributions. Export Excel pour traitements externes.", items: ['Moyennes, médianes, taux réussite', 'Distributions de notes par examen', 'Graphiques interactifs', 'Export Excel des résultats'] },
              { icon: 'fa-users-gear', title: 'Gestion Multi-Rôles', desc: "Quatre profils utilisateur avec interfaces et permissions distincts. Chaque rôle accède uniquement aux fonctions qui lui sont dédiées.", items: ['Admin : gestion globale & sécurité', 'Professeur : examens, correction, relevés', 'Surveillant : supervision groupe assigné', 'Étudiant : tableau de bord unifié'] },
              { icon: 'fa-comment-dots', title: 'Système de Réclamations IA', desc: "Contestation de notes en ligne avec analyse IA des arguments. L'étudiant suit l'état de sa réclamation en temps réel jusqu'à la décision finale.", items: ['Soumission en ligne (copies & examens)', 'Analyse IA des arguments étudiant', 'Workflow approbation / rejet / ajustement', 'Suivi de statut en temps réel'] },
              { icon: 'fa-bell', id: 'feature-notifications', title: 'Notifications In-App & Email', desc: "Cloche de notification intégrée au tableau de bord avec badge de non-lus. Emails automatiques pour tous les événements critiques.", items: ['Cloche in-app avec badge non-lus', 'Email : correction publiée', 'Email : incident anti-triche', 'Email : réclamation traitée'] },
              { icon: 'fa-shield-virus', title: 'Rapport de Sécurité', desc: "Tableau de bord dédié à la sécurité des examens pour l'admin et les professeurs. Visualisation complète des tentatives suspectes et des bannissements.", items: ['Synthèse des événements par type', 'Étudiants à haut risque identifiés', 'Compteur et liste des bannissements', 'Accessible admin & professeur'] },
              { icon: 'fa-circle-question', title: "Centre d'Aide Étudiant", desc: "FAQ intégrée au tableau de bord étudiant répondant aux questions courantes sur la surveillance, les avertissements et la procédure d'examen.", items: ['FAQ accordéon interactive', 'Explication des avertissements caméra', 'Procédure de réclamation expliquée', 'Guides accessibles avant & après examen'] },
            ].map((f, i) => (
              <div key={i} className="feature-card" id={(f as {id?:string}).id}>
                <div className="feature-icon"><i className={`fas ${f.icon}`} /></div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
                <ul className="feature-list">
                  {f.items.map((item, j) => <li key={j}><i className="fas fa-check" />{item}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="stats">
        <div className="stats-grid">
          <div className="stat-item">
            <div className="stat-value">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
              <span className="stat-num" id="stat-students">1 480</span>
            </div>
            <div className="stat-label">Étudiants actifs</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              <span className="stat-num" id="stat-exams">320</span>
            </div>
            <div className="stat-label">Examens créés</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
              <span className="stat-num" id="stat-attempts">4 750</span>
            </div>
            <div className="stat-label">Compositions passées</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a2 2 0 012 2v1h4a1 1 0 011 1v10a1 1 0 01-1 1H6a1 1 0 01-1-1V6a1 1 0 011-1h4V4a2 2 0 012-2z"/><path d="M9 14l2 2 4-4"/></svg>
              <span className="stat-num" id="stat-corrections">3 920</span>
            </div>
            <div className="stat-label">Copies corrigées par l&apos;IA</div>
          </div>
        </div>
      </section>

      {/* ── Sécurité ── */}
      <section className="security" id="security">
        <div className="container">
          <h2>Sécurité &amp; Surveillance Maximales</h2>
          <p className="section-subtitle">Protection complète contre la triche avec détection intelligente</p>
          <div className="security-grid">
            {[
              { icon: 'fa-window-restore', title: 'Détection Changement Fenêtre', desc: 'Avertissement immédiat et bannissement automatique après dépassement du seuil configuré' },
              { icon: 'fa-ban', title: 'Blocage Copier/Coller', desc: 'Désactivation complète du presse-papier pour empêcher toute forme de fraude' },
              { icon: 'fa-code', title: 'Protection Console Dev', desc: 'Blocage F12 et des outils développeur pour sécuriser l\'environnement d\'examen' },
              { icon: 'fa-expand', title: 'Mode Plein Écran Forcé', desc: 'Activation automatique et obligatoire pour éviter les distractions externes' },
              { icon: 'fa-clock', title: 'Soumission Auto Temps', desc: "Envoi automatique à l'expiration du temps pour garantir l'équité" },
              { icon: 'fa-history', title: 'Logs Complets', desc: 'Traçabilité de toutes les actions suspectes avec horodatage précis' },
              { icon: 'fa-exclamation-triangle', title: 'Gestion des Incidents', desc: 'Système complet de détection, enregistrement et gestion des incidents de triche' },
              { icon: 'fa-envelope', title: 'Notifications Email', desc: 'Alertes automatiques par email pour tous les incidents de sécurité' },
            ].map((s, i) => (
              <div key={i} className="security-card">
                <i className={`fas ${s.icon}`} />
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Comment ça marche (examen en ligne) ── */}
      <section id="comment-ca-marche" className="online-exams">
        <div className="container">
          <h2>Ce qui se passe pendant un examen en ligne</h2>
          <p className="section-subtitle">Chaque session est surveillée en temps réel — caméra, écran partagé, comportement — de la connexion à la correction automatique.</p>

          <div className="exams-showcase">
            <div className="exams-features">
              {[
                { svg: <><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></>, title: 'Caméra activée automatiquement', desc: "Dès le lancement, la caméra s'active et le flux vidéo HD est transmis en direct au panneau de surveillance de l'enseignant." },
                { svg: <><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></>, title: "Partage d'écran entier obligatoire", desc: "L'écran complet est partagé automatiquement. L'enseignant peut l'ouvrir en plein format à tout moment depuis le dashboard." },
                { svg: <><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></>, title: 'Détection faciale en continu', desc: "L'IA analyse le flux caméra : absence du visage, plusieurs personnes détectées, regard hors écran — chaque anomalie est loguée." },
                { svg: <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>, title: 'Score de risque en temps réel', desc: "Chaque incident (changement de fenêtre, visage absent, outils dev) incrémente le score de risque visible chez l'enseignant (0–100)." },
                { svg: <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>, title: 'Timer et sauvegarde automatique', desc: "Un compte à rebours est affiché en permanence. Les réponses sont sauvegardées toutes les 30 secondes. À l'expiration, la copie est soumise automatiquement." },
                { svg: <><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></>, title: 'Messages et avertissements en direct', desc: "L'enseignant peut envoyer un avertissement ou un message directement à un étudiant — affiché immédiatement sur son écran sous forme de popup." },
              ].map((item, i) => (
                <div key={i} className="exam-feature-item">
                  <h4>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>{item.svg}</svg>
                    {item.title}
                  </h4>
                  <p>{item.desc}</p>
                </div>
              ))}
            </div>

            {/* Mock browser */}
            <div className="exams-visual">
              <div className="mock-browser">
                <div className="browser-header">
                  <div className="browser-dot dot-red" />
                  <div className="browser-dot dot-yellow" />
                  <div className="browser-dot dot-green" />
                  <span style={{ fontSize: 10, color: 'var(--gray-400)', marginLeft: 10, fontFamily: 'monospace' }}>examen-surveillé · session active</span>
                </div>
                <div style={{ display: 'flex', height: 310, overflow: 'hidden' }}>
                  {/* Panneau surveillance */}
                  <div style={{ width: 112, minWidth: 112, background: '#1e293b', padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: 9 }}>
                    <div style={{ fontSize: 8, fontWeight: 700, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '.06em' }}>Surveillance</div>
                    <div style={{ aspectRatio: '4/3', background: '#0f172a', borderRadius: 5, border: '1px solid #334155', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#334155" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                      <div style={{ position: 'absolute', bottom: 3, right: 3, width: 7, height: 7, background: '#10b981', borderRadius: '50%' }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {[['Caméra', 'On'], ['Micro', 'On'], ['Écran', 'On']].map(([label, val]) => (
                        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: '#94a3b8' }}>
                          <span>{label}</span><span style={{ color: '#10b981', fontWeight: 700 }}>{val}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ background: '#0f172a', borderRadius: 5, padding: 7 }}>
                      <div style={{ fontSize: 8, color: '#64748b', marginBottom: 4, fontWeight: 600 }}>Risque</div>
                      <div style={{ height: 4, background: '#1e293b', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ width: '9%', height: '100%', background: '#10b981', borderRadius: 2 }} />
                      </div>
                      <div style={{ fontSize: 9, color: '#10b981', textAlign: 'right', marginTop: 3, fontWeight: 700 }}>9 / 100</div>
                    </div>
                    <div style={{ fontSize: 8, color: '#64748b', textAlign: 'center', marginTop: 'auto', padding: '5px 0', borderTop: '1px solid #334155' }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', verticalAlign: 'middle' }}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                      {' '}Aucune alerte
                    </div>
                  </div>
                  {/* Panneau examen */}
                  <div style={{ flex: 1, background: '#f8fafc', padding: 12, display: 'flex', flexDirection: 'column', gap: 9, overflow: 'hidden' }}>
                    <div style={{ background: 'linear-gradient(135deg,#2563eb,#1e40af)', color: 'white', padding: '9px 13px', borderRadius: 7, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                      <span style={{ fontSize: 10, fontWeight: 700 }}>Algorithmique — Examen Final</span>
                      <span style={{ fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 3 }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        01:38:42
                      </span>
                    </div>
                    <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 7, padding: 9, flexShrink: 0 }}>
                      <div style={{ fontSize: 8, fontWeight: 700, color: '#3b82f6', marginBottom: 4 }}>Question 1 · 4 pts</div>
                      <div style={{ fontSize: 9, color: '#334155', lineHeight: 1.5 }}>Expliquez la complexité O(n log n) et citez un algorithme de tri qui l&apos;atteint en justifiant.</div>
                    </div>
                    <div style={{ flex: 1, background: 'white', border: '1px solid #e2e8f0', borderRadius: 7, padding: 9, fontSize: 9, color: '#475569', lineHeight: 1.5, overflow: 'hidden' }}>
                      Le tri fusion (Merge Sort) atteint O(n log n) car il divise le tableau en deux moitiés récursives…
                    </div>
                    <div style={{ fontSize: 8, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                      <span style={{ color: '#10b981', fontWeight: 600 }}>Surveillance active</span>
                      &nbsp;·&nbsp; Sauvegardé il y a 22 s
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Steps */}
          <div style={{ marginTop: 72 }}>
            {/* Enseignant */}
            <div className="process-label" data-reveal="1">
              <div className="process-label-icon" style={{ background: 'var(--primary-dark)' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
              </div>
              <h3 className="process-label-title">Côté Enseignant</h3>
            </div>
            <div className="steps-grid" id="steps-prof">
              {[
                { svg: <><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></>, bg: '#eff6ff', stroke: '#2563eb', color: 'var(--primary-dark)', title: "Créer l'examen", desc: "Configurez le titre, la durée, les plages horaires et rédigez le sujet — ou générez-le avec l'IA." },
                { svg: <><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></>, bg: '#eff6ff', stroke: '#2563eb', color: 'var(--primary-dark)', title: "Activer l'examen", desc: "Activez l'examen à l'heure prévue. Les étudiants inscrits voient immédiatement le bouton Composer." },
                { svg: <><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></>, bg: '#eff6ff', stroke: '#2563eb', color: 'var(--primary-dark)', title: 'Surveiller en direct', desc: "Le dashboard affiche la grille vidéo de tous les étudiants, leurs scores de risque et les alertes automatiques." },
                { svg: <><path d="M12 2a2 2 0 012 2v1h4a1 1 0 011 1v10a1 1 0 01-1 1H6a1 1 0 01-1-1V6a1 1 0 011-1h4V4a2 2 0 012-2z"/><path d="M9 17h6"/></>, bg: '#eff6ff', stroke: '#2563eb', color: 'var(--primary-dark)', title: "Corriger avec l'IA", desc: "Après soumission, l'IA corrige chaque copie selon le barème. Validez, ajustez si besoin, puis publiez les notes." },
              ].map((s, i) => (
                <div key={i} className="step-card step-card--blue">
                  <div className="step-icon-wrap" style={{ background: s.bg }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={s.stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{s.svg}</svg>
                  </div>
                  <div className="step-badge" style={{ background: s.color }}>Étape {i + 1}</div>
                  <h4 className="step-title">{s.title}</h4>
                  <p className="step-desc">{s.desc}</p>
                </div>
              ))}
            </div>

            {/* Étudiant */}
            <div className="process-label" data-reveal="1" style={{ marginTop: 56 }}>
              <div className="process-label-icon" style={{ background: 'var(--success-dark)' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
              </div>
              <h3 className="process-label-title">Côté Étudiant</h3>
            </div>
            <div className="steps-grid" id="steps-student">
              {[
                { svg: <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>, bg: '#ecfdf5', stroke: '#059669', color: 'var(--success-dark)', title: "Voir l'examen disponible", desc: "L'examen apparaît dans votre tableau de bord avec le bouton Composer ou un compte à rebours jusqu'à l'ouverture." },
                { svg: <><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></>, bg: '#ecfdf5', stroke: '#059669', color: 'var(--success-dark)', title: 'Autoriser la surveillance', desc: "Autorisez caméra, micro et partage d'écran dans votre navigateur. La plateforme active tout automatiquement au lancement." },
                { svg: <><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></>, bg: '#ecfdf5', stroke: '#059669', color: 'var(--success-dark)', title: 'Composer', desc: "Lisez le sujet et rédigez vos réponses. Sauvegarde automatique toutes les 30 s. Posez vos questions via la messagerie intégrée." },
                { svg: <><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></>, bg: '#ecfdf5', stroke: '#059669', color: 'var(--success-dark)', title: 'Soumettre & consulter', desc: "Soumettez avant l'expiration. Consultez ensuite votre note, le feedback IA par question et votre relevé de notes officiel." },
              ].map((s, i) => (
                <div key={i} className="step-card step-card--green">
                  <div className="step-icon-wrap" style={{ background: s.bg }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={s.stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{s.svg}</svg>
                  </div>
                  <div className="step-badge" style={{ background: s.color }}>Étape {i + 1}</div>
                  <h4 className="step-title">{s.title}</h4>
                  <p className="step-desc">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Témoignages ── */}
      <section id="temoignages" style={{ background: 'var(--gray-50)', padding: '80px 0' }}>
        <div className="container">
          <div style={{ textAlign: 'center', maxWidth: 640, margin: '0 auto 56px' }}>
            <span style={{ display: 'inline-block', background: '#eff6ff', color: 'var(--primary-dark)', fontSize: 12, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', padding: '5px 16px', borderRadius: 99, marginBottom: 16 }}>Ils utilisent le CEI</span>
            <h2 style={{ fontSize: '1.9rem', fontWeight: 800, color: 'var(--gray-900)', marginBottom: 14, lineHeight: 1.25 }}>Ce qu&apos;en disent les professionnels</h2>
            <p style={{ color: 'var(--gray-500)', fontSize: '.97rem', lineHeight: 1.7 }}>Enseignants, ingénieurs et responsables académiques partagent leur expérience avec la plateforme.</p>
          </div>
          <div id="testimonials-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 24 }}>
            {[
              { initial: 'S', color: 'linear-gradient(135deg,#2563eb,#1e40af)', quote: "Le CEI répond directement aux besoins des universités africaines qui se digitalisent. La surveillance en temps réel et la correction automatique permettent d'offrir une expérience d'examen à distance digne de ce nom, sans compromis sur la rigueur académique. C'est exactement ce qu'il faut pour des établissements comme l'UVS qui gèrent des milliers d'étudiants dispersés sur tout le territoire.", name: 'Professeur Samuel OUYA', role: 'Recteur — Université Virtuelle du Sénégal (UVS), Dakar' },
              { initial: 'S', color: 'linear-gradient(135deg,#0f766e,#0d9488)', quote: "En tant qu'ingénieur spécialisé en cybersécurité, ce qui m'a convaincu c'est l'architecture de surveillance : détection faciale, partage d'écran obligatoire, logs horodatés à chaque action. Le niveau de traçabilité est comparable à ce qu'on retrouve dans les certifications professionnelles. Le CEI apporte une vraie réponse technique au problème de fraude dans nos filières.", name: 'Serge BOUNGUELE', role: 'Ingénieur Télécoms Réseaux (Cybersécurité/DevOps) — RTN' },
              { initial: 'N', color: 'linear-gradient(135deg,#2563eb,#1e40af)', quote: "Enseigner à l'EC2LT c'est gérer des étudiants qui jonglent entre travail et formation. La correction IA du CEI m'a libéré un temps considérable — ce qui prenait 3 jours se fait maintenant en une heure. Les étudiants reçoivent un feedback précis question par question, ce qui améliore leur compréhension. Un outil indispensable pour l'enseignement des filières techniques à distance.", name: 'Nasry AHAMADI', role: 'Télécoms Réseaux (Cybersécurité/DevOps) — Enseignant EC2LT' },
            ].map((item, i) => (
              <div key={i} style={{ background: 'white', borderRadius: 16, padding: 32, border: '1px solid var(--gray-200)', boxShadow: '0 4px 16px rgba(0,0,0,.06)', display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div style={{ display: 'flex', gap: 4 }}>
                  {[0,1,2,3,4].map(j => <svg key={j} width="16" height="16" viewBox="0 0 24 24" fill="#f59e0b" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>)}
                </div>
                <blockquote style={{ fontSize: '.97rem', color: '#334155', lineHeight: 1.75, fontStyle: 'italic', margin: 0, flex: 1 }}>&ldquo;{item.quote}&rdquo;</blockquote>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, paddingTop: 16, borderTop: '1px solid var(--gray-100)' }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: item.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '1.1rem', fontWeight: 700, flexShrink: 0 }}>{item.initial}</div>
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--gray-900)', fontSize: '.93rem' }}>{item.name}</div>
                    <div style={{ fontSize: '.82rem', color: 'var(--gray-500)', lineHeight: 1.4 }}>{item.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="cta-section">
        <div className="container">
          <h2>Prêt à Révolutionner Vos Examens ?</h2>
          <p>Rejoignez les établissements qui ont modernisé leur système d&apos;évaluation</p>
          <Link href="/login" className="btn btn-cta">
            <i className="fas fa-rocket" />Démarrer Maintenant
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="footer">
        <div className="footer-content">
          <div className="footer-section">
            <h3><i className="fas fa-graduation-cap" /> CEI — Centre d&apos;Examen Intelligent</h3>
            <p>Plateforme sénégalaise d&apos;examens en ligne avec IA, surveillance anti-triche et relevés automatiques.</p>
            <div className="social-links">
              <a href="#" className="social-link"><i className="fab fa-github" /></a>
              <a href="#" className="social-link"><i className="fab fa-linkedin" /></a>
              <a href="#" className="social-link"><i className="fab fa-twitter" /></a>
              <a href="#" className="social-link"><i className="fas fa-envelope" /></a>
            </div>
          </div>
          <div className="footer-section">
            <h3>Fonctionnalités</h3>
            <a href="#feature-exams" onClick={e=>{e.preventDefault();goTo('feature-exams')}}>Examens en Ligne</a>
            <a href="#feature-ai" onClick={e=>{e.preventDefault();goTo('feature-ai')}}>Correction IA</a>
            <a href="#feature-transcripts" onClick={e=>{e.preventDefault();goTo('feature-transcripts')}}>Relevés de Notes</a>
            <a href="#feature-anticheat" onClick={e=>{e.preventDefault();goTo('feature-anticheat')}}>Anti-Triche</a>
            <a href="#feature-notifications" onClick={e=>{e.preventDefault();goTo('feature-notifications')}}>Notifications Temps Réel</a>
          </div>
          <div className="footer-section">
            <h3>Documentation</h3>
            <a href="/guide-enseignant"><i className="fas fa-chalkboard-teacher" style={{ width: 16, marginRight: 6 }} />{t.guide_teacher}</a>
            <a href="/guide-etudiant"><i className="fas fa-user-graduate" style={{ width: 16, marginRight: 6 }} />{t.guide_student}</a>
            <a href="/guide-surveillant"><i className="fas fa-eye" style={{ width: 16, marginRight: 6 }} />Guide Surveillant</a>
            <a href="/conditions"><i className="fas fa-file-contract" style={{ width: 16, marginRight: 6 }} />Conditions d&apos;Utilisation</a>
            <a href="#comment-ca-marche"><i className="fas fa-question-circle" style={{ width: 16, marginRight: 6 }} />Comment ça marche ?</a>
          </div>
          <div className="footer-section">
            <h3>Contact</h3>
            <p><i className="fas fa-map-marker-alt" /> Cité du Savoir – Diamniadio, Castors, avenue Bourguiba, rue n°13</p>
            <p><i className="fas fa-phone" /> +221 30 108 41 53</p>
            <p><i className="fas fa-envelope" /> visioplus@unchk.edu.sn</p>
          </div>
        </div>
        <div className="footer-bottom">
          <p>&copy; 2026 CEI — Université Cheikh Hamidou Kane (UNCHK)</p>
        </div>
      </footer>
    </>
  )
}
