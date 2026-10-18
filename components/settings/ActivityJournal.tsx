'use client'

/**
 * Journal d'activité des comptes à privilèges (administrateurs et responsables d'examen).
 *
 * Fonction DISCRÈTE : le bouton des Paramètres n'existe que pour le propriétaire et les personnes qu'il a
 * autorisées ; le serveur répond « introuvable » à tout autre compte — voir routes/audit.py.
 */
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import api from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'
import Pager from '@/components/ui/Pager'
import { useProgressive } from '@/lib/useProgressive'
import ShowMore from '@/components/ui/ShowMore'

interface Account {
  id: number; name: string; email: string; role: string; is_active: boolean
  last_login: string | null; last_seen: string | null; online: boolean
  actions_total: number; actions_today: number; failed_logins_24h: number
  last_action: { label: string; target_label: string | null; at: string; ip: string } | null
}
interface Row {
  id: number; created_at: string; user_id: number; user_name: string; user_email: string; role: string
  kind: string; label: string; method: string; path: string; status_code: number
  target_type: string | null; target_id: number | null; target_label: string | null
  ip: string; user_agent: string; details: Record<string, any> | null
}

const ROLE_LABEL: Record<string, string> = { admin: 'Administrateur', responsable_examen: "Responsable d'examen" }
const ROLE_COLOR: Record<string, string> = { admin: '#ef4444', responsable_examen: '#0d9488' }
const KIND: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  create:       { label: 'Création',     color: '#15803d', bg: '#dcfce7', icon: 'fa-plus' },
  update:       { label: 'Modification', color: '#1d4ed8', bg: '#dbeafe', icon: 'fa-pen' },
  delete:       { label: 'Suppression',  color: '#b91c1c', bg: '#fee2e2', icon: 'fa-trash' },
  read:         { label: 'Consultation', color: '#475569', bg: '#e2e8f0', icon: 'fa-eye' },
  login:        { label: 'Connexion',    color: '#15803d', bg: '#f0fdf4', icon: 'fa-right-to-bracket' },
  login_failed: { label: 'Connexion refusée', color: '#b91c1c', bg: '#fee2e2', icon: 'fa-ban' },
  logout:       { label: 'Déconnexion',  color: '#475569', bg: '#f1f5f9', icon: 'fa-right-from-bracket' },
  other:        { label: 'Autre',        color: '#475569', bg: '#f1f5f9', icon: 'fa-circle' },
}
const KIND_FILTERS: { value: string; label: string }[] = [
  { value: '', label: 'Toutes les actions' },
  { value: 'create', label: 'Créations' }, { value: 'update', label: 'Modifications' },
  { value: 'delete', label: 'Suppressions' }, { value: 'read', label: 'Consultations de données' },
  { value: 'login,logout,login_failed', label: 'Connexions' },
]

function ago(iso: string | null): string {
  if (!iso) return 'jamais'
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000))
  if (s < 60) return "à l'instant"
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`
  if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`
  return `il y a ${Math.floor(s / 86400)} j`
}
const when = (iso: string) => new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })

function statusChip(code: number) {
  if (code < 400) return { text: 'Réussi', color: '#15803d', bg: '#dcfce7' }
  if (code === 401 || code === 403) return { text: `Refusé (${code})`, color: '#b45309', bg: '#fef3c7' }
  if (code >= 500) return { text: `Erreur (${code})`, color: '#b91c1c', bg: '#fee2e2' }
  return { text: `Échec (${code})`, color: '#b45309', bg: '#fef3c7' }
}

interface Person { id: number; name: string; email: string; role: string; granted_at?: string; granted_by?: string }
const ROLE_NAME: Record<string, string> = { admin: 'Administrateur', responsable_examen: "Responsable d'examen", professor: 'Professeur', surveillant: 'Surveillant', superviseur: 'Superviseur' }

