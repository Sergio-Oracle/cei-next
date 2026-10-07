'use client'

import { useState } from 'react'
import api from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'

/* Section « Correspondance des rôles enseignants » de la page Moodle
   (document d'intégration, section 8). Pour chaque plateforme : le rôle CEI
   d'un enseignant éditeur et d'un enseignant non éditeur (tuteur) de Moodle.
   Toute modification passe par une simulation sur toute la plateforme avant
   d'être enregistrée ; tant qu'aucune table n'est enregistrée, la plateforme
   garde le fonctionnement antérieur (tout enseignant est responsable). */

const ACCENT = '#3b82f6'

export type RoleChoice = 'responsable' | 'tuteur' | 'ignore'
export interface RoleMap { editingteacher: RoleChoice; teacher: RoleChoice; no_editor_fallback: boolean }
export interface RolesInstance { id: number; name: string; is_active: boolean; role_map?: RoleMap; role_map_configured?: boolean }
interface Impact {
  courses: number; responsables: number; tuteurs: number; ignored: number; fallback_courses: string[]
  to_tuteur: number; to_responsable: number; to_remove: number; manual_untouched: number; examples: string[]
}

const PROPOSED: RoleMap = { editingteacher: 'responsable', teacher: 'tuteur', no_editor_fallback: true }
const LABELS: Record<RoleChoice, string> = {
  responsable: 'Professeur responsable de l’EC',
  tuteur: 'Professeur tuteur de l’EC',
  ignore: 'Ignoré (géré à la main)',
}

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }
const cardHead: React.CSSProperties = { padding: '16px 22px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }
const selectStyle: React.CSSProperties = { padding: '8px 10px', border: '1.5px solid var(--border)', borderRadius: 9, fontSize: 15, background: 'var(--surface)', color: 'var(--text)', minWidth: 240 }
const th: React.CSSProperties = { padding: '8px 10px', borderBottom: '1px solid var(--border)', fontWeight: 600, textAlign: 'left', color: 'var(--text-muted)', fontSize: 14 }
const td: React.CSSProperties = { padding: '8px 10px', borderBottom: '1px solid var(--border)', fontSize: 14.5, verticalAlign: 'top' }

function Btn({ children, onClick, disabled, primary }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; primary?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      style={{ background: primary ? ACCENT : 'transparent', color: primary ? 'white' : 'var(--text)', border: primary ? 'none' : '1.5px solid var(--border)',
               padding: '8px 16px', borderRadius: 9, fontSize: 15, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? .55 : 1,
               display: 'inline-flex', alignItems: 'center', gap: 7 }}>
      {children}
    </button>
  )
}

