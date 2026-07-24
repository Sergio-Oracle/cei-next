'use client'

import './landing.css'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

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

/* ── Count-up ──────────────────────────────────────────────────────── */
function animateCount(el: HTMLElement, target: number, duration: number) {
  const start = performance.now()
  const step = (now: number) => {
    const p = Math.min((now - start) / duration, 1)
    const ease = p === 1 ? 1 : 1 - Math.pow(2, -10 * p)
    el.textContent = Math.floor(ease * target).toLocaleString('fr-FR')
    if (p < 1) requestAnimationFrame(step)
    else el.textContent = target.toLocaleString('fr-FR')
  }
  requestAnimationFrame(step)
}

/* ── Component ─────────────────────────────────────────────────────── */
export default function LandingPage() {
  const [lang, setLang] = useState<'fr' | 'en' | 'wo'>('fr')
  const [menuOpen, setMenuOpen] = useState(false)
  const t = LD[lang]

  /* Restore lang — le cookie googtrans fait foi (c'est lui qui détermine
     ce que Google Translate affiche réellement) ; localStorage n'est qu'un
     repli si le cookie est absent. Si les deux divergent (ex. cookie posé
     par une navigation antérieure sans que localStorage suive), le
     sélecteur affichait une langue différente de celle réellement montrée
     à l'écran — on les reconcilie ici. */
  useEffect(() => {
    const m = document.cookie.match(/(?:^|; )googtrans=([^;]*)/)
    const cookieLang = m ? (decodeURIComponent(m[1]).split('/')[2] as 'fr' | 'en' | 'wo' | undefined) : undefined
    const stored = localStorage.getItem('lang') as 'fr' | 'en' | 'wo' | null
    const cookieValid = cookieLang && ['fr', 'en', 'wo'].includes(cookieLang)
    const s = cookieValid ? (cookieLang as 'fr' | 'en' | 'wo') : stored
    if (s && ['fr', 'en', 'wo'].includes(s)) {
      setLang(s)
      if (s !== stored) localStorage.setItem('lang', s)
      if (s !== 'fr' && !cookieValid) {
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

  /* Animations + count-up — exactement comme landing.html original */
  useEffect(() => {
    /* ── Scroll-reveal (même approche que l'original : JS ajoute .reveal puis observe) ── */
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.remove('l-hidden')
          e.target.classList.add('l-visible')
          io.unobserve(e.target)
        }
      })
    }, { threshold: 0.12 })

    /* Sélectionner les mêmes éléments que l'original */
    document.querySelectorAll(
      '.feature-card, .exam-feature-item, .security-card, .stat-item, [data-reveal]'
    ).forEach(el => {
      el.classList.add('l-hidden')
      io.observe(el)
    })

    /* ── Step grids (Enseignant / Étudiant) ── */
    function observeStepGrid(gridId: string) {
      const grid = document.getElementById(gridId)
      if (!grid) return
      const cards = grid.querySelectorAll('.step-card')
      const io2 = new IntersectionObserver((entries) => {
        if (!entries[0].isIntersecting) return
        io2.disconnect()
        grid.classList.add('anim-done')
        cards.forEach(card => {
          card.classList.add('step-card-js')
          requestAnimationFrame(() => card.classList.add('step-visible'))
        })
      }, { threshold: 0.15 })
      io2.observe(grid)
    }
    observeStepGrid('steps-prof')
    observeStepGrid('steps-student')
    observeStepGrid('steps-surveillant')

    /* ── Count-up animé ── */
    const STATS: Record<string, number> = {
      'stat-students': 1480, 'stat-exams': 320,
      'stat-attempts': 4750, 'stat-corrections': 3920,
    }
    const statsSection = document.querySelector('.stats')
    if (statsSection) {
      const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
          observer.disconnect()
          Object.entries(STATS).forEach(([id, val]) => {
            const el = document.getElementById(id)
            if (el) animateCount(el, val, 1600)
          })
        }
      }, { threshold: 0.3 })
      observer.observe(statsSection)
    }

    /* ── Close lang menu on outside click ── */
    const closeMenu = (e: MouseEvent) => {
      const sw = document.getElementById('lang-sw')
      if (sw && !sw.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('click', closeMenu)

    return () => {
      io.disconnect()
      document.removeEventListener('click', closeMenu)
    }
  }, [])

  function goTo(id: string) {
    const el = document.getElementById(id)
    if (!el) return
    /* Forcer l'état visible avant de calculer la position (l-hidden a un transform) */
    el.classList.remove('l-hidden')
    el.classList.add('l-visible')
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
      {/* Logo UNCHK */}
      <div className="landing-brand-logo">
        <picture>
          <source srcSet="/brand/logo-unchk.webp" type="image/webp" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-unchk.png" alt="Université Numérique Cheikh Hamidou Kane" width={135} height={32} decoding="async" />
        </picture>
      </div>

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
      <section className="hero">
        {/* Courbes/spirales décoratives en trait blanc translucide + motifs de
            points, même traitement que la page de connexion pour la
            cohérence visuelle (pas de dégradé, pas de violet). */}
        <svg viewBox="0 0 1200 600" preserveAspectRatio="none" aria-hidden="true"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 0, pointerEvents: 'none' }}>
          <path
            d="M-20,60 C80,110 -40,200 90,250 C220,300 300,190 380,280
               C460,370 310,410 400,500 C490,590 640,520 600,610"
            fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"
          />
          <path
            d="M1220,40 C1120,90 1240,170 1110,220 C980,270 900,170 830,250
               C760,330 900,380 830,460 C760,540 620,500 640,580"
            fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"
          />
        </svg>
        <svg width="150" height="150" viewBox="0 0 150 150" aria-hidden="true"
          style={{ position: 'absolute', right: 28, top: 28, zIndex: 0, pointerEvents: 'none' }}>
          <defs>
            <pattern id="hero-dots" width="16" height="16" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="2" fill="rgba(255,255,255,0.35)" />
            </pattern>
          </defs>
          <rect width="150" height="150" rx="18" fill="url(#hero-dots)" />
        </svg>
        <svg width="90" height="90" viewBox="0 0 90 90" aria-hidden="true"
          style={{ position: 'absolute', left: 28, bottom: 28, zIndex: 0, pointerEvents: 'none', opacity: .6 }}>
          <rect width="90" height="90" fill="url(#hero-dots)" />
        </svg>

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
      <section id="mission" className="py-80" style={{ background: 'white' }}>
        <div className="container">
          <div style={{ textAlign: 'center', maxWidth: 760, margin: '0 auto 64px' }}>
            <span style={{ display: 'inline-block', background: '#eff6ff', color: 'var(--primary-dark)', fontSize: 12, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', padding: '5px 16px', borderRadius: 99, marginBottom: 16 }}>Notre mission</span>
            <h2 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--gray-900)', marginBottom: 16, lineHeight: 1.25 }}>Pourquoi le Centre d&apos;Examen Intelligent ?</h2>
            <p style={{ color: 'var(--gray-500)', fontSize: '1.05rem', lineHeight: 1.7 }}>Au Sénégal, les enseignants font face à des promotions surchargées, des délais de correction serrés et des fraudes difficiles à contrôler — surtout en présentiel. Le CEI est né pour répondre à ces défis concrets avec une solution entièrement numérique, accessible depuis n&apos;importe quel navigateur.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(280px, 100%), 1fr))', gap: 28, marginBottom: 72 }}>
            <div data-reveal="1" style={{ border: '1px solid var(--gray-200)', borderRadius: 16, padding: 32, background: 'var(--gray-50)' }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary-dark)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
              </div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--gray-900)', marginBottom: 10 }}>Objectif</h3>
              <p style={{ color: 'var(--gray-500)', fontSize: '.93rem', lineHeight: 1.7 }}>Numériser l&apos;intégralité du cycle d&apos;examen — de la création du sujet à la publication des relevés de notes — en éliminant les tâches manuelles répétitives et en garantissant l&apos;intégrité académique à chaque étape.</p>
            </div>
            <div data-reveal="1" style={{ border: '1px solid var(--gray-200)', borderRadius: 16, padding: 32, background: 'var(--gray-50)' }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--success-dark)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
              </div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--gray-900)', marginBottom: 10 }}>Public visé</h3>
              <p style={{ color: 'var(--gray-500)', fontSize: '.93rem', lineHeight: 1.7 }}>Universités, grandes écoles, centres de formation professionnelle et instituts techniques au Sénégal et en Afrique de l&apos;Ouest. La plateforme s&apos;adresse aux établissements publics comme privés souhaitant moderniser leur système d&apos;évaluation.</p>
            </div>
            <div data-reveal="1" style={{ border: '1px solid var(--gray-200)', borderRadius: 16, padding: 32, background: 'var(--gray-50)' }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              </div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--gray-900)', marginBottom: 10 }}>Pourquoi c&apos;est crucial au Sénégal</h3>
              <p style={{ color: 'var(--gray-500)', fontSize: '.93rem', lineHeight: 1.7 }}>Avec des classes pouvant dépasser 200 étudiants, un enseignant passe des semaines à corriger manuellement. Le CEI réduit ce délai à quelques heures grâce à l&apos;IA, tout en rendant la surveillance possible à distance — un enjeu majeur pour les filières en ligne comme l&apos;EC2LT ou l&apos;UVS.</p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(220px, 100%), 1fr))', gap: 20 }}>
            {[
              { bg: '#eff6ff', stroke: '#2563eb', path: <polyline points="20 6 9 17 4 12"/>, title: 'Gain de temps > 90 %', desc: "La correction IA génère un feedback détaillé par copie en quelques secondes, avec note calculée automatiquement selon le barème défini." },
              { bg: '#ecfdf5', stroke: '#059669', path: <><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></>, title: 'Anti-triche avancé', desc: "Surveillance caméra + écran + détection faciale + reconnaissance d'identité en temps réel. Chaque incident est logué et horodaté avec preuve." },
              { bg: '#fef3c7', stroke: '#d97706', path: <><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></>, title: 'Relevés officiels PDF', desc: "Génération automatique des relevés semestriels avec calcul de la moyenne pondérée, crédits, GPA — conformes aux exigences académiques." },
              { bg: '#f0fdf4', stroke: '#16a34a', path: <><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></>, title: '100 % navigateur', desc: "Aucune installation requise. La plateforme fonctionne sur tout navigateur moderne — adapté aux contextes où les équipements sont limités." },
            ].map((item, i) => (
              <div key={i} data-reveal="1" style={{ display: 'flex', gap: 14, alignItems: 'flex-start', padding: 20, borderRadius: 12, border: '1px solid var(--gray-200)', background: 'white' }}>
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

      {/* ── Aperçu produit ── */}
      <section id="apercu" className="py-100" style={{ background: 'var(--gray-50)' }}>
        <div className="container" style={{ maxWidth: 1440 }}>
          <div style={{ textAlign: 'center', maxWidth: 700, margin: '0 auto 72px' }}>
            <span style={{ display: 'inline-block', background: '#eff6ff', color: 'var(--primary-dark)', fontSize: 12, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', padding: '5px 16px', borderRadius: 99, marginBottom: 16 }}>Aperçu de la plateforme</span>
            <h2 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--gray-900)', marginBottom: 16, lineHeight: 1.25 }}>Le CEI en action</h2>
            <p style={{ color: 'var(--gray-500)', fontSize: '1.05rem', lineHeight: 1.7 }}>Quatre rôles, quatre interfaces dédiées — enseignant, étudiant, surveillant et administrateur, chacun avec les outils qui lui reviennent.</p>
          </div>

          {[
            {
              heading: 'Génération de sujets par IA — côté enseignant',
              items: [
                { img: '/screenshots/capture-1.jpg', badge: '1', title: 'Uploadez votre support de cours', desc: "Glissez un PDF, un DOCX ou un fichier texte — jusqu'à 50 Mo. L'IA s'appuie directement sur le contenu réel du cours, pas sur un résumé." },
                { img: '/screenshots/capture-3.jpg', badge: '2', title: 'Configurez la génération selon vos besoins', desc: "Niveau de difficulté, promotion visée, types de questions et niveaux taxonomiques de Bloom à cibler — tout est paramétrable avant génération." },
                { img: '/screenshots/capture-4.jpg', badge: '3', title: 'Obtenez des sujets prêts à l\'emploi', desc: "L'IA résume le cours analysé, en extrait les thèmes clés, puis propose plusieurs sujets complets avec points clés et durée estimée." },
                { img: '/screenshots/capture-2.jpg', badge: '4', title: 'Ou créez un sujet manuellement', desc: "Uploadez directement un fichier de sujet existant, ou assemblez un examen depuis la banque de questions réutilisables." },
              ],
            },
            {
              heading: 'Création et gestion des examens — côté enseignant',
              items: [
                { img: '/screenshots/capture-5.jpg', badge: '5', title: 'Configurez la sécurité de l\'examen', desc: "Seuils de bannissement, surveillants assignés, correction IA automatique — tout se règle avant publication." },
                { img: '/screenshots/capture-6.jpg', badge: '6', title: 'Suivez vos examens en un coup d\'œil', desc: "Statuts en temps réel et actions rapides : Activer, Surveiller, Éditer, Rallonger." },
                { img: '/screenshots/capture-7.jpg', badge: '7', title: 'Basculez en surveillance active', desc: "Une fois lancé, accédez directement au suivi live et à la clôture de l'examen." },
              ],
            },
            {
              heading: 'Pendant l\'examen — côté étudiant',
              items: [
                { img: '/screenshots/capture-8.jpg', badge: '8', title: 'L\'étudiant retrouve son examen', desc: "Dès l'activation, le bouton Composer apparaît sur le tableau de bord étudiant avec les créneaux et paramètres de sécurité affichés." },
                { img: '/screenshots/capture-11.jpg', badge: '9', title: 'Signature de l\'engagement anti-fraude', desc: "Avant de démarrer, l'étudiant lit les conditions de surveillance et signe une attestation sur l'honneur — archivée avec sa copie." },
                { img: '/screenshots/capture-12.jpg', badge: '10', title: 'Autorisation caméra, micro et écran', desc: "Les trois accès sont vérifiés un par un avant de pouvoir commencer — rien n'est laissé au hasard." },
                { img: '/screenshots/capture-13.jpg', badge: '11', title: 'Partage d\'écran complet obligatoire', desc: "Le navigateur impose le choix explicite \"Tout l'écran\" — le partage de fenêtre ou d'onglet seul est refusé par la plateforme." },
                { img: '/screenshots/capture-14.jpg', badge: '12', title: 'Composition sous surveillance IA en temps réel', desc: "Caméra, micro et écran actifs, score de risque visible, messagerie directe avec l'enseignant — tout est réuni dans une seule interface." },
              ],
            },
            {
              heading: 'Le tableau de bord dédié au surveillant',
              items: [
                { img: '/screenshots/capture-9.jpg', badge: '13', title: 'Un tableau de bord qui lui est propre', desc: "Le surveillant a sa propre interface, distincte de celle du professeur : nombre d'étudiants qui lui sont assignés, examens en cours, accès direct à sa surveillance." },
                { img: '/screenshots/capture-10.jpg', badge: '14', title: 'Détail des étudiants de son groupe', desc: "Liste des étudiants qui lui sont attribués (pas l'ensemble de la promotion), avec statut de composition et score de risque en direct." },
                { img: '/screenshots/capture-15.jpg', badge: '15', title: 'Supervision vidéo de son groupe', desc: "Flux caméra, alertes, appel et bannissement — limités aux étudiants qui lui ont été attribués par le professeur. Le professeur, lui, voit tous les surveillants et tous les groupes depuis sa propre vue d'ensemble." },
              ],
            },
          ].map((group, g) => (
            <div key={g} style={{ marginBottom: g < 3 ? 80 : 0 }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--gray-900)', marginBottom: 32, paddingBottom: 12, borderBottom: '2px solid var(--gray-200)' }}>{group.heading}</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(560px, 100%), 1fr))', gap: 44 }}>
                {group.items.map((card, i) => (
                  <div key={i}>
                    <div className="mock-browser" style={{ boxShadow: 'var(--shadow-xl)' }}>
                      <div className="browser-header">
                        <div className="browser-dot dot-red" />
                        <div className="browser-dot dot-yellow" />
                        <div className="browser-dot dot-green" />
                      </div>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={card.img} alt={card.title} loading="lazy" decoding="async" style={{ display: 'block', width: '100%', height: 'auto' }} />
                    </div>
                    <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginTop: 20 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, minWidth: 30, borderRadius: '50%', background: 'var(--primary)', color: 'white', fontWeight: 800, fontSize: 13 }}>
                        {card.badge}
                      </div>
                      <div>
                        <h4 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--gray-900)', marginBottom: 6, lineHeight: 1.3 }}>{card.title}</h4>
                        <p style={{ color: 'var(--gray-500)', fontSize: '.95rem', lineHeight: 1.65 }}>{card.desc}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
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
        <div className="container" style={{ maxWidth: 1440 }}>
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

            {/* Capture réelle de l'interface de composition surveillée */}
            <div className="exams-visual">
              <div className="mock-browser">
                <div className="browser-header">
                  <div className="browser-dot dot-red" />
                  <div className="browser-dot dot-yellow" />
                  <div className="browser-dot dot-green" />
                  <span style={{ fontSize: 10, color: 'var(--gray-400)', marginLeft: 10, fontFamily: 'monospace' }}>examen-surveillé · session active</span>
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/screenshots/capture-14.jpg" alt="Interface de composition sous surveillance IA en temps réel" loading="lazy" decoding="async" style={{ display: 'block', width: '100%', height: 'auto' }} />
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
                { img: '/screenshots/capture-5.jpg', svg: <><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></>, bg: '#eff6ff', stroke: '#2563eb', color: 'var(--primary-dark)', title: "Créer l'examen", desc: "Configurez le titre et les plages horaires (la durée est calculée automatiquement) et rédigez le sujet — ou générez-le avec l'IA." },
                { img: '/screenshots/capture-6.jpg', svg: <><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></>, bg: '#eff6ff', stroke: '#2563eb', color: 'var(--primary-dark)', title: "Activer l'examen", desc: "Activez l'examen à l'heure prévue. Les étudiants inscrits voient immédiatement le bouton Composer." },
                { img: null, svg: <><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></>, bg: '#eff6ff', stroke: '#2563eb', color: 'var(--primary-dark)', title: 'Surveiller en direct', desc: "Le dashboard affiche la grille vidéo de tous les étudiants (tous groupes de surveillants confondus), leurs scores de risque et les alertes automatiques." },
                { img: null, svg: <><path d="M12 2a2 2 0 012 2v1h4a1 1 0 011 1v10a1 1 0 01-1 1H6a1 1 0 01-1-1V6a1 1 0 011-1h4V4a2 2 0 012-2z"/><path d="M9 17h6"/></>, bg: '#eff6ff', stroke: '#2563eb', color: 'var(--primary-dark)', title: "Corriger avec l'IA", desc: "Après soumission, l'IA corrige chaque copie selon le barème. Validez, ajustez si besoin, puis publiez les notes." },
              ].map((s, i) => (
                <div key={i} className="step-card step-card--blue">
                  {s.img ? (
                    <div style={{ borderRadius: 10, overflow: 'hidden', marginBottom: 14, border: '1px solid var(--gray-200)', aspectRatio: '16/10', background: 'var(--gray-100)' }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={s.img} alt={s.title} loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    </div>
                  ) : (
                    <div className="step-icon-wrap" style={{ background: s.bg }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={s.stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{s.svg}</svg>
                    </div>
                  )}
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
                { img: '/screenshots/capture-8.jpg', svg: <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>, bg: '#ecfdf5', stroke: '#059669', color: 'var(--success-dark)', title: "Voir l'examen disponible", desc: "L'examen apparaît dans votre tableau de bord avec le bouton Composer ou un compte à rebours jusqu'à l'ouverture." },
                { img: '/screenshots/capture-12.jpg', svg: <><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></>, bg: '#ecfdf5', stroke: '#059669', color: 'var(--success-dark)', title: 'Autoriser la surveillance', desc: "Autorisez caméra, micro et partage d'écran dans votre navigateur. La plateforme active tout automatiquement au lancement." },
                { img: '/screenshots/capture-14.jpg', svg: <><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></>, bg: '#ecfdf5', stroke: '#059669', color: 'var(--success-dark)', title: 'Composer', desc: "Lisez le sujet et rédigez vos réponses. Sauvegarde automatique toutes les 30 s. Posez vos questions via la messagerie intégrée." },
                { img: null, svg: <><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></>, bg: '#ecfdf5', stroke: '#059669', color: 'var(--success-dark)', title: 'Soumettre & consulter', desc: "Soumettez avant l'expiration. Consultez ensuite votre note et le feedback IA par question, une fois publiés par l'enseignant, ainsi que votre relevé de notes officiel." },
              ].map((s, i) => (
                <div key={i} className="step-card step-card--green">
                  {s.img ? (
                    <div style={{ borderRadius: 10, overflow: 'hidden', marginBottom: 14, border: '1px solid var(--gray-200)', aspectRatio: '16/10', background: 'var(--gray-100)' }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={s.img} alt={s.title} loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    </div>
                  ) : (
                    <div className="step-icon-wrap" style={{ background: s.bg }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={s.stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{s.svg}</svg>
                    </div>
                  )}
                  <div className="step-badge" style={{ background: s.color }}>Étape {i + 1}</div>
                  <h4 className="step-title">{s.title}</h4>
                  <p className="step-desc">{s.desc}</p>
                </div>
              ))}
            </div>

            {/* Surveillant */}
            <div className="process-label" data-reveal="1" style={{ marginTop: 56 }}>
              <div className="process-label-icon" style={{ background: '#d97706' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              </div>
              <h3 className="process-label-title">Côté Surveillant</h3>
            </div>
            <p style={{ textAlign: 'center', color: 'var(--gray-500)', fontSize: '.95rem', maxWidth: 560, margin: '0 auto 32px' }}>
              Un rôle à part entière, distinct du professeur : chaque surveillant ne voit que le groupe d&apos;étudiants qui lui a été attribué.
            </p>
            <div className="steps-grid" id="steps-surveillant">
              {[
                { img: '/screenshots/capture-9.jpg', svg: <><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></>, bg: '#fffbeb', stroke: '#d97706', color: '#d97706', title: 'Son propre tableau de bord', desc: "Nombre d'étudiants attribués, examens en cours, accès direct à sa surveillance — une interface distincte de celle du professeur." },
                { img: '/screenshots/capture-10.jpg', svg: <><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/></>, bg: '#fffbeb', stroke: '#d97706', color: '#d97706', title: 'Le détail de son groupe', desc: "Seuls les étudiants automatiquement répartis vers lui (via son Groupe Surveillants) apparaissent, avec statut et score de risque en direct." },
                { img: '/screenshots/capture-15.jpg', svg: <><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></>, bg: '#fffbeb', stroke: '#d97706', color: '#d97706', title: 'Supervision vidéo de son groupe', desc: "Flux caméra, alertes et actions (message, appel, bannissement) limités à son groupe — le professeur seul voit l'ensemble des surveillants et de la promotion." },
              ].map((s, i) => (
                <div key={i} className="step-card" style={{ borderColor: 'var(--gray-200)' }}>
                  {s.img ? (
                    <div style={{ borderRadius: 10, overflow: 'hidden', marginBottom: 14, border: '1px solid var(--gray-200)', aspectRatio: '16/10', background: 'var(--gray-100)' }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={s.img} alt={s.title} loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    </div>
                  ) : (
                    <div className="step-icon-wrap" style={{ background: s.bg }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={s.stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{s.svg}</svg>
                    </div>
                  )}
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
      <section id="temoignages" className="py-80" style={{ background: 'var(--gray-50)' }}>
        <div className="container">
          <div style={{ textAlign: 'center', maxWidth: 640, margin: '0 auto 56px' }}>
            <span style={{ display: 'inline-block', background: '#eff6ff', color: 'var(--primary-dark)', fontSize: 12, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', padding: '5px 16px', borderRadius: 99, marginBottom: 16 }}>Ils utilisent le CEI</span>
            <h2 style={{ fontSize: '1.9rem', fontWeight: 800, color: 'var(--gray-900)', marginBottom: 14, lineHeight: 1.25 }}>Ce qu&apos;en disent les professionnels</h2>
            <p style={{ color: 'var(--gray-500)', fontSize: '.97rem', lineHeight: 1.7 }}>Enseignants, ingénieurs et responsables académiques partagent leur expérience avec la plateforme.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(300px, 100%), 1fr))', gap: 24 }}>
            {[
              { initial: 'S', color: '#2563eb', quote: "Le CEI répond directement aux besoins des universités africaines qui se digitalisent. La surveillance en temps réel et la correction automatique permettent d'offrir une expérience d'examen à distance digne de ce nom, sans compromis sur la rigueur académique. C'est exactement ce qu'il faut pour des établissements comme l'UVS qui gèrent des milliers d'étudiants dispersés sur tout le territoire.", name: 'Professeur Samuel OUYA', role: 'Recteur — Université Virtuelle du Sénégal (UVS), Dakar' },
              { initial: 'S', color: '#0d9488', quote: "En tant qu'ingénieur spécialisé en cybersécurité, ce qui m'a convaincu c'est l'architecture de surveillance : détection faciale, partage d'écran obligatoire, logs horodatés à chaque action. Le niveau de traçabilité est comparable à ce qu'on retrouve dans les certifications professionnelles. Le CEI apporte une vraie réponse technique au problème de fraude dans nos filières.", name: 'Serge BOUNGUELE', role: 'Ingénieur Télécoms Réseaux (Cybersécurité/DevOps) — RTN' },
              { initial: 'N', color: '#2563eb', quote: "Enseigner à l'EC2LT c'est gérer des étudiants qui jonglent entre travail et formation. La correction IA du CEI m'a libéré un temps considérable — ce qui prenait 3 jours se fait maintenant en une heure. Les étudiants reçoivent un feedback précis question par question, ce qui améliore leur compréhension. Un outil indispensable pour l'enseignement des filières techniques à distance.", name: 'Nasry AHAMADI', role: 'Télécoms Réseaux (Cybersécurité/DevOps) — Enseignant EC2LT' },
            ].map((item, i) => (
              <div key={i} data-reveal="1" style={{ background: 'white', borderRadius: 16, padding: 32, border: '1px solid var(--gray-200)', boxShadow: '0 4px 16px rgba(0,0,0,.06)', display: 'flex', flexDirection: 'column', gap: 20 }}>
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
