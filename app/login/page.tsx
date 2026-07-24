'use client'

import { useState, FormEvent, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import Link from 'next/link'

const LANGS = {
  fr: {
    email: 'Email', password: 'Mot de passe', btn: 'Se Connecter', forgot: 'Mot de passe oublié ?',
    contact: "Contactez l'administration pour obtenir un compte", back: "Retour à l'accueil",
    title: "Centre d'Examen Intelligent", tagline: 'Connexion à votre compte',
    connexion: 'Connexion', connexionSub: 'Accédez à votre espace CEI',
    welcome: 'Bienvenue !', welcomeSub: "Connectez-vous pour composer vos examens, surveiller une session ou consulter vos relevés de notes, en toute sécurité.",
  },
  en: {
    email: 'Email', password: 'Password', btn: 'Sign In', forgot: 'Forgot password?',
    contact: 'Contact administration to get an account', back: 'Back to home',
    title: 'Intelligent Examination Centre', tagline: 'Sign in to your account',
    connexion: 'Sign In', connexionSub: 'Access your CEI workspace',
    welcome: 'Welcome!', welcomeSub: 'Sign in to take your exams, proctor a session or check your transcripts, all securely.',
  },
  wo: {
    email: 'Email', password: 'Mot de passe', btn: 'Dugg', forgot: 'Mot de passe oublié ?',
    contact: "Xibaar l'administration", back: 'Dellu ci kanam',
    title: "Xëtu Jëfandikoo yu Xam-Xam", tagline: 'Dugg ci sa kont',
    connexion: 'Dugg', connexionSub: 'Dugg ci sa espace CEI',
    welcome: 'Dalal ak jàmm !', welcomeSub: 'Dugg ngir jëfandikoo say examen ci kaaraange.',
  },
}

const FEATURE_ICONS = [
  { icon: 'fa-video',       top: '14%', left: '72%' },
  { icon: 'fa-file-lines',  top: '24%', left: '14%' },
  { icon: 'fa-shield-halved', top: '38%', left: '80%' },
  { icon: 'fa-chart-line',  top: '58%', left: '10%' },
  { icon: 'fa-clock',       top: '68%', left: '78%' },
  { icon: 'fa-circle-check',top: '82%', left: '20%' },
]

export default function LoginPage() {
  const { login } = useAuth()
  const { error: showError } = useToast()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [lang, setLang]         = useState<'fr' | 'en' | 'wo'>('fr')
  const [menuOpen, setMenuOpen] = useState(false)

  const t = LANGS[lang]

  useEffect(() => {
    const s = localStorage.getItem('lang') as 'fr' | 'en' | 'wo' | null
    if (s && ['fr', 'en', 'wo'].includes(s)) setLang(s)

    const close = (e: MouseEvent) => {
      const sw = document.getElementById('login-lang-sw')
      if (sw && !sw.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [])

  function changeLang(code: 'fr' | 'en' | 'wo') {
    localStorage.setItem('lang', code)
    setLang(code)
    setMenuOpen(false)
    const host = window.location.hostname
    const pastExp = 'expires=Thu, 01 Jan 1970 00:00:00 GMT'
    const futExp  = 'expires=Fri, 31 Dec 9999 23:59:59 GMT'
    if (code === 'fr') {
      document.cookie = `googtrans=;path=/;${pastExp}`
      if (host && host.includes('.')) document.cookie = `googtrans=;path=/;domain=.${host};${pastExp}`
      window.location.reload()
      return
    }
    const val = `/fr/${code}`
    document.cookie = `googtrans=${val};path=/;${futExp}`
    if (host && host.includes('.')) document.cookie = `googtrans=${val};path=/;domain=.${host};${futExp}`
    const tryCombo = (n: number) => {
      const c = document.querySelector('select.goog-te-combo') as HTMLSelectElement | null
      if (c) { c.value = code; c.dispatchEvent(new Event('change', { bubbles: true })) }
      else if (n > 0) setTimeout(() => tryCombo(n - 1), 250)
      else window.location.reload()
    }
    tryCombo(8)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!email || !password) { showError('Email et mot de passe requis'); return }
    setLoading(true)
    try {
      await login(email, password)
    } catch (err: any) {
      showError(err.message || 'Identifiants invalides')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="cei-split">
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .cei-split {
          min-height: 100vh;
          display: flex;
          background: #f8fafc;
          padding: 20px;
          gap: 20px;
        }
        .cei-split-panel {
          flex: 1 1 52%;
          max-width: 980px;
          background: var(--primary, #1d4ed8);
          border-radius: 28px;
          position: relative;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          padding: 32px;
          color: white;
          min-height: calc(100vh - 40px);
          order: 2;
        }
        .cei-split-brand {
          display: flex;
          align-items: center;
          gap: 12px;
          position: relative;
          z-index: 1;
        }
        .cei-split-brand-icon {
          width: 42px; height: 42px;
          background: rgba(255,255,255,.15);
          border-radius: 12px;
          display: flex; align-items: center; justify-content: center;
          font-size: 18px;
          flex-shrink: 0;
        }
        .cei-split-brand-name {
          font-weight: 800;
          font-size: 15px;
          letter-spacing: .02em;
        }
        .cei-split-unchk-logo {
          position: relative;
          z-index: 1;
          margin: 0 auto 24px;
          background: white;
          border-radius: 16px;
          padding: 12px 20px;
          box-shadow: 0 12px 32px rgba(0,0,0,.18);
          display: flex;
          align-items: center;
          justify-content: center;
          width: fit-content;
        }
        .cei-split-unchk-logo img {
          display: block;
          height: 40px;
          width: auto;
        }
        .cei-split-welcome {
          position: relative;
          z-index: 1;
          margin: auto 0 40px;
          text-align: center;
          padding: 0 12px;
        }
        .cei-split-welcome-glow {
          width: 190px; height: 190px;
          background: rgba(255,255,255,.10);
          border-radius: 50%;
          margin: 0 auto -139px;
          position: relative;
        }
        .cei-split-welcome-icon {
          width: 84px; height: 84px;
          background: white;
          border-radius: 20px;
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 28px;
          box-shadow: 0 12px 32px rgba(0,0,0,.18);
          position: relative;
        }
        .cei-split-welcome-icon i { font-size: 38px; color: var(--primary, #1d4ed8); }
        .cei-split-welcome h2 { font-size: 26px; font-weight: 800; margin: 0 0 10px; }
        .cei-split-welcome p { font-size: 14px; opacity: .85; line-height: 1.6; max-width: 360px; margin: 0 auto; }
        .cei-split-feature-icon {
          position: absolute;
          width: 44px; height: 44px;
          border-radius: 50%;
          background: rgba(255,255,255,.08);
          border: 1px solid rgba(255,255,255,.12);
          display: flex; align-items: center; justify-content: center;
          font-size: 17px;
          color: rgba(255,255,255,.55);
          z-index: 0;
        }
        .cei-split-right {
          flex: 1 1 48%;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          padding: 24px;
          order: 1;
        }
        .cei-split-topbar {
          position: absolute;
          top: 20px; right: 20px;
          display: flex; align-items: center; gap: 10px;
          z-index: 10;
        }
        .cei-split-form-wrap {
          width: 100%;
          max-width: 460px;
        }
        .cei-split-form-wrap h1 { font-size: 36px; font-weight: 800; color: var(--text, #0f172a); margin: 0 0 10px; }
        .cei-split-form-wrap > p { color: var(--text-light, #64748b); font-size: 15px; margin: 0 0 36px; }
        .cei-split-form-wrap .form-group input { font-size: 16px; padding: 14px 16px; }
        .cei-split-form-wrap .btn-block { padding: 14px; font-size: 15px; }
        @media (max-width: 900px) {
          .cei-split-panel { display: none; }
          .cei-split { padding: 0; }
          .cei-split-right { min-height: 100vh; }
        }
      `}</style>

      {/* ── Panneau gauche — identité CEI ── */}
      <div className="cei-split-panel">
        {/* Courbes/spirales décoratives, en blanc translucide (trait, pas d'aplat) */}
        <svg viewBox="0 0 600 900" preserveAspectRatio="none" aria-hidden="true"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 0, pointerEvents: 'none' }}>
          <path
            d="M120,30 C220,80 60,170 170,220 C280,270 360,160 400,250
               C440,340 290,380 350,470 C410,560 540,490 500,600
               C460,710 320,650 360,750 C400,850 530,790 500,880"
            fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"
          />
          <path
            d="M40,250 C110,300 20,360 90,410 C160,460 220,390 250,460
               C280,530 180,560 220,630"
            fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"
          />
        </svg>
        <svg width="150" height="150" viewBox="0 0 150 150" aria-hidden="true"
          style={{ position: 'absolute', right: 0, bottom: 0, zIndex: 0, pointerEvents: 'none' }}>
          <defs>
            <pattern id="split-dots" width="16" height="16" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="2" fill="rgba(255,255,255,0.3)" />
            </pattern>
          </defs>
          <rect width="150" height="150" fill="url(#split-dots)" />
        </svg>
        <svg width="90" height="90" viewBox="0 0 90 90" aria-hidden="true"
          style={{ position: 'absolute', left: 24, top: 100, zIndex: 0, pointerEvents: 'none', opacity: .6 }}>
          <rect width="90" height="90" fill="url(#split-dots)" />
        </svg>

        {/* Icônes représentant les fonctionnalités réelles de CEI, dans des badges circulaires */}
        {FEATURE_ICONS.map(f => (
          <div key={f.icon} className="cei-split-feature-icon" style={{ top: f.top, left: f.left }}>
            <i className={`fas ${f.icon}`} />
          </div>
        ))}

        <div className="cei-split-unchk-logo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-unchk.png" alt="Université Numérique Cheikh Hamidou Kane" />
        </div>

        <div className="cei-split-brand">
          <div className="cei-split-brand-icon"><i className="fas fa-graduation-cap" /></div>
          <span className="cei-split-brand-name">CENTRE D&apos;EXAMEN INTELLIGENT</span>
        </div>

        <div className="cei-split-welcome">
          <div className="cei-split-welcome-glow" />
          <div className="cei-split-welcome-icon"><i className="fas fa-graduation-cap" /></div>
          <h2>{t.welcome}</h2>
          <p>{t.welcomeSub}</p>
        </div>
      </div>

      {/* ── Colonne droite — formulaire ── */}
      <div className="cei-split-right">
        <div className="cei-split-topbar">
          <Link href="/" className="btn-home" style={{ position: 'static' }}>
            <i className="fas fa-home" /> {t.back}
          </Link>
          <div className="lang-switcher" id="login-lang-sw" style={{ position: 'relative' }}>
            <button className="lang-btn" onClick={e => { e.stopPropagation(); setMenuOpen(v => !v) }}>
              <i className="fas fa-globe" />
              <span className="lang-current-label">{lang === 'fr' ? '🇫🇷 FR' : lang === 'en' ? '🇬🇧 EN' : '🇸🇳 WO'}</span>
              <i className="fas fa-chevron-down" style={{ fontSize: 10 }} />
            </button>
            {menuOpen && (
              <div className="lang-menu">
                <button className={`lang-option${lang === 'fr' ? ' active' : ''}`} onClick={e => { e.stopPropagation(); changeLang('fr') }}>
                  <span className="lang-flag">🇫🇷</span> Français
                </button>
                <button className={`lang-option${lang === 'en' ? ' active' : ''}`} onClick={e => { e.stopPropagation(); changeLang('en') }}>
                  <span className="lang-flag">🇬🇧</span> English
                </button>
                <button className={`lang-option${lang === 'wo' ? ' active' : ''}`} onClick={e => { e.stopPropagation(); changeLang('wo') }}>
                  <span className="lang-flag">🇸🇳</span> Wolof
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="cei-split-form-wrap">
          <h1>{t.connexion}</h1>
          <p>{t.connexionSub}</p>

          <form id="login-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label><i className="fas fa-envelope" /> {t.email}</label>
              <input
                type="email"
                id="login-email"
                required
                placeholder="votre@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
            <div className="form-group">
              <label><i className="fas fa-lock" /> {t.password}</label>
              <input
                type="password"
                id="login-password"
                required
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
              {loading
                ? <><i className="fas fa-spinner" style={{ animation: 'spin 1s linear infinite' }} /> Connexion…</>
                : <><i className="fas fa-sign-in-alt" /> {t.btn}</>
              }
            </button>
          </form>

          <p style={{ textAlign: 'center', margin: '14px 0 0' }}>
            <Link href="/forgot-password" style={{ background: 'none', color: '#3b82f6', fontSize: 13, cursor: 'pointer', textDecoration: 'underline', padding: 0, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <i className="fas fa-key" /> {t.forgot}
            </Link>
          </p>

          <p className="auth-footer">
            <i className="fas fa-info-circle" /> {t.contact}
          </p>
        </div>
      </div>
    </div>
  )
}