/** Réservé au propriétaire : qui d'autre peut consulter le journal. L'effet d'un retrait est immédiat. */
function AccessPanel() {
  const { success, error } = useToast()
  const [open, setOpen] = useState(false)
  const [owners, setOwners] = useState<Person[]>([])
  const [grants, setGrants] = useState<Person[]>([])
  const [q, setQ] = useState('')
  const [found, setFound] = useState<Person[]>([])
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const r = await api.get<{ owners: Person[]; grants: Person[] }>('/api/audit/grants')
      setOwners(r.owners); setGrants(r.grants)
    } catch (e: any) { error(e?.message || 'Chargement impossible') }
  }, [error])
  useEffect(() => { if (open) load() }, [open, load])
  useEffect(() => {
    if (!open || q.trim().length < 2) { setFound([]); return }
    const t = setTimeout(async () => {
      try { setFound((await api.get<{ candidates: Person[] }>(`/api/audit/candidates?q=${encodeURIComponent(q.trim())}`)).candidates) } catch { setFound([]) }
    }, 300)
    return () => clearTimeout(t)
  }, [q, open, grants])

  async function grant(p: Person) {
    setBusy(true)
    try { await api.post('/api/audit/grants', { user_id: p.id }); success(`${p.name} peut maintenant consulter le journal`); setQ(''); await load() }
    catch (e: any) { error(e?.message || 'Opération impossible') } finally { setBusy(false) }
  }
  async function revoke(p: Person) {
    if (!confirm(`Retirer l'accès au journal à ${p.name} ? Son bouton disparaît immédiatement.`)) return
    setBusy(true)
    try { await api.delete(`/api/audit/grants/${p.id}`); success(`Accès retiré à ${p.name}`); await load() }
    catch (e: any) { error(e?.message || 'Opération impossible') } finally { setBusy(false) }
  }

  return (
    <div className="card" style={{ marginBottom: 20, padding: 0 }}>
      <button onClick={() => setOpen(o => !o)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', textAlign: 'left' }}>
        <i className="fas fa-user-lock" style={{ color: 'var(--primary)' }} />
        <strong style={{ fontSize: 16 }}>Accès au journal</strong>
        <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>— vous décidez qui peut le consulter</span>
        <i className={`fas fa-chevron-${open ? 'up' : 'down'}`} style={{ marginLeft: 'auto', color: 'var(--text-muted)' }} />
      </button>
      {open && (
        <div style={{ padding: '4px 18px 18px', borderTop: '1px solid var(--border)' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: '12px 0' }}>
            Une personne autorisée voit le bouton « Journal d&apos;activité » dans ses Paramètres et consulte toutes les traces. Elle ne peut pas donner l&apos;accès à d&apos;autres. Ses ouvertures du journal sont elles-mêmes tracées.
          </p>
          {owners.map(o => (
            <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ flex: 1 }}><strong>{o.name}</strong> <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>{o.email}</span></div>
              <span style={{ fontSize: 13, fontWeight: 700, padding: '2px 10px', borderRadius: 10, background: '#dbeafe', color: '#1d4ed8' }}>Propriétaire</span>
            </div>
          ))}
          {grants.map(g => (
            <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 220 }}>
                <strong>{g.name}</strong> <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>{g.email} · {ROLE_NAME[g.role] || g.role}</span>
                <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Autorisé{g.granted_by ? ` par ${g.granted_by}` : ''}{g.granted_at ? ` le ${new Date(g.granted_at).toLocaleDateString('fr-FR')}` : ''}</div>
              </div>
              <button disabled={busy} onClick={() => revoke(g)} className="btn" style={{ color: '#b91c1c', background: 'transparent', border: '1px solid #fca5a5' }}><i className="fas fa-user-minus" /> Retirer</button>
            </div>
          ))}
          {grants.length === 0 && <div style={{ padding: '10px 0', color: 'var(--text-muted)', fontSize: 14 }}>Personne d&apos;autre n&apos;a accès pour le moment.</div>}
          <div style={{ marginTop: 14 }}>
            <label style={{ fontSize: 14, fontWeight: 600 }}>Autoriser une personne</label>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Tapez un nom ou une adresse e-mail (2 lettres minimum)…"
              style={{ width: '100%', marginTop: 6, padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', fontSize: 15 }} />
            {found.map(p => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 4px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ flex: 1 }}><strong>{p.name}</strong> <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>{p.email} · {ROLE_NAME[p.role] || p.role}</span></div>
                <button disabled={busy} onClick={() => grant(p)} className="btn btn-primary"><i className="fas fa-user-plus" /> Autoriser</button>
              </div>
            ))}
            {q.trim().length >= 2 && found.length === 0 && <div style={{ padding: '8px 4px', color: 'var(--text-muted)', fontSize: 14 }}>Aucune personne trouvée (les étudiants ne peuvent pas être autorisés).</div>}
          </div>
        </div>
      )}
    </div>
  )
}

