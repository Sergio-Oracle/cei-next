'use client'

import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'

interface Notification {
  id: number
  type: string
  title?: string
  message: string
  is_read: boolean
  created_at: string
}

export default function ProfessorNotificationsPage() {
  const { success, error } = useToast()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const res = await api.get<any>('/api/notifications')
      const list = Array.isArray(res) ? res : (res.notifications ?? [])
      setNotifications(list)
    } catch { error('Erreur de chargement') }
    finally { setLoading(false) }
  }

  async function markAllRead() {
    try {
      await api.put('/api/notifications/mark-read', {})
      success('Toutes les notifications marquées comme lues')
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    } catch (e: any) { error(e.message || 'Erreur') }
  }

  const unread = notifications.filter(n => !n.is_read).length

  return (
    <div>
      <div className="page-header">
        <div>
          <h2><i className="fas fa-bell" style={{ marginRight: 10, color: 'var(--primary)' }} />Notifications</h2>
          <p>{unread > 0 ? `${unread} non lue(s)` : 'Toutes lues'}</p>
        </div>
        {unread > 0 && (
          <button className="btn btn-secondary" onClick={markAllRead}>
            <i className="fas fa-check-double" /> Tout marquer lu
          </button>
        )}
      </div>

      <div className="card">
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}><i className="fas fa-spinner fa-spin" style={{ fontSize: 24 }} /></div>
        ) : notifications.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <i className="fas fa-bell-slash" style={{ fontSize: 40, color: 'var(--text-muted)', display: 'block', marginBottom: 12 }} />
            <p style={{ color: 'var(--text-muted)' }}>Aucune notification</p>
          </div>
        ) : notifications.map(n => (
          <div key={n.id} style={{ display: 'flex', gap: 12, padding: '14px 24px', borderBottom: '1px solid var(--border)', background: n.is_read ? 'transparent' : 'var(--primary)' + '08' }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: n.is_read ? 'var(--background)' : 'var(--primary)' + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <i className="fas fa-bell" style={{ color: n.is_read ? 'var(--text-muted)' : 'var(--primary)', fontSize: 14 }} />
            </div>
            <div style={{ flex: 1 }}>
              {n.title && <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{n.title}</div>}
              <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>{n.message}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{new Date(n.created_at).toLocaleString('fr-FR')}</div>
            </div>
            {!n.is_read && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--primary)', flexShrink: 0, marginTop: 4 }} />}
          </div>
        ))}
      </div>
    </div>
  )
}
