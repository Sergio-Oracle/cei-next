'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import api from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'
import type { AdminStats } from '@/types'

export default function AdminDashboard() {
  const { error } = useToast()
  const [stats, setStats]   = useState<AdminStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get<AdminStats>('/api/admin/dashboard')
      .then(s => setStats(s))
      .catch(() => error('Erreur chargement statistiques'))
      .finally(() => setLoading(false))
  }, [])

  const cards = stats ? [
    { label: 'Utilisateurs',    value: stats.total_users,           icon: 'fa-users',              color: '#3b82f6' },
    { label: 'Étudiants',       value: stats.total_students,        icon: 'fa-graduation-cap',     color: '#10b981' },
    { label: 'Professeurs',     value: stats.total_professors,      icon: 'fa-chalkboard-teacher', color: '#3b82f6' },
    { label: 'Surveillants',    value: stats.total_surveillants,    icon: 'fa-eye',                color: '#f59e0b' },
    { label: 'Sujets',          value: stats.total_subjects,        icon: 'fa-file-lines',         color: '#06b6d4' },
    { label: 'Copies totales',  value: stats.total_papers,          icon: 'fa-copy',               color: '#0891b2' },
    { label: 'Réclamations',    value: stats.pending_reclamations,  icon: 'fa-comment-exclamation',color: '#dc2626' },
    { label: 'Copies corrigées',value: stats.total_corrected_papers,icon: 'fa-check-circle',       color: '#ef4444' },
  ] : []

  return (
    <div>
      <div className="page-header">
        <h2><i className="fa-solid fa-gauge" style={{ marginRight: 10, color: 'var(--primary)' }} />Tableau de bord</h2>
        <p>Vue d'ensemble de la plateforme CEI</p>
      </div>

      {/* Stats */}
      <div className="grid">
        {loading
          ? Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="stat-card" style={{ borderColor: '#e2e8f0' }}>
                <div style={{ height: 20, background: '#f1f5f9', borderRadius: 4, marginBottom: 8 }} />
                <div style={{ height: 36, background: '#f1f5f9', borderRadius: 4 }} />
              </div>
            ))
          : cards.map((c, i) => (
              <div key={i} className="stat-card" style={{ borderColor: c.color }}>
                <div className="stat-label">
                  <i className={`fa-solid ${c.icon}`} style={{ color: c.color }} />
                  {c.label}
                </div>
                <div className="stat-value" style={{ color: c.color }}>{c.value?.toLocaleString()}</div>
              </div>
            ))
        }
      </div>

      {/* Actions rapides */}
      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', marginTop: 24 }}>
        <div className="card">
          <div className="card-header"><h3><i className="fa-solid fa-bolt" style={{ marginRight: 8, color: 'var(--warning)' }} />Actions rapides</h3></div>
          <div style={{ padding: '8px 0' }}>
            {[
              { href: '/dashboard/admin/users', icon: 'fa-user-plus', label: 'Ajouter un utilisateur', desc: 'Créer un compte étudiant, professeur ou surveillant' },
              { href: '/dashboard/admin/exams', icon: 'fa-plus-circle', label: 'Nouvel examen en ligne', desc: 'Créer et planifier un examen surveillé' },
              { href: '/dashboard/admin/subjects', icon: 'fa-file-circle-plus', label: 'Nouveau sujet', desc: 'Uploader ou générer un sujet avec l\'IA' },
              { href: '/dashboard/admin/formations', icon: 'fa-building-columns', label: 'Gérer les formations', desc: 'Maquette pédagogique Formation → Semestre → UE → EC' },
              { href: '/dashboard/admin/transcripts', icon: 'fa-scroll', label: 'Relevés de notes', desc: 'Générer et publier les transcripts LMD' },
              { href: '/dashboard/admin/security', icon: 'fa-shield-halved', label: 'Rapport de sécurité', desc: 'Incidents, fraudes et comportements suspects' },
            ].map((a, i) => (
              <Link key={i} href={a.href} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 24px', borderBottom: '1px solid var(--border)', textDecoration: 'none', transition: 'background 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--background)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <div style={{ width: 38, height: 38, background: 'var(--primary)' + '15', borderRadius: 'var(--radius)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <i className={`fa-solid ${a.icon}`} style={{ color: 'var(--primary)' }} />
                </div>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: 14 }}>{a.label}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>{a.desc}</div>
                </div>
                <i className="fa-solid fa-chevron-right" style={{ color: 'var(--border)', marginLeft: 'auto', fontSize: 12 }} />
              </Link>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h3><i className="fa-solid fa-circle-info" style={{ marginRight: 8, color: 'var(--info)' }} />Informations système</h3></div>
          <div style={{ padding: '0 24px' }}>
            {[
              { label: 'API Backend',      value: 'En ligne',   badge: 'success' },
              { label: 'Authentification', value: 'PASETO v4',  badge: 'info' },
              { label: 'IA',               value: 'Disponible', badge: 'success' },
              { label: 'Surveillance',     value: 'Active',     badge: 'success' },
              { label: 'Stockage',         value: 'Configuré',  badge: 'secondary' },
              { label: 'Version API',      value: 'v2.0',       badge: 'secondary' },
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--text-light)', fontSize: 14 }}>{item.label}</span>
                <span className={`status-badge ${item.badge}`}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
