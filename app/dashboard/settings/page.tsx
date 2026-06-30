'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import api from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'

type Tab = 'profil' | 'securite' | 'apparence' | 'accessibilite'

/* Émet un événement global quand le thème change
   → Header.tsx l'écoute pour synchroniser son état */
function broadcastTheme(dark: boolean) {
  window.dispatchEvent(new CustomEvent('cei:themechange', { detail: { dark } }))
}

const roleLabels: Record<string, string> = {
  admin: 'Administrateur', professor: 'Professeur', student: 'Étudiant', surveillant: 'Surveillant'
}
const roleColors: Record<string, string> = {
  admin: '#ef4444', professor: '#3b82f6', student: '#10b981', surveillant: '#f59e0b'
}

interface FullProfile {
  full_name: string; email: string; role: string;
  is_active?: boolean; last_login?: string; formation_name?: string; niveau?: string;
}

export default function SettingsPage() {
  const { user } = useAuth()
  const { success, error } = useToast()
  const [tab, setTab] = useState<Tab>('profil')

  /* Profil complet depuis API */
  const [profile, setProfile]   = useState<FullProfile | null>(null)
  const [fullName, setFullName] = useState('')
  const [email, setEmail]       = useState('')
  const [saving, setSaving]     = useState(false)

  /* Mot de passe */
  const [currentPwd, setCurrentPwd]   = useState('')
  const [newPwd, setNewPwd]           = useState('')
  const [confirmPwd, setConfirmPwd]   = useState('')
  const [showPwds, setShowPwds]       = useState(false)
  const [changingPwd, setChangingPwd] = useState(false)

  /* Apparence */
  const [dark, setDark]         = useState(false)
  const [fontSize, setFontSize] = useState<'sm' | 'md' | 'lg'>('md')

  /* Accessibilité */
  const [highContrast, setHighContrast]   = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    setDark(localStorage.getItem('theme') === 'dark')
    setFontSize((localStorage.getItem('fontSize') as 'sm' | 'md' | 'lg') || 'md')
    setHighContrast(localStorage.getItem('highContrast') === '1')
    setReducedMotion(localStorage.getItem('reducedMotion') === '1')
    loadProfile()
  }, [])

  async function loadProfile() {
    try {
      const res = await api.get<any>('/api/auth/me')
      const u: FullProfile = res.user ?? res
      setProfile(u)
      setFullName(u.full_name || '')
      setEmail(u.email || '')
    } catch {
      if (user) { setFullName(user.full_name || ''); setEmail(user.email || '') }
    }
  }

  /* Profil */
  async function saveProfile(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await api.put('/api/profile', { full_name: fullName })
      setProfile(p => p ? { ...p, full_name: fullName } : p)
      success('Profil mis à jour avec succès')
    } catch (err: any) {
      error(err.message || 'Erreur lors de la sauvegarde')
    } finally { setSaving(false) }
  }

  /* Mot de passe — endpoint : PUT /api/profile/password */
  async function changePassword(e: React.FormEvent) {
    e.preventDefault()
    if (newPwd !== confirmPwd) { error('Les mots de passe ne correspondent pas'); return }
    if (newPwd.length < 6) { error('Le mot de passe doit faire au moins 6 caractères'); return }
    setChangingPwd(true)
    try {
      await api.put('/api/profile/password', {
        current_password: currentPwd,
        new_password:     newPwd,
        confirm_password: confirmPwd,
      })
      success('Mot de passe modifié avec succès')
      setCurrentPwd(''); setNewPwd(''); setConfirmPwd('')
    } catch (err: any) {
      error(err.message || 'Mot de passe actuel incorrect')
    } finally { setChangingPwd(false) }
  }

  /* Thème */
  function applyTheme(isDark: boolean) {
    setDark(isDark)
    localStorage.setItem('theme', isDark ? 'dark' : 'light')
    document.body.classList.toggle('theme-dark', isDark)
    broadcastTheme(isDark)
  }

  /* Taille du texte */
  function applyFontSize(size: 'sm' | 'md' | 'lg') {
    setFontSize(size)
    localStorage.setItem('fontSize', size)
    const map = { sm: '13px', md: '15px', lg: '17px' }
    document.documentElement.style.fontSize = map[size]
  }

  /* Accessibilité */
  function applyHighContrast(val: boolean) {
    setHighContrast(val)
    localStorage.setItem('highContrast', val ? '1' : '0')
    document.body.classList.toggle('high-contrast', val)
  }

  function applyReducedMotion(val: boolean) {
    setReducedMotion(val)
    localStorage.setItem('reducedMotion', val ? '1' : '0')
    document.body.classList.toggle('reduced-motion', val)
    // Injecter / retirer un style global pour prefers-reduced-motion
    const id = 'reduced-motion-style'
    if (val) {
      if (!document.getElementById(id)) {
        const s = document.createElement('style')
        s.id = id
        s.textContent = '*, *::before, *::after { animation-duration: 0ms !important; transition-duration: 0ms !important; }'
        document.head.appendChild(s)
      }
    } else {
      document.getElementById(id)?.remove()
    }
  }

  const TABS: { key: Tab; label: string; icon: string }[] = [
    { key: 'profil',        label: 'Mon profil',    icon: 'fa-user-edit' },
    { key: 'securite',      label: 'Sécurité',      icon: 'fa-lock' },
    { key: 'apparence',     label: 'Apparence',     icon: 'fa-paint-brush' },
    { key: 'accessibilite', label: 'Accessibilité', icon: 'fa-universal-access' },
  ]

  return (
    <div>
      <div className="page-header">
        <div>
          <h2><i className="fas fa-cog" style={{ marginRight: 10, color: 'var(--primary)' }} />Paramètres</h2>
          <p>Gérez votre compte, apparence et accessibilité</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* Menu onglets vertical */}
        <div className="card" style={{ minWidth: 200, flexShrink: 0, padding: 8 }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                padding: '10px 14px', marginBottom: 2,
                background: tab === t.key ? 'var(--primary)' : 'transparent',
                color: tab === t.key ? 'white' : 'var(--text)',
                border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14,
                fontWeight: tab === t.key ? 600 : 400, textAlign: 'left' }}>
              <i className={`fas ${t.icon}`} style={{ width: 16 }} />
              {t.label}
            </button>
          ))}
        </div>

        {/* Contenu */}
        <div style={{ flex: 1, minWidth: 300 }}>

          {/* ── Profil ───────────────────────────────────────────────────── */}
          {tab === 'profil' && (
            <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              {/* Carte avatar */}
              <div className="card" style={{ width: 240, flexShrink: 0, textAlign: 'center', padding: 28 }}>
                <div style={{ width: 80, height: 80, borderRadius: '50%', background: roleColors[profile?.role || user?.role || ''] || 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 32, color: 'white', fontWeight: 700 }}>
                  {(profile?.full_name || user?.full_name || 'U').charAt(0).toUpperCase()}
                </div>
                <h3 style={{ marginBottom: 4, fontSize: 16 }}>{profile?.full_name || user?.full_name}</h3>
                <div style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 12 }}>{profile?.email || user?.email}</div>
                <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, padding: '3px 12px', borderRadius: 12, background: roleColors[profile?.role || user?.role || ''] || 'var(--primary)', color: 'white', textTransform: 'uppercase' }}>
                  {roleLabels[profile?.role || user?.role || ''] || profile?.role || user?.role}
                </span>
                {profile?.formation_name && (
                  <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)' }}>
                    <i className="fas fa-university" /> {profile.formation_name}{profile.niveau ? ` · ${profile.niveau}` : ''}
                  </div>
                )}
                <div style={{ marginTop: 12 }}>
                  <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, padding: '3px 12px', borderRadius: 12, background: profile?.is_active !== false ? '#dcfce7' : '#fef2f2', color: profile?.is_active !== false ? '#059669' : '#dc2626' }}>
                    {profile?.is_active !== false ? 'Compte actif' : 'Compte inactif'}
                  </span>
                </div>
                {profile?.last_login && (
                  <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-muted)' }}>
                    Dernière connexion :<br />
                    {new Date(profile.last_login).toLocaleString('fr-FR')}
                  </div>
                )}
              </div>

              {/* Formulaire */}
              <div style={{ flex: 1, minWidth: 240 }}>
                <div className="card" style={{ padding: 28 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 24, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <i className="fas fa-user-edit" style={{ color: 'var(--primary)' }} /> Modifier le profil
                  </h3>
                  <form onSubmit={saveProfile}>
                    <Fg label="Nom complet" hint="Ce nom sera affiché sur vos copies et relevés">
                      <input value={fullName} onChange={e => setFullName(e.target.value)} required
                        placeholder="Votre nom complet" style={inputStyle} />
                    </Fg>

                    <Fg label="Adresse e-mail" hint="L'adresse e-mail ne peut pas être modifiée ici.">
                      <div style={{ position: 'relative' }}>
                        <i className="fas fa-lock" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: 13 }} />
                        <input value={email} disabled placeholder="Email" style={{ ...inputStyle, paddingLeft: 38, opacity: .55, cursor: 'not-allowed', background: 'var(--background)' }} />
                      </div>
                    </Fg>

                    <Fg label="Rôle" hint="Votre rôle est attribué par l'administrateur.">
                      <div style={{ position: 'relative' }}>
                        <i className="fas fa-id-badge" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: 13 }} />
                        <input value={roleLabels[profile?.role || user?.role || ''] || ''} disabled style={{ ...inputStyle, paddingLeft: 38, opacity: .55, cursor: 'not-allowed', background: 'var(--background)' }} />
                      </div>
                    </Fg>

                    <button type="submit" disabled={saving}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 24px', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: 9, fontSize: 14, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? .7 : 1 }}>
                      <i className={`fas ${saving ? 'fa-spinner fa-spin' : 'fa-save'}`} />
                      {saving ? 'Enregistrement…' : 'Enregistrer les modifications'}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          )}

          {/* ── Sécurité ─────────────────────────────────────────────────── */}
          {tab === 'securite' && (
            <div className="card" style={{ padding: 28 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 24, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <i className="fas fa-lock" style={{ color: 'var(--primary)' }} /> Changer le mot de passe
              </h3>
              <form onSubmit={changePassword}>
                <Fg label="Mot de passe actuel">
                  <div style={{ position: 'relative' }}>
                    <i className="fas fa-lock" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: 13 }} />
                    <input type={showPwds ? 'text' : 'password'} value={currentPwd}
                      onChange={e => setCurrentPwd(e.target.value)}
                      required autoComplete="current-password" placeholder="••••••••"
                      style={{ ...inputStyle, paddingLeft: 38, paddingRight: 44 }} />
                    <button type="button" onClick={() => setShowPwds(v => !v)}
                      style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
                      <i className={`fas ${showPwds ? 'fa-eye-slash' : 'fa-eye'}`} />
                    </button>
                  </div>
                </Fg>

                <Fg label="Nouveau mot de passe">
                  <div style={{ position: 'relative' }}>
                    <i className="fas fa-key" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: 13 }} />
                    <input type={showPwds ? 'text' : 'password'} value={newPwd}
                      onChange={e => setNewPwd(e.target.value)}
                      required autoComplete="new-password" minLength={6} placeholder="Minimum 6 caractères"
                      style={{ ...inputStyle, paddingLeft: 38 }} />
                  </div>
                  {newPwd.length > 0 && <PasswordStrength pwd={newPwd} />}
                </Fg>

                <Fg label="Confirmer le nouveau mot de passe">
                  <div style={{ position: 'relative' }}>
                    <i className={`fas ${confirmPwd && newPwd === confirmPwd ? 'fa-check-circle' : 'fa-lock'}`}
                      style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: confirmPwd && newPwd === confirmPwd ? '#10b981' : 'var(--text-muted)' }} />
                    <input type={showPwds ? 'text' : 'password'} value={confirmPwd}
                      onChange={e => setConfirmPwd(e.target.value)}
                      required autoComplete="new-password" placeholder="Répéter le nouveau mot de passe"
                      style={{ ...inputStyle, paddingLeft: 38, borderColor: confirmPwd ? (newPwd === confirmPwd ? '#10b981' : '#ef4444') : undefined }} />
                  </div>
                  {confirmPwd.length > 0 && newPwd !== confirmPwd && (
                    <div style={{ marginTop: 6, fontSize: 12, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <i className="fas fa-times-circle" /> Les mots de passe ne correspondent pas
                    </div>
                  )}
                  {confirmPwd.length > 0 && newPwd === confirmPwd && (
                    <div style={{ marginTop: 6, fontSize: 12, color: '#10b981', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <i className="fas fa-check-circle" /> Les mots de passe correspondent
                    </div>
                  )}
                </Fg>

                <div style={{ paddingTop: 8 }}>
                  <button type="submit" disabled={changingPwd || newPwd !== confirmPwd || !currentPwd}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 24px', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: 9, fontSize: 14, fontWeight: 600, cursor: changingPwd || newPwd !== confirmPwd || !currentPwd ? 'not-allowed' : 'pointer', opacity: changingPwd || newPwd !== confirmPwd || !currentPwd ? .6 : 1 }}>
                    <i className={`fas ${changingPwd ? 'fa-spinner fa-spin' : 'fa-key'}`} />
                    {changingPwd ? 'Modification…' : 'Changer le mot de passe'}
                  </button>
                </div>
              </form>

              <div style={{ marginTop: 28, paddingTop: 24, borderTop: '1px solid var(--border)' }}>
                <h4 style={{ marginBottom: 12, fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <i className="fas fa-shield-alt" style={{ color: 'var(--primary)' }} /> Conseils de sécurité
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    ['fa-check', 'Utilisez un mot de passe unique, jamais réutilisé ailleurs.'],
                    ['fa-check', 'Combinez majuscules, minuscules, chiffres et symboles.'],
                    ['fa-check', 'Ne partagez jamais vos identifiants.'],
                    ['fa-check', 'Déconnectez-vous sur les appareils partagés.'],
                  ].map(([icon, text]) => (
                    <div key={text} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, color: 'var(--text-muted)' }}>
                      <i className={`fas ${icon}`} style={{ color: '#10b981', marginTop: 2, flexShrink: 0 }} />
                      {text}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Apparence ────────────────────────────────────────────────── */}
          {tab === 'apparence' && (
            <div className="card">
              <h3 className="card-title"><i className="fas fa-paint-brush" /> Apparence</h3>

              <div style={{ marginBottom: 28 }}>
                <label style={{ fontWeight: 600, display: 'block', marginBottom: 12, fontSize: 14 }}>Thème</label>
                <div style={{ display: 'flex', gap: 12 }}>
                  {[
                    { val: false, icon: 'fa-sun',  label: 'Mode clair',  desc: 'Interface claire par défaut' },
                    { val: true,  icon: 'fa-moon', label: 'Mode sombre', desc: 'Réduit la fatigue oculaire' },
                  ].map(opt => (
                    <button key={String(opt.val)} onClick={() => applyTheme(opt.val)}
                      style={{ flex: 1, padding: '18px 12px',
                        border: `2px solid ${dark === opt.val ? 'var(--primary)' : 'var(--border)'}`,
                        borderRadius: 12,
                        background: dark === opt.val ? 'var(--primary)15' : 'var(--background)',
                        cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s' }}>
                      <i className={`fas ${opt.icon}`} style={{ fontSize: 26,
                        color: dark === opt.val ? 'var(--primary)' : 'var(--text-muted)',
                        display: 'block', marginBottom: 8 }} />
                      <div style={{ fontWeight: 600, fontSize: 14,
                        color: dark === opt.val ? 'var(--primary)' : 'var(--text)' }}>{opt.label}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{opt.desc}</div>
                      {dark === opt.val && (
                        <div style={{ marginTop: 8 }}>
                          <i className="fas fa-check-circle" style={{ color: 'var(--primary)', fontSize: 16 }} />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ fontWeight: 600, display: 'block', marginBottom: 12, fontSize: 14 }}>Taille du texte</label>
                <div style={{ display: 'flex', gap: 12 }}>
                  {([
                    { val: 'sm' as const, label: 'Petit',  size: '13px', desc: 'Plus compact' },
                    { val: 'md' as const, label: 'Normal', size: '15px', desc: 'Recommandé' },
                    { val: 'lg' as const, label: 'Grand',  size: '17px', desc: 'Plus lisible' },
                  ]).map(opt => (
                    <button key={opt.val} onClick={() => applyFontSize(opt.val)}
                      style={{ flex: 1, padding: '14px 12px',
                        border: `2px solid ${fontSize === opt.val ? 'var(--primary)' : 'var(--border)'}`,
                        borderRadius: 12,
                        background: fontSize === opt.val ? 'var(--primary)15' : 'var(--background)',
                        cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s' }}>
                      <div style={{ fontSize: opt.size, fontWeight: 700,
                        color: fontSize === opt.val ? 'var(--primary)' : 'var(--text)', marginBottom: 4 }}>Aa</div>
                      <div style={{ fontSize: 13, fontWeight: 600,
                        color: fontSize === opt.val ? 'var(--primary)' : 'var(--text)' }}>{opt.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Accessibilité ────────────────────────────────────────────── */}
          {tab === 'accessibilite' && (
            <div className="card">
              <h3 className="card-title"><i className="fas fa-universal-access" /> Accessibilité</h3>

              <ToggleRow
                icon="fa-adjust"
                title="Contraste élevé"
                desc="Augmente le contraste des couleurs pour une meilleure lisibilité."
                checked={highContrast}
                onChange={applyHighContrast}
              />
              <ToggleRow
                icon="fa-wind"
                title="Réduire les animations"
                desc="Supprime les transitions et animations pour réduire les distractions visuelles."
                checked={reducedMotion}
                onChange={applyReducedMotion}
              />

              <div style={{ paddingTop: 20, marginTop: 8 }}>
                <h4 style={{ marginBottom: 12, fontSize: 15 }}>
                  <i className="fas fa-keyboard" style={{ marginRight: 8, color: 'var(--primary)' }} />
                  Raccourcis clavier
                </h4>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14 }}>
                  Ces raccourcis sont actifs sur toutes les pages du tableau de bord.
                </p>
                <table style={{ width: '100%', fontSize: 14, borderCollapse: 'separate', borderSpacing: '0 4px' }}>
                  <tbody>
                    {[
                      ['Alt + D', 'Aller au Dashboard'],
                      ['Alt + S', 'Ouvrir les Paramètres'],
                      ['Alt + N', 'Ouvrir les Notifications'],
                      ['Alt + L', 'Se déconnecter'],
                      ['Échap',   'Fermer les fenêtres modales'],
                    ].map(([key, desc]) => (
                      <tr key={key}>
                        <td style={{ padding: '5px 0', width: 130, verticalAlign: 'middle' }}>
                          <kbd style={{ background: 'var(--background)', border: '1px solid var(--border)',
                            borderRadius: 6, padding: '3px 10px', fontSize: 12,
                            fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{key}</kbd>
                        </td>
                        <td style={{ padding: '5px 0', color: 'var(--text-muted)', fontSize: 13 }}>{desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

/* Style commun pour les inputs */
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', fontSize: 14,
  background: 'var(--surface)', border: '1px solid var(--border)',
  borderRadius: 8, color: 'var(--text)', outline: 'none',
  boxSizing: 'border-box',
}

/* Groupe de champ : label + input + hint optionnel */
function Fg({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
        {label}
      </label>
      {children}
      {hint && <div style={{ marginTop: 5, fontSize: 12, color: 'var(--text-muted)' }}>{hint}</div>}
    </div>
  )
}

/* Barre de force du mot de passe */
function PasswordStrength({ pwd }: { pwd: string }) {
  let score = 0
  if (pwd.length >= 8)                      score++
  if (/[A-Z]/.test(pwd))                   score++
  if (/[0-9]/.test(pwd))                   score++
  if (/[^A-Za-z0-9]/.test(pwd))            score++

  const labels = ['Très faible', 'Faible', 'Moyen', 'Fort', 'Très fort']
  const colors = ['#ef4444', '#f97316', '#eab308', '#10b981', '#10b981']

  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
        {[0,1,2,3].map(i => (
          <div key={i} style={{ flex: 1, height: 4, borderRadius: 2,
            background: i < score ? colors[score - 1] : 'var(--border)',
            transition: 'background 0.2s' }} />
        ))}
      </div>
      <small style={{ fontSize: 12, color: score > 0 ? colors[score - 1] : 'var(--text-muted)' }}>
        {score > 0 ? labels[score - 1] : ''}
      </small>
    </div>
  )
}

/* Toggle switch */
function ToggleRow({ icon, title, desc, checked, onChange }: {
  icon: string; title: string; desc: string; checked: boolean; onChange: (v: boolean) => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '16px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <i className={`fas ${icon}`} style={{ color: 'var(--primary)', marginTop: 2, width: 18, fontSize: 15 }} />
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{title}</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>{desc}</div>
        </div>
      </div>
      <button onClick={() => onChange(!checked)}
        style={{ width: 48, height: 28, borderRadius: 14, border: 'none', cursor: 'pointer', flexShrink: 0,
          background: checked ? 'var(--primary)' : 'var(--border)',
          transition: 'background 0.2s', position: 'relative', outline: 'none' }}>
        <span style={{ position: 'absolute', top: 4, width: 20, height: 20, borderRadius: '50%',
          background: 'white', transition: 'left 0.2s', left: checked ? 24 : 4,
          display: 'block', boxShadow: '0 1px 4px rgba(0,0,0,0.25)' }} />
      </button>
    </div>
  )
}
