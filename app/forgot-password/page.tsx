'use client'

import { useState } from 'react'
import Link from 'next/link'
import api from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'

export default function ForgotPasswordPage() {
  const { success, error } = useToast()
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) { error('Veuillez entrer votre adresse email'); return }
    if (!email.includes('@')) { error('Adresse email invalide'); return }
    setSubmitting(true)
    try {
      await api.post('/api/auth/forgot-password', { email })
      setSent(true)
      success('Instructions envoyées par email')
    } catch (e: any) {
      error(e.message || 'Erreur lors de l\'envoi')
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
            <i className="fa-solid fa-lock" style={{ fontSize: 28, color: 'white' }} />
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Mot de passe oublié</h1>
          <p style={{ color: 'var(--text-muted)' }}>CEI – Centre d'Examen Intelligent</p>
        </div>

        <div className="card" style={{ padding: 32 }}>
          {sent ? (
            <div style={{ textAlign: 'center' }}>
              <i className="fa-solid fa-envelope-circle-check" style={{ fontSize: 48, color: 'var(--success)', marginBottom: 16, display: 'block' }} />
              <h3 style={{ marginBottom: 8 }}>Email envoyé !</h3>
              <p style={{ color: 'var(--text-muted)', marginBottom: 24, fontSize: 14 }}>
                Si un compte existe avec l'adresse <strong>{email}</strong>, vous recevrez un email avec les instructions de réinitialisation.
              </p>
              <Link href="/login" className="btn btn-primary btn-block">
                <i className="fa-solid fa-arrow-left" /> Retour à la connexion
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <p style={{ color: 'var(--text-muted)', marginBottom: 24, fontSize: 14 }}>
                Entrez votre adresse email et nous vous enverrons les instructions pour réinitialiser votre mot de passe.
              </p>

              <div className="form-group">
                <label>Adresse email</label>
                <div style={{ position: 'relative' }}>
                  <i className="fa-solid fa-envelope" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="email"
                    className="form-control"
                    style={{ paddingLeft: 36 }}
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="votre@email.com"
                    autoFocus
                    autoComplete="email"
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
                  ? <><i className="fa-solid fa-spinner spin" /> Envoi en cours...</>
                  : <><i className="fa-solid fa-paper-plane" /> Envoyer les instructions</>
                }
              </button>

              <div style={{ textAlign: 'center', marginTop: 16 }}>
                <Link href="/login" style={{ color: 'var(--primary)', fontSize: 14 }}>
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
