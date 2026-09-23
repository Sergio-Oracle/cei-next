'use client'

import { useEffect, useState, useCallback } from 'react'
import api from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'

interface ApiClient {
  id: number
  name: string
  key_prefix: string
  allowed_roles: string[]
  is_active: boolean
  created_at?: string
  last_used_at?: string | null
  revoked_at?: string | null
}

const ROLE_META: Record<string, { label: string; color: string; bg: string }> = {
  professor:   { label: 'Professeur',  color: '#10b981', bg: '#d1fae5' },
  student:     { label: 'Étudiant',    color: '#3b82f6', bg: '#dbeafe' },
  surveillant: { label: 'Surveillant', color: '#f59e0b', bg: '#fef3c7' },
  superviseur: { label: 'Superviseur', color: '#0891b2', bg: '#cffafe' },
}
const ROLE_ORDER = ['professor', 'student', 'surveillant', 'superviseur']

function fmtDate(iso?: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })
}

export default function ApiClientsPage() {
  const { success, error } = useToast()

  const [clients, setClients] = useState<ApiClient[]>([])
  const [loading, setLoading] = useState(true)

  const [modal, setModal] = useState<'create' | null>(null)
  const [newName, setNewName] = useState('')
  const [newRoles, setNewRoles] = useState<Set<string>>(new Set())
  const [creating, setCreating] = useState(false)

  // Résultat de création — la clé brute ne sera plus jamais affichée après ça.
  const [revealedKey, setRevealedKey] = useState<{ name: string; key: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get<ApiClient[]>('/api/admin/api-clients')
      setClients(Array.isArray(res) ? res : [])
    } catch { error('Erreur chargement des clés API') }
    finally { setLoading(false) }
  }, []) // eslint-disable-line

  useEffect(() => { load() }, [load])

  function openCreate() {
    setNewName(''); setNewRoles(new Set()); setModal('create')
  }

  function toggleRole(role: string) {
    setNewRoles(prev => { const n = new Set(prev); n.has(role) ? n.delete(role) : n.add(role); return n })
  }

  async function createClient() {
    if (!newName.trim()) { error('Nom requis'); return }
    if (newRoles.size === 0) { error('Sélectionnez au moins un module (rôle)'); return }
    setCreating(true)
    try {
      const res = await api.post<{ api_client: ApiClient; api_key: string }>('/api/admin/api-clients', {
        name: newName.trim(),
        allowed_roles: [...newRoles],
      })
      setModal(null)
      setRevealedKey({ name: res.api_client.name, key: res.api_key })
      success('Clé API créée')
      load()
    } catch (e: any) { error(e.message || 'Erreur création') }
    finally { setCreating(false) }
  }

  async function toggleActive(c: ApiClient) {
    const verb = c.is_active ? 'révoquer' : 'réactiver'
    if (!confirm(`Confirmer : ${verb} la clé « ${c.name} » ?`)) return
    try {
      await api.put(`/api/admin/api-clients/${c.id}`, { is_active: !c.is_active })
      success(c.is_active ? 'Clé révoquée' : 'Clé réactivée')
      load()
    } catch (e: any) { error(e.message || 'Erreur') }
  }

  async function copyKey() {
    if (!revealedKey) return
    try {
      await navigator.clipboard.writeText(revealedKey.key)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { error('Impossible de copier — sélectionnez et copiez manuellement') }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>
            <i className="fas fa-key" style={{ marginRight: 10, color: 'var(--primary)' }} />
            Clés API — Intégration externe
          </h2>
          <p>Gérez les clés d'accès données aux intégrations externes (ex. ENT UNCHK) pour appeler l'API CEI par module de rôle. Voir la documentation sur <code>/api/docs/&lt;rôle&gt;</code>.</p>
        </div>
        <button className="btn btn-secondary" onClick={load}>
          <i className="fas fa-rotate" /> Actualiser
        </button>
      </div>

      <div style={{ marginBottom: 20 }}>
        <button className="btn btn-primary" onClick={openCreate}>
          <i className="fas fa-plus" /> Créer une clé API
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><i className="fas fa-spinner fa-spin" style={{ fontSize: 31, color: 'var(--primary)' }} /></div>
      ) : clients.length === 0 ? (
        <div className="empty-message" style={{ padding: '48px 20px' }}>
          <i className="fas fa-inbox" style={{ fontSize: 35, display: 'block', marginBottom: 10 }} />
          Aucune clé API créée
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>NOM</th>
                  <th>CLÉ</th>
                  <th>MODULES AUTORISÉS</th>
                  <th>STATUT</th>
                  <th>CRÉÉE LE</th>
                  <th>DERNIÈRE UTILISATION</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {clients.map(c => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 600 }}>{c.name}</td>
                    <td><code style={{ fontSize: 13.5 }}>{c.key_prefix}••••••••</code></td>
                    <td>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {c.allowed_roles.map(r => {
                          const m = ROLE_META[r] || { label: r, color: '#64748b', bg: '#f1f5f9' }
                          return (
                            <span key={r} style={{ fontSize: 12, fontWeight: 700, color: m.color, background: m.bg, borderRadius: 99, padding: '2px 8px' }}>
                              {m.label}
                            </span>
                          )
                        })}
                      </div>
                    </td>
                    <td>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 14.5, fontWeight: 600, color: c.is_active ? '#10b981' : '#ef4444' }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: c.is_active ? '#10b981' : '#ef4444', display: 'inline-block' }} />
                        {c.is_active ? 'Active' : 'Révoquée'}
                      </span>
                    </td>
                    <td style={{ fontSize: 14, color: 'var(--text-muted)' }}>{fmtDate(c.created_at)}</td>
                    <td style={{ fontSize: 14, color: 'var(--text-muted)' }}>{fmtDate(c.last_used_at)}</td>
                    <td>
                      <button onClick={() => toggleActive(c)}
                        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', fontSize: 14.5, borderRadius: 7, border: c.is_active ? '1px solid #fecaca' : '1px solid #a7f3d0', background: c.is_active ? '#fff1f2' : '#ecfdf5', cursor: 'pointer', color: c.is_active ? '#ef4444' : '#10b981' }}>
                        <i className={`fas ${c.is_active ? 'fa-ban' : 'fa-rotate-left'}`} /> {c.is_active ? 'Révoquer' : 'Réactiver'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══ Modal Créer ══ */}
      {modal === 'create' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setModal(null)}>
          <div className="card" style={{ padding: 0, width: '100%', maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <div className="card-header">
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                <i className="fas fa-key" style={{ color: 'var(--primary)' }} /> Créer une clé API
              </h3>
              <button onClick={() => setModal(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', fontSize: 20.5, cursor: 'pointer', color: 'var(--text-muted)' }}>
                <i className="fas fa-times" />
              </button>
            </div>
            <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: 15.5, fontWeight: 600, display: 'block', marginBottom: 6 }}>Nom (ex. « ENT UNCHK »)</label>
                <input className="form-control" value={newName} onChange={e => setNewName(e.target.value)} placeholder="ENT UNCHK" />
              </div>
              <div>
                <label style={{ fontSize: 15.5, fontWeight: 600, display: 'block', marginBottom: 8 }}>Modules autorisés</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {ROLE_ORDER.map(r => {
                    const m = ROLE_META[r]
                    return (
                      <label key={r} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8, cursor: 'pointer', border: '1.5px solid var(--border)' }}>
                        <input type="checkbox" checked={newRoles.has(r)} onChange={() => toggleRole(r)}
                          style={{ width: 15, height: 15, accentColor: 'var(--primary)' }} />
                        <span style={{ fontSize: 12, fontWeight: 700, color: m.color, background: m.bg, borderRadius: 99, padding: '2px 8px' }}>{m.label}</span>
                      </label>
                    )
                  })}
                </div>
                <p style={{ fontSize: 13.5, color: 'var(--text-muted)', margin: '6px 0 0' }}>
                  Admin n'est jamais proposé — ce module n'est pas exposé via l'API externe.
                </p>
              </div>
            </div>
            <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button className="btn btn-secondary" onClick={() => setModal(null)}>Annuler</button>
              <button className="btn btn-primary" onClick={createClient} disabled={creating}>
                <i className={`fas ${creating ? 'fa-spinner fa-spin' : 'fa-plus'}`} /> {creating ? 'Création…' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Révélation unique de la clé brute ══ */}
      {revealedKey && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div className="card" style={{ padding: 0, width: '100%', maxWidth: 520 }}>
            <div className="card-header">
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 10, color: '#10b981' }}>
                <i className="fas fa-circle-check" /> Clé « {revealedKey.name} » créée
              </h3>
            </div>
            <div style={{ padding: '16px 24px' }}>
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '12px 16px', marginBottom: 14, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <i className="fas fa-triangle-exclamation" style={{ color: '#f59e0b', fontSize: 18, marginTop: 2 }} />
                <p style={{ margin: 0, fontSize: 14.5, color: '#92400e' }}>
                  Cette clé ne sera <strong>plus jamais affichée</strong>. Copiez-la et transmettez-la à l'équipe d'intégration maintenant.
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <code style={{ flex: 1, fontSize: 14, background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', wordBreak: 'break-all' }}>
                  {revealedKey.key}
                </code>
                <button className="btn btn-secondary" onClick={copyKey} style={{ flexShrink: 0 }}>
                  <i className={`fas ${copied ? 'fa-check' : 'fa-copy'}`} /> {copied ? 'Copié' : 'Copier'}
                </button>
              </div>
              <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: '12px 0 0' }}>
                À utiliser dans l'en-tête <code>X-CEI-API-Key</code>, en plus du jeton d'authentification normal de l'utilisateur.
              </p>
            </div>
            <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-primary" onClick={() => setRevealedKey(null)}>J'ai copié la clé — Fermer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
