'use client'

import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'
import type { User, UserRole } from '@/types'

/* ── Couleurs & icônes par rôle ─────────────────────────────────────────── */
const ROLE_META: Record<string, { label: string; plural: string; color: string; bg: string; icon: string }> = {
  admin:       { label: 'Admin',        plural: 'Administrateurs', color: '#eab308', bg: '#fef9c3', icon: 'fa-crown' },
  professor:   { label: 'Professeur',   plural: 'Professeurs',     color: '#10b981', bg: '#d1fae5', icon: 'fa-chalkboard-teacher' },
  surveillant: { label: 'Surveillant',  plural: 'Surveillants',    color: '#f59e0b', bg: '#fef3c7', icon: 'fa-eye' },
  student:     { label: 'Étudiant',     plural: 'Étudiants',       color: '#3b82f6', bg: '#dbeafe', icon: 'fa-graduation-cap' },
}

const SECTION_ORDER = ['admin', 'professor', 'surveillant', 'student']
const LEVELS        = ['L1', 'L2', 'L3', 'M1', 'M2']

/* ── Initiales depuis le nom complet ─────────────────────────────────────── */
function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w.charAt(0)).join('').toUpperCase() || '?'
}

export default function AdminUsersPage() {
  const { success, error } = useToast()

  const [users, setUsers]         = useState<User[]>([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [activeFilter, setActiveFilter] = useState<string>('') // role | 'no_email'
  const [deleting, setDeleting]   = useState<number | null>(null)

  /* Modal créer / modifier */
  const [modal, setModal]       = useState<'create' | 'edit' | 'no_email' | 'csv' | null>(null)
  const [editing, setEditing]   = useState<User | null>(null)
  const [saving, setSaving]     = useState(false)
  const [createRole, setCreateRole] = useState<UserRole>('student')
  const [form, setForm] = useState({ email: '', full_name: '', password: '', role: 'student' as UserRole, niveau: '', formation_id: '' })

  /* Modal sans email */
  const [noEmailForm, setNoEmailForm] = useState({ full_name: '', niveau: '' })
  const [noEmailResult, setNoEmailResult] = useState<{ email: string; temp_password: string } | null>(null)

  /* Modal CSV */
  const [csvFile, setCsvFile]   = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<any>(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const data = await api.get<User[]>('/api/admin/users')
      setUsers(Array.isArray(data) ? data : (data as any).users || [])
    } catch { error('Erreur chargement utilisateurs') }
    finally { setLoading(false) }
  }

  /* ── Filtrage ─────────────────────────────────────────────────────────── */
  const isNoEmail = (u: User) => !!u.email?.includes('@no-email.cei.local') || u.has_email === false

  const filtered = users.filter(u => {
    const q = search.toLowerCase()
    const matchQ = !q || u.full_name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q)
    const matchF =
      !activeFilter ? true :
      activeFilter === 'no_email' ? isNoEmail(u) :
      u.role === activeFilter
    return matchQ && matchF
  })

  const countByRole = (role: string) => users.filter(u => u.role === role).length
  const stats = SECTION_ORDER.map(r => ({ role: r, count: countByRole(r) }))

  /* ── Grouper par rôle ────────────────────────────────────────────────── */
  const sections = SECTION_ORDER.map(role => ({
    role,
    users: filtered.filter(u => u.role === role),
  })).filter(s => s.users.length > 0)

  /* ── Actions ─────────────────────────────────────────────────────────── */
  function openCreate(role: UserRole) {
    setCreateRole(role)
    setEditing(null)
    setForm({ email: '', full_name: '', password: '', role, niveau: '', formation_id: '' })
    setModal('create')
  }

  function openEdit(u: User) {
    setEditing(u)
    setForm({ email: u.email || '', full_name: u.full_name, password: '', role: u.role, niveau: u.niveau || '', formation_id: '' })
    setModal('edit')
  }

  async function handleSave() {
    if (!form.email || !form.full_name) { error('Email et nom requis'); return }
    if (!editing && !form.password) { error('Mot de passe requis'); return }
    setSaving(true)
    try {
      const payload: any = { email: form.email, full_name: form.full_name, role: form.role }
      if (form.password) payload.password = form.password
      payload.niveau = form.role === 'student' ? (form.niveau || null) : null
      if (editing) {
        await api.put(`/api/admin/users/${editing.id}`, payload)
        success('Utilisateur modifié')
      } else {
        await api.post('/api/admin/users', payload)
        success('Utilisateur créé')
      }
      setModal(null)
      await load()
    } catch (e: any) { error(e.message) }
    finally { setSaving(false) }
  }

  async function handleDelete(id: number, name: string) {
    if (!confirm(`Supprimer ${name} ? Action irréversible.`)) return
    setDeleting(id)
    try {
      await api.delete(`/api/admin/users/${id}`)
      success('Utilisateur supprimé')
      setUsers(p => p.filter(u => u.id !== id))
    } catch (e: any) { error(e.message) }
    finally { setDeleting(null) }
  }

  async function handleNoEmail() {
    if (!noEmailForm.full_name.trim()) { error('Nom requis'); return }
    setSaving(true)
    try {
      const res = await api.post<any>('/api/admin/users/student-no-email', {
        full_name: noEmailForm.full_name,
        niveau: noEmailForm.niveau || undefined,
      })
      setNoEmailResult({ email: res.user?.email || '', temp_password: res.temp_password || '' })
      await load()
    } catch (e: any) { error(e.message) }
    finally { setSaving(false) }
  }

  async function downloadCsvTemplate() {
    try {
      const blob = await api.blob('/api/admin/users/csv-template')
      const url = URL.createObjectURL(blob)
      Object.assign(document.createElement('a'), {
        href: url,
        download: `template_utilisateurs_${new Date().toISOString().split('T')[0]}.csv`,
      }).click()
      URL.revokeObjectURL(url)
      success('Template téléchargé avec succès')
    } catch { error('Impossible de télécharger le template') }
  }

  async function handleImport() {
    if (!csvFile) { error('Sélectionnez un fichier CSV'); return }
    setImporting(true)
    const fd = new FormData(); fd.append('file', csvFile)
    try {
      const res = await api.upload<any>('/api/admin/users/import-csv', fd)
      setImportResult(res)
      success(`${res.created || res.imported || 0} utilisateur(s) créé(s)`)
      setTimeout(() => { setModal(null); load() }, 2000)
    } catch (e: any) { error(e.message) }
    finally { setImporting(false) }
  }

  /* ── Avatar ────────────────────────────────────────────────────────────── */
  function Avatar({ user }: { user: User }) {
    const m = ROLE_META[user.role] || ROLE_META.student
    return (
      <div style={{ width: 36, height: 36, borderRadius: '50%', background: m.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
        {initials(user.full_name || '')}
      </div>
    )
  }

  /* ── Render ─────────────────────────────────────────────────────────────── */
  return (
    <div>
      {/* Header + boutons d'action */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 10, margin: 0 }}>
            <i className="fas fa-users" style={{ color: 'var(--primary)' }} />
            Gestion des Utilisateurs
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 4 }}>Gérez les comptes admins, professeurs et étudiants</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => openCreate('student')} style={btnStyle('#10b981')}>
            <i className="fas fa-graduation-cap" /> Étudiant
          </button>
          <button onClick={() => openCreate('professor')} style={btnStyle('#3b82f6')}>
            <i className="fas fa-chalkboard-teacher" /> Professeur
          </button>
          <button onClick={() => openCreate('surveillant')} style={btnStyle('#f59e0b')}>
            <i className="fas fa-eye" /> Surveillant
          </button>
          <button
            onClick={() => { setModal('no_email'); setNoEmailForm({ full_name: '', niveau: '' }); setNoEmailResult(null) }}
            style={btnStyle('#3b82f6')}>
            <i className="fas fa-user-slash" /> Sans Email
          </button>
          <button onClick={() => { setModal('csv'); setCsvFile(null); setImportResult(null) }} style={btnStyle('#64748b')}>
            <i className="fas fa-file-import" /> Import CSV
          </button>
        </div>
      </div>

      {/* Stats cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 24 }}>
        {stats.map(({ role, count }) => {
          const m = ROLE_META[role]
          return (
            <div key={role} className="card" onClick={() => setActiveFilter(activeFilter === role ? '' : role)}
              style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer', border: activeFilter === role ? `2px solid ${m.color}` : '2px solid transparent', transition: 'all .15s' }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: m.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <i className={`fas ${m.icon}`} style={{ color: m.color, fontSize: 20 }} />
              </div>
              <div>
                <div style={{ fontSize: 28, fontWeight: 800, color: m.color, lineHeight: 1 }}>{count}</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>{m.plural}</div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Barre de recherche + filtre Sans Email */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 360 }}>
          <i className="fas fa-search" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: 13 }} />
          <input type="text" placeholder="Rechercher un utilisateur…" value={search} onChange={e => setSearch(e.target.value)}
            autoComplete="off" name="cei-admin-users-search" data-lpignore="true" data-1p-ignore
            style={{ width: '100%', padding: '9px 12px 9px 36px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, background: 'var(--surface)', color: 'var(--text)', boxSizing: 'border-box' }} />
        </div>
        {activeFilter && (
          <button onClick={() => setActiveFilter('')} style={{ fontSize: 13, padding: '8px 14px', borderRadius: 8, background: '#f1f5f9', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text)' }}>
            <i className="fas fa-times" style={{ marginRight: 5 }} />Effacer le filtre
          </button>
        )}
        {activeFilter === 'no_email' && (
          <span style={{ fontSize: 12, color: '#3b82f6', background: '#dbeafe', padding: '4px 10px', borderRadius: 20, fontWeight: 600 }}>
            <i className="fas fa-user-slash" style={{ marginRight: 4 }} />Filtre : Sans email institutionnel
          </span>
        )}
      </div>

      {/* Sections par rôle */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <i className="fas fa-spinner fa-spin" style={{ fontSize: 32, color: 'var(--primary)' }} />
        </div>
      ) : sections.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
          <i className="fas fa-users" style={{ fontSize: 40, display: 'block', marginBottom: 12 }} />
          Aucun utilisateur trouvé
        </div>
      ) : (
        sections.map(({ role, users: sUsers }) => {
          const m = ROLE_META[role] || ROLE_META.student
          return (
            <div key={role} className="card" style={{ marginBottom: 20 }}>
              {/* Section header */}
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: m.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className={`fas ${m.icon}`} style={{ color: m.color, fontSize: 16 }} />
                </div>
                <h3 style={{ margin: 0, fontSize: 16 }}>
                  {m.plural}
                  <span style={{ marginLeft: 8, fontSize: 13, fontWeight: 600, color: m.color, background: m.bg, padding: '2px 8px', borderRadius: 20 }}>{sUsers.length}</span>
                </h3>
              </div>

              {/* Table */}
              <div className="table-responsive">
                <table>
                  <thead>
                    <tr>
                      <th>NOM</th>
                      <th>EMAIL</th>
                      {role === 'student' && <th>NIVEAU</th>}
                      <th>STATUT</th>
                      <th>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sUsers.map(u => (
                      <tr key={u.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 34, height: 34, borderRadius: '50%', background: m.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 12, flexShrink: 0 }}>
                              {initials(u.full_name || '')}
                            </div>
                            <span style={{ fontWeight: 600 }}>{u.full_name}</span>
                            {isNoEmail(u) && (
                              <span style={{ fontSize: 10, background: '#dbeafe', color: '#2563eb', padding: '1px 6px', borderRadius: 10, fontWeight: 700 }}>Sans email</span>
                            )}
                          </div>
                        </td>
                        <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{u.email || '—'}</td>
                        {role === 'student' && <td style={{ fontSize: 13 }}>{u.niveau || '—'}</td>}
                        <td>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 600, color: u.is_active ? '#10b981' : '#ef4444' }}>
                            <span style={{ width: 7, height: 7, borderRadius: '50%', background: u.is_active ? '#10b981' : '#ef4444', display: 'inline-block' }} />
                            {u.is_active ? 'Actif' : 'Inactif'}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <button onClick={() => openEdit(u)}
                              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', fontSize: 13, borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', color: 'var(--text)' }}>
                              <i className="fas fa-pen" style={{ fontSize: 11 }} /> Modifier
                            </button>
                            {role !== 'admin' && (
                              <button onClick={() => handleDelete(u.id, u.full_name)} disabled={deleting === u.id}
                                style={{ width: 30, height: 30, borderRadius: 7, border: '1px solid #fca5a5', background: '#fff1f2', cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <i className={`fas ${deleting === u.id ? 'fa-spinner fa-spin' : 'fa-trash'}`} style={{ fontSize: 11 }} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        })
      )}

      {/* ── Modal Créer / Modifier ────────────────────────────────────────── */}
      {(modal === 'create' || modal === 'edit') && (
        <ModalOverlay onClose={() => setModal(null)}>
          <h3 style={{ marginBottom: 20 }}>
            <i className={`fas ${modal === 'edit' ? 'fa-user-edit' : 'fa-user-plus'}`} style={{ color: 'var(--primary)', marginRight: 8 }} />
            {modal === 'edit' ? 'Modifier l\'utilisateur' : `Nouvel utilisateur — ${ROLE_META[createRole]?.label}`}
          </h3>
          <Fg label="Nom complet *">
            <input type="text" value={form.full_name} onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))}
              placeholder="Prénom Nom" style={inp} />
          </Fg>
          <Fg label="Adresse email *">
            <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
              placeholder="prenom.nom@unchk.sn" style={inp} />
          </Fg>
          <div style={{ display: 'grid', gridTemplateColumns: form.role === 'student' ? '1fr 1fr' : '1fr', gap: 14 }}>
            <Fg label="Rôle">
              {modal === 'create' ? (
                // Rôle déjà déterminé par le bouton cliqué (Étudiant/Professeur/Surveillant) — non modifiable.
                // Un utilisateur "Administrateur" ne se crée pas via ce chemin (aucun bouton dédié).
                <div style={{ ...inp, display: 'flex', alignItems: 'center', gap: 8, background: 'var(--background)', color: 'var(--text-muted)' }}>
                  <i className={`fas ${ROLE_META[form.role]?.icon}`} style={{ color: ROLE_META[form.role]?.color }} />
                  {ROLE_META[form.role]?.label}
                </div>
              ) : (
                <select value={form.role} onChange={e => {
                  const role = e.target.value as UserRole
                  setForm(p => ({ ...p, role, niveau: role === 'student' ? p.niveau : '' }))
                }} style={inp}>
                  <option value="student">Étudiant</option>
                  <option value="professor">Professeur</option>
                  <option value="surveillant">Surveillant</option>
                  <option value="admin">Administrateur</option>
                </select>
              )}
            </Fg>
            {form.role === 'student' && (
              <Fg label="Niveau">
                <select value={form.niveau} onChange={e => setForm(p => ({ ...p, niveau: e.target.value }))} style={inp}>
                  <option value="">— Aucun —</option>
                  {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </Fg>
            )}
          </div>
          <Fg label={`Mot de passe${modal === 'edit' ? ' (vide = inchangé)' : ' *'}`}>
            <input type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
              placeholder={modal === 'edit' ? '••••••••' : 'Min. 6 caractères'} style={inp} />
          </Fg>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
            <button onClick={() => setModal(null)} style={{ padding: '9px 20px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', fontSize: 14 }}>Annuler</button>
            <button onClick={handleSave} disabled={saving}
              style={{ padding: '9px 22px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
              <i className={`fas ${saving ? 'fa-spinner fa-spin' : 'fa-save'}`} style={{ marginRight: 6 }} />
              {saving ? 'Enregistrement…' : modal === 'edit' ? 'Modifier' : 'Créer'}
            </button>
          </div>
        </ModalOverlay>
      )}

      {/* ── Modal Sans Email ─────────────────────────────────────────────── */}
      {modal === 'no_email' && (
        <ModalOverlay onClose={() => setModal(null)}>
          <h3 style={{ marginBottom: 4 }}>
            <i className="fas fa-user-slash" style={{ color: '#3b82f6', marginRight: 8 }} />
            Étudiant sans email institutionnel
          </h3>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
            Un email temporaire et un mot de passe seront générés automatiquement.
          </p>
          {noEmailResult ? (
            <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 10, padding: 16, marginBottom: 16 }}>
              <div style={{ fontWeight: 700, color: '#166534', marginBottom: 10 }}>
                <i className="fas fa-check-circle" style={{ marginRight: 6 }} />Compte créé avec succès
              </div>
              <div style={{ fontSize: 13, marginBottom: 6 }}>
                <strong>Email temporaire :</strong><br />
                <code style={{ fontSize: 12, background: '#dcfce7', padding: '2px 6px', borderRadius: 4 }}>{noEmailResult.email}</code>
              </div>
              <div style={{ fontSize: 13 }}>
                <strong>Mot de passe temporaire :</strong><br />
                <code style={{ fontSize: 14, fontWeight: 700, background: '#dcfce7', padding: '2px 8px', borderRadius: 4, letterSpacing: 1 }}>{noEmailResult.temp_password}</code>
              </div>
              <p style={{ fontSize: 12, color: '#166534', marginTop: 10, marginBottom: 0 }}>
                <i className="fas fa-info-circle" style={{ marginRight: 4 }} />
                Notez ces informations — le mot de passe ne sera plus affiché.
              </p>
            </div>
          ) : (
            <>
              <Fg label="Nom complet *">
                <input type="text" value={noEmailForm.full_name} onChange={e => setNoEmailForm(p => ({ ...p, full_name: e.target.value }))}
                  placeholder="Prénom Nom" style={inp} />
              </Fg>
              <Fg label="Niveau (optionnel)">
                <select value={noEmailForm.niveau} onChange={e => setNoEmailForm(p => ({ ...p, niveau: e.target.value }))} style={inp}>
                  <option value="">— Aucun —</option>
                  {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </Fg>
            </>
          )}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={() => setModal(null)} style={{ padding: '9px 20px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', fontSize: 14 }}>
              {noEmailResult ? 'Fermer' : 'Annuler'}
            </button>
            {!noEmailResult && (
              <button onClick={handleNoEmail} disabled={saving}
                style={{ padding: '9px 22px', borderRadius: 8, border: 'none', background: '#3b82f6', color: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
                <i className={`fas ${saving ? 'fa-spinner fa-spin' : 'fa-plus'}`} style={{ marginRight: 6 }} />
                {saving ? 'Création…' : 'Créer le compte'}
              </button>
            )}
          </div>
        </ModalOverlay>
      )}

      {/* ── Modal Import CSV ─────────────────────────────────────────────── */}
      {modal === 'csv' && (
        <ModalOverlay onClose={() => setModal(null)}>
          <h3 style={{ marginBottom: 6 }}>
            <i className="fas fa-file-import" style={{ color: 'var(--primary)', marginRight: 8 }} />
            Import Bulk Utilisateurs
          </h3>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14 }}>
            Importez plusieurs utilisateurs à la fois via un fichier CSV
          </p>

          {/* Instructions */}
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 13 }}>
            <strong style={{ color: '#1d4ed8' }}>Instructions :</strong>
            <ol style={{ margin: '8px 0 0 18px', color: '#1e40af', lineHeight: 1.8 }}>
              <li>Téléchargez le template CSV</li>
              <li>Remplissez-le avec les données (<code>full_name, email, password, role</code>)</li>
              <li>Rôles possibles : <code>student</code>, <code>professor</code>, <code>admin</code></li>
              <li>Uploadez le fichier</li>
            </ol>
          </div>

          {/* Bouton télécharger template */}
          <button onClick={downloadCsvTemplate}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 18px', borderRadius: 8, border: 'none', background: '#06b6d4', color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 600, marginBottom: 18 }}>
            <i className="fas fa-download" /> Télécharger Template CSV
          </button>

          <Fg label="Fichier CSV *">
            <input type="file" accept=".csv" onChange={e => { setCsvFile(e.target.files?.[0] || null); setImportResult(null) }}
              style={{ width: '100%', fontSize: 14 }} />
          </Fg>

          {/* Résultat import */}
          {importResult && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: 12, fontSize: 13 }}>
                <strong style={{ color: '#166534' }}>
                  <i className="fas fa-check-circle" style={{ marginRight: 5 }} />
                  {importResult.created || 0} utilisateur(s) créé(s)
                </strong>
                {(importResult.emails_queued ?? 0) > 0 && (
                  <div style={{ marginTop: 4, color: '#166534' }}>
                    <i className="fas fa-envelope" style={{ marginRight: 4 }} />
                    {importResult.emails_queued} email(s) de notification en cours d&apos;envoi
                  </div>
                )}
                {importResult.users?.length > 0 && (
                  <ul style={{ margin: '8px 0 0 16px', fontSize: 12, color: '#166534' }}>
                    {importResult.users.map((u: any, i: number) => (
                      <li key={i}><strong>{u.full_name}</strong> ({u.email}) — {u.role}</li>
                    ))}
                  </ul>
                )}
              </div>
              {(importResult.errors > 0 || importResult.error_details?.length > 0) && (
                <div style={{ background: '#fefce8', border: '1px solid #fde68a', borderRadius: 8, padding: 12, fontSize: 13, marginTop: 8 }}>
                  <strong style={{ color: '#92400e' }}>
                    <i className="fas fa-exclamation-triangle" style={{ marginRight: 5 }} />
                    {importResult.errors || importResult.error_details?.length || 0} erreur(s)
                  </strong>
                  <ul style={{ margin: '6px 0 0 16px', color: '#92400e', fontSize: 12 }}>
                    {(importResult.error_details || []).map((e: string, i: number) => <li key={i}>{e}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={handleImport} disabled={importing || !csvFile}
              style={{ padding: '9px 22px', borderRadius: 8, border: 'none', background: '#10b981', color: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 600, opacity: !csvFile ? .5 : 1 }}>
              <i className={`fas ${importing ? 'fa-spinner fa-spin' : 'fa-upload'}`} style={{ marginRight: 6 }} />
              {importing ? 'Import en cours…' : 'Importer'}
            </button>
            <button onClick={() => setModal(null)} style={{ padding: '9px 20px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', fontSize: 14 }}>Annuler</button>
          </div>
        </ModalOverlay>
      )}
    </div>
  )
}

/* ── Helpers internes ─────────────────────────────────────────────────────── */
function btnStyle(color: string): React.CSSProperties {
  return {
    padding: '8px 16px', borderRadius: 8,
    border: `1px solid ${color}40`,
    background: color + '18', color, fontWeight: 700, fontSize: 13,
    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
  }
}

const inp: React.CSSProperties = {
  width: '100%', padding: '10px 14px', fontSize: 14,
  border: '1px solid var(--border)', borderRadius: 8,
  background: 'var(--surface)', color: 'var(--text)',
  boxSizing: 'border-box', outline: 'none',
}

function Fg({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 5 }}>{label}</label>
      {children}
    </div>
  )
}

function ModalOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'var(--surface)', borderRadius: 14, padding: 28, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
        {children}
      </div>
    </div>
  )
}
