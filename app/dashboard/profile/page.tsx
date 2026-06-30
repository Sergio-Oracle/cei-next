'use client'

import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import type { User } from '@/types'

export default function ProfilePage() {
  const { user, updateUser } = useAuth()
  const { success, error } = useToast()
  const [profile, setProfile] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [profileForm, setProfileForm] = useState({ full_name: '', email: '' })
  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', confirm_password: '' })
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingPw, setSavingPw] = useState(false)
  const [tab, setTab] = useState<'profile' | 'password'>('profile')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const res = await api.get<User | { user: User }>('/api/auth/me')
      const u = (res as any).user ?? res as User
      setProfile(u)
      setProfileForm({ full_name: u.full_name, email: u.email })
    } catch { error('Erreur de chargement') }
    finally { setLoading(false) }
  }

  async function saveProfile() {
    if (!profileForm.full_name.trim()) { error('Le nom est requis'); return }
    setSavingProfile(true)
    try {
      await api.put('/api/profile', profileForm)
      updateUser(profileForm)
      success('Profil mis à jour')
    } catch (e: any) { error(e.message || 'Erreur') }
    finally { setSavingProfile(false) }
  }

  async function savePassword() {
    if (!pwForm.current_password || !pwForm.new_password) { error('Tous les champs sont requis'); return }
    if (pwForm.new_password !== pwForm.confirm_password) { error('Les mots de passe ne correspondent pas'); return }
    if (pwForm.new_password.length < 6) { error('Le mot de passe doit faire au moins 6 caractères'); return }
    setSavingPw(true)
    try {
      await api.put('/api/profile/password', {
        current_password: pwForm.current_password,
        new_password: pwForm.new_password,
      })
      success('Mot de passe modifié')
      setPwForm({ current_password: '', new_password: '', confirm_password: '' })
    } catch (e: any) { error(e.message || 'Erreur') }
    finally { setSavingPw(false) }
  }

  const roleLabels: Record<string, string> = {
    admin: 'Administrateur', professor: 'Professeur', student: 'Étudiant', surveillant: 'Surveillant'
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 60 }}><i className="fa-solid fa-spinner spin" style={{ fontSize: 32 }} /></div>
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2><i className="fa-solid fa-user-circle" style={{ marginRight: 10, color: 'var(--primary)' }} />Mon profil</h2>
          <p>Gérez vos informations personnelles</p>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: '280px 1fr', alignItems: 'start' }}>
        {/* Avatar / Info card */}
        <div className="card" style={{ textAlign: 'center', padding: 32 }}>
          <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 32, color: 'white', fontWeight: 700 }}>
            {profile?.full_name.charAt(0).toUpperCase()}
          </div>
          <h3 style={{ marginBottom: 4 }}>{profile?.full_name}</h3>
          <div style={{ color: 'var(--text-muted)', marginBottom: 8 }}>{profile?.email}</div>
          <span className="status-badge info">{profile?.role ? roleLabels[profile.role] : '—'}</span>
          {profile?.formation_name && (
            <div style={{ marginTop: 12, fontSize: 13, color: 'var(--text-muted)' }}>
              <i className="fa-solid fa-building-columns" /> {profile.formation_name}
              {profile.niveau && ` · ${profile.niveau}`}
            </div>
          )}
          <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)' }}>
            <span className={`status-badge ${profile?.is_active ? 'success' : 'danger'}`}>{profile?.is_active ? 'Compte actif' : 'Compte inactif'}</span>
          </div>
          {profile?.last_login && (
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
              Dernière connexion : {new Date(profile.last_login).toLocaleString('fr-FR')}
            </div>
          )}
        </div>

        {/* Formulaires */}
        <div>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderBottom: '2px solid var(--border)' }}>
            {([
              { key: 'profile', label: 'Profil', icon: 'fa-user' },
              { key: 'password', label: 'Mot de passe', icon: 'fa-lock' },
            ] as const).map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                style={{
                  padding: '10px 24px', border: 'none', background: 'transparent',
                  borderBottom: tab === t.key ? '2px solid var(--primary)' : '2px solid transparent',
                  color: tab === t.key ? 'var(--primary)' : 'var(--text-muted)',
                  cursor: 'pointer', fontWeight: tab === t.key ? 600 : 400, marginBottom: -2,
                  transition: 'all 0.2s',
                }}
              >
                <i className={`fa-solid ${t.icon}`} style={{ marginRight: 6 }} /> {t.label}
              </button>
            ))}
          </div>

          {tab === 'profile' && (
            <div className="card">
              <div className="card-header"><h3><i className="fa-solid fa-user-pen" /> Modifier le profil</h3></div>
              <div style={{ padding: '0 24px 24px' }}>
                <div className="form-group">
                  <label>Nom complet</label>
                  <input className="form-control" value={profileForm.full_name} onChange={e => setProfileForm(p => ({ ...p, full_name: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Adresse email</label>
                  <input type="email" className="form-control" value={profileForm.email} onChange={e => setProfileForm(p => ({ ...p, email: e.target.value }))} />
                </div>
                <button className="btn btn-primary" onClick={saveProfile} disabled={savingProfile}>
                  {savingProfile ? <><i className="fa-solid fa-spinner spin" /> Enregistrement...</> : <><i className="fa-solid fa-check" /> Enregistrer</>}
                </button>
              </div>
            </div>
          )}

          {tab === 'password' && (
            <div className="card">
              <div className="card-header"><h3><i className="fa-solid fa-lock" /> Changer le mot de passe</h3></div>
              <div style={{ padding: '0 24px 24px' }}>
                <div className="form-group">
                  <label>Mot de passe actuel</label>
                  <input type="password" className="form-control" value={pwForm.current_password} onChange={e => setPwForm(p => ({ ...p, current_password: e.target.value }))} autoComplete="current-password" />
                </div>
                <div className="form-group">
                  <label>Nouveau mot de passe</label>
                  <input type="password" className="form-control" value={pwForm.new_password} onChange={e => setPwForm(p => ({ ...p, new_password: e.target.value }))} autoComplete="new-password" />
                </div>
                <div className="form-group">
                  <label>Confirmer le nouveau mot de passe</label>
                  <input type="password" className="form-control" value={pwForm.confirm_password} onChange={e => setPwForm(p => ({ ...p, confirm_password: e.target.value }))} autoComplete="new-password" />
                </div>
                {pwForm.new_password && pwForm.confirm_password && pwForm.new_password !== pwForm.confirm_password && (
                  <div className="alert alert-error" style={{ marginBottom: 12 }}>Les mots de passe ne correspondent pas</div>
                )}
                <button className="btn btn-primary" onClick={savePassword} disabled={savingPw}>
                  {savingPw ? <><i className="fa-solid fa-spinner spin" /> Modification...</> : <><i className="fa-solid fa-key" /> Changer le mot de passe</>}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
