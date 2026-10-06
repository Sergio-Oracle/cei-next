'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import api from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'

/* Page Administration → Moteur RAG. Relie CEI à un serveur RAGFlow de façon
   graphique : adresse + clé API (chiffrée côté serveur), test de connexion,
   modèles, état de l'indexation, ré-indexation. Un seul moteur en service :
   changer de serveur = ajouter le nouveau puis le mettre en service, l'ancien
   reste actif tant que le nouveau n'est pas prêt. */

const ACCENT = '#3b82f6'
const DANGER = '#ef4444'

interface Diagnosis {
  ok: boolean; problems?: string[]
  components?: Record<string, string>
  models?: { name: string; provider: string; types: string[] }[]
  default_models?: { type: string; name: string; provider: string }[]
  datasets?: number; documents?: number; chunks?: number
}
interface Engine {
  id: number; name: string; base_url: string; key_hint: string; is_active: boolean
  auto_index: boolean; first_index_at: string | null; auto_index_last_at: string | null
  auto_index_report: { at: string; changes?: { ec_code: string; sent?: number; removed?: number; errors?: { file: string; error: string }[] }[] } | null
  last_check_at: string | null; last_check_ok: boolean | null; last_check: Diagnosis | null
}
interface DatasetStatus {
  id: string; name: string; documents: number; chunks: number; embedding_model: string
  running: number; failed: number; failed_docs: { id: string; name: string; error: string }[]
}

interface DatasetDoc {
  id: string; name: string; state: 'ready' | 'running' | 'queued' | 'failed'; progress: number; chunks: number; size: number
  duration: number | null; queue_position: number | null; module: string | null; section: string | null
  layout: string | null; attempts: number; error: string | null; last_message: string | null; from_moodle: boolean
}
interface DatasetDetail { dataset_id: string; ec_code: string | null; ec_name: string | null; counts: Record<string, number>; documents: DatasetDoc[] }

const DOC_STATE: Record<DatasetDoc['state'], [string, string, string]> = {
  ready: ['Prêt', '#047857', '#d1fae5'], running: ['En cours', '#b45309', '#fef3c7'],
  queued: ['En file d’attente', '#475569', '#e2e8f0'], failed: ['Échec', '#b91c1c', '#fee2e2'],
}

function fmtDuration(s: number) {
  if (s < 60) return `${Math.round(s)} s`
  if (s < 3600) return `${Math.floor(s / 60)} min ${Math.round(s % 60)} s`
  return `${Math.floor(s / 3600)} h ${Math.round((s % 3600) / 60)} min`
}

