'use client'

import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'

interface ECInfo {
  ec_code: string
  ec_name: string
  ue_code: string
  student_count: number
  pole_id?: number | null
  pole_code?: string | null
  pole_name?: string | null
}

interface StudentEC { ec_code: string }

interface Student {
  id: number
  full_name: string
  email: string
  ecs: StudentEC[]
  formation_name?: string
  niveau?: string
  is_active?: boolean
  pole_id?: number | null
  pole_code?: string | null
  pole_name?: string | null
}

interface MyStudentsResponse {
  ecs: ECInfo[]
  students: Student[]
  total: number
}

export default function ProfessorStudentsPage() {
  const { error } = useToast()
  const [ecs, setEcs]         = useState<ECInfo[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [total, setTotal]     = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [filterEc, setFilterEc] = useState('')
  const [filterPole, setFilterPole] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const res = await api.get<MyStudentsResponse>('/api/professor/my_students')
      setEcs(res.ecs ?? [])
      setStudents(res.students ?? [])
      setTotal(res.total ?? 0)
    } catch { error('Erreur de chargement') }
    finally { setLoading(false) }
  }

  // Retour : "je veux que tu les affiches par Pôles" — regroupement/filtre
  // par Pôle en plus du filtre EC déjà existant, sans jamais élargir
  // l'ensemble de base déjà correctement scopé au professeur côté backend
  // (ECAssignment → EC → UE → StudentUEEnrollment).
  const poles = Array.from(
    new Map(ecs.filter(e => e.pole_code).map(e => [e.pole_code, { code: e.pole_code!, name: e.pole_name || e.pole_code! }])).values()
  )
  const visibleEcs = filterPole ? ecs.filter(e => e.pole_code === filterPole) : ecs

  const filtered = students.filter(s => {
    if (filterPole && s.pole_code !== filterPole) return false
    if (filterEc && !s.ecs.some(e => e.ec_code === filterEc)) return false
    if (!search) return true
    const q = search.toLowerCase()
    return s.full_name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q)
  })

  return (
    <div style={{ padding: '28px 32px' }}>
      {/* En-tête */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <i className="fas fa-users" style={{ color: '#2563eb' }} />Mes Étudiants
        </h1>
        <p style={{ color: '#64748b', margin: 0, fontSize: 14 }}>
          {loading ? 'Chargement…' : `${total} étudiant(s) inscrit(s) dans vos éléments constitutifs`}
        </p>
      </div>

      {/* Onglets Pôle — regroupe/filtre l'ensemble déjà scopé au professeur */}
      {!loading && poles.length > 1 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          <button onClick={() => { setFilterPole(''); setFilterEc('') }}
            style={{ padding: '7px 16px', borderRadius: 99, border: `1.5px solid ${!filterPole ? '#2563eb' : '#e2e8f0'}`, background: !filterPole ? '#eff6ff' : 'white', color: !filterPole ? '#1d4ed8' : '#475569', fontWeight: !filterPole ? 700 : 500, fontSize: 13, cursor: 'pointer' }}>
            Tous les pôles ({students.length})
          </button>
          {poles.map(p => (
            <button key={p.code} onClick={() => { setFilterPole(filterPole === p.code ? '' : p.code); setFilterEc('') }}
              style={{ padding: '7px 16px', borderRadius: 99, border: `1.5px solid ${filterPole === p.code ? '#2563eb' : '#e2e8f0'}`, background: filterPole === p.code ? '#eff6ff' : 'white', color: filterPole === p.code ? '#1d4ed8' : '#475569', fontWeight: filterPole === p.code ? 700 : 500, fontSize: 13, cursor: 'pointer' }}>
              {p.name} ({students.filter(s => s.pole_code === p.code).length})
            </button>
          ))}
        </div>
      )}

      {/* Cartes EC */}
      {!loading && ecs.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14, marginBottom: 24 }}>
          {visibleEcs.map(ec => (
            <div key={ec.ec_code}
              onClick={() => setFilterEc(filterEc === ec.ec_code ? '' : ec.ec_code)}
              style={{ background: 'white', border: `2px solid ${filterEc === ec.ec_code ? '#2563eb' : '#e2e8f0'}`, borderRadius: 10, padding: 16, cursor: 'pointer', transition: 'border-color .15s' }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', marginBottom: 2 }}>
                {ec.ec_code} <span style={{ fontWeight: 400, color: '#64748b', fontSize: 13 }}>— {ec.ec_name}</span>
              </div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                {ec.pole_name && <><i className="fas fa-sitemap" style={{ marginRight: 4, color: '#94a3b8' }} />{ec.pole_name}&nbsp;·&nbsp;</>}
                <i className="fas fa-layer-group" style={{ marginRight: 4, color: '#94a3b8' }} />UE {ec.ue_code}
                &nbsp;·&nbsp;
                <i className="fas fa-users" style={{ marginRight: 4, color: '#94a3b8' }} />{ec.student_count} étudiant(s)
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filtres */}
      <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, padding: '14px 18px', marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
          <i className="fas fa-search" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: 13 }} />
          <input placeholder="Rechercher un étudiant…" value={search} onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', padding: '9px 12px 9px 34px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box', color: '#0f172a' }} />
        </div>
        {filterEc && (
          <button onClick={() => setFilterEc('')} style={{ padding: '7px 14px', border: 'none', borderRadius: 8, background: '#dbeafe', color: '#1d4ed8', fontWeight: 600, cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <i className="fas fa-times" />EC : {filterEc}
          </button>
        )}
        <span style={{ fontSize: 13, color: '#64748b' }}>
          {filtered.length} étudiant(s) affiché(s)
        </span>
      </div>

      {/* Tableau */}
      <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 24px', color: '#64748b' }}>
            <i className="fas fa-spinner fa-spin" style={{ fontSize: 28, color: '#2563eb', display: 'block', marginBottom: 14 }} />
            Chargement…
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 24px', color: '#64748b' }}>
            <i className="fas fa-user-slash" style={{ fontSize: 36, display: 'block', marginBottom: 14, opacity: .4 }} />
            <p style={{ margin: '0 0 6px', fontWeight: 600 }}>
              {students.length === 0 ? 'Aucun étudiant inscrit dans vos UEs' : 'Aucun résultat'}
            </p>
            <p style={{ margin: 0, fontSize: 13 }}>
              {students.length === 0 ? 'Les étudiants apparaissent après leur inscription aux UEs de vos ECs' : 'Modifiez votre recherche'}
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                {['Étudiant','Email','Pôle','ECs','Formation','Niveau'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: .5, borderBottom: '1px solid #e2e8f0' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, i) => {
                const initials = (s.full_name || s.email || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
                return (
                  <tr key={s.id} style={{ background: i % 2 === 0 ? 'white' : '#fafafa', borderBottom: '1px solid #f1f5f9' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#f0f9ff' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = i % 2 === 0 ? 'white' : '#fafafa' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#dbeafe', color: '#1d4ed8', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {initials}
                        </div>
                        <span style={{ fontWeight: 600, color: '#0f172a', fontSize: 14 }}>{s.full_name}</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', color: '#64748b', fontSize: 13 }}>{s.email}</td>
                    <td style={{ padding: '12px 16px' }}>
                      {s.pole_code
                        ? <span style={{ background: '#f5f3ff', color: '#7c3aed', border: '1px solid #ddd6fe', borderRadius: 99, padding: '2px 9px', fontSize: 11, fontWeight: 700 }}>{s.pole_code}</span>
                        : <span style={{ color: '#94a3b8', fontSize: 13 }}>—</span>}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {s.ecs.map(e => (
                          <span key={e.ec_code} style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 99, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>
                            {e.ec_code}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', color: '#475569', fontSize: 13 }}>{s.formation_name ?? '—'}</td>
                    <td style={{ padding: '12px 16px', color: '#475569', fontSize: 13 }}>{s.niveau ?? '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  )
}