function InstanceRoles({ inst, onSaved }: { inst: RolesInstance; onSaved: () => void }) {
  const { success, error } = useToast()
  const [map, setMap] = useState<RoleMap>(inst.role_map_configured && inst.role_map ? inst.role_map : PROPOSED)
  const [sim, setSim] = useState<{ map: RoleMap; current: Impact; proposed: Impact } | null>(null)
  const [busy, setBusy] = useState<null | 'sim' | 'save'>(null)
  const simulatedThis = sim && JSON.stringify(sim.map) === JSON.stringify(map)

  async function simulate() {
    setBusy('sim')
    try {
      const r = await api.aiPost<{ role_map: RoleMap; current: Impact; proposed: Impact }>(`/api/admin/moodle/instances/${inst.id}/role-map/simulate`, { role_map: map })
      setSim({ map: r.role_map, current: r.current, proposed: r.proposed })
    } catch (e: any) { error(e.message || 'Simulation impossible') }
    finally { setBusy(null) }
  }
  async function save() {
    setBusy('save')
    try {
      await api.put(`/api/admin/moodle/instances/${inst.id}/role-map`, { role_map: map, confirmed: true })
      success('Table enregistrée : les affectations venues de Moodle suivront à la prochaine synchronisation')
      setSim(null); onSaved()
    } catch (e: any) { error(e.message || 'Enregistrement impossible') }
    finally { setBusy(null) }
  }

  const rows: [string, string, keyof RoleMap][] = [
    ['editingteacher', 'Enseignant éditeur (propriétaire du cours)', 'editingteacher'],
    ['teacher', 'Enseignant non éditeur (tuteur)', 'teacher'],
  ]
  const p = sim?.proposed, c = sim?.current
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <strong style={{ fontSize: 16.5 }}>{inst.name}</strong>
        {inst.role_map_configured
          ? <span style={{ fontSize: 13, fontWeight: 700, padding: '3px 10px', borderRadius: 99, color: '#047857', background: '#d1fae5' }}>Table en vigueur</span>
          : <span style={{ fontSize: 13, fontWeight: 700, padding: '3px 10px', borderRadius: 99, color: '#92400e', background: '#fef3c7' }}>Pas encore appliquée : tout enseignant est responsable</span>}
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={th}>Rôle Moodle</th><th style={th}>Qui</th><th style={th}>Rôle CEI</th></tr></thead>
          <tbody>
            {rows.map(([code, who, key]) => (
              <tr key={code}>
                <td style={td}><code>{code}</code></td>
                <td style={td}>{who}</td>
                <td style={td}>
                  <select style={selectStyle} value={map[key] as string} onChange={e => setMap(m => ({ ...m, [key]: e.target.value as RoleChoice }))}>
                    {(Object.keys(LABELS) as RoleChoice[]).map(k => <option key={k} value={k}>{LABELS[k]}</option>)}
                  </select>
                </td>
              </tr>
            ))}
            <tr><td style={td}><code>student</code></td><td style={td}>Étudiant</td><td style={td}>Étudiant inscrit à l’UE de l’EC</td></tr>
            <tr><td style={td}><code>manager</code>, <code>coursecreator</code></td><td style={td}>Gestionnaires</td><td style={td}>Ignorés (gérés à la main par l’administrateur CEI)</td></tr>
          </tbody>
        </table>
      </div>
      <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 14.5, cursor: 'pointer' }}>
        <input type="checkbox" checked={map.no_editor_fallback} onChange={e => setMap(m => ({ ...m, no_editor_fallback: e.target.checked }))} style={{ marginTop: 3 }} />
        <span><strong>Cours sans enseignant éditeur</strong> : ses tuteurs deviennent responsables, pour qu’il y ait toujours quelqu’un pour créer les sujets et les examens.</span>
      </label>
      <div style={{ fontSize: 13.5, color: 'var(--text-muted)', lineHeight: 1.6 }}>
        Un <strong>responsable</strong> crée les sujets et les examens et publie les résultats. Un <strong>tuteur</strong> voit les étudiants et les examens de l’EC et corrige les copies ; il ne crée ni sujet ni examen et ne publie pas.
        Seules les affectations venues de Moodle suivent cette table : celles saisies dans « Affectations EC » ne changent jamais. Jamais de rôle administrateur, surveillant ou superviseur automatique.
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Btn onClick={simulate} disabled={!!busy}><i className={`fas ${busy === 'sim' ? 'fa-spinner fa-spin' : 'fa-magnifying-glass'}`} /> Simuler sur toute la plateforme</Btn>
        <Btn primary onClick={save} disabled={!!busy || !simulatedThis}>
          <i className={`fas ${busy === 'save' ? 'fa-spinner fa-spin' : 'fa-check'}`} /> Enregistrer cette table
        </Btn>
        {!simulatedThis && <span style={{ fontSize: 13.5, color: 'var(--text-muted)', alignSelf: 'center' }}>Simulez d’abord : l’enregistrement n’est possible qu’après une simulation de la table affichée.</span>}
      </div>
      {p && c && (
        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Simulation — rien n’a été modifié ({p.courses} cours reliés à un EC)</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={th}></th><th style={th}>Table actuelle</th><th style={th}>Table simulée</th></tr></thead>
              <tbody>
                {([['Enseignants responsables', c.responsables, p.responsables], ['Enseignants tuteurs', c.tuteurs, p.tuteurs],
                   ['Ignorés', c.ignored, p.ignored], ['Cours sans éditeur (tuteurs devenus responsables)', c.fallback_courses.length, p.fallback_courses.length]] as [string, number, number][]).map(([label, a, b]) => (
                  <tr key={label}><td style={td}>{label}</td><td style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>{a}</td>
                    <td style={{ ...td, fontVariantNumeric: 'tabular-nums', fontWeight: a !== b ? 700 : 400, color: a !== b ? '#1d4ed8' : undefined }}>{b}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: 14.5, lineHeight: 1.7 }}>
            Affectations CEI venues de Moodle qui changeraient : <strong>{p.to_tuteur}</strong> passeraient tuteur, <strong>{p.to_responsable}</strong> responsable, <strong>{p.to_remove}</strong> seraient retirées.
            {p.manual_untouched > 0 && <> {p.manual_untouched} affectation(s) saisie(s) à la main resteraient inchangées.</>}
          </div>
          {p.examples.length > 0 && (
            <details><summary style={{ cursor: 'pointer', fontSize: 14.5 }}>Exemples ({p.examples.length})</summary>
              <div style={{ fontSize: 13.5, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.8 }}>{p.examples.join(' · ')}</div>
            </details>
          )}
          {p.fallback_courses.length > 0 && (
            <details><summary style={{ cursor: 'pointer', fontSize: 14.5 }}>Cours sans enseignant éditeur ({p.fallback_courses.length})</summary>
              <div style={{ fontSize: 13.5, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.8 }}>{p.fallback_courses.join(' · ')}</div>
            </details>
          )}
        </div>
      )}
    </div>
  )
}

export default function RolesPanel({ instances, onChanged }: { instances: RolesInstance[]; onChanged: () => void }) {
  const active = instances.filter(i => i.is_active)
  if (!active.length) return null
  return (
    <section style={card}>
      <div style={cardHead}>
        <h3 style={{ margin: 0, fontSize: 18.5, fontWeight: 700 }}><i className="fas fa-user-tag" style={{ color: ACCENT, marginRight: 8 }} />Correspondance des rôles enseignants</h3>
      </div>
      <div style={{ padding: '16px 22px', display: 'grid', gap: 14 }}>
        <p style={{ margin: 0, fontSize: 14.5, color: 'var(--text-muted)' }}>
          Pour chaque plateforme, le rôle CEI donné aux enseignants Moodle. Le rôle est lu cours par cours (éditeur ou non éditeur), sans ralentir la synchronisation.
        </p>
        {active.map(i => <InstanceRoles key={`${i.id}-${i.role_map_configured}`} inst={i} onSaved={onChanged} />)}
      </div>
    </section>
  )
}
