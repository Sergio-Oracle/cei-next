'use client'

import { useCallback, useEffect, useState } from 'react'
import api from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'

/* Section « CEI dans Moodle » de la page Moodle (phase 6) :
   bouton « CEI » du menu de Moodle (une ligne), enregistrement de CEI pour
   les notes (une adresse à coller, rien à recopier), surveillance des
   changements Moodle (sans rien installer), webhook facultatif, notes. */

const ACCENT = '#3b82f6'

export interface LtiInstance {
  id: number; name: string; is_active: boolean
  lti_client_id?: string | null; lti_deployment_id?: string | null; lti_configured?: boolean
  webhook_configured?: boolean; webhook_last_at?: string | null
  auto_sync_enabled?: boolean; auto_sync_last_at?: string | null; auto_sync_last_full_at?: string | null
  auto_sync_last_report?: { at: string; kind: string; detail: any } | null
}
interface ToolConfig { moodle_menu_url: string; registration_url: string; tool_url: string; initiate_login_url: string; redirection_uris: string; public_keyset_url: string }
interface GradeRow { exam_id: number; title: string; pushed_at: string | null; pushed_count: number; last_error: string | null }
interface Webhook { url: string; events: string[]; last_received_at: string | null }

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }
const cardHead: React.CSSProperties = { padding: '16px 22px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }
const box: React.CSSProperties = { border: '1px solid var(--border)', borderRadius: 10, padding: 14, display: 'grid', gap: 10 }
const inputStyle: React.CSSProperties = { width: '100%', padding: '9px 12px', border: '1.5px solid var(--border)', borderRadius: 9, fontSize: 15.5, background: 'var(--surface)', color: 'var(--text)', boxSizing: 'border-box' }
const muted: React.CSSProperties = { fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6 }

function Btn({ children, onClick, disabled, ghost, title }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; ghost?: boolean; title?: string }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={title}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 9, fontSize: 14.5, fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? .6 : 1,
        background: ghost ? 'var(--surface)' : ACCENT, color: ghost ? 'var(--text)' : '#fff', border: ghost ? '1px solid var(--border)' : 'none' }}>
      {children}
    </button>
  )
}

function Pill({ ok, yes, no }: { ok: boolean; yes: string; no: string }) {
  return (
    <span style={{ fontSize: 13, fontWeight: 700, padding: '2px 9px', borderRadius: 99, background: ok ? '#dcfce7' : '#fef3c7', color: ok ? '#166534' : '#92400e' }}>
      {ok ? yes : no}
    </span>
  )
}

const fmt = (iso?: string | null) => iso ? new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '—'

function CopyLine({ label, value, onCopy }: { label: string; value: string; onCopy: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      {label && <span style={{ fontSize: 14, color: 'var(--text-muted)', minWidth: 200 }}>{label}</span>}
      <code style={{ flex: 1, fontSize: 13.5, wordBreak: 'break-all', background: 'var(--background)', padding: '6px 9px', borderRadius: 7 }}>{value}</code>
      <Btn ghost onClick={() => onCopy(value)}><i className="fas fa-copy" /> Copier</Btn>
    </div>
  )
}

