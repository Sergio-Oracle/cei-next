'use client'

import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'
import type { User } from '@/types'

export default function ProfessorStudentsPage() {
  const { error } = useToast()
  const [students, setStudents] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const res = await api.get<User[]>('/api/admin/users')
      const all = Array.isArray(res) ? res : (res as any).users ?? []
      setStudents(all.filter((u: User) => u.role === 'student'))
    } catch { error('Erreur de chargement') }
    finally { setLoading(false) }
  }

  const filtered = students.filter(s =>
    !search || s.full_name.toLowerCase().includes(search.toLowerCase()) || s.email.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div className="page-header">
        <div>
          <h2><i className="fa-solid fa-graduation-cap" style={{ marginRight: 10, color: 'var(--primary)' }} />Mes étudiants</h2>
          <p>{students.length} étudiant(s)</p>
        </div>
      </div>

      <div className="card">
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ position: 'relative', maxWidth: 400 }}>
            <i className="fa-solid fa-search" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              className="form-control"
              style={{ paddingLeft: 36 }}
              placeholder="Rechercher un étudiant..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="table-responsive">
          <table>
            <thead>
              <tr><th>Nom complet</th><th>Email</th><th>Formation</th><th>Niveau</th><th>Statut</th><th>Dernière connexion</th></tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40 }}><i className="fa-solid fa-spinner spin" /> Chargement...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="empty-message">Aucun étudiant trouvé</td></tr>
              ) : filtered.map(s => (
                <tr key={s.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--primary)20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: 'var(--primary)', flexShrink: 0 }}>
                        {s.full_name.charAt(0).toUpperCase()}
                      </div>
                      {s.full_name}
                    </div>
                  </td>
                  <td>{s.email}</td>
                  <td>{s.formation_name ?? '—'}</td>
                  <td>{s.niveau ?? '—'}</td>
                  <td><span className={`status-badge ${s.is_active ? 'success' : 'danger'}`}>{s.is_active ? 'Actif' : 'Inactif'}</span></td>
                  <td>{s.last_login ? new Date(s.last_login).toLocaleDateString('fr-FR') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
