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
  poles: { code: string; name: string; count: number }[]
  students: Student[]
  total: number
  filtered_total: number
  page: number
  pages: number
  per_page: number
}

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

/* Numéros de page façon Moodle : 1 … 4 5 [6] 7 8 … 155 */
function pageNumbers(page: number, pages: number): (number | '…')[] {
  const set = new Set([1, pages, page - 2, page - 1, page, page + 1, page + 2].filter(n => n >= 1 && n <= pages))
  const sorted = [...set].sort((a, b) => a - b)
  const out: (number | '…')[] = []
  sorted.forEach((n, i) => { if (i && n - sorted[i - 1] > 1) out.push('…'); out.push(n) })
  return out
}

export default function ProfessorStudentsPage() {
  const { error } = useToast()
  // Le serveur ne renvoie qu'une page d'étudiants, déjà filtrée et triée :
  // avant, les milliers d'étudiants arrivaient d'un coup (22 s, 3,8 Mo).
  const [data, setData] = useState<MyStudentsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [q, setQ] = useState('')                 // recherche envoyée (après une courte pause de frappe)
  const [filterEc, setFilterEc] = useState('')
  const [pole, setPole] = useState('')
  const [first, setFirst] = useState('')
  const [last, setLast] = useState('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(50)

  useEffect(() => { const t = setTimeout(() => setQ(search.trim()), 350); return () => clearTimeout(t) }, [search])
  useEffect(() => { setPage(1) }, [q, filterEc, pole, first, last, perPage])

  useEffect(() => {
    let alive = true
    setLoading(true)
    const qs = new URLSearchParams({ page: String(page), per_page: String(perPage) })
    if (q) qs.set('q', q); if (filterEc) qs.set('ec', filterEc); if (pole) qs.set('pole', pole)
    if (first) qs.set('first', first); if (last) qs.set('last', last)
    api.get<MyStudentsResponse>(`/api/professor/my_students?${qs}`)
      .then(res => { if (alive) setData(res) })
      .catch(() => { if (alive) error('Erreur de chargement') })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [page, perPage, q, filterEc, pole, first, last]) // eslint-disable-line

  const ecs = data?.ecs ?? []
  const students = data?.students ?? []
  const pages = data?.pages ?? 1
  const filtersOn = !!(q || filterEc || pole || first || last)

  const letterRow = (label: string, value: string, set: (v: string) => void) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 14.5, fontWeight: 700, color: '#64748b', minWidth: 62 }}>{label}</span>
      {['', ...LETTERS].map(l => (
        <button key={l || 'tout'} onClick={() => set(l)} aria-pressed={value === l}
          style={{ minWidth: l ? 28 : 46, padding: '4px 6px', borderRadius: 6, border: '1px solid ' + (value === l ? '#2563eb' : '#e2e8f0'),
            background: value === l ? '#2563eb' : 'white', color: value === l ? 'white' : '#334155', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
          {l || 'Tout'}
        </button>
      ))}
    </div>
  )

  return (
    <div style={{ padding: '28px 32px' }}>
      {/* En-tête */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize:24, fontWeight: 800, color: '#0f172a', margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <i className="fas fa-users" style={{ color: '#2563eb' }} />Mes Étudiants
        </h1>
        <p style={{ color: '#64748b', margin: 0, fontSize:17 }}>
          {!data ? 'Chargement…' : `${data.total} étudiant(s) inscrit(s) dans vos éléments constitutifs`}
        </p>
      </div>

      {/* Cartes EC (cliquer pour filtrer) */}
      {ecs.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14, marginBottom: 24 }}>
          {ecs.map(ec => (
            <div key={ec.ec_code}
              onClick={() => setFilterEc(filterEc === ec.ec_code ? '' : ec.ec_code)}
              style={{ background: 'white', border: `2px solid ${filterEc === ec.ec_code ? '#2563eb' : '#e2e8f0'}`, borderRadius: 10, padding: 16, cursor: 'pointer', transition: 'border-color .15s' }}>
              <div style={{ fontWeight: 700, fontSize:17, color: '#0f172a', marginBottom: 2 }}>
                {ec.ec_code} <span style={{ fontWeight: 400, color: '#64748b', fontSize:15.5 }}>— {ec.ec_name}</span>
              </div>
              <div style={{ fontSize:14.5, color: '#64748b', marginTop: 4 }}>
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
      <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, padding: '14px 18px', marginBottom: 16, display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
            <i className="fas fa-search" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: 16 }} />
            <input placeholder="Rechercher un étudiant (nom ou email)…" value={search} onChange={e => setSearch(e.target.value)}
              style={{ width: '100%', padding: '9px 12px 9px 34px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize:17, outline: 'none', boxSizing: 'border-box', color: '#0f172a' }} />
          </div>
          {(data?.poles?.length ?? 0) > 1 && (
            <select value={pole} onChange={e => setPole(e.target.value)} aria-label="Pôle"
              style={{ padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 15.5, color: '#0f172a', background: 'white' }}>
              <option value="">Tous les pôles</option>
              {data!.poles.map(p => <option key={p.code} value={p.code}>{p.code} — {p.name} ({p.count})</option>)}
            </select>
          )}
          <select value={perPage} onChange={e => setPerPage(Number(e.target.value))} aria-label="Étudiants par page"
            style={{ padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 15.5, color: '#0f172a', background: 'white' }}>
            {[20, 50, 100, 200].map(n => <option key={n} value={n}>{n} par page</option>)}
          </select>
          {filterEc && (
            <button onClick={() => setFilterEc('')} style={{ padding: '7px 14px', border: 'none', borderRadius: 8, background: '#dbeafe', color: '#1d4ed8', fontWeight: 600, cursor: 'pointer', fontSize:14.5, display: 'flex', alignItems: 'center', gap: 6 }}>
              <i className="fas fa-times" />EC : {filterEc}
            </button>
          )}
          {filtersOn && (
            <button onClick={() => { setSearch(''); setQ(''); setFilterEc(''); setPole(''); setFirst(''); setLast('') }}
              style={{ padding: '7px 14px', border: '1px solid #e2e8f0', borderRadius: 8, background: 'white', color: '#334155', fontWeight: 600, cursor: 'pointer', fontSize: 14.5 }}>
              Réinitialiser
            </button>
          )}
        </div>
        {letterRow('Prénom', first, setFirst)}
        {letterRow('Nom', last, setLast)}
      </div>

      {/* Résultat */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
        <span style={{ fontSize:15.5, color: '#64748b' }}>
          {data ? `${data.filtered_total} étudiant(s)${filtersOn ? ' correspondant(s)' : ''} · page ${data.page} sur ${pages}` : ''}
          {loading && data && <i className="fas fa-spinner fa-spin" style={{ marginLeft: 8, color: '#2563eb' }} />}
        </span>
        <Pagination page={data?.page ?? 1} pages={pages} onPage={setPage} />
      </div>

      {!data ? (
        <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, textAlign: 'center', padding: '60px 24px', color: '#64748b' }}>
          <i className="fas fa-spinner fa-spin" style={{ fontSize: 31, color: '#2563eb', display: 'block', marginBottom: 14 }} />
          Chargement…
        </div>
      ) : students.length === 0 ? (
        <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, textAlign: 'center', padding: '60px 24px', color: '#64748b' }}>
          <i className="fas fa-user-slash" style={{ fontSize: 40, display: 'block', marginBottom: 14, opacity: .4 }} />
          <p style={{ margin: '0 0 6px', fontWeight: 600 }}>
            {data.total === 0 ? 'Aucun étudiant inscrit dans vos UEs' : 'Aucun résultat'}
          </p>
          <p style={{ margin: 0, fontSize:15.5 }}>
            {data.total === 0 ? 'Les étudiants apparaissent après leur inscription aux UEs de vos ECs' : 'Modifiez votre recherche ou vos filtres'}
          </p>
        </div>
      ) : (
        <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', opacity: loading ? .6 : 1, transition: 'opacity .15s' }}>
          <StudentsTable students={students} showPoleColumn={(data.poles?.length ?? 0) > 1} />
        </div>
      )}

      {data && pages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
          <Pagination page={data.page} pages={pages} onPage={p => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }) }} />
        </div>
      )}
    </div>
  )
}

