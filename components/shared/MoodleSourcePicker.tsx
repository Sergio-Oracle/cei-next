'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import api from '@/lib/api'

/* Source « Depuis Moodle » de Générer Suggestions (phase 3).
   L'enseignant choisit un de ses cours Moodle (= un de ses EC, affecté par la
   synchronisation) puis coche les documents du cours. Le niveau, la formation
   et l'EC viennent de la maquette : la page n'a plus à les demander. Le
   navigateur ne télécharge rien — le serveur récupère lui-même les fichiers
   cochés et vérifie qu'ils appartiennent bien au cours. */

export interface MoodleEc {
  ec_id: number; ec_code: string; ec_name: string; ue_code: string | null
  instance: string; moodle_course_id: number; moodle_course_name: string
  formation_id: number | null; formation_code: string | null; formation_name: string | null
  pole_id: number | null; pole_name: string | null; student_level: string | null
}
export interface MoodleSelection {
  ec: MoodleEc | null; files: string[]
  /** Moteur RAG : chapitre ou thème à cibler dans les documents indexés (facultatif). */
  focus?: string
}

interface RagDoc { fileurl: string; status: 'ready' | 'indexing' | 'failed'; chunks: number; error: string | null }

interface Material {
  fileurl: string; filename: string; title: string; extension: string; filesize: number
  section: string | null; module: string | null; supported: boolean
}

const ACCENT = '#3b82f6'

function fmtSize(bytes: number) {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} Ko`
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`
}

function extIcon(ext: string) {
  if (ext === 'pdf') return { icon: 'fa-file-pdf', color: '#ef4444' }
  if (ext === 'doc' || ext === 'docx') return { icon: 'fa-file-word', color: '#2563eb' }
  if (ext === 'html' || ext === 'htm') return { icon: 'fa-book-open', color: '#0d9488' }
  if (ext === 'txt') return { icon: 'fa-file-lines', color: '#64748b' }
  return { icon: 'fa-file', color: '#94a3b8' }
}

function RagBadge({ doc }: { doc?: RagDoc }) {
  const [label, color, bg, title] = !doc
    ? ['non indexé', 'var(--text-muted)', 'var(--border)', 'Pas encore dans le moteur RAG : lu en texte brut']
    : doc.status === 'ready' ? ['indexé', '#0f766e', '#ccfbf1', `${doc.chunks} passages indexés`]
    : doc.status === 'indexing' ? ['indexation…', '#b45309', '#fef3c7', 'Indexation en cours : lu en texte brut en attendant']
    : ['échec', '#b91c1c', '#fee2e2', doc.error || 'Indexation impossible : lu en texte brut']
  return <span title={title} style={{ fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 99, color, background: bg, whiteSpace: 'nowrap' }}>{label}</span>
}