function InstanceLti({ inst, onChanged, onCopy }: { inst: LtiInstance; onChanged: () => void; onCopy: (v: string) => void }) {
  const { success, error } = useToast()
  const [hook, setHook] = useState<Webhook | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => { api.get<Webhook>(`/api/admin/moodle/instances/${inst.id}/webhook`).then(setHook).catch(() => {}) }, [inst.id])

  async function save(body: Record<string, unknown>, ok: string) {
    setBusy('save')
    try { await api.put(`/api/admin/moodle/instances/${inst.id}`, body); success(ok); onChanged() }
    catch (e: any) { error(e.message || 'Enregistrement impossible') }
    finally { setBusy(null) }
  }
  async function newSecret() {
    setBusy('hook')
    try { setHook(await api.post<Webhook>(`/api/admin/moodle/instances/${inst.id}/webhook`, {})); success('Nouvelle adresse créée : mettez-la à jour dans Moodle') }
    catch (e: any) { error(e.message) } finally { setBusy(null) }
  }
  async function runFull() {
    setBusy('full')
    try { await api.post(`/api/admin/moodle/instances/${inst.id}/auto-sync/run`, {}); success('Synchronisation complète lancée (plusieurs minutes)'); setTimeout(onChanged, 4000) }
    catch (e: any) { error(e.message) } finally { setBusy(null) }
  }

  const report = inst.auto_sync_last_report
  const summary = (() => {
    if (!report) return null
    const d = report.detail
    if (Array.isArray(d)) {
      const sum = (k: string) => d.reduce((a: number, x: any) => a + (x[k] || 0), 0)
      const parts = [`${d.length} cours synchronisé(s) après un changement dans Moodle`]
      for (const [k, label] of [['students_created', 'comptes créés'], ['enrollments_added', 'inscriptions ajoutées'], ['enrollments_removed', 'inscriptions retirées'],
                                ['teachers_assigned', 'affectations ajoutées'], ['teachers_removed', 'affectations retirées'], ['names_updated', 'noms mis à jour'],
                                ['formation_changed', 'formations changées']] as [string, string][]) {
        if (sum(k)) parts.push(`${sum(k)} ${label}`)
      }
      if (d.some((x: any) => x.removal_suspended)) parts.push('retraits suspendus sur un cours (à vérifier)')
      if (d.some((x: any) => x.error)) parts.push('avec erreurs')
      return parts.join(' · ')
    }
    if (d && typeof d === 'object') {
      const parts = [`synchronisation complète : ${d.courses_synced ?? 0} cours`]
      if (d.errors?.length) parts.push(`${d.errors.length} erreur(s)`)
      return parts.join(' · ')
    }
    return null
  })()

  return (
    <div style={{ ...box, gap: 14 }}>
      <div style={{ fontWeight: 800, fontSize: 16 }}>{inst.name}</div>

      {/* 1. Enregistrement */}
      <div style={{ display: 'grid', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontWeight: 700 }}>
          CEI enregistré dans Moodle (dépôt des notes) <Pill ok={!!inst.lti_configured} yes="Enregistré" no="À faire" />
        </div>
        {inst.lti_configured
          ? <div style={muted}>Identifiant client <code>{inst.lti_client_id}</code> · déploiement <code>{inst.lti_deployment_id}</code> — retenus automatiquement.</div>
          : <div style={muted}>Collez l&apos;adresse d&apos;enregistrement ci-dessus dans Moodle, puis activez l&apos;outil. Rechargez cette page ensuite.</div>}
      </div>

      {/* Surveillance des changements */}
      <div style={{ display: 'grid', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontWeight: 700 }}>
          Synchronisation automatique (surveillance des changements Moodle) <Pill ok={!!inst.auto_sync_enabled} yes="Activée" no="Désactivée" />
        </div>
        <div style={muted}>
          Sans rien installer sur Moodle : CEI regarde lui-même ce qui change — cours et catégories chaque minute, enseignants toutes les 5 minutes,
          inscrits de chaque cours environ toutes les 10 minutes — et synchronise aussitôt le cours concerné (ajouts, mises à jour, retraits des liens venus de Moodle).
          Synchronisation complète chaque nuit (1 h). Dernier traitement : {fmt(inst.auto_sync_last_at)} · dernière synchronisation complète : {fmt(inst.auto_sync_last_full_at)}
          {summary && <><br />Dernier bilan ({fmt(report?.at)}) : {summary}</>}
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Btn onClick={() => save({ auto_sync_enabled: !inst.auto_sync_enabled }, inst.auto_sync_enabled ? 'Synchronisation automatique désactivée' : 'Synchronisation automatique activée')} disabled={busy === 'save'}>
            <i className={`fas ${inst.auto_sync_enabled ? 'fa-pause' : 'fa-play'}`} /> {inst.auto_sync_enabled ? 'Désactiver' : 'Activer'}
          </Btn>
          <Btn ghost onClick={runFull} disabled={!!busy}><i className="fas fa-rotate" /> Synchronisation complète maintenant</Btn>
        </div>
      </div>
      <details>
        <summary style={{ cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>Webhook (facultatif)</summary>
        <div style={{ marginTop: 8 }}>
      {/* Webhook (facultatif) */}
      <div style={{ display: 'grid', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontWeight: 700 }}>
          Webhook (facultatif) <Pill ok={!!inst.webhook_last_at} yes={`Reçu ${fmt(inst.webhook_last_at)}`} no="Non utilisé" />
        </div>
        <div style={muted}>
          Inutile pour le fonctionnement : la surveillance ci-dessus suffit. Seulement si l&apos;UNCHK installe un jour une extension de webhooks sur Moodle,
          cette adresse permettrait de réagir en quelques secondes au lieu de quelques minutes.
        </div>
        {hook && <CopyLine label="" value={hook.url} onCopy={onCopy} />}
        {hook && (
          <details><summary style={{ cursor: 'pointer', fontSize: 14 }}>Événements Moodle à cocher ({hook.events.length})</summary>
            <div style={{ ...muted, marginTop: 6, fontFamily: 'monospace', fontSize: 13 }}>{hook.events.join('  ·  ')}</div>
          </details>
        )}
        <div><Btn ghost onClick={newSecret} disabled={busy === 'hook'} title="L'ancienne adresse cessera de fonctionner"><i className="fas fa-key" /> Nouvelle adresse secrète</Btn></div>
      </div>

        </div>
      </details>
    </div>
  )
}

export default function LtiPanel({ instances, onChanged }: { instances: LtiInstance[]; onChanged: () => void }) {
  const { success, error } = useToast()
  const [toolCfg, setToolCfg] = useState<ToolConfig | null>(null)
  const [grades, setGrades] = useState<GradeRow[] | null>(null)
  const [pushing, setPushing] = useState<number | null>(null)
  const active = instances.filter(i => i.is_active)

  const loadGrades = useCallback(async () => {
    try { setGrades((await api.get<{ exams: GradeRow[] }>('/api/admin/moodle/lti/grades')).exams) } catch { setGrades([]) }
  }, [])
  useEffect(() => {
    api.get<ToolConfig>('/api/admin/moodle/lti/tool-config').then(setToolCfg).catch(() => {})
    loadGrades()
  }, [loadGrades])

  function copy(text: string) { navigator.clipboard?.writeText(text).then(() => success('Copié'), () => {}) }
  async function pushGrades(examId: number) {
    setPushing(examId)
    try {
      const r = await api.aiPost<any>(`/api/admin/moodle/lti/grades/${examId}`, { dry_run: false })
      if (r.error) error(r.error)
      else if (r.skipped) error(`Non envoyé : ${r.skipped}`)
      else success(`${r.pushed} note(s) déposée(s) dans Moodle${r.not_in_moodle?.length ? ` — ${r.not_in_moodle.length} étudiant(s) absent(s) du cours Moodle` : ''}`)
      loadGrades()
    } catch (e: any) { error(e.message || 'Envoi impossible') }
    finally { setPushing(null) }
  }

  if (!active.length) return null
  return (
    <section style={card}>
      <div style={cardHead}>
        <h3 style={{ margin: 0, fontSize: 18.5, fontWeight: 700 }}><i className="fas fa-puzzle-piece" style={{ color: ACCENT, marginRight: 8 }} />CEI dans Moodle (LTI), webhook et synchronisation automatique</h3>
      </div>
      <div style={{ padding: '16px 22px', display: 'grid', gap: 16 }}>
        <ul style={{ margin: 0, paddingLeft: 20, ...muted, display: 'grid', gap: 4 }}>
          <li>Le bouton « CEI » du menu de Moodle (sur toutes les pages, dans tous les cours) ouvre le tableau de bord CEI de la personne (étudiant, enseignant, admin) à la place de Moodle, sans reconnexion. « Retour à Moodle », la flèche Retour et la déconnexion ramènent à Moodle.</li>
          <li>À la publication des résultats, CEI crée une colonne « Examen CEI – titre » dans le carnet de notes du cours et y dépose les notes sur 20.</li>
        </ul>
        {toolCfg && (
          <div style={box}>
            <div style={{ fontWeight: 700 }}>Bouton « CEI » dans le menu de Moodle — une ligne, une fois par Moodle</div>
            <div style={muted}>Moodle : Administration du site → Présentation → Réglages des thèmes → « Éléments du menu personnalisé » : ajoutez cette ligne puis enregistrez. Le bouton apparaît sur toutes les pages de Moodle, pour tout le monde.</div>
            <CopyLine label="" value={`CEI|${toolCfg.moodle_menu_url}`} onCopy={copy} />
          </div>
        )}
        {toolCfg && (
          <div style={box}>
            <div style={{ fontWeight: 700 }}>Adresse d&apos;enregistrement de CEI (dépôt des notes) — à coller une fois dans chaque Moodle</div>
            <div style={muted}>Moodle : Administration du site → Plugins → Modules d&apos;activité → Outil externe → Gérer les outils → champ « URL de l&apos;outil » → « Ajouter LTI Advantage », puis « Activer » sur la carte CEI. CEI récupère seul son identifiant client et son déploiement.</div>
            <CopyLine label="" value={toolCfg.registration_url} onCopy={copy} />
            <details><summary style={{ cursor: 'pointer', fontSize: 14 }}>Configuration manuelle (si l&apos;enregistrement automatique n&apos;est pas possible)</summary>
              <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
                <CopyLine label="URL de l’outil" value={toolCfg.tool_url} onCopy={copy} />
                <CopyLine label="URL de connexion" value={toolCfg.initiate_login_url} onCopy={copy} />
                <CopyLine label="URI de redirection" value={toolCfg.redirection_uris} onCopy={copy} />
                <CopyLine label="Keyset URL" value={toolCfg.public_keyset_url} onCopy={copy} />
              </div>
            </details>
          </div>
        )}
        {active.map(i => <InstanceLti key={i.id} inst={i} onChanged={onChanged} onCopy={copy} />)}
        {grades && grades.length > 0 && (
          <div style={{ display: 'grid', gap: 6 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Notes publiées → carnet Moodle</div>
            <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 10 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, minWidth: 560 }}>
                <tbody>
                  {grades.map(g => (
                    <tr key={g.exam_id} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={{ padding: '8px 12px' }}>{g.title}</td>
                      <td style={{ padding: '8px 12px', color: g.last_error ? '#b91c1c' : 'var(--text-muted)' }}>
                        {g.last_error ? g.last_error : g.pushed_at ? `${g.pushed_count} note(s) le ${fmt(g.pushed_at)}` : 'pas encore envoyées'}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                        <Btn ghost onClick={() => pushGrades(g.exam_id)} disabled={pushing === g.exam_id}>
                          <i className={`fas ${pushing === g.exam_id ? 'fa-spinner fa-spin' : 'fa-paper-plane'}`} /> {g.pushed_at ? 'Renvoyer' : 'Envoyer'}
                        </Btn>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
