'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import api from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'

interface ProfDashboardAPI {
  my_subjects:      number
  papers_corrected: number
}

export default function ProfessorDashboard() {
  const { user } = useAuth()
  const { error } = useToast()
  const [data, setData]     = useState<ProfDashboardAPI | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, []) // eslint-disable-line

  async function load() {
    setLoading(true)
    try {
      const res = await api.get<ProfDashboardAPI>('/api/professor/dashboard')
      setData(res)
    } catch { error('Erreur de chargement') }
    finally { setLoading(false) }
  }

  return (
    <div>
      {/* ── Header ───────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
        <div style={{ background: '#3b82f6', width: 46, height: 46, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <i className="fas fa-chart-line" style={{ color: 'white', fontSize: 20 }} />
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>Tableau de bord</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>Bienvenue, <strong>{user?.full_name}</strong></p>
        </div>
      </div>

      {/* ── Stat tiles ───────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 28 }}>
        <StatTile
          icon="fa-book"
          label="Mes Sujets"
          value={loading ? '…' : (data?.my_subjects ?? 0)}
          color="#3b82f6"
          href="/dashboard/professor/subjects"
        />
        <StatTile
          icon="fa-check-circle"
          label="Copies Corrigées"
          value={loading ? '…' : (data?.papers_corrected ?? 0)}
          color="#10b981"
          href="/dashboard/professor/papers"
        />
      </div>

      {/* ── Actions rapides ──────────────────────────────────────────── */}
      <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)', overflow: 'hidden', marginBottom: 28 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <i className="fas fa-rocket" style={{ color: '#f59e0b' }} />
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Actions Rapides</h3>
        </div>
        <div style={{ padding: '20px', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          <Link href="/dashboard/professor/create-subject"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '13px 22px', background: '#3b82f6', color: 'white', borderRadius: 10, fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>
            <i className="fas fa-plus-circle" style={{ fontSize: 16 }} />
            Créer un Sujet
          </Link>
          <Link href="/dashboard/professor/papers"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '13px 22px', background: '#10b981', color: 'white', borderRadius: 10, fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>
            <i className="fas fa-pencil-alt" style={{ fontSize: 16 }} />
            Corriger des Copies
          </Link>
        </div>
      </div>

      {/* ── Liens rapides ────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
        {QUICK_LINKS.map(a => (
          <Link key={a.href} href={a.href} style={{ textDecoration: 'none' }}>
            <div
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '20px 14px', textAlign: 'center', cursor: 'pointer', transition: 'box-shadow .2s, transform .2s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 18px rgba(0,0,0,.1)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = 'none'; (e.currentTarget as HTMLElement).style.transform = 'translateY(0)' }}>
              <i className={`fas ${a.icon}`} style={{ fontSize: 26, color: a.color, marginBottom: 10, display: 'block' }} />
              <div style={{ color: a.color, fontWeight: 600, fontSize: 13 }}>{a.label}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

const QUICK_LINKS = [
  { href: '/dashboard/professor/exams',         icon: 'fa-laptop-code',  label: 'Examens en Ligne',   color: '#3b82f6' },
  { href: '/dashboard/professor/subjects',      icon: 'fa-book',         label: 'Mes Sujets',          color: '#3b82f6' },
  { href: '/dashboard/professor/questions',     icon: 'fa-database',     label: 'Banque Questions',    color: '#0891b2' },
  { href: '/dashboard/professor/analytics',     icon: 'fa-chart-bar',    label: 'Résultats',           color: '#10b981' },
  { href: '/dashboard/professor/reclamations',  icon: 'fa-exclamation-triangle', label: 'Réclamations', color: '#f59e0b' },
  { href: '/dashboard/professor/notifications', icon: 'fa-bell',         label: 'Notifications',       color: '#64748b' },
]

function StatTile({ icon, label, value, color, href }: { icon: string; label: string; value: string | number; color: string; href: string }) {
  return (
    <Link href={href} style={{ textDecoration: 'none' }}>
      <div style={{ background: 'var(--surface)', border: `1px solid var(--border)`, borderRadius: 14, padding: '22px 20px', display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer', transition: 'box-shadow .2s, transform .2s', borderTop: `4px solid ${color}` }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 18px rgba(0,0,0,.1)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)' }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = 'none'; (e.currentTarget as HTMLElement).style.transform = 'translateY(0)' }}>
        <div style={{ width: 48, height: 48, background: `${color}15`, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <i className={`fas ${icon}`} style={{ color, fontSize: 20 }} />
        </div>
        <div>
          <div style={{ fontSize: 32, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
          <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>{label}</div>
        </div>
      </div>
    </Link>
  )
}
