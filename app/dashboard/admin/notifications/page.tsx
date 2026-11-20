'use client'

import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'
import { errMsg } from '@/lib/errors'

interface Notification {
  id: string | number
  type: string
  title?: string
  message: string
  is_read: boolean
  created_at: string
}

export default function AdminNotificationsPage() {
  const { success, error } = useToast()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      const res = await api.get<any>('/api/notifications')
      setNotifications(Array.isArray(res) ? res : (res.notifications ?? []))
    } catch { error('Erreur de chargement') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  async function markAllRead() {
    try {
      await api.put('/api/notifications/mark-read', {})
      success('Toutes les notifications marquées comme lues')
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
      window.dispatchEvent(new CustomEvent('cei:notifications-read'))
    } catch (e: unknown) { error(errMsg(e) || 'Erreur') }
  }

  // Suppression définitive de l'historique de CET utilisateur seulement (les autres comptes gardent le leur) — même route que la page de l'enseignant.
  async function remove(ids: Array<string | number> | 'all', confirmText?: string) {
    if (confirmText && !confirm(confirmText)) return
    const all = ids === 'all'
    setDeleting(all ? '*' : String(ids[0]))
    try {
      await api.post('/api/notifications/dismiss', all ? { all: true } : { ids: ids.map(String) })
      const gone = new Set(all ? [] : ids.map(String))
      setNotifications(prev => all ? [] : prev.filter(n => !gone.has(String(n.id))))
      window.dispatchEvent(new CustomEvent('cei:notifications-read'))
      success(all ? 'Toutes les notifications ont été supprimées' : 'Notification supprimée')
    } catch (e: unknown) { error(errMsg(e) || "Échec — la suppression n'a pas été faite") }
    finally { setDeleting(null) }
  }

  const unread = notifications.filter(n => !n.is_read).length
  const readOnes = notifications.filter(n => n.is_read)

  return (
    <div>
      <div className="page-header">
        <div>
          <h2><i className="fas fa-bell" style={{ marginRight: 10, color: 'var(--primary)' }} />Notifications</h2>
          <p>{unread > 0 ? `${unread} non lue(s)` : 'Toutes lues'}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {unread > 0 && (
            <button className="btn btn-secondary" onClick={markAllRead}>
              <i className="fas fa-check-double" /> Tout marquer lu
            </button>
          )}
          {readOnes.length > 0 && readOnes.length < notifications.length && (
            <button className="btn btn-secondary" disabled={deleting !== null}
              onClick={() => remove(readOnes.map(n => n.id), `Supprimer les ${readOnes.length} notification(s) déjà lue(s) ? Cette action est définitive.`)}>
              <i className="fas fa-broom" /> Supprimer les lues
            </button>
          )}
          {notifications.length > 0 && (
            <button className="btn btn-danger" disabled={deleting !== null}
              onClick={() => remove('all', `Supprimer définitivement les ${notifications.length} notification(s) ? Cette action est irréversible.`)}>
              <i className={`fas ${deleting === '*' ? 'fa-spinner fa-spin' : 'fa-trash'}`} /> Tout supprimer
            </button>
          )}
        </div>
      </div>
      <div className="card">
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}><i className="fas fa-spinner fa-spin" style={{ fontSize: 26 }} /></div>
        ) : notifications.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <i className="fas fa-bell-slash" style={{ fontSize: 44, color: 'var(--text-muted)', display: 'block', marginBottom: 12 }} />
            <p style={{ color: 'var(--text-muted)' }}>Aucune notification</p>
          </div>
        ) : notifications.map(n => (
          <div key={n.id} style={{ display: 'flex', gap: 12, padding: '14px 24px',
            borderBottom: '1px solid var(--border)',
            background: n.is_read ? 'transparent' : 'var(--primary)08' }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%',
              background: n.is_read ? 'var(--background)' : 'var(--primary)20',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <i className="fas fa-bell" style={{ color: n.is_read ? 'var(--text-muted)' : 'var(--primary)', fontSize: 17 }} />
            </div>
            <div style={{ flex: 1 }}>
              {n.title && <div style={{ fontWeight: 600, fontSize:17, marginBottom: 2 }}>{n.title}</div>}
              <div style={{ fontSize:17, color: 'var(--text-muted)' }}>{n.message}</div>
              <div style={{ fontSize:14.5, color: 'var(--text-muted)', marginTop: 4 }}>
                {new Date(n.created_at).toLocaleString('fr-FR')}
              </div>
            </div>
            {!n.is_read && <div style={{ width: 8, height: 8, borderRadius: '50%',
              background: 'var(--primary)', flexShrink: 0, marginTop: 6 }} />}
            <button onClick={() => remove([n.id])} disabled={deleting !== null} title="Supprimer cette notification" aria-label="Supprimer cette notification"
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: deleting ? 'not-allowed' : 'pointer', padding: 6, borderRadius: 6, alignSelf: 'flex-start', fontSize: 16 }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#ef4444' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)' }}>
              <i className={`fas ${deleting === String(n.id) ? 'fa-spinner fa-spin' : 'fa-times'}`} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
