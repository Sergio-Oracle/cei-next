'use client'

import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { useEffect, useState, useRef, useCallback } from 'react'
import api from '@/lib/api'
import { useNotificationPoll } from '@/hooks/useNotificationPoll'

const roleLabel: Record<string, string> = {
  admin: 'Administrateur',
  professor: 'Professeur',
  student: 'Étudiant',
  surveillant: 'Surveillant',
}
const roleColor: Record<string, string> = {
  admin: '#ef4444',
  professor: '#3b82f6',
  student: '#10b981',
  surveillant: '#f59e0b',
}

type Lang = 'fr' | 'en' | 'wo'
const LANGS: { code: Lang; flag: string; label: string }[] = [
  { code: 'fr', flag: 'FR', label: 'Français' },
  { code: 'en', flag: 'GB', label: 'English' },
  { code: 'wo', flag: 'SN', label: 'Wolof' },
]

function changeLang(code: Lang) {
  localStorage.setItem('lang', code)
  const host = window.location.hostname
  const pastExp = 'expires=Thu, 01 Jan 1970 00:00:00 GMT'
  const futExp  = 'expires=Fri, 31 Dec 9999 23:59:59 GMT'
  if (code === 'fr') {
    document.cookie = `googtrans=;path=/;${pastExp}`
    if (host?.includes('.')) document.cookie = `googtrans=;path=/;domain=.${host};${pastExp}`
    window.location.reload()
    return
  }
  const val = `/fr/${code}`
  document.cookie = `googtrans=${val};path=/;${futExp}`
  if (host?.includes('.')) document.cookie = `googtrans=${val};path=/;domain=.${host};${futExp}`
  const tryCombo = (n: number) => {
    const combo = document.querySelector('select.goog-te-combo') as HTMLSelectElement | null
    if (combo) { combo.value = code; combo.dispatchEvent(new Event('change', { bubbles: true })) }
    else if (n > 0) setTimeout(() => tryCombo(n - 1), 250)
    else window.location.reload()
  }
  tryCombo(8)
}

interface ProfileExtra { is_active?: boolean; last_login?: string }

