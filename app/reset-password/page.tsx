'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import api from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'

function ResetPasswordInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') || ''
  const { success, error } = useToast()

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!token) { error('Lien invalide ou incomplet'); return }
    if (password.length < 8) { error('Le mot de passe doit contenir au moins 8 caractères'); return }
    if (password !== confirm) { error('Les mots de passe ne correspondent pas'); return }
    setSubmitting(true)
    try {
      await api.post('/api/auth/reset-password', { token, new_password: password })
      setDone(true)
      success('Mot de passe mis à jour avec succès')
    } catch (e: any) {
      error(e.message || 'Erreur lors de la réinitialisation')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--background)', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 64, height: 64, background: 'var(--primary)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <i className="fa-solid fa-key" style={{ fontSize: 31, color: 'white' }} />
          </div>
          <h1 style={{ fontSize: 26.5, fontWeight: 700, marginBottom: 4 }}>Réinitialiser le mot de passe</h1>
          <p style={{ color: 'var(--text-muted)' }}>CEI – Centre d'Examen Intelligent</p>
        </div>

        <div className="card" style={{ padding: 32 }}>
          {!token ? (
            <div style={{ textAlign: 'center' }}>
              <i className="fa-solid fa-circle-exclamation" style={{ fontSize: 53, color: 'var(--danger)', marginBottom: 16, display: 'block' }} />
              <h3 style={{ marginBottom: 8 }}>Lien invalide</h3>
              <p style={{ color: 'var(--text-muted)', marginBottom: 24, fontSize: 17 }}>
                Ce lien de réinitialisation est incomplet ou invalide. Faites une nouvelle demande.
              </p>
              <Link href="/forgot-password" className="btn btn-primary btn-block">
                <i className="fa-solid fa-arrow-left" /> Nouvelle demande
              </Link>
            </div>
          ) : done ? (
            <div style={{ textAlign: 'center' }}>
              <i className="fa-solid fa-circle-check" style={{ fontSize: 53, color: 'var(--success)', marginBottom: 16, display: 'block' }} />
              <h3 style={{ marginBottom: 8 }}>Mot de passe mis à jour !</h3>
              <p style={{ color: 'var(--text-muted)', marginBottom: 24, fontSize: 17 }}>
                Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.
              </p>
              <button className="btn btn-primary btn-block" onClick={() => router.push('/login')}>
                <i className="fa-solid fa-right-to-bracket" /> Se connecter
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <p style={{ color: 'var(--text-muted)', marginBottom: 24, fontSize: 17 }}>
                Choisissez un nouveau mot de passe pour votre compte.
              </p>

              <div className="form-group">
                <label>Nouveau mot de passe</label>
                <div style={{ position: 'relative' }}>
                  <i className="fa-solid fa-lock" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="password"
                    className="form-control"
                    style={{ paddingLeft: 36 }}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Au moins 8 caractères"
                    autoFocus
                    autoComplete="new-password"
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Confirmer le mot de passe</label>
                <div style={{ position: 'relative' }}>
                  <i className="fa-solid fa-lock" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="password"
                    className="form-control"
                    style={{ paddingLeft: 36 }}
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    placeholder="Retapez le mot de passe"
                    autoComplete="new-password"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-block"
                style={{ marginTop: 8 }}
                disabled={submitting}
              >
                {submitting
                  ? <><i className="fa-solid fa-spinner spin" /> Mise à jour...</>
                  : <><i className="fa-solid fa-check" /> Réinitialiser le mot de passe</>
                }
              </button>

              <div style={{ textAlign: 'center', marginTop: 16 }}>
                <Link href="/login" style={{ color: 'var(--primary)', fontSize: 17 }}>
                  <i className="fa-solid fa-arrow-left" /> Retour à la connexion
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordInner />
    </Suspense>
  )
}
