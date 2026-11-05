'use client'
import React, { useEffect, useState } from 'react'

/** Sites d'assistance proposés d'office (canal de dépannage technique pendant l'examen). */
export const ASSIST_PRESETS: { label: string; url: string }[] = [
  { label: 'Teranga Meet — salle d’assistance', url: 'https://terangameet.unchk.sn/xuy-mbwu-tih' },
  { label: 'Jokko Meet', url: 'https://jokkomeet.unchk.sn/' },
]

const normUrl = (u: string) => u.trim().replace(/\/+$/, '')

/**
 * Réglages de l'application CEI Examen propres à un examen : sites ouverts dans une fenêtre d'assistance (rien d'autre n'est accessible),
 * applications tolérées sur le poste, refus des machines virtuelles. Les outils de bureau / contrôle à distance ne sont JAMAIS tolérés.
 */
export default function ClientAssistSettings({ sites, apps, onSites, onApps, disabled }: {
  sites: string[]; apps: string[]; onSites: (v: string[]) => void; onApps: (v: string[]) => void; disabled?: boolean
}) {
  const presetSet = new Set(ASSIST_PRESETS.map(p => normUrl(p.url)))
  const others = sites.filter(s => !presetSet.has(normUrl(s)))
  const [othersText, setOthersText] = useState(others.join('\n'))
  const [appsText, setAppsText] = useState(apps.join(', '))
  // Rechargement des valeurs (ouverture de la fenêtre de réglages) sans écraser une saisie en cours
  useEffect(() => { setOthersText(others.join('\n')) }, [sites.join('|')]) // eslint-disable-line
  useEffect(() => { setAppsText(apps.join(', ')) }, [apps.join('|')]) // eslint-disable-line

  const has = (url: string) => sites.some(s => normUrl(s) === normUrl(url))
  const toggle = (url: string) => {
    if (disabled) return
    onSites(has(url) ? sites.filter(s => normUrl(s) !== normUrl(url)) : [...sites, url])
  }
  const setOthers = (t: string) => {
    setOthersText(t)
    const extra = t.split(/[\n,;]+/).map(x => x.trim()).filter(Boolean)
    onSites([...sites.filter(s => presetSet.has(normUrl(s))), ...extra])
  }
  const setApps = (t: string) => { setAppsText(t); onApps(t.split(/[\n,;]+/).map(x => x.trim()).filter(Boolean)) }

  const box: React.CSSProperties = { width: '100%', padding: '9px 12px', border: '1.5px solid var(--border, #e2e8f0)', borderRadius: 8, fontSize: 15, boxSizing: 'border-box', background: disabled ? '#f1f5f9' : 'white', color: '#0f172a' }
  return (
    <div style={{ marginTop: 8, padding: '12px 14px', border: '1px dashed #cbd5e1', borderRadius: 10, background: '#f8fafc' }}>
      <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a', marginBottom: 4 }}><i className="fas fa-life-ring" style={{ color: '#2563eb', marginRight: 6 }} />Assistance technique pendant l&apos;examen</div>
      <p style={{ margin: '0 0 8px', fontSize: 13.5, color: '#64748b', lineHeight: 1.5 }}>
        Par défaut, l&apos;application ferme tout ce qui n&apos;est pas l&apos;examen. Les sites cochés ci-dessous s&apos;ouvrent <b>dans une fenêtre de l&apos;application</b> (bouton « Assistance technique »
        pour l&apos;étudiant) : ils servent à dépanner un étudiant en difficulté, sans que la fenêtre puisse aller ailleurs. Chaque ouverture est enregistrée pour le surveillant.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
        {ASSIST_PRESETS.map(p => (
          <label key={p.url} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 8, border: `1.5px solid ${has(p.url) ? '#2563eb' : '#e2e8f0'}`, background: has(p.url) ? '#eff6ff' : 'white', cursor: disabled ? 'not-allowed' : 'pointer', fontSize: 14.5 }}>
            <input type="checkbox" checked={has(p.url)} disabled={disabled} onChange={() => toggle(p.url)} style={{ width: 'auto' }} />
            <span>{p.label}<small style={{ display: 'block', color: '#94a3b8', fontSize: 12.5 }}>{p.url.replace('https://', '')}</small></span>
          </label>
        ))}
      </div>
      <div style={{ fontSize: 13.5, fontWeight: 600, color: '#475569', marginBottom: 4 }}>Autres sites (https://…, un par ligne, 5 au total)</div>
      <textarea value={othersText} onChange={e => setOthers(e.target.value)} disabled={disabled} rows={2} placeholder="https://exemple.unchk.sn/salle" style={{ ...box, resize: 'vertical', fontFamily: 'inherit' }} />
      <div style={{ fontSize: 13.5, fontWeight: 600, color: '#475569', margin: '10px 0 4px' }}>Applications tolérées sur le poste (noms de programmes, séparés par des virgules)</div>
      <input value={appsText} onChange={e => setApps(e.target.value)} disabled={disabled} placeholder="ex. whatsapp, teams" style={box} />
      <small style={{ display: 'block', color: '#94a3b8', fontSize: 12.5, marginTop: 4 }}>
        Ces applications ne sont pas fermées par l&apos;application CEI Examen. Les outils de bureau ou de contrôle à distance (TeamViewer, AnyDesk, Bureau à distance…) restent toujours bloqués.
      </small>
    </div>
  )
}