export default function Header() {
  const { user, logout } = useAuth()
  const [unreadCount, setUnreadCount]   = useState(0)
  const [langOpen, setLangOpen]         = useState(false)
  const [userOpen, setUserOpen]         = useState(false)
  const [currentLang, setCurrentLang]   = useState<Lang>('fr')
  const [dark, setDark]                 = useState(false)
  const [profileExtra, setProfileExtra] = useState<ProfileExtra>({})

  const langRef = useRef<HTMLDivElement>(null)
  const userRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const saved = (localStorage.getItem('lang') as Lang) || 'fr'
    setCurrentLang(saved)
    setDark(localStorage.getItem('theme') === 'dark')
    function onThemeChange(e: Event) {
      setDark((e as CustomEvent<{ dark: boolean }>).detail.dark)
    }
    window.addEventListener('cei:themechange', onThemeChange)
    return () => window.removeEventListener('cei:themechange', onThemeChange)
  }, [])

  // Fetch initial du compteur + profil
  useEffect(() => {
    if (!user) return
    api.get<{ unread_count?: number }>('/api/notifications')
      .then(res => setUnreadCount(res.unread_count ?? 0))
      .catch(() => {})
    api.get<any>('/api/auth/me')
      .then(res => {
        const u = res.user ?? res
        setProfileExtra({ is_active: u.is_active, last_login: u.last_login })
      })
      .catch(() => {})
  }, [user])

  // Long-polling Redis : incrémente le badge dès qu'un événement arrive
  const handleNotifEvent = useCallback(() => {
    setUnreadCount(c => c + 1)
  }, [])

  useNotificationPoll(!!user, handleNotifEvent)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (langRef.current && !langRef.current.contains(e.target as Node)) setLangOpen(false)
      if (userRef.current && !userRef.current.contains(e.target as Node)) setUserOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function toggleTheme() {
    const next = !dark
    setDark(next)
    localStorage.setItem('theme', next ? 'dark' : 'light')
    document.body.classList.toggle('theme-dark', next)
  }

  function selectLang(code: Lang) {
    setCurrentLang(code)
    setLangOpen(false)
    changeLang(code)
  }

  function handleLogout() {
    setUserOpen(false)
    logout()
  }

  const currentLangObj = LANGS.find(l => l.code === currentLang) ?? LANGS[0]
  const notifHref =
    user?.role === 'student'   ? '/dashboard/student/notifications' :
    user?.role === 'professor' ? '/dashboard/professor/notifications' :
    '/dashboard/admin/notifications'

  const initials = user?.full_name?.split(' ').slice(0, 2).map(w => w.charAt(0)).join('').toUpperCase() || '?'

  return (
    <header className="app-header">
      {/* Conteneur pleine largeur sans max-width */}
      <div style={{ width: '100%', padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>

        {/* Logo à gauche */}
        <div className="header-left">
          <i className="fas fa-graduation-cap header-icon" />
          <h1>Centre d'Examen Intelligent</h1>
        </div>

        {/* Contrôles à droite */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>

          {/* Toggle thème */}
          <button onClick={toggleTheme} title={dark ? 'Mode clair' : 'Mode sombre'}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 36, height: 36, borderRadius: '50%', background: 'var(--background)',
              border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text)' }}>
            <i className={`fas ${dark ? 'fa-sun' : 'fa-moon'}`} style={{ fontSize: 14 }} />
          </button>

          {/* Notifications */}
          {user && (
            <Link href={notifHref} title="Notifications"
              style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 36, height: 36, borderRadius: '50%', background: 'var(--background)',
                border: '1px solid var(--border)', textDecoration: 'none', color: 'var(--text)' }}>
              <i className="fas fa-bell" style={{ fontSize: 14 }} />
              {unreadCount > 0 && (
                <span style={{ position: 'absolute', top: -3, right: -3, background: '#ef4444', color: 'white',
                  borderRadius: '50%', width: 17, height: 17, fontSize: 10, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Link>
          )}

          {/* Sélecteur de langue */}
          <div ref={langRef} style={{ position: 'relative' }}>
            <button onClick={() => setLangOpen(o => !o)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px',
                background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 20,
                cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
              <i className="fas fa-globe" style={{ color: 'var(--primary)', fontSize: 13 }} />
              <span>{currentLangObj.flag}</span>
              <i className="fas fa-chevron-down" style={{ fontSize: 9, color: 'var(--text-muted)' }} />
            </button>
            {langOpen && (
              <div style={{ position: 'absolute', top: 42, right: 0, background: 'var(--surface)', borderRadius: 10,
                boxShadow: '0 8px 24px rgba(0,0,0,0.15)', border: '1px solid var(--border)',
                minWidth: 140, zIndex: 300, overflow: 'hidden' }}>
                {LANGS.map(l => (
                  <button key={l.code} onClick={() => selectLang(l.code)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 14px',
                      background: currentLang === l.code ? 'var(--primary)1a' : 'transparent',
                      border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--text)',
                      fontWeight: currentLang === l.code ? 700 : 400 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)', minWidth: 22 }}>{l.flag}</span>
                    {l.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Avatar + dropdown */}
          {user && (
            <div ref={userRef} style={{ position: 'relative' }}>
              <button onClick={() => setUserOpen(o => !o)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none',
                  border: 'none', cursor: 'pointer', padding: '2px 4px', borderRadius: 10 }}>
                <div style={{ width: 38, height: 38, borderRadius: '50%',
                  background: roleColor[user.role] || 'var(--primary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', fontWeight: 700, fontSize: 13, letterSpacing: .5, flexShrink: 0 }}>
                  {initials}
                </div>
                <i className="fas fa-chevron-down" style={{ fontSize: 9, color: 'var(--text-muted)' }} />
              </button>

              {userOpen && (
                <div style={{ position: 'absolute', top: 50, right: 0, background: 'var(--surface)', borderRadius: 12,
                  boxShadow: '0 12px 32px rgba(0,0,0,0.18)', border: '1px solid var(--border)',
                  minWidth: 250, zIndex: 300, overflow: 'hidden' }}>

                  <div style={{ padding: '16px', borderBottom: '1px solid var(--border)', background: 'var(--background)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                      <div style={{ width: 44, height: 44, borderRadius: '50%',
                        background: roleColor[user.role] || 'var(--primary)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'white', fontWeight: 700, fontSize: 16, flexShrink: 0 }}>
                        {initials}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{user.full_name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{user.email}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                        background: roleColor[user.role], color: 'white', textTransform: 'uppercase' }}>
                        {roleLabel[user.role]}
                      </span>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                        background: profileExtra.is_active !== false ? '#dcfce7' : '#fef2f2',
                        color: profileExtra.is_active !== false ? '#059669' : '#dc2626' }}>
                        {profileExtra.is_active !== false ? 'Compte actif' : 'Compte inactif'}
                      </span>
                    </div>
                    {profileExtra.last_login && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
                        <i className="fas fa-clock" style={{ fontSize: 10 }} />
                        Dernière connexion : {new Date(profileExtra.last_login).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}
                  </div>

                  <DropdownLink href="/dashboard/settings" icon="fa-user-edit" onClick={() => setUserOpen(false)}>
                    Mon profil
                  </DropdownLink>
                  <DropdownLink href="/dashboard/settings" icon="fa-cog" onClick={() => setUserOpen(false)}>
                    Paramètres
                  </DropdownLink>

                  <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />

                  <button onClick={handleLogout}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px',
                      width: '100%', border: 'none', background: 'transparent', cursor: 'pointer',
                      color: '#ef4444', fontSize: 14 }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#fef2f2')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <i className="fas fa-sign-out-alt" style={{ width: 16 }} />
                    Déconnexion
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

function DropdownLink({ href, icon, children, onClick }: {
  href: string; icon: string; children: React.ReactNode; onClick: () => void
}) {
  return (
    <Link href={href} onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px',
        textDecoration: 'none', color: 'var(--text)', fontSize: 14 }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--background)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
      <i className={`fas ${icon}`} style={{ color: 'var(--primary)', width: 16 }} />
      {children}
    </Link>
  )
}