export default function MoodleSourcePicker({ value, onChange, onLoaded }: {
  value: MoodleSelection
  onChange: (v: MoodleSelection) => void
  /** Appelé une fois la liste chargée, avec le nombre de cours disponibles. */
  onLoaded?: (count: number) => void
}) {
  const [courses, setCourses] = useState<MoodleEc[] | null>(null)
  const [listError, setListError] = useState('')
  const [query, setQuery] = useState('')
  const [materials, setMaterials] = useState<Material[] | null>(null)
  const [maxMb, setMaxMb] = useState(50)
  const [matLoading, setMatLoading] = useState(false)
  const [matError, setMatError] = useState('')
  // Moteur RAG : état d'indexation des documents de ce cours (null = pas de moteur en service)
  const [rag, setRag] = useState<Record<string, RagDoc> | null>(null)
  // Vrai quand l'enseignant vient de cliquer un cours : on coche alors tous
  // les documents exploitables. Faux lors d'une restauration de brouillon,
  // pour garder sa sélection.
  const autoSelectRef = useRef(false)
  const valueRef = useRef(value); valueRef.current = value

  useEffect(() => {
    api.get<{ ecs: MoodleEc[] }>('/api/moodle/ecs')
      .then(r => { setCourses(r.ecs || []); onLoaded?.((r.ecs || []).length) })
      .catch((e: any) => { setCourses([]); setListError(e.message || 'Cours Moodle indisponibles'); onLoaded?.(0) })
  }, []) // eslint-disable-line

  const ecId = value.ec?.ec_id
  useEffect(() => {
    if (!ecId) { setMaterials(null); return }
    let cancelled = false
    setMatLoading(true); setMatError(''); setMaterials(null)
    api.get<{ materials: Material[]; max_total_mb: number }>(`/api/moodle/ecs/${ecId}/materials`)
      .then(r => {
        if (cancelled) return
        setMaterials(r.materials || []); setMaxMb(r.max_total_mb || 50)
        const supported = (r.materials || []).filter(m => m.supported).map(m => m.fileurl)
        const cur = valueRef.current
        if (autoSelectRef.current) onChange({ ...cur, files: supported })
        else onChange({ ...cur, files: cur.files.filter(u => supported.includes(u)) })
        autoSelectRef.current = false
      })
      .catch((e: any) => { if (!cancelled) setMatError(e.message || 'Documents du cours indisponibles') })
      .finally(() => { if (!cancelled) setMatLoading(false) })
    return () => { cancelled = true }
  }, [ecId]) // eslint-disable-line

  useEffect(() => {
    if (!ecId) { setRag(null); return }
    let cancelled = false
    api.get<{ active: boolean; documents: RagDoc[] }>(`/api/rag/ecs/${ecId}/documents`)
      .then(r => { if (!cancelled) setRag(r.active ? Object.fromEntries((r.documents || []).map(d => [d.fileurl, d])) : null) })
      .catch(() => { if (!cancelled) setRag(null) })
    return () => { cancelled = true }
  }, [ecId])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!courses) return []
    if (!q) return courses
    return courses.filter(c => [c.ec_code, c.ec_name, c.moodle_course_name, c.formation_code, c.formation_name]
      .some(v => (v || '').toLowerCase().includes(q)))
  }, [courses, query])

  const selectedSet = new Set(value.files)
  const isIndexed = (url: string) => rag?.[url]?.status === 'ready'
  // Les documents indexés ne sont pas téléchargés à la génération : seuls les
  // autres comptent dans le plafond d'extraction.
  const totalBytes = (materials || []).filter(m => selectedSet.has(m.fileurl) && !isIndexed(m.fileurl)).reduce((s, m) => s + (m.filesize || 0), 0)
  const indexedSelected = value.files.filter(isIndexed).length
  const overLimit = totalBytes > maxMb * 1024 * 1024
  const supportedCount = (materials || []).filter(m => m.supported).length

  function pick(c: MoodleEc) {
    autoSelectRef.current = true
    onChange({ ec: c, files: [] })
  }
  function toggle(url: string) {
    onChange({ ...value, files: selectedSet.has(url) ? value.files.filter(u => u !== url) : [...value.files, url] })
  }

  const cardHeader = (icon: string, title: string, sub: string, right?: React.ReactNode) => (
    <div className="card-header" style={{ background: 'var(--primary)', borderBottom: 'none' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 34, height: 34, background: 'rgba(255,255,255,.2)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <i className={`fas ${icon}`} style={{ color: '#fff' }} />
          </div>
          <div>
            <h3 style={{ margin: 0, color: '#fff', fontSize: 18 }}>{title}</h3>
            <p style={{ margin: 0, color: 'rgba(255,255,255,.75)', fontSize: 14.5 }}>{sub}</p>
          </div>
        </div>
        {right}
      </div>
    </div>
  )

  /* ── Étape 1 : choix du cours ── */
  if (!value.ec) {
    return (
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {cardHeader('fa-graduation-cap', 'Cours Moodle', 'Choisissez le cours dont les documents serviront à la génération')}
        <div style={{ padding: 20, display: 'grid', gap: 12 }}>
          {courses === null ? (
            <div style={{ color: 'var(--text-muted)' }}><i className="fas fa-spinner fa-spin" /> Chargement de vos cours Moodle…</div>
          ) : listError ? (
            <div style={{ color: '#b91c1c', fontSize: 15 }}><i className="fas fa-circle-exclamation" /> {listError}. Utilisez l&apos;onglet « Téléverser ».</div>
          ) : courses.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 15, lineHeight: 1.6 }}>
              <i className="fas fa-circle-info" style={{ color: ACCENT }} /> Aucun de vos EC n&apos;a de cours Moodle. Si vous enseignez un cours Moodle, il apparaîtra ici après la prochaine synchronisation. En attendant, utilisez l&apos;onglet « Téléverser ».
            </div>
          ) : (
            <>
              <div style={{ position: 'relative' }}>
                <i className="fas fa-magnifying-glass" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input className="form-control" style={{ paddingLeft: 36 }} placeholder={`Rechercher parmi ${courses.length} cours (code, nom, formation)`}
                  value={query} onChange={e => setQuery(e.target.value)} />
              </div>
              <div style={{ maxHeight: 360, overflowY: 'auto', display: 'grid', gap: 6, paddingRight: 2 }}>
                {filtered.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: 15 }}>Aucun cours ne correspond à « {query} ».</div>}
                {filtered.map(c => (
                  <button key={c.ec_id} type="button" onClick={() => pick(c)}
                    style={{ textAlign: 'left', padding: '10px 14px', borderRadius: 9, border: '1.5px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', display: 'grid', gap: 3 }}>
                    <span style={{ fontSize: 15.5, color: 'var(--text)' }}>
                      <strong style={{ fontFamily: 'monospace' }}>{c.ec_code}</strong> — {c.ec_name}
                    </span>
                    <span style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>
                      {[c.formation_code, c.student_level, c.instance].filter(Boolean).join(' · ')}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    )
  }

  /* ── Étape 2 : documents du cours ── */
  const ec = value.ec
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      {cardHeader('fa-graduation-cap', `${ec.ec_code} — ${ec.ec_name}`, `Cours Moodle · ${ec.instance}`,
        <button type="button" onClick={() => onChange({ ec: null, files: [] })}
          style={{ background: 'rgba(255,255,255,.15)', border: '1px solid rgba(255,255,255,.3)', color: '#fff', borderRadius: 8, padding: '6px 12px', fontSize: 14.5, fontWeight: 600, cursor: 'pointer' }}>
          <i className="fas fa-arrow-left" style={{ marginRight: 6 }} />Changer de cours
        </button>)}
      <div style={{ padding: 20, display: 'grid', gap: 12 }}>
        {matLoading ? (
          <div style={{ color: 'var(--text-muted)' }}><i className="fas fa-spinner fa-spin" /> Lecture des documents du cours…</div>
        ) : matError ? (
          <div style={{ color: '#b91c1c', fontSize: 15 }}><i className="fas fa-circle-exclamation" /> {matError}</div>
        ) : materials && materials.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 15 }}>
            <i className="fas fa-circle-info" style={{ color: ACCENT }} /> Ce cours Moodle ne contient aucun document. Déposez vos fichiers dans l&apos;onglet « Téléverser ».
          </div>
        ) : materials && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: 14.5 }}>
              <span style={{ color: overLimit ? '#b91c1c' : 'var(--text-muted)' }}>
                <strong style={{ color: overLimit ? '#b91c1c' : 'var(--text)' }}>{value.files.length}</strong> document(s) sur {supportedCount} · {fmtSize(totalBytes) || '0 Ko'} / {maxMb} Mo
                {overLimit && ' — trop volumineux, décochez des documents'}
              </span>
              <span style={{ display: 'flex', gap: 12 }}>
                <button type="button" onClick={() => onChange({ ...value, files: materials.filter(m => m.supported).map(m => m.fileurl) })}
                  style={{ background: 'none', border: 'none', color: ACCENT, fontWeight: 600, cursor: 'pointer', padding: 0, fontSize: 14.5 }}>Tout cocher</button>
                <button type="button" onClick={() => onChange({ ...value, files: [] })}
                  style={{ background: 'none', border: 'none', color: ACCENT, fontWeight: 600, cursor: 'pointer', padding: 0, fontSize: 14.5 }}>Tout décocher</button>
              </span>
            </div>
            {rag && (
              <div style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.55, background: '#f0fdfa', border: '1px solid #99f6e4', borderRadius: 10, padding: '10px 12px' }}>
                <i className="fas fa-book-open-reader" style={{ color: '#0d9488', marginRight: 6 }} />
                {indexedSelected > 0
                  ? <><strong style={{ color: '#0f766e' }}>{indexedSelected} document(s) indexé(s)</strong> : l&apos;IA reçoit des passages répartis sur tout leur contenu (et non seulement leur début), numérotés et cités comme sources.</>
                  : <>Aucun document coché n&apos;est encore indexé : ils seront lus en texte brut, comme avant.</>}
              </div>
            )}
            <div style={{ maxHeight: 380, overflowY: 'auto', display: 'grid', gap: 4, border: '1px solid var(--border)', borderRadius: 10, padding: 6 }}>
              {materials.map((m, i) => {
                const prevModule = i > 0 ? materials[i - 1].module : null
                const { icon, color } = extIcon(m.extension)
                const checked = selectedSet.has(m.fileurl)
                return (
                  <div key={m.fileurl}>
                    {m.module !== prevModule && (
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.03em', padding: '8px 8px 4px' }}>{m.module || m.section}</div>
                    )}
                    <label title={m.supported ? '' : 'Format non pris en charge par l’IA (PDF, Word, TXT et chapitres de livre uniquement)'}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 8px', borderRadius: 7, cursor: m.supported ? 'pointer' : 'not-allowed', opacity: m.supported ? 1 : 0.5, background: checked ? '#eff6ff' : 'transparent' }}>
                      <input type="checkbox" checked={checked} disabled={!m.supported} onChange={() => toggle(m.fileurl)} />
                      <i className={`fas ${icon}`} style={{ color, width: 16, textAlign: 'center' }} />
                      <span style={{ flex: 1, fontSize: 15, color: 'var(--text)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.title}</span>
                      {m.supported && rag && <RagBadge doc={rag[m.fileurl]} />}
                      <span style={{ fontSize: 13, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{m.supported ? fmtSize(m.filesize) : 'non pris en charge'}</span>
                    </label>
                  </div>
                )
              })}
            </div>
            {indexedSelected > 0 && (
              <label style={{ display: 'grid', gap: 5, fontSize: 14.5, fontWeight: 600 }}>
                Chapitre ou thème à cibler (facultatif)
                <input className="form-control" value={value.focus || ''} maxLength={300}
                  placeholder="Ex : le contrôle de constitutionnalité — laissez vide pour couvrir tout le cours"
                  onChange={e => onChange({ ...value, focus: e.target.value })} />
              </label>
            )}
          </>
        )}
      </div>
    </div>
  )
}