export default function ActivityJournal() {
  const { error } = useToast()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [onlineCount, setOnlineCount] = useState(0)
  const [rows, setRows] = useState<Row[]>([])
  const rows_pg = useProgressive(rows)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<number | null>(null)
  const [kind, setKind] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [q, setQ] = useState('')
  const [failures, setFailures] = useState(false)
  const [live, setLive] = useState(true)
  const [open, setOpen] = useState<number | null>(null)
  const [isOwner, setIsOwner] = useState(false)

  const qs = useMemo(() => {
    const p = new URLSearchParams()
    if (userId) p.set('user_id', String(userId))
    if (kind) p.set('kind', kind)
    if (from) p.set('date_from', from)
    if (to) p.set('date_to', to)
    if (q.trim()) p.set('q', q.trim())
    if (failures) p.set('failures', '1')
    return p
  }, [userId, kind, from, to, q, failures])

  const loadAccounts = useCallback(async () => {
    try {
      const r = await api.get<{ accounts: Account[]; online: number }>('/api/audit/accounts')
      setAccounts(r.accounts); setOnlineCount(r.online)
    } catch (e: any) { error(e?.message || 'Chargement impossible') }
  }, [error])

  const loadRows = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const p = new URLSearchParams(qs); p.set('page', String(page)); p.set('limit', '25')
      const r = await api.get<{ rows: Row[]; total: number; total_pages: number }>(`/api/audit/activity?${p.toString()}`)
      setRows(r.rows); setTotal(r.total); setPages(r.total_pages)
    } catch (e: any) { if (!silent) error(e?.message || 'Chargement impossible') }
    finally { setLoading(false) }
  }, [qs, page, error])

  useEffect(() => { api.get<{ owner: boolean }>('/api/audit/access').then(r => setIsOwner(!!r.owner)).catch(() => {}) }, [])
  useEffect(() => { loadAccounts() }, [loadAccounts])
  useEffect(() => { setPage(1) }, [qs])
  useEffect(() => { loadRows() }, [loadRows])
  useEffect(() => {
    if (!live) return
    const t = setInterval(() => { loadAccounts(); if (page === 1) loadRows(true) }, 15000)
    return () => clearInterval(t)
  }, [live, loadAccounts, loadRows, page])

  async function exportCsv() {
    try {
      const blob = await api.blob(`/api/audit/export?${qs.toString()}`)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `journal_activite_${new Date().toISOString().slice(0, 10)}.csv`; a.click()
      URL.revokeObjectURL(url)
    } catch (e: any) { error(e?.message || 'Export impossible') }
  }

  const sel = accounts.find(a => a.id === userId)
  const inp: React.CSSProperties = { padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', fontSize: 15 }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 21 }}><i className="fas fa-clipboard-list" style={{ marginRight: 10, color: 'var(--primary)' }} />Journal d&apos;activité</h3>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 15 }}>
            Ce que font les administrateurs et les responsables d&apos;examen sur la plateforme. Les traces ne peuvent être ni modifiées ni supprimées.
          </p>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: 'var(--text-muted)', cursor: 'pointer' }}>
          <input type="checkbox" checked={live} onChange={e => setLive(e.target.checked)} /> Actualisation automatique
        </label>
      </div>

      {isOwner && <AccessPanel />}

      {/* Comptes */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <strong style={{ fontSize: 16 }}>Comptes</strong>
        <span style={{ fontSize: 13, fontWeight: 700, padding: '2px 10px', borderRadius: 12, background: onlineCount ? '#dcfce7' : '#f1f5f9', color: onlineCount ? '#15803d' : '#64748b' }}>
          {onlineCount} en ligne
        </span>
        {userId && <button onClick={() => setUserId(null)} className="btn btn-secondary" style={{ marginLeft: 'auto', fontSize: 14 }}>Voir tous les comptes</button>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 12, marginBottom: 22 }}>
        {accounts.map(a => (
          <button key={a.id} onClick={() => setUserId(userId === a.id ? null : a.id)}
            style={{ textAlign: 'left', padding: 14, borderRadius: 12, cursor: 'pointer', background: 'var(--surface)', color: 'var(--text)',
              border: userId === a.id ? '2px solid var(--primary)' : '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 38, height: 38, borderRadius: '50%', background: ROLE_COLOR[a.role] || '#64748b', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                {(a.name || '?').charAt(0).toUpperCase()}
              </span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.email}</div>
              </div>
              <span title={a.online ? 'En ligne' : `Vu ${ago(a.last_seen)}`} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 700, color: a.online ? '#15803d' : '#94a3b8' }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: a.online ? '#22c55e' : '#cbd5e1' }} />{a.online ? 'En ligne' : 'Hors ligne'}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, padding: '2px 9px', borderRadius: 10, background: ROLE_COLOR[a.role] || '#64748b', color: '#fff' }}>{ROLE_LABEL[a.role] || a.role}</span>
              {!a.is_active && <span style={{ fontSize: 12.5, fontWeight: 700, padding: '2px 9px', borderRadius: 10, background: '#fee2e2', color: '#b91c1c' }}>Compte désactivé</span>}
              {a.failed_logins_24h > 0 && <span style={{ fontSize: 12.5, fontWeight: 700, padding: '2px 9px', borderRadius: 10, background: '#fef3c7', color: '#b45309' }}>{a.failed_logins_24h} connexion(s) refusée(s) / 24 h</span>}
            </div>
            <div style={{ display: 'flex', gap: 18, marginTop: 10, fontSize: 14 }}>
              <span><strong>{a.actions_today}</strong> action(s) aujourd&apos;hui</span>
              <span style={{ color: 'var(--text-muted)' }}><strong>{a.actions_total}</strong> au total</span>
            </div>
            <div style={{ marginTop: 8, fontSize: 13.5, color: 'var(--text-muted)' }}>
              {a.last_action
                ? <>Dernière action : <strong style={{ color: 'var(--text)' }}>{a.last_action.label}</strong>{a.last_action.target_label ? ` — ${a.last_action.target_label}` : ''} · {ago(a.last_action.at)}</>
                : 'Aucune action enregistrée'}
            </div>
            <div style={{ marginTop: 4, fontSize: 12.5, color: 'var(--text-muted)' }}>
              Dernière connexion : {a.last_login ? when(a.last_login) : '—'}{a.last_action?.ip ? ` · ${a.last_action.ip}` : ''}
            </div>
          </button>
        ))}
        {accounts.length === 0 && <div style={{ color: 'var(--text-muted)' }}>Chargement…</div>}
      </div>

      {/* Filtres */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
        <select value={kind} onChange={e => setKind(e.target.value)} style={inp}>
          {KIND_FILTERS.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, color: 'var(--text-muted)' }}>Du <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={inp} /></label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, color: 'var(--text-muted)' }}>au <input type="date" value={to} onChange={e => setTo(e.target.value)} style={inp} /></label>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher (examen, sujet, compte, texte…)" style={{ ...inp, flex: 1, minWidth: 220 }} />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, cursor: 'pointer' }}>
          <input type="checkbox" checked={failures} onChange={e => setFailures(e.target.checked)} /> Refus et échecs seulement
        </label>
        <button onClick={exportCsv} className="btn btn-secondary"><i className="fas fa-file-csv" /> Exporter (CSV)</button>
      </div>

      <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 8 }}>
        {total.toLocaleString('fr-FR')} trace(s){sel ? ` pour ${sel.name}` : ''} · heures affichées dans votre fuseau
      </div>

      {/* Journal */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="table" style={{ width: '100%' }}>
            <thead><tr><th>Date et heure</th><th>Compte</th><th>Action</th><th>Concerne</th><th>Résultat</th><th>Adresse IP</th></tr></thead>
            <tbody>
              {loading && rows.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', padding: 28 }}><i className="fas fa-spinner fa-spin" /></td></tr>}
              {!loading && rows.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', padding: 28, color: 'var(--text-muted)' }}>Aucune trace pour ces critères.</td></tr>}
              {rows_pg.shown.map(r => {
                const k = KIND[r.kind] || KIND.other
                const st = statusChip(r.status_code)
                const hasDetails = r.details && Object.keys(r.details).length > 0
                return (
                  <Fragment key={r.id}>
                    <tr onClick={() => setOpen(open === r.id ? null : r.id)} style={{ cursor: 'pointer' }}>
                      <td style={{ whiteSpace: 'nowrap' }}>{when(r.created_at)}</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{r.user_name}</div>
                        <div style={{ fontSize: 12.5, color: ROLE_COLOR[r.role] || '#64748b', fontWeight: 600 }}>{ROLE_LABEL[r.role] || r.role}</div>
                      </td>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, padding: '2px 9px', borderRadius: 10, background: k.bg, color: k.color, marginRight: 8 }}>
                          <i className={`fas ${k.icon}`} style={{ fontSize: 11 }} />{k.label}
                        </span>
                        {r.label}
                      </td>
                      <td style={{ maxWidth: 320 }}>{r.target_label || (r.target_id ? `n° ${r.target_id}` : '—')}</td>
                      <td><span style={{ fontSize: 13, fontWeight: 700, padding: '2px 9px', borderRadius: 10, background: st.bg, color: st.color }}>{st.text}</span></td>
                      <td style={{ whiteSpace: 'nowrap', fontFamily: 'monospace', fontSize: 13.5 }}>{r.ip || '—'}</td>
                    </tr>
                    {open === r.id && (
                      <tr>
                        <td colSpan={6} style={{ background: 'var(--background)', padding: '12px 18px' }}>
                          <div style={{ fontSize: 14, marginBottom: 6 }}><strong>{r.method}</strong> <code>{r.path}</code></div>
                          {hasDetails
                            ? <pre style={{ margin: 0, fontSize: 13, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{JSON.stringify(r.details, null, 2)}</pre>
                            : <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>Aucun champ enregistré pour cette action.</span>}
                          <div style={{ marginTop: 8, fontSize: 12.5, color: 'var(--text-muted)' }}>{r.user_email} · {r.user_agent || 'navigateur inconnu'}</div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
          <ShowMore pg={rows_pg} label="événements" />
        </div>
        <Pager page={page} totalPages={pages} onChange={setPage} loading={loading} />
      </div>
    </div>
  )
}
