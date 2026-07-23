'use client'

import { useState, FormEvent, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import Link from 'next/link'

const LANGS = {
  fr: { email: 'Email', password: 'Mot de passe', btn: 'Se Connecter', forgot: 'Mot de passe oublié ?', contact: "Contactez l'administration pour obtenir un compte", back: "Retour à l'accueil", title: "Centre d'Examen Intelligent", tagline: 'Connexion à votre compte' },
  en: { email: 'Email', password: 'Password', btn: 'Sign In', forgot: 'Forgot password?', contact: 'Contact administration to get an account', back: 'Back to home', title: 'Intelligent Examination Centre', tagline: 'Sign in to your account' },
  wo: { email: 'Email', password: 'Mot de passe', btn: 'Dugg', forgot: 'Mot de passe oublié ?', contact: "Xibaar l'administration", back: 'Dellu ci kanam', title: "Xëtu Jëfandikoo yu Xam-Xam", tagline: 'Dugg ci sa kont' },
}

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
    <div id="login-screen" className="auth-screen">

      {/* Éléments décoratifs — silhouette organique + motif de points, en
          blanc translucide sur le fond bleu existant (pas de dégradé, pas de
          violet). Purement visuels : pointer-events désactivés, en arrière-plan. */}
      <svg viewBox="0 0 420 900" preserveAspectRatio="none" aria-hidden="true"
        style={{ position: 'absolute', top: 0, left: 0, width: 340, height: '100%', zIndex: 0, pointerEvents: 'none' }}>
        <path
          d="M0,0 L360,0 C300,90 400,180 330,280 C270,360 410,460 320,560 C255,640 400,720 310,820 C270,865 330,890 300,900 L0,900 Z"
          fill="rgba(255,255,255,0.07)"
        />
      </svg>
      <svg width="150" height="150" viewBox="0 0 150 150" aria-hidden="true"
        style={{ position: 'absolute', right: 28, bottom: 28, zIndex: 0, pointerEvents: 'none' }}>
        <defs>
          <pattern id="login-dots" width="16" height="16" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="2" fill="rgba(255,255,255,0.35)" />
          </pattern>
        </defs>
        <rect width="150" height="150" rx="18" fill="url(#login-dots)" />
      </svg>

      {/* Bouton retour accueil */}
      <Link href="/" className="btn-home">
        <i className="fas fa-home" /> {t.back}
      </Link>

      {/* Sélecteur de langue */}
      <div className="lang-switcher" id="login-lang-sw" style={{ position: 'absolute', top: 20, right: 20, zIndex: 10 }}>
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

      {/* Formulaire */}
      <div className="auth-container">
        <div className="auth-header">
          <i className="fas fa-graduation-cap" />
          <h1>{t.title}</h1>
          <p>{t.tagline}</p>
        </div>

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

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
