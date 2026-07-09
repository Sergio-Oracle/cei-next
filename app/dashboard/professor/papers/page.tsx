'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import api, { AI_TIMEOUT_MS } from '@/lib/api'

interface Subject {
  id: number
  title: string
  ec_code?: string
  rubric?: string
}

interface SingleResult {
  id: number
  student_name: string
  subject_title: string
  score: number
  feedback?: string
}

interface BatchResultItem {
  filename: string
  student_name?: string
  score?: number
  error?: string
}

interface BatchResult {
  corrected: number
  errors: number
  results?: BatchResultItem[]
  error_details?: string[]
}

type Tab = 'single' | 'batch'

function getMention(score: number) {
  if (score >= 16) return 'Très Bien'
  if (score >= 14) return 'Bien'
  if (score >= 12) return 'Assez Bien'
  if (score >= 10) return 'Passable'
  return 'Insuffisant'
}

export default function ProfessorPapersPage() {
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [loadingSubjects, setLoadingSubjects] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('single')

  // Single correction state
  const [singleSubjectId, setSingleSubjectId] = useState('')
  const [singleStudentName, setSingleStudentName] = useState('')
  const [singleFile, setSingleFile] = useState<File | null>(null)
  const [singleDragging, setSingleDragging] = useState(false)
  const singleInputRef = useRef<HTMLInputElement>(null)
  const [singleSubmitting, setSingleSubmitting] = useState(false)
  const [singleResult, setSingleResult] = useState<SingleResult | null>(null)
  const [singleError, setSingleError] = useState('')

  // Batch correction state
  const [batchSubjectId, setBatchSubjectId] = useState('')
  const [batchFiles, setBatchFiles] = useState<FileList | null>(null)
  const [batchAutoExtract, setBatchAutoExtract] = useState(true)
  const [batchDragging, setBatchDragging] = useState(false)
  const batchInputRef = useRef<HTMLInputElement>(null)
  const [batchSubmitting, setBatchSubmitting] = useState(false)
  const [batchResult, setBatchResult] = useState<BatchResult | null>(null)
  const [batchError, setBatchError] = useState('')

  const resultsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setLoadingSubjects(true)
    api.get<Subject[] | { subjects: Subject[] }>('/api/subjects')
      .then(r => setSubjects(Array.isArray(r) ? r : (r as any).subjects ?? []))
      .catch(() => {})
      .finally(() => setLoadingSubjects(false))
  }, [])

  // ── Single file drop ────────────────────────────────────────────────
  function onSingleDrop(e: React.DragEvent) {
    e.preventDefault(); setSingleDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) setSingleFile(f)
  }

  // ── Batch folder drop ───────────────────────────────────────────────
  function onBatchDrop(e: React.DragEvent) {
    e.preventDefault(); setBatchDragging(false)
    if (e.dataTransfer.files.length > 0) setBatchFiles(e.dataTransfer.files)
  }

  // ── Submit single ───────────────────────────────────────────────────
  async function handleSingle(e: React.FormEvent) {
    e.preventDefault()
    setSingleError('')
    if (!singleSubjectId || !singleStudentName.trim() || !singleFile) {
      setSingleError('Veuillez remplir tous les champs'); return
    }
    setSingleSubmitting(true)
    try {
      const fd = new FormData()
      fd.append('subject_id', singleSubjectId)
      fd.append('student_name', singleStudentName.trim())
      fd.append('file', singleFile)
      const res = await api.upload<{ success: boolean; paper: SingleResult; error?: string }>('/api/papers/correct', fd)
      if (res.success && res.paper) {
        setSingleResult(res.paper)
        setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
        setSingleSubjectId('')
        setSingleStudentName('')
        setSingleFile(null)
      } else {
        setSingleError(res.error || 'Impossible de corriger la copie.')
      }
    } catch (err: any) {
      setSingleError(err.message || 'Erreur réseau. Vérifiez votre connexion.')
    } finally {
      setSingleSubmitting(false)
    }
  }

  // ── Submit batch ────────────────────────────────────────────────────
  async function handleBatch(e: React.FormEvent) {
    e.preventDefault()
    setBatchError('')
    if (!batchSubjectId) { setBatchError('Veuillez sélectionner un sujet'); return }
    if (!batchFiles || batchFiles.length === 0) { setBatchError('Veuillez sélectionner au moins un fichier'); return }
    setBatchSubmitting(true)
    try {
      const fd = new FormData()
      fd.append('subject_id', batchSubjectId)
      fd.append('auto_extract', batchAutoExtract ? '1' : '0')
      for (let i = 0; i < batchFiles.length; i++) fd.append('files', batchFiles[i])
      const res = await api.upload<{ success: boolean; corrected?: number; errors?: number; results?: BatchResultItem[]; error_details?: string[]; error?: string }>('/api/papers/upload-batch', fd, 'POST', { timeoutMs: AI_TIMEOUT_MS })
      if (res.success) {
        setBatchResult({ corrected: res.corrected ?? 0, errors: res.errors ?? 0, results: res.results, error_details: res.error_details })
        setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
        setBatchSubjectId('')
        setBatchFiles(null)
        if (batchInputRef.current) batchInputRef.current.value = ''
      } else {
        setBatchError(res.error || 'Impossible de corriger les copies.')
      }
    } catch (err: any) {
      setBatchError(err.message || 'Erreur réseau. Vérifiez votre connexion.')
    } finally {
      setBatchSubmitting(false)
    }
  }

  const noSubjects = !loadingSubjects && subjects.length === 0

  return (
    <div>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 28 }}>
        <div>
          <h2 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 800, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <i className="fas fa-pen-ruler" style={{ color: 'var(--primary)' }} />Corriger des Copies
          </h2>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 14 }}>Correction individuelle par IA ou traitement en lot de plusieurs copies</p>
        </div>
      </div>

      {/* Empty state if no subjects */}
      {noSubjects && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '48px 32px', textAlign: 'center', marginBottom: 24 }}>
          <div style={{ width: 56, height: 56, background: '#fef3c7', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <i className="fas fa-triangle-exclamation" style={{ fontSize: 26, color: '#d97706' }} />
          </div>
          <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)', marginBottom: 8 }}>Aucun sujet disponible</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
            Vous devez créer un sujet avec un barème avant de pouvoir corriger des copies.
          </div>
          <Link href="/dashboard/professor/create-subject"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: 'var(--primary)', color: 'white', borderRadius: 8, fontWeight: 600, fontSize: 14, textDecoration: 'none' }}>
            <i className="fas fa-plus-circle" />Créer un sujet
          </Link>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24, alignItems: 'start' }}>
        {/* Left: form panel */}
        <div>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: 0, marginBottom: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderBottom: 'none', borderRadius: '14px 14px 0 0', overflow: 'hidden' }}>
            {(['single', 'batch'] as Tab[]).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                style={{
                  flex: 1, padding: '14px 18px', border: 'none', fontWeight: 600, fontSize: 14, cursor: 'pointer',
                  background: activeTab === tab ? 'white' : '#f8fafc',
                  color: activeTab === tab ? '#2563eb' : 'var(--text-muted)',
                  borderBottom: activeTab === tab ? '2px solid #2563eb' : '2px solid transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                }}>
                <i className={`fas ${tab === 'single' ? 'fa-file-alt' : 'fa-layer-group'}`} />
                {tab === 'single' ? 'Copie Individuelle' : 'Lot de Copies'}
              </button>
            ))}
          </div>

          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 14px 14px', padding: 28 }}>
            {/* ── Single tab ── */}
            {activeTab === 'single' && (
              <form onSubmit={handleSingle} id="single-correction-form">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <div>
                    <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 7, color: 'var(--text)' }}>
                      <i className="fas fa-book" style={{ marginRight: 6, color: '#94a3b8' }} />Sujet d'examen *
                    </label>
                    <select value={singleSubjectId} onChange={e => setSingleSubjectId(e.target.value)} required
                      style={{ width: '100%', padding: '10px 14px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 14, color: 'var(--text)', background: 'var(--surface)', outline: 'none', boxSizing: 'border-box' }}>
                      <option value="">-- Choisissez un sujet --</option>
                      {subjects.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.ec_code ? `[${s.ec_code}] ` : ''}{s.title}
                          {!s.rubric ? ' (pas de barème)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 7, color: 'var(--text)' }}>
                      <i className="fas fa-user" style={{ marginRight: 6, color: '#94a3b8' }} />Nom de l'étudiant *
                    </label>
                    <input type="text" placeholder="Ex : Dupont Jean" value={singleStudentName} onChange={e => setSingleStudentName(e.target.value)} required
                      style={{ width: '100%', padding: '10px 14px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 14, color: 'var(--text)', background: 'var(--surface)', outline: 'none', boxSizing: 'border-box' }} />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 7, color: 'var(--text)' }}>
                      <i className="fas fa-file-upload" style={{ marginRight: 6, color: '#94a3b8' }} />Fichier copie *
                      <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: 6 }}>PDF, DOCX ou TXT</span>
                    </label>
                    <div
                      onClick={() => singleInputRef.current?.click()}
                      onDragOver={e => { e.preventDefault(); setSingleDragging(true) }}
                      onDragLeave={() => setSingleDragging(false)}
                      onDrop={onSingleDrop}
                      style={{
                        border: `2px dashed ${singleDragging ? '#2563eb' : singleFile ? '#10b981' : 'var(--border)'}`,
                        borderRadius: 10, padding: '28px 20px', textAlign: 'center', cursor: 'pointer',
                        background: singleDragging ? '#eff6ff' : singleFile ? '#f0fdf4' : 'var(--background)',
                        transition: 'all .15s'
                      }}>
                      {singleFile ? (
                        <>
                          <i className="fas fa-file-check" style={{ fontSize: 28, color: '#10b981', display: 'block', marginBottom: 8 }} />
                          <div style={{ fontWeight: 600, fontSize: 14, color: '#15803d', marginBottom: 4 }}>{singleFile.name}</div>
                          <div style={{ fontSize: 12, color: '#64748b' }}>{(singleFile.size / 1024).toFixed(0)} Ko</div>
                        </>
                      ) : (
                        <>
                          <i className="fas fa-cloud-upload-alt" style={{ fontSize: 32, color: '#94a3b8', display: 'block', marginBottom: 8 }} />
                          <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)', marginBottom: 4 }}>Glissez-déposez le fichier ici</div>
                          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>ou cliquez pour parcourir</div>
                        </>
                      )}
                    </div>
                    <input ref={singleInputRef} type="file" accept=".pdf,.docx,.txt" style={{ display: 'none' }}
                      onChange={e => { if (e.target.files?.[0]) setSingleFile(e.target.files[0]) }} />
                    {singleFile && (
                      <button type="button" onClick={() => { setSingleFile(null); if (singleInputRef.current) singleInputRef.current.value = '' }}
                        style={{ marginTop: 8, background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                        <i className="fas fa-times" style={{ marginRight: 4 }} />Retirer le fichier
                      </button>
                    )}
                  </div>

                  {singleError && (
                    <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 16px', color: '#991b1b', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <i className="fas fa-circle-exclamation" />{singleError}
                    </div>
                  )}

                  <button type="submit" disabled={singleSubmitting}
                    style={{ padding: '12px 24px', background: singleSubmitting ? '#93c5fd' : '#2563eb', color: 'white', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: singleSubmitting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                    {singleSubmitting
                      ? <><i className="fas fa-spinner fa-spin" />Correction en cours…</>
                      : <><i className="fas fa-magic" />Corriger avec l'IA</>}
                  </button>
                </div>
              </form>
            )}

            {/* ── Batch tab ── */}
            {activeTab === 'batch' && (
              <form onSubmit={handleBatch} id="batch-correction-form">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <div>
                    <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 7, color: 'var(--text)' }}>
                      <i className="fas fa-book" style={{ marginRight: 6, color: '#94a3b8' }} />Sujet d'examen *
                    </label>
                    <select value={batchSubjectId} onChange={e => setBatchSubjectId(e.target.value)} required
                      style={{ width: '100%', padding: '10px 14px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 14, color: 'var(--text)', background: 'var(--surface)', outline: 'none', boxSizing: 'border-box' }}>
                      <option value="">-- Choisissez un sujet --</option>
                      {subjects.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.ec_code ? `[${s.ec_code}] ` : ''}{s.title}
                          {!s.rubric ? ' (pas de barème)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 7, color: 'var(--text)' }}>
                      <i className="fas fa-folder-open" style={{ marginRight: 6, color: '#94a3b8' }} />Copies (fichiers multiples) *
                      <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: 6 }}>PDF, DOCX ou TXT</span>
                    </label>
                    <div
                      onClick={() => batchInputRef.current?.click()}
                      onDragOver={e => { e.preventDefault(); setBatchDragging(true) }}
                      onDragLeave={() => setBatchDragging(false)}
                      onDrop={onBatchDrop}
                      style={{
                        border: `2px dashed ${batchDragging ? '#2563eb' : batchFiles && batchFiles.length > 0 ? '#10b981' : 'var(--border)'}`,
                        borderRadius: 10, padding: '28px 20px', textAlign: 'center', cursor: 'pointer',
                        background: batchDragging ? '#eff6ff' : batchFiles && batchFiles.length > 0 ? '#f0fdf4' : 'var(--background)',
                        transition: 'all .15s'
                      }}>
                      {batchFiles && batchFiles.length > 0 ? (
                        <>
                          <i className="fas fa-folder-open" style={{ fontSize: 28, color: '#10b981', display: 'block', marginBottom: 8 }} />
                          <div style={{ fontWeight: 600, fontSize: 14, color: '#15803d', marginBottom: 4 }}>{batchFiles.length} fichier(s) sélectionné(s)</div>
                          <div style={{ fontSize: 12, color: '#64748b' }}>Cliquez pour changer la sélection</div>
                        </>
                      ) : (
                        <>
                          <i className="fas fa-folder-open" style={{ fontSize: 32, color: '#94a3b8', display: 'block', marginBottom: 8 }} />
                          <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)', marginBottom: 4 }}>Sélectionnez un dossier de copies</div>
                          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Ou glissez-déposez plusieurs fichiers ici</div>
                        </>
                      )}
                    </div>
                    {/* webkitdirectory for folder selection */}
                    <input ref={batchInputRef} type="file" multiple
                      {...({ webkitdirectory: '', directory: '' } as any)}
                      accept=".pdf,.docx,.txt" style={{ display: 'none' }}
                      onChange={e => { if (e.target.files && e.target.files.length > 0) setBatchFiles(e.target.files) }} />
                    {batchFiles && batchFiles.length > 0 && (
                      <button type="button" onClick={() => { setBatchFiles(null); if (batchInputRef.current) batchInputRef.current.value = '' }}
                        style={{ marginTop: 8, background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                        <i className="fas fa-times" style={{ marginRight: 4 }} />Vider la sélection
                      </button>
                    )}
                  </div>

                  {/* Auto-extract checkbox */}
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', padding: '12px 14px', background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 8 }}>
                    <input type="checkbox" checked={batchAutoExtract} onChange={e => setBatchAutoExtract(e.target.checked)}
                      style={{ marginTop: 2, width: 16, height: 16, accentColor: '#2563eb', flexShrink: 0 }} />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>Extraction automatique des noms</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                        L'IA extraira les noms des étudiants depuis les fichiers. Désactivez si les noms figurent dans les noms de fichiers.
                      </div>
                    </div>
                  </label>

                  {batchError && (
                    <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 16px', color: '#991b1b', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <i className="fas fa-circle-exclamation" />{batchError}
                    </div>
                  )}

                  {batchSubmitting && (
                    <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '12px 16px', color: '#1d4ed8', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <i className="fas fa-circle-info" />
                      Correction de {batchFiles?.length ?? 0} copie(s) en cours… Veuillez patienter.
                    </div>
                  )}

                  <button type="submit" disabled={batchSubmitting}
                    style={{ padding: '12px 24px', background: batchSubmitting ? '#93c5fd' : '#2563eb', color: 'white', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: batchSubmitting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                    {batchSubmitting
                      ? <><i className="fas fa-spinner fa-spin" />Correction en cours…</>
                      : <><i className="fas fa-layer-group" />Lancer la correction en lot</>}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Right sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* How it works */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <i className="fas fa-circle-question" style={{ color: '#2563eb' }} />
              <span style={{ fontWeight: 700, fontSize: 14 }}>Comment ça marche ?</span>
            </div>
            {[
              { n: 1, text: 'Sélectionnez le sujet avec son barème' },
              { n: 2, text: 'Uploadez la (les) copie(s) à corriger' },
              { n: 3, text: "L'IA compare la copie au barème et attribue une note" },
              { n: 4, text: 'Consultez le feedback détaillé et téléchargez le rapport PDF' },
            ].map(step => (
              <div key={step.n} style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                <div style={{ width: 24, height: 24, background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 11, fontWeight: 700, color: '#2563eb' }}>
                  {step.n}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5, paddingTop: 2 }}>{step.text}</div>
              </div>
            ))}
          </div>

          {/* Mode guide */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)', marginBottom: 12 }}>
              <i className="fas fa-arrows-left-right" style={{ marginRight: 6, color: '#64748b' }} />Quand utiliser chaque mode ?
            </div>
            <div style={{ padding: '10px 12px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, marginBottom: 8 }}>
              <div style={{ fontWeight: 600, fontSize: 12, color: '#1d4ed8', marginBottom: 4 }}>
                <i className="fas fa-file-alt" style={{ marginRight: 5 }} />Copie individuelle
              </div>
              <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.5 }}>
                Pour tester une copie isolée ou corriger rapidement un seul étudiant.
              </div>
            </div>
            <div style={{ padding: '10px 12px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8 }}>
              <div style={{ fontWeight: 600, fontSize: 12, color: '#15803d', marginBottom: 4 }}>
                <i className="fas fa-layer-group" style={{ marginRight: 5 }} />Lot de copies
              </div>
              <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.5 }}>
                Pour corriger toute une promo d'un coup. L'IA traite chaque fichier séparément.
              </div>
            </div>
          </div>

          {/* Warning */}
          <div style={{ background: '#fefce8', border: '1px solid #fde68a', borderRadius: 14, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <i className="fas fa-triangle-exclamation" style={{ color: '#d97706', marginTop: 2, flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#92400e', marginBottom: 4 }}>À savoir</div>
                <div style={{ fontSize: 12, color: '#78350f', lineHeight: 1.6 }}>
                  Ne fermez pas la page pendant le traitement. La correction peut prendre
                  quelques secondes par copie selon la taille du fichier.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Results zone */}
      <div ref={resultsRef} style={{ marginTop: 28 }}>

        {/* Single result */}
        {singleResult && (
          <div style={{ background: 'var(--surface)', border: `1px solid var(--border)`, borderRadius: 14, overflow: 'hidden', borderTop: `3px solid ${singleResult.score >= 10 ? '#10b981' : '#ef4444'}` }}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: singleResult.score >= 10 ? '#dcfce7' : '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className="fas fa-check-circle" style={{ fontSize: 22, color: singleResult.score >= 10 ? '#10b981' : '#ef4444' }} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)' }}>Correction terminée</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>{singleResult.subject_title}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={async () => { try { const blob = await api.blob(`/api/papers/${singleResult.id}/export`); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `correction_${singleResult.student_name}.pdf`; a.click() } catch {} }}
                  style={{ padding: '8px 16px', background: '#2563eb', color: 'white', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <i className="fas fa-file-pdf" />Télécharger PDF
                </button>
                <button onClick={() => setSingleResult(null)}
                  style={{ padding: '8px 12px', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14 }}>
                  <i className="fas fa-times" />
                </button>
              </div>
            </div>
            <div style={{ padding: '20px 24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 24 }}>
                <div style={{ padding: 14, background: '#f8fafc', borderRadius: 10, textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 4 }}>Étudiant</div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>{singleResult.student_name}</div>
                </div>
                <div style={{ padding: 14, background: singleResult.score >= 10 ? '#dcfce7' : '#fee2e2', borderRadius: 10, textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: singleResult.score >= 10 ? '#15803d' : '#991b1b', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 4, fontWeight: 600 }}>Note</div>
                  <div style={{ fontWeight: 800, fontSize: 28, color: singleResult.score >= 10 ? '#10b981' : '#ef4444', lineHeight: 1 }}>
                    {singleResult.score}<span style={{ fontSize: 13, fontWeight: 500 }}>/20</span>
                  </div>
                </div>
                <div style={{ padding: 14, background: '#f8fafc', borderRadius: 10, textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 4 }}>Mention</div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>{getMention(singleResult.score)}</div>
                </div>
              </div>
              {singleResult.feedback && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <i className="fas fa-comment-dots" style={{ color: '#2563eb' }} />
                    <span style={{ fontWeight: 700, fontSize: 14 }}>Feedback détaillé de l'IA</span>
                  </div>
                  <div style={{ padding: '14px 16px', background: '#f8fafc', borderRadius: 8, fontSize: 13, lineHeight: 1.8, color: '#334155', maxHeight: 320, overflowY: 'auto', whiteSpace: 'pre-wrap' }}>
                    {singleResult.feedback}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Batch result */}
        {batchResult && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', borderTop: '3px solid #10b981' }}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className="fas fa-layer-group" style={{ fontSize: 20, color: '#10b981' }} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)' }}>Correction en lot terminée</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>{(batchResult.corrected + batchResult.errors)} copie(s) traitée(s)</div>
                </div>
              </div>
              <button onClick={() => setBatchResult(null)}
                style={{ padding: '8px 14px', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                <i className="fas fa-times" />Fermer
              </button>
            </div>
            <div style={{ padding: '20px 24px' }}>
              {/* Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
                <div style={{ padding: 14, background: '#dcfce7', borderRadius: 10, textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: '#15803d', textTransform: 'uppercase', letterSpacing: .5, fontWeight: 600, marginBottom: 2 }}>Corrigées</div>
                  <div style={{ fontWeight: 800, fontSize: 26, color: '#15803d' }}>{batchResult.corrected}</div>
                </div>
                {batchResult.results && batchResult.results.filter(r => typeof r.score === 'number').length > 0 ? (
                  <div style={{ padding: 14, background: '#eff6ff', borderRadius: 10, textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: .5, fontWeight: 600, marginBottom: 2 }}>Moyenne</div>
                    <div style={{ fontWeight: 800, fontSize: 26, color: '#1d4ed8' }}>
                      {(batchResult.results.filter(r => typeof r.score === 'number').reduce((a, r) => a + (r.score ?? 0), 0) / batchResult.results.filter(r => typeof r.score === 'number').length).toFixed(1)}
                      <span style={{ fontSize: 13, fontWeight: 500 }}>/20</span>
                    </div>
                  </div>
                ) : <div />}
                <div style={{ padding: 14, background: batchResult.errors > 0 ? '#fee2e2' : '#f8fafc', borderRadius: 10, textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: batchResult.errors > 0 ? '#991b1b' : '#64748b', textTransform: 'uppercase', letterSpacing: .5, fontWeight: 600, marginBottom: 2 }}>Erreurs</div>
                  <div style={{ fontWeight: 800, fontSize: 26, color: batchResult.errors > 0 ? '#ef4444' : '#94a3b8' }}>{batchResult.errors}</div>
                </div>
              </div>

              {/* Results table */}
              {batchResult.results && batchResult.results.length > 0 && (
                <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc' }}>
                        {['Fichier','Étudiant','Note','Statut'].map(h => (
                          <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 12, color: '#64748b', fontWeight: 700, borderBottom: '1px solid var(--border)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {batchResult.results.map((r, i) => (
                        <tr key={i} style={{ background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                          <td style={{ padding: '10px 14px', fontSize: 13, color: '#475569', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.filename}</td>
                          <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{r.student_name || '—'}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                            {typeof r.score === 'number'
                              ? <span style={{ fontWeight: 700, fontSize: 15, color: r.score >= 10 ? '#10b981' : '#ef4444' }}>{r.score}/20</span>
                              : <span style={{ color: '#94a3b8', fontSize: 13 }}>—</span>}
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                            {r.error
                              ? <span style={{ background: '#fee2e2', color: '#991b1b', padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 600 }}>Erreur</span>
                              : <span style={{ background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 600 }}>Corrigée</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Error details */}
              {batchResult.errors > 0 && batchResult.error_details && batchResult.error_details.length > 0 && (
                <div style={{ marginTop: 16, padding: 14, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: '#991b1b', marginBottom: 8 }}>
                    <i className="fas fa-triangle-exclamation" style={{ marginRight: 6 }} />{batchResult.errors} erreur(s) rencontrée(s)
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 20, fontSize: 12, color: '#7f1d1d', lineHeight: 1.8 }}>
                    {batchResult.error_details.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