function DatasetDetails({ engineId, datasetId }: { engineId: number; datasetId: string }) {
  const [data, setData] = useState<DatasetDetail | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<'all' | DatasetDoc['state']>('all')
  const load = useCallback(async () => {
    setLoading(true); setErr(null)
    try { setData(await api.get<DatasetDetail>(`/api/admin/rag/engines/${engineId}/datasets/${datasetId}/documents`)) }
    catch (e: any) { setErr(e.message || 'Détail indisponible') }
    finally { setLoading(false) }
  }, [engineId, datasetId])
  useEffect(() => { load() }, [load])
  if (err) return <div style={{ color: '#b91c1c', fontSize: 14 }}><i className="fas fa-circle-exclamation" /> {err}</div>
  if (!data) return <div style={{ color: 'var(--text-muted)', fontSize: 14 }}><i className="fas fa-spinner fa-spin" /> Lecture des documents…</div>
  const docs = data.documents.filter(d => filter === 'all' || d.state === filter)
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {([['all', `Tous (${data.documents.length})`], ...(['failed', 'running', 'queued', 'ready'] as const).filter(k => data.counts[k]).map(k => [k, `${DOC_STATE[k][0]} (${data.counts[k]})`])] as [string, string][]).map(([k, label]) => (
          <button key={k} type="button" onClick={() => setFilter(k as any)}
            style={{ fontSize: 13.5, padding: '4px 12px', borderRadius: 99, cursor: 'pointer', border: `1.5px solid ${filter === k ? ACCENT : 'var(--border)'}`, background: filter === k ? '#eff6ff' : 'var(--surface)', color: filter === k ? '#1d4ed8' : 'var(--text)', fontWeight: 600 }}>
            {label}
          </button>
        ))}
        <button type="button" onClick={load} disabled={loading}
          style={{ marginLeft: 'auto', fontSize: 13.5, background: 'none', border: 'none', color: ACCENT, fontWeight: 600, cursor: 'pointer' }}>
          <i className={`fas ${loading ? 'fa-spinner fa-spin' : 'fa-rotate'}`} /> Actualiser
        </button>
      </div>
      <div style={{ display: 'grid', gap: 6, maxHeight: 460, overflowY: 'auto', paddingRight: 2 }}>
        {docs.map(d => {
          const [label, color, bg] = DOC_STATE[d.state]
          return (
            <div key={d.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px', background: 'var(--surface)', display: 'grid', gap: 4 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12.5, fontWeight: 700, padding: '2px 9px', borderRadius: 99, color, background: bg, whiteSpace: 'nowrap' }}>
                  {label}{d.state === 'running' && d.progress > 0 ? ` · ${Math.round(d.progress * 100)} %` : ''}
                </span>
                <strong style={{ fontSize: 14.5, flex: 1, minWidth: 180, wordBreak: 'break-word' }}>{d.name}</strong>
                <span style={{ fontSize: 13, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  {[d.size ? fmtMb(d.size) : null, d.chunks ? `${d.chunks} fragment${d.chunks > 1 ? 's' : ''}` : null,
                    d.duration ? `indexé en ${fmtDuration(d.duration)}` : null].filter(Boolean).join(' · ')}
                </span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                {d.from_moodle ? [d.section, d.module].filter(Boolean).join(' › ') || 'Cours Moodle' : 'Ajouté directement dans RAGFlow'}
                {d.layout === 'DeepDOC' && ' · reconnaissance de caractères (document scanné)'}
                {d.queue_position ? ` · position ${d.queue_position.toLocaleString('fr-FR')} dans la file` : ''}
                {d.attempts ? ` · relancé ${d.attempts} fois` : ''}
              </div>
              {d.state === 'running' && d.last_message && <div style={{ fontSize: 12.5, color: '#b45309' }}>{d.last_message}</div>}
              {d.error && <div style={{ fontSize: 13, color: '#b91c1c', wordBreak: 'break-word' }}><i className="fas fa-circle-exclamation" style={{ marginRight: 5 }} />{d.error}</div>}
            </div>
          )
        })}
        {docs.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Aucun document dans cette catégorie.</div>}
      </div>
    </div>
  )
}

interface RagEc { ec_id: number; ec_code: string; ec_name: string; ready: number; indexing: number; failed: number }
interface EcReport {
  ec_code: string; error?: string; skipped?: string; documents?: number
  to_add?: string[]; to_update?: string[]; to_retry?: string[]; to_remove?: string[]; unchanged?: number
  indexing?: number; failed?: number; bytes_to_send?: number
  sent?: number; removed?: number; retried?: number; errors?: { file: string; error: string }[]
}

function fmtMb(b: number) { return b < 1024 * 1024 ? `${Math.max(0, Math.round(b / 1024))} Ko` : `${(b / 1024 / 1024).toFixed(1)} Mo` }

const COMPONENT_LABELS: Record<string, string> = {
  db: 'Base de données', doc_engine: 'Moteur documentaire', redis: 'File de tâches (Redis)', storage: 'Stockage des fichiers',
}
const TYPE_LABELS: Record<string, string> = {
  embedding: 'Embedding', chat: 'Conversation', rerank: 'Reclassement', image2text: 'Vision', speech2text: 'Audio', tts: 'Synthèse vocale', ocr: 'OCR',
}

const inputStyle: React.CSSProperties = { width: '100%', padding: '9px 12px', border: '1.5px solid var(--border)', borderRadius: 9, fontSize: 15.5, background: 'var(--surface)', color: 'var(--text)', boxSizing: 'border-box' }
const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }
const cardHead: React.CSSProperties = { padding: '16px 22px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }

function Button({ children, onClick, disabled, variant = 'primary', title }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; variant?: 'primary' | 'ghost' | 'danger'; title?: string }) {
  const styles: Record<string, React.CSSProperties> = {
    primary: { background: ACCENT, color: 'white', border: 'none' },
    ghost:   { background: 'transparent', color: 'var(--text)', border: '1.5px solid var(--border)' },
    danger:  { background: 'transparent', color: DANGER, border: `1.5px solid ${DANGER}` },
  }
  return (
    <button type="button" title={title} onClick={onClick} disabled={disabled}
      style={{ ...styles[variant], padding: '8px 16px', borderRadius: 9, fontSize: 15, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? .55 : 1, display: 'inline-flex', alignItems: 'center', gap: 7 }}>
      {children}
    </button>
  )
}

function StatusPill({ e }: { e: Engine }) {
  let label = 'Non testé', color = 'var(--text-muted)', bg = 'var(--border)'
  if (e.is_active) { label = 'En service'; color = '#047857'; bg = '#d1fae5' }
  else if (e.last_check_ok === true) { label = 'Prêt'; color = '#1d4ed8'; bg = '#dbeafe' }
  else if (e.last_check_ok === false) { label = 'À régler'; color = '#b91c1c'; bg = '#fee2e2' }
  return <span style={{ fontSize: 13, fontWeight: 700, padding: '3px 10px', borderRadius: 99, color, background: bg, whiteSpace: 'nowrap' }}>{label}</span>
}

function DiagnosisBox({ d }: { d: Diagnosis }) {
  const embedding = (d.default_models || []).find(m => m.type === 'embedding')
  return (
    <div style={{ fontSize: 14.5, display: 'grid', gap: 8, padding: '12px 14px', borderRadius: 10, background: d.ok ? '#eff6ff' : '#fef2f2', border: `1px solid ${d.ok ? '#bfdbfe' : '#fecaca'}` }}>
      {d.ok && <div style={{ color: '#1d4ed8', fontWeight: 600 }}><i className="fas fa-check-circle" style={{ marginRight: 6 }} />Moteur prêt pour CEI</div>}
      {(d.problems || []).map((p, i) => <div key={i} style={{ color: '#b91c1c' }}><i className="fas fa-circle-exclamation" style={{ marginRight: 6 }} />{p}</div>)}
      {d.components && Object.keys(d.components).length > 0 && (
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          {Object.entries(d.components).map(([k, v]) => (
            <span key={k} style={{ color: v === 'ok' ? '#047857' : '#b91c1c' }}>
              <i className={`fas ${v === 'ok' ? 'fa-circle-check' : 'fa-circle-xmark'}`} style={{ marginRight: 5 }} />{COMPONENT_LABELS[k] || k}
            </span>
          ))}
        </div>
      )}
      {d.models && (
        <div style={{ color: 'var(--text-muted)' }}>
          Embedding par défaut : <strong style={{ color: 'var(--text)' }}>{embedding ? `${embedding.name} (${embedding.provider})` : 'aucun'}</strong>
          {d.models.length > 0 && <> · {d.models.length} modèle{d.models.length > 1 ? 's' : ''} disponible{d.models.length > 1 ? 's' : ''} : {d.models.map(m => `${m.name} [${m.types.map(t => TYPE_LABELS[t] || t).join(', ')}]`).join(' · ')}</>}
        </div>
      )}
      {d.datasets !== undefined && (
        <div style={{ color: 'var(--text-muted)' }}>
          {d.datasets} base{d.datasets > 1 ? 's' : ''} documentaire{d.datasets > 1 ? 's' : ''} · {d.documents} document{(d.documents || 0) > 1 ? 's' : ''} · {d.chunks} fragment{(d.chunks || 0) > 1 ? 's' : ''} indexé{(d.chunks || 0) > 1 ? 's' : ''}
        </div>
      )}
    </div>
  )
}

const emptyForm = { name: '', base_url: '', api_key: '' }

export default function AdminRagPage() {
  const { success, error } = useToast()
  const [engines, setEngines] = useState<Engine[]>([])
  const [loading, setLoading] = useState(true)

  const [formOpen, setFormOpen] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [formDiagnosis, setFormDiagnosis] = useState<Diagnosis | null>(null)
  const [busy, setBusy] = useState<string | null>(null)   // `${action}-${id}`
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null)
  const [confirmDeactivate, setConfirmDeactivate] = useState<number | null>(null)
  const [confirmReindexAll, setConfirmReindexAll] = useState(false)

  const [status, setStatus] = useState<DatasetStatus[] | null>(null)
  const [openDataset, setOpenDataset] = useState<string | null>(null)
  const [statusLoading, setStatusLoading] = useState(false)
  const [statusError, setStatusError] = useState<string | null>(null)

  const active = engines.find(e => e.is_active) || null

  /* ── Documents des cours Moodle ── */
  const [ragEcs, setRagEcs] = useState<RagEc[] | null>(null)
  const [ecsError, setEcsError] = useState<string | null>(null)
  const [ecFilter, setEcFilter] = useState('')
  const [docRun, setDocRun] = useState<null | 'dry' | 'apply'>(null)
  const [docMode, setDocMode] = useState<null | 'dry' | 'apply'>(null)
  const [docProgress, setDocProgress] = useState({ done: 0, total: 0, current: '' })
  const [docResults, setDocResults] = useState<EcReport[]>([])
  const [confirmDocApply, setConfirmDocApply] = useState(false)
  const docStop = useRef(false)

  const loadEcs = useCallback(async () => {
    setEcsError(null)
    try { setRagEcs((await api.get<{ ecs: RagEc[] }>('/api/admin/rag/ecs')).ecs || []) }
    catch (e: any) { setRagEcs([]); setEcsError(e.message || 'Cours Moodle indisponibles') }
  }, [])
  useEffect(() => { if (active) loadEcs(); else setRagEcs(null) }, [active?.id, loadEcs]) // eslint-disable-line

  const ecTargets = (ragEcs || []).filter(e => !ecFilter.trim() || `${e.ec_code} ${e.ec_name}`.toLowerCase().includes(ecFilter.trim().toLowerCase()))

  async function runDocs(mode: 'dry' | 'apply') {
    if (!ecTargets.length) return
    setConfirmDocApply(false); docStop.current = false
    setDocRun(mode); setDocMode(mode); setDocResults([])
    const acc: EcReport[] = []
    for (let i = 0; i < ecTargets.length; i++) {
      if (docStop.current) break
      const ec = ecTargets[i]
      setDocProgress({ done: i, total: ecTargets.length, current: ec.ec_code })
      try { acc.push(await api.aiPost<EcReport>('/api/admin/rag/sync/ec', { ec_code: ec.ec_code, dry_run: mode === 'dry' })) }
      catch (e: any) { acc.push({ ec_code: ec.ec_code, error: e.message || 'Erreur' }) }
      setDocResults([...acc])
    }
    setDocProgress(p => ({ ...p, done: acc.length, current: '' }))
    setDocRun(null)
    if (docStop.current) error(`Arrêtée après ${acc.length} cours sur ${ecTargets.length}`)
    else success(mode === 'dry' ? 'Simulation terminée : rien n’a été envoyé' : 'Documents envoyés : l’indexation se poursuit dans RAGFlow')
    if (mode === 'apply') { loadEcs(); loadEngines(); if (active) loadStatus(active.id) }
  }

  async function toggleAuto(enabled: boolean) {
    if (!active) return
    setBusy('auto')
    try {
      await api.post(`/api/admin/rag/engines/${active.id}/auto-index`, { enabled })
      success(enabled ? 'Indexation automatique activée' : 'Indexation automatique désactivée')
      await loadEngines()
    } catch (e: any) { error(e.message || 'Modification impossible') }
    finally { setBusy(null) }
  }

  const docTotals = docResults.reduce((t, r) => ({
    add: t.add + (r.to_add?.length || 0), update: t.update + (r.to_update?.length || 0), retry: t.retry + (r.to_retry?.length || 0),
    remove: t.remove + (r.to_remove?.length || 0), unchanged: t.unchanged + (r.unchanged || 0), bytes: t.bytes + (r.bytes_to_send || 0),
    sent: t.sent + (r.sent || 0), errors: t.errors + (r.error ? 1 : 0) + (r.errors?.length || 0), skipped: t.skipped + (r.skipped ? 1 : 0),
  }), { add: 0, update: 0, retry: 0, remove: 0, unchanged: 0, bytes: 0, sent: 0, errors: 0, skipped: 0 })
  const ecTotals = (ragEcs || []).reduce((t, e) => ({ ready: t.ready + e.ready, indexing: t.indexing + e.indexing, failed: t.failed + e.failed, withDocs: t.withDocs + (e.ready || e.indexing || e.failed ? 1 : 0) }),
                                           { ready: 0, indexing: 0, failed: 0, withDocs: 0 })

  const loadEngines = useCallback(async () => {
    try {
      const res = await api.get<{ engines: Engine[] }>('/api/admin/rag/engines')
      setEngines(res.engines || [])
    } catch (e: any) { error(e.message || 'Chargement des moteurs impossible') }
    finally { setLoading(false) }
  }, []) // eslint-disable-line

  const loadStatus = useCallback(async (id: number) => {
    setStatusLoading(true); setStatusError(null)
    try { setStatus((await api.get<{ datasets: DatasetStatus[] }>(`/api/admin/rag/engines/${id}/status`)).datasets || []) }
    catch (e: any) { setStatus(null); setStatusError(e.message || 'État indisponible') }
    finally { setStatusLoading(false) }
  }, [])

  useEffect(() => { loadEngines() }, [loadEngines])
  useEffect(() => { if (active) loadStatus(active.id); else setStatus(null) }, [active?.id, loadStatus]) // eslint-disable-line

  function openAdd() { setEditId(null); setForm(emptyForm); setFormDiagnosis(null); setFormOpen(true) }
  function openEdit(e: Engine) { setEditId(e.id); setForm({ name: e.name, base_url: e.base_url, api_key: '' }); setFormDiagnosis(null); setFormOpen(true) }

  async function saveEngine() {
    if (!form.name.trim() || !form.base_url.trim() || (!editId && !form.api_key.trim())) {
      error(editId ? 'Nom et adresse requis' : 'Nom, adresse et clé API requis'); return
    }
    setSaving(true); setFormDiagnosis(null)
    const body: any = { name: form.name.trim(), base_url: form.base_url.trim() }
    if (form.api_key.trim()) body.api_key = form.api_key.trim()
    try {
      const res = editId
        ? await api.put<{ engine: Engine; diagnosis: Diagnosis | null }>(`/api/admin/rag/engines/${editId}`, body)
        : await api.post<{ engine: Engine; diagnosis: Diagnosis }>('/api/admin/rag/engines', body)
      if (res.diagnosis) setFormDiagnosis(res.diagnosis)
      if (!res.diagnosis || res.diagnosis.ok) setFormOpen(false)
      success(editId ? 'Moteur modifié' : res.engine.is_active ? 'Moteur ajouté et mis en service' : 'Moteur ajouté')
      await loadEngines()
    } catch (e: any) { error(e.message || 'Enregistrement impossible') }
    finally { setSaving(false) }
  }

  async function act(action: 'test' | 'activate' | 'deactivate', e: Engine) {
    setBusy(`${action}-${e.id}`); setConfirmDeactivate(null)
    try {
      const res = await api.post<{ diagnosis?: Diagnosis }>(`/api/admin/rag/engines/${e.id}/${action}`)
      if (action === 'test') res.diagnosis?.ok ? success('Moteur prêt') : error('Le moteur a des problèmes, voir le détail')
      if (action === 'activate') success(`« ${e.name} » est maintenant en service`)
      if (action === 'deactivate') success('Moteur retiré du service : CEI n’utilise plus de RAG')
      await loadEngines()
    } catch (err: any) { error(err.message || 'Action impossible'); await loadEngines() }
    finally { setBusy(null) }
  }

  async function deleteEngine(id: number) {
    try {
      await api.delete(`/api/admin/rag/engines/${id}`)
      success('Moteur supprimé'); setConfirmDelete(null)
      await loadEngines()
    } catch (e: any) { error(e.message || 'Suppression impossible') }
  }

  async function reindex(scope: 'failed' | 'all') {
    if (!active) return
    setConfirmReindexAll(false); setBusy(`reindex-${scope}`)
    try {
      const r = await api.post<{ documents: number; datasets: number }>(`/api/admin/rag/engines/${active.id}/reindex`, { scope })
      r.documents ? success(`Indexation relancée : ${r.documents} document(s) dans ${r.datasets} base(s)`) : success('Aucun document à ré-indexer')
      await loadStatus(active.id)
    } catch (e: any) { error(e.message || 'Ré-indexation impossible') }
    finally { setBusy(null) }
  }

  const totals = (status || []).reduce((t, d) => ({ documents: t.documents + d.documents, chunks: t.chunks + d.chunks, running: t.running + d.running, failed: t.failed + d.failed }),
                                        { documents: 0, chunks: 0, running: 0, failed: 0 })

  return (
    <div style={{ display: 'grid', gap: 22 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 10 }}>
          <i className="fas fa-book-open-reader" style={{ color: 'var(--primary)' }} /> Moteur RAG
        </h2>
        <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 16.5 }}>
          Serveur RAGFlow qui indexe les documents de cours pour ancrer la génération des sujets dans la matière réellement enseignée.
        </p>
      </div>

      {/* ── État global ── */}
      {!loading && (
        <div style={{ ...card, padding: '14px 22px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                      borderColor: active ? '#a7f3d0' : 'var(--border)', background: active ? '#ecfdf5' : 'var(--surface)' }}>
          <i className={`fas ${active ? 'fa-circle-check' : 'fa-circle-pause'}`} style={{ fontSize: 22, color: active ? '#047857' : 'var(--text-muted)' }} />
          <div style={{ display: 'grid', gap: 2 }}>
            <strong style={{ color: active ? '#065f46' : 'var(--text)' }}>{active ? `RAG activé : « ${active.name} » en service` : 'RAG désactivé'}</strong>
            <span style={{ fontSize: 14, color: active ? '#047857' : 'var(--text-muted)' }}>
              {active ? 'CEI utilise ce moteur pour retrouver les passages de cours.' : 'Aucun moteur en service : la génération des sujets fonctionne sans RAG. Ajoutez un moteur ou mettez-en un en service.'}
            </span>
          </div>
        </div>
      )}

      {/* ── Moteurs ── */}
      <section style={card}>
        <div style={cardHead}>
          <h3 style={{ margin: 0, fontSize: 18.5, fontWeight: 700 }}><i className="fas fa-server" style={{ color: ACCENT, marginRight: 8 }} />Moteurs</h3>
          {!formOpen && <Button onClick={openAdd}><i className="fas fa-plus" /> Ajouter un moteur</Button>}
        </div>
        <div style={{ padding: '16px 22px', display: 'grid', gap: 14 }}>
          {formOpen && (
            <div style={{ border: '1.5px solid var(--border)', borderRadius: 12, padding: 16, display: 'grid', gap: 12 }}>
              <div style={{ fontWeight: 700 }}>{editId ? 'Modifier le moteur' : 'Nouveau moteur'}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                <label style={{ display: 'grid', gap: 5, fontSize: 14.5, fontWeight: 600 }}>Nom
                  <input id="rag-name" style={inputStyle} value={form.name} placeholder="Ex : RAGFlow préproduction" onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </label>
                <label style={{ display: 'grid', gap: 5, fontSize: 14.5, fontWeight: 600 }}>Adresse de l&apos;API
                  <input id="rag-url" style={inputStyle} value={form.base_url} placeholder="https://serveur-rag.unchk.sn ou http://127.0.0.1:19380" onChange={e => setForm(f => ({ ...f, base_url: e.target.value }))} />
                </label>
                <label style={{ display: 'grid', gap: 5, fontSize: 14.5, fontWeight: 600 }}>Clé API RAGFlow
                  <input id="rag-key" type="password" autoComplete="off" style={inputStyle} value={form.api_key}
                    placeholder={editId ? 'Laisser vide pour garder la clé actuelle' : 'ragflow-…'}
                    onChange={e => setForm(f => ({ ...f, api_key: e.target.value }))} />
                </label>
              </div>
              <div style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>
                La connexion est vérifiée avant l&apos;enregistrement. La clé est chiffrée et ne sera plus jamais affichée.
                {!editId && !active && ' Le premier moteur prêt est mis en service automatiquement.'}
              </div>
              <details style={{ fontSize: 14.5, background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '10px 14px' }}>
                <summary style={{ cursor: 'pointer', fontWeight: 600, color: '#1d4ed8' }}>Où trouver l&apos;adresse et la clé API ? (sans commande)</summary>
                <ol style={{ margin: '10px 0 4px', paddingLeft: 20, lineHeight: 1.75, color: 'var(--text)' }}>
                  <li>Ouvrez l&apos;interface web de RAGFlow dans le navigateur et connectez-vous (compte du service, pas un compte personnel : CEI travaille dans l&apos;espace de ce compte).</li>
                  <li>Cliquez sur l&apos;avatar en haut à droite, puis sur <strong>API</strong> dans le menu de gauche.</li>
                  <li>Cliquez sur <strong>Clé API</strong> puis <strong>Créer une nouvelle clé</strong>, et copiez la clé (elle commence par <code>ragflow-</code>).</li>
                  <li><strong>Adresse de l&apos;API</strong> : l&apos;adresse affichée sur cette même page (« Serveur API »). Si RAGFlow tourne sur le même serveur que CEI, préférez <code>http://127.0.0.1:&lt;port&gt;</code> : rien ne passe par le réseau. Sinon, l&apos;adresse web de RAGFlow, de préférence son propre nom de domaine sans numéro de port (ex. <code>https://serveur-rag.unchk.sn</code>).</li>
                  <li>Collez les deux ici puis « Vérifier et enregistrer ». Pour changer de serveur : ajoutez le nouveau moteur, puis « Basculer sur ce moteur ».</li>
                </ol>
                <div style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>Ne collez jamais la clé dans un message ou une capture d&apos;écran : en cas de fuite, supprimez-la dans RAGFlow et créez-en une autre.</div>
              </details>
              {formDiagnosis && <DiagnosisBox d={formDiagnosis} />}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <Button onClick={saveEngine} disabled={saving}>
                  <i className={`fas ${saving ? 'fa-spinner fa-spin' : 'fa-check'}`} /> {saving ? 'Vérification…' : 'Vérifier et enregistrer'}
                </Button>
                <Button variant="ghost" onClick={() => { setFormOpen(false); setFormDiagnosis(null) }}>{formDiagnosis && !formDiagnosis.ok ? 'Fermer' : 'Annuler'}</Button>
              </div>
            </div>
          )}

          {loading ? (
            <div style={{ color: 'var(--text-muted)' }}><i className="fas fa-spinner fa-spin" /> Chargement…</div>
          ) : engines.length === 0 ? (
            <div style={{ color: 'var(--text-muted)' }}>Aucun moteur. Ajoutez le serveur RAGFlow avec son adresse et une clé API créée dans RAGFlow.</div>
          ) : engines.map(e => (
            <div key={e.id} style={{ border: `1px solid ${e.is_active ? '#a7f3d0' : 'var(--border)'}`, borderRadius: 12, padding: '14px 16px', display: 'grid', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <div style={{ display: 'grid', gap: 3, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <strong style={{ fontSize: 16.5 }}>{e.name}</strong><StatusPill e={e} />
                  </div>
                  <div style={{ fontSize: 14, color: 'var(--text-muted)', wordBreak: 'break-all' }}>{e.base_url} · clé {e.key_hint}</div>
                  {e.last_check_at && <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Dernier test : {new Date(e.last_check_at).toLocaleString('fr-FR')}</div>}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Button variant="ghost" onClick={() => act('test', e)} disabled={busy === `test-${e.id}`}>
                    <i className={`fas ${busy === `test-${e.id}` ? 'fa-spinner fa-spin' : 'fa-stethoscope'}`} /> Tester
                  </Button>
                  <Button variant="ghost" onClick={() => openEdit(e)}><i className="fas fa-pen" /> Modifier</Button>
                  {e.is_active ? (
                    confirmDeactivate === e.id ? (
                      <>
                        <Button variant="danger" onClick={() => act('deactivate', e)} disabled={busy === `deactivate-${e.id}`}><i className="fas fa-power-off" /> Confirmer : désactiver le RAG</Button>
                        <Button variant="ghost" onClick={() => setConfirmDeactivate(null)}>Annuler</Button>
                      </>
                    ) : (
                      <Button variant="ghost" onClick={() => setConfirmDeactivate(e.id)}><i className="fas fa-power-off" /> Retirer du service</Button>
                    )
                  ) : (
                    <Button onClick={() => act('activate', e)} disabled={busy === `activate-${e.id}`}
                      title={active ? `Remplace « ${active.name} », qui reste en service si celui-ci n'est pas prêt` : undefined}>
                      <i className={`fas ${busy === `activate-${e.id}` ? 'fa-spinner fa-spin' : 'fa-play'}`} /> {active ? 'Basculer sur ce moteur' : 'Mettre en service'}
                    </Button>
                  )}
                  {!e.is_active && (confirmDelete === e.id ? (
                    <>
                      <Button variant="danger" onClick={() => deleteEngine(e.id)}><i className="fas fa-trash" /> Confirmer la suppression</Button>
                      <Button variant="ghost" onClick={() => setConfirmDelete(null)}>Annuler</Button>
                    </>
                  ) : (
                    <Button variant="danger" onClick={() => setConfirmDelete(e.id)} title="Supprimer"><i className="fas fa-trash" /></Button>
                  ))}
                </div>
              </div>
              {e.last_check && <DiagnosisBox d={e.last_check} />}
            </div>
          ))}
        </div>
      </section>

      {/* ── Indexation ── */}
      {active && (
        <section style={card}>
          <div style={cardHead}>
            <h3 style={{ margin: 0, fontSize: 18.5, fontWeight: 700 }}><i className="fas fa-layer-group" style={{ color: ACCENT, marginRight: 8 }} />Indexation des documents</h3>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Button variant="ghost" onClick={() => loadStatus(active.id)} disabled={statusLoading}><i className={`fas ${statusLoading ? 'fa-spinner fa-spin' : 'fa-rotate'}`} /> Actualiser</Button>
              <Button variant="ghost" onClick={() => reindex('failed')} disabled={!!busy}
                title="Documents en échec, annulés ou jamais indexés">
                <i className={`fas ${busy === 'reindex-failed' ? 'fa-spinner fa-spin' : 'fa-wrench'}`} /> Relancer les échecs
              </Button>
              {confirmReindexAll ? (
                <>
                  <Button variant="danger" onClick={() => reindex('all')} disabled={!!busy}><i className="fas fa-arrows-rotate" /> Confirmer : tout ré-indexer</Button>
                  <Button variant="ghost" onClick={() => setConfirmReindexAll(false)}>Annuler</Button>
                </>
              ) : (
                <Button variant="ghost" onClick={() => setConfirmReindexAll(true)} disabled={!!busy}><i className="fas fa-arrows-rotate" /> Tout ré-indexer</Button>
              )}
            </div>
          </div>
          <div style={{ padding: '16px 22px', display: 'grid', gap: 12 }}>
            {confirmReindexAll && (
              <div style={{ fontSize: 14.5, color: '#b45309', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '10px 14px' }}>
                Tout ré-indexer recalcule chaque fragment de chaque document : plusieurs heures pour un gros volume, pendant lesquelles les documents concernés ne sont pas interrogeables. À réserver à un changement de modèle d&apos;embedding.
              </div>
            )}
            {statusError ? (
              <div style={{ color: '#b91c1c', fontSize: 14.5 }}><i className="fas fa-circle-exclamation" /> {statusError}</div>
            ) : !status ? (
              <div style={{ color: 'var(--text-muted)' }}><i className="fas fa-spinner fa-spin" /> Lecture de l&apos;état…</div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
                  {([
                    ['Bases documentaires', status.length, 'var(--text)'],
                    ['Documents', totals.documents, 'var(--text)'],
                    ['Fragments indexés', totals.chunks, 'var(--text)'],
                    ['En attente ou en cours', totals.running, totals.running ? '#b45309' : 'var(--text)'],
                    ['En échec', totals.failed, totals.failed ? '#b91c1c' : 'var(--text)'],
                  ] as [string, number, string][]).map(([label, n, color]) => (
                    <div key={label} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px' }}>
                      <div style={{ fontSize: 24, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color }}>{n}</div>
                      <div style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>{label}</div>
                    </div>
                  ))}
                </div>
                {status.length === 0 ? (
                  <div style={{ color: 'var(--text-muted)', fontSize: 14.5 }}>Aucune base documentaire pour l&apos;instant : elles seront créées par EC lors de l&apos;indexation des documents de cours.</div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14.5 }}>
                      <thead>
                        <tr style={{ textAlign: 'left', color: 'var(--text-muted)' }}>
                          {['Base documentaire', 'Documents', 'Fragments', 'En attente ou en cours', 'En échec', 'Modèle d’embedding'].map(h => (
                            <th key={h} style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {status.map(d => (<React.Fragment key={d.id}>
                          <tr onClick={() => setOpenDataset(openDataset === d.id ? null : d.id)} title="Cliquer pour voir le détail des documents"
                            style={{ cursor: 'pointer', background: openDataset === d.id ? '#eff6ff' : undefined }}>
                            <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>
                              <i className={`fas ${openDataset === d.id ? 'fa-chevron-down' : 'fa-chevron-right'}`} style={{ fontSize: 11, color: ACCENT, marginRight: 8, width: 10 }} />
                              {d.name}
                              {d.failed_docs.length > 0 && (
                                <details style={{ fontWeight: 400, marginTop: 4 }} onClick={e => e.stopPropagation()}>
                                  <summary style={{ cursor: 'pointer', color: '#b91c1c', fontSize: 13.5 }}>Voir les échecs</summary>
                                  {d.failed_docs.map(f => (
                                    <div key={f.id} style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}><strong>{f.name}</strong> : {f.error || 'erreur inconnue'}</div>
                                  ))}
                                </details>
                              )}
                            </td>
                            <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)', fontVariantNumeric: 'tabular-nums' }}>{d.documents}</td>
                            <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)', fontVariantNumeric: 'tabular-nums' }}>{d.chunks}</td>
                            <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)', color: d.running ? '#b45309' : undefined }}>{d.running}</td>
                            <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)', color: d.failed ? '#b91c1c' : undefined }}>{d.failed}</td>
                            <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: 13.5 }}>{(d.embedding_model || '').split('@')[0]}</td>
                          </tr>
                          {openDataset === d.id && active && (
                            <tr><td colSpan={6} style={{ padding: '12px 10px 16px', borderBottom: '1px solid var(--border)', background: 'var(--background)' }}>
                              <DatasetDetails engineId={active.id} datasetId={d.id} />
                            </td></tr>
                          )}
                        </React.Fragment>))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      )}
      {/* ── Documents des cours Moodle ── */}
      {active && (
        <section style={card}>
          <div style={cardHead}>
            <h3 style={{ margin: 0, fontSize: 18.5, fontWeight: 700 }}><i className="fas fa-graduation-cap" style={{ color: ACCENT, marginRight: 8 }} />Documents des cours Moodle</h3>
            <Button variant="ghost" onClick={loadEcs} disabled={!!docRun}><i className="fas fa-rotate" /> Actualiser</Button>
          </div>
          <div style={{ padding: '16px 22px', display: 'grid', gap: 14 }}>
            <p style={{ margin: 0, fontSize: 14.5, color: 'var(--text-muted)', lineHeight: 1.6 }}>
              Chaque EC relié à un cours Moodle a sa base documentaire. Ses documents visibles (PDF, Word, texte, chapitres de livre) y sont indexés.
              Étapes : <strong>simulation</strong> (rien n&apos;est envoyé) → rapport → <strong>indexation réelle</strong> → <strong>indexation automatique</strong> des documents ajoutés, remplacés ou retirés dans Moodle.
            </p>

            {ecsError ? (
              <div style={{ color: '#b91c1c', fontSize: 14.5 }}><i className="fas fa-circle-exclamation" /> {ecsError}</div>
            ) : !ragEcs ? (
              <div style={{ color: 'var(--text-muted)' }}><i className="fas fa-spinner fa-spin" /> Lecture des cours Moodle…</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
                {([
                  ['Cours Moodle reliés', ragEcs.length, 'var(--text)'],
                  ['Cours avec documents indexés', ecTotals.withDocs, 'var(--text)'],
                  ['Documents prêts', ecTotals.ready, '#047857'],
                  ['En cours d’indexation', ecTotals.indexing, ecTotals.indexing ? '#b45309' : 'var(--text)'],
                  ['En échec', ecTotals.failed, ecTotals.failed ? '#b91c1c' : 'var(--text)'],
                ] as [string, number, string][]).map(([label, n, color]) => (
                  <div key={label} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px' }}>
                    <div style={{ fontSize: 24, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color }}>{n}</div>
                    <div style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>{label}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Indexation automatique */}
            <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ display: 'grid', gap: 3 }}>
                <strong style={{ fontSize: 15.5 }}>
                  <i className={`fas ${active.auto_index ? 'fa-circle-check' : 'fa-circle-pause'}`} style={{ color: active.auto_index ? '#047857' : 'var(--text-muted)', marginRight: 6 }} />
                  Indexation automatique {active.auto_index ? 'activée' : 'désactivée'}
                </strong>
                <span style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>
                  {active.auto_index
                    ? `Le service de synchronisation Moodle relit chaque cours environ toutes les 30 minutes.${active.auto_index_last_at ? ` Dernier changement traité : ${new Date(active.auto_index_last_at).toLocaleString('fr-FR')}.` : ''}`
                    : active.first_index_at ? 'Prête à être activée.' : 'Disponible après une première indexation réelle (simulation puis indexation).'}
                </span>
              </div>
              <Button variant={active.auto_index ? 'ghost' : 'primary'} onClick={() => toggleAuto(!active.auto_index)}
                disabled={busy === 'auto' || (!active.auto_index && !active.first_index_at)}>
                <i className={`fas ${busy === 'auto' ? 'fa-spinner fa-spin' : active.auto_index ? 'fa-pause' : 'fa-play'}`} /> {active.auto_index ? 'Désactiver' : 'Activer'}
              </Button>
            </div>
            {active.auto_index && active.auto_index_report?.changes && active.auto_index_report.changes.length > 0 && (
              <details><summary style={{ cursor: 'pointer', fontSize: 14.5 }}>Derniers changements traités automatiquement ({active.auto_index_report.changes.length})</summary>
                <div style={{ fontSize: 13.5, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.8 }}>
                  {active.auto_index_report.changes.map((c, k) => (
                    <div key={k}><strong>{c.ec_code}</strong> : {c.sent || 0} envoyé(s), {c.removed || 0} retiré(s){c.errors?.length ? `, ${c.errors.length} erreur(s)` : ''}</div>
                  ))}
                </div>
              </details>
            )}

            {/* Simulation / indexation */}
            {ragEcs && ragEcs.length > 0 && (
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <input style={{ ...inputStyle, maxWidth: 280 }} placeholder="Filtrer les cours (code ou nom)" value={ecFilter} onChange={e => setEcFilter(e.target.value)} disabled={!!docRun} />
                <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>{ecTargets.length} cours</span>
                {docRun ? (
                  <Button variant="danger" onClick={() => { docStop.current = true }}><i className="fas fa-stop" /> Arrêter</Button>
                ) : (
                  <>
                    <Button variant="ghost" onClick={() => runDocs('dry')} disabled={!ecTargets.length}><i className="fas fa-flask" /> Simuler</Button>
                    {confirmDocApply ? (
                      <>
                        <Button onClick={() => runDocs('apply')}><i className="fas fa-check" /> Confirmer l&apos;indexation</Button>
                        <Button variant="ghost" onClick={() => setConfirmDocApply(false)}>Annuler</Button>
                      </>
                    ) : (
                      <Button onClick={() => setConfirmDocApply(true)} disabled={!ecTargets.length || docMode !== 'dry' || !docResults.length}
                        title={docMode !== 'dry' ? 'Lancez d’abord une simulation' : undefined}>
                        <i className="fas fa-cloud-arrow-up" /> Indexer
                      </Button>
                    )}
                  </>
                )}
              </div>
            )}
            {confirmDocApply && (
              <div style={{ fontSize: 14.5, color: '#b45309', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '10px 14px' }}>
                {docTotals.add + docTotals.update} document(s) ({fmtMb(docTotals.bytes)}) seront téléchargés depuis Moodle et envoyés au moteur, {docTotals.remove} retiré(s).
                L&apos;indexation se poursuit ensuite dans RAGFlow, sur processeur : comptez quelques minutes par document.
              </div>
            )}
            {(docRun || docResults.length > 0) && (
              <div style={{ display: 'grid', gap: 10 }}>
                {docRun && (
                  <div style={{ fontSize: 14.5 }}>
                    <i className="fas fa-spinner fa-spin" style={{ color: ACCENT }} /> {docRun === 'dry' ? 'Simulation' : 'Indexation'} : {docProgress.done} / {docProgress.total}{docProgress.current && ` — ${docProgress.current}`}
                    <div style={{ height: 6, background: 'var(--border)', borderRadius: 99, marginTop: 6, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${docProgress.total ? (docProgress.done / docProgress.total) * 100 : 0}%`, background: ACCENT, transition: 'width .3s' }} />
                    </div>
                  </div>
                )}
                <div style={{ fontWeight: 700, fontSize: 15.5 }}>{docMode === 'dry' ? 'Rapport de simulation (rien n’a été envoyé)' : 'Bilan de l’indexation'}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
                  {(docMode === 'dry' ? [
                    ['Documents à indexer', docTotals.add], ['Documents remplacés dans Moodle', docTotals.update], ['Échecs à relancer', docTotals.retry],
                    ['Documents à retirer', docTotals.remove], ['Déjà à jour', docTotals.unchanged], ['Cours sans documents ni cours Moodle', docTotals.skipped],
                  ] : [
                    ['Documents envoyés', docTotals.sent], ['Documents retirés', docResults.reduce((t, r) => t + (r.removed || 0), 0)],
                    ['Échecs relancés', docResults.reduce((t, r) => t + (r.retried || 0), 0)], ['Erreurs', docTotals.errors],
                  ] as [string, number][]).map(([label, n]) => (
                    <div key={label} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px' }}>
                      <div style={{ fontSize: 22, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{n}</div>
                      <div style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>{label}</div>
                    </div>
                  ))}
                </div>
                {docMode === 'dry' && docTotals.bytes > 0 && <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>Volume à télécharger depuis Moodle : {fmtMb(docTotals.bytes)}</div>}
                <details>
                  <summary style={{ cursor: 'pointer', fontSize: 14.5 }}>Détail par cours ({docResults.length})</summary>
                  <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
                    {docResults.map(r => (
                      <div key={r.ec_code} style={{ fontSize: 13.5, borderBottom: '1px solid var(--border)', paddingBottom: 6 }}>
                        <strong>{r.ec_code}</strong>{' '}
                        {r.error ? <span style={{ color: '#b91c1c' }}>{r.error}</span>
                          : r.skipped ? <span style={{ color: 'var(--text-muted)' }}>{r.skipped}</span>
                          : <span style={{ color: 'var(--text-muted)' }}>
                              {r.documents} document(s) · {docMode === 'dry'
                                ? `${r.to_add?.length || 0} à indexer, ${r.to_update?.length || 0} remplacé(s), ${r.to_remove?.length || 0} à retirer, ${r.unchanged || 0} à jour`
                                : `${r.sent || 0} envoyé(s), ${r.removed || 0} retiré(s)`}
                            </span>}
                        {[...(r.to_add || []), ...(r.to_update || [])].length > 0 && docMode === 'dry' && (
                          <div style={{ color: 'var(--text-muted)', marginTop: 2 }}>{[...(r.to_add || []), ...(r.to_update || [])].join(' · ')}</div>
                        )}
                        {(r.errors || []).map((e, k) => <div key={k} style={{ color: '#b91c1c' }}>{e.file} : {e.error}</div>)}
                      </div>
                    ))}
                  </div>
                </details>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  )
}