function Pagination({ page, pages, onPage }: { page: number; pages: number; onPage: (p: number) => void }) {
  if (pages <= 1) return null
  const btn = (active: boolean, disabled = false): React.CSSProperties => ({
    minWidth: 34, padding: '6px 10px', borderRadius: 7, border: '1px solid ' + (active ? '#2563eb' : '#e2e8f0'),
    background: active ? '#2563eb' : 'white', color: active ? 'white' : disabled ? '#cbd5e1' : '#334155',
    fontSize: 15, fontWeight: 600, cursor: disabled ? 'default' : 'pointer',
  })
  return (
    <nav aria-label="Pages" style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
      <button style={btn(false, page <= 1)} disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Page précédente">‹</button>
      {pageNumbers(page, pages).map((n, i) => n === '…'
        ? <span key={'e' + i} style={{ padding: '0 4px', color: '#94a3b8' }}>…</span>
        : <button key={n} style={btn(n === page)} aria-current={n === page ? 'page' : undefined} onClick={() => onPage(n)}>{n}</button>)}
      <button style={btn(false, page >= pages)} disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Page suivante">›</button>
    </nav>
  )
}

function StudentsTable({ students, showPoleColumn }: { students: Student[]; showPoleColumn: boolean }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#f8fafc' }}>
            {['Étudiant', 'Email', ...(showPoleColumn ? ['Pôle'] : []), 'ECs', 'Formation', 'Niveau'].map(h => (
              <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize:14.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: .5, borderBottom: '1px solid #e2e8f0' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {students.map((s, i) => {
            const initials = (s.full_name || s.email || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
            return (
              <tr key={s.id} style={{ background: i % 2 === 0 ? 'white' : '#fafafa', borderBottom: '1px solid #f1f5f9' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#f0f9ff' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = i % 2 === 0 ? 'white' : '#fafafa' }}>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#dbeafe', color: '#1d4ed8', fontSize:14.5, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {initials}
                    </div>
                    <span style={{ fontWeight: 600, color: '#0f172a', fontSize:17 }}>{s.full_name}</span>
                  </div>
                </td>
                <td style={{ padding: '12px 16px', color: '#64748b', fontSize:15.5 }}>{s.email}</td>
                {showPoleColumn && (
                  <td style={{ padding: '12px 16px' }}>
                    {s.pole_code
                      ? <span style={{ background: '#f0fdfa', color: '#0d9488', border: '1px solid #99f6e4', borderRadius: 99, padding: '2px 9px', fontSize:13, fontWeight: 700 }}>{s.pole_code}</span>
                      : <span style={{ color: '#94a3b8', fontSize:15.5 }}>—</span>}
                  </td>
                )}
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {s.ecs.map(e => (
                      <span key={e.ec_code} style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 99, padding: '2px 8px', fontSize:13, fontWeight: 600 }}>
                        {e.ec_code}
                      </span>
                    ))}
                  </div>
                </td>
                <td style={{ padding: '12px 16px', color: '#475569', fontSize:15.5 }}>{s.formation_name ?? '—'}</td>
                <td style={{ padding: '12px 16px', color: '#475569', fontSize:15.5 }}>{s.niveau ?? '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
