'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'

interface Question {
  id: number
  title: string
  content: string
  rubric?: string
  question_type: string
  bloom_level?: string
  ec_id?: number
  ec_name?: string
  created_by?: string
  created_at?: string
}

interface EC { id: number; name: string }

const TYPE_LABEL: Record<string, string> = {
  open:    'Ouvert',
  qcm:     'QCM',
  vf:      'Vrai/Faux',
  subopen: 'Semi-ouvert',
}
const TYPE_STYLE: Record<string, { bg: string; color: string }> = {
  open:    { bg: '#f1f5f9', color: '#475569' },
  qcm:     { bg: '#dbeafe', color: '#1d4ed8' },
  vf:      { bg: '#dcfce7', color: '#15803d' },
  subopen: { bg: '#fff7ed', color: '#c2410c' },
}

export default function AdminQuestionsPage() {
  const { success, error: toastErr } = useToast()
  const router = useRouter()

  const [questions, setQuestions]   = useState<Question[]>([])
  const [loading, setLoading]       = useState(true)
  const [selected, setSelected]     = useState<Set<number>>(new Set())
  const [preview, setPreview]       = useState<Question | null>(null)
  const [assembleModal, setAssembleModal] = useState(false)
  const [ecs, setEcs]               = useState<EC[]>([])

  // Formulaire assemblage
  const [aTitle, setATitle]     = useState('Examen Assemblé')
  const [aDuration, setADuration] = useState(60)
  const [aLevel, setALevel]     = useState('Licence 3')
  const [aEcId, setAEcId]       = useState('')
  const [assembling, setAssembling] = useState(false)

  function load() {
    setLoading(true)
    api.get<Question[]>('/api/question_bank')
      .then(r => setQuestions(Array.isArray(r) ? r : []))
      .catch(() => setQuestions([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    api.get<any>('/api/ecs').then(r => setEcs(Array.isArray(r) ? r : r.ecs ?? [])).catch(() => {})
  }, [])

  function toggle(id: number) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function selectAll() {
    setSelected(new Set(questions.map(q => q.id)))
  }
  function clearAll() { setSelected(new Set()) }

  async function deleteQ(id: number) {
    if (!confirm('Supprimer cette question de la banque ?')) return
    try {
      await api.delete(`/api/question_bank/${id}`)
      success('Question supprimée')
      setSelected(prev => { const n = new Set(prev); n.delete(id); return n })
      load()
    } catch { toastErr('Erreur lors de la suppression') }
  }

  async function assemble() {
    if (!aTitle.trim()) { toastErr('Veuillez saisir un titre'); return }
    const ids = [...selected]
    if (!ids.length) { toastErr('Aucune question sélectionnée'); return }
    setAssembling(true)
    try {
      await api.post('/api/question_bank/assemble', {
        question_ids:  ids,
        title:         aTitle.trim(),
        duration:      aDuration,
        student_level: aLevel,
        ec_id:         aEcId ? Number(aEcId) : null,
      })
      success(`Sujet "${aTitle}" créé avec ${ids.length} question(s)`)
      setAssembleModal(false)
      setSelected(new Set())
      setTimeout(() => router.push('/dashboard/admin/subjects'), 1200)
    } catch (e: any) {
      toastErr(e.message || 'Erreur lors de la création du sujet')
    } finally {
      setAssembling(false)
    }
  }

  const typeSt = (t: string) => TYPE_STYLE[t] ?? TYPE_STYLE.open
  const typeLabel = (t: string) => TYPE_LABEL[t] ?? t ?? 'Ouvert'

  /* ── PREVIEW MODAL ─────────────────────────────────────── */
  if (preview) return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div className="card" style={{ width: '100%', maxWidth: 600, maxHeight: '85vh', overflowY: 'auto', padding: 28 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16, gap: 12 }}>
          <h3 style={{ margin: 0, fontSize: 17 }}>{preview.title}</h3>
          <button className="btn btn-secondary btn-sm" onClick={() => setPreview(null)}>
            <i className="fas fa-times" />
          </button>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <span style={{ ...typeSt(preview.question_type), padding: '2px 10px', borderRadius: 99, fontSize: 12, fontWeight: 700 }}>
            {typeLabel(preview.question_type)}
          </span>
          {preview.bloom_level && <span className="status-badge secondary" style={{ fontSize: 12 }}>{preview.bloom_level}</span>}
          {preview.ec_name && <span className="status-badge secondary" style={{ fontSize: 12 }}><i className="fas fa-book" /> {preview.ec_name}</span>}
        </div>
        <pre style={{ background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 8, padding: 14, fontSize: 13, whiteSpace: 'pre-wrap', lineHeight: 1.7, maxHeight: 280, overflowY: 'auto' }}>
          {preview.content}
        </pre>
        {preview.rubric && (
          <>
            <h4 style={{ margin: '16px 0 8px', fontSize: 14 }}>
              <i className="fas fa-clipboard-list" style={{ color: '#10b981', marginRight: 6 }} />Barème
            </h4>
            <pre style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: 14, fontSize: 12, whiteSpace: 'pre-wrap', lineHeight: 1.7, maxHeight: 200, overflowY: 'auto' }}>
              {preview.rubric}
            </pre>
          </>
        )}
        <div style={{ textAlign: 'right', marginTop: 16 }}>
          <button className="btn btn-secondary" onClick={() => setPreview(null)}>Fermer</button>
        </div>
      </div>
    </div>
  )

  /* ── ASSEMBLE MODAL ─────────────────────────────────────── */
  if (assembleModal) {
    const selQuestions = questions.filter(q => selected.has(q.id))
    const uniqueEcIds = [...new Map(
      selQuestions.filter(q => q.ec_id).map(q => [q.ec_id, { id: q.ec_id!, name: q.ec_name! }])
    ).values()]
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div className="card" style={{ width: '100%', maxWidth: 580, maxHeight: '90vh', overflowY: 'auto', padding: 28 }}>
          <h3 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 700 }}>
            <i className="fas fa-layer-group" style={{ color: '#2563eb', marginRight: 8 }} />
            Créer un sujet à partir de {selected.size} question{selected.size > 1 ? 's' : ''}
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Titre de l'examen *</label>
              <input className="form-control" value={aTitle} onChange={e => setATitle(e.target.value)}
                placeholder="Ex : Examen de Réseaux S1 2025" />
            </div>
            <div className="grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Durée (minutes)</label>
                <input className="form-control" type="number" min={15} max={360} value={aDuration}
                  onChange={e => setADuration(Number(e.target.value))} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Niveau</label>
                <select className="form-control" value={aLevel} onChange={e => setALevel(e.target.value)}>
                  {['Licence 1','Licence 2','Licence 3','Master 1','Master 2','Doctorat'].map(l =>
                    <option key={l}>{l}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Élément Constitutif (EC)</label>
              <select className="form-control" value={aEcId} onChange={e => setAEcId(e.target.value)}>
                <option value="">— Aucun EC spécifique —</option>
                {(uniqueEcIds.length ? uniqueEcIds : ecs).map(e =>
                  <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>

            {/* Aperçu questions sélectionnées */}
            <div style={{ background: 'var(--background)', borderRadius: 8, padding: 12, maxHeight: 160, overflowY: 'auto' }}>
              <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Questions sélectionnées :
              </p>
              {selQuestions.map((q, i) => {
                const st = typeSt(q.question_type)
                return (
                  <div key={q.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ ...st, fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 99, flexShrink: 0 }}>
                      {typeLabel(q.question_type)}
                    </span>
                    <span style={{ fontSize: 13 }}>{i + 1}. {q.title}</span>
                  </div>
                )
              })}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={() => setAssembleModal(false)}>Annuler</button>
            <button className="btn btn-primary" onClick={assemble} disabled={assembling}>
              <i className={`fas ${assembling ? 'fa-spinner fa-spin' : 'fa-layer-group'}`} />
              {assembling ? 'Création…' : 'Créer le sujet'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  /* ── PAGE PRINCIPALE ─────────────────────────────────────── */
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* En-tête */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <i className="fas fa-database" style={{ color: '#2563eb' }} />
            Banque de Questions
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
            {questions.length} question(s) — cochez pour sélectionner et assembler un sujet
          </p>
        </div>
        {questions.length > 0 && (
          <button className="btn btn-secondary" onClick={selectAll}>
            <i className="fas fa-check-square" /> Tout sélectionner
          </button>
        )}
      </div>

      {/* Barre de sélection */}
      {selected.size > 0 && (
        <div style={{ background: '#2563eb', borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ flex: 1 }}>
            <span style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>
              {selected.size} question{selected.size > 1 ? 's' : ''}
            </span>
            <span style={{ color: '#bfdbfe', fontSize: 13, marginLeft: 8 }}>sélectionnée{selected.size > 1 ? 's' : ''}</span>
          </div>
          <button onClick={clearAll}
            style={{ background: 'rgba(255,255,255,.15)', border: 'none', color: '#fff', padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            <i className="fas fa-times" /> Désélectionner
          </button>
          <button onClick={() => setAssembleModal(true)}
            style={{ background: '#fff', border: 'none', color: '#1d4ed8', padding: '10px 20px', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 2px 8px rgba(0,0,0,.15)' }}>
            <i className="fas fa-layer-group" /> Créer un sujet d'examen
          </button>
        </div>
      )}

      {/* Tableau */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>
            <i className="fas fa-spinner fa-spin" style={{ fontSize: 28, display: 'block', marginBottom: 12 }} />
            Chargement…
          </div>
        ) : questions.length === 0 ? (
          <div style={{ padding: 64, textAlign: 'center' }}>
            <i className="fas fa-inbox" style={{ fontSize: 40, color: 'var(--text-muted)', display: 'block', marginBottom: 14 }} />
            <h3 style={{ margin: '0 0 10px' }}>Banque vide</h3>
            <p style={{ margin: 0, color: 'var(--text-muted)', maxWidth: 380, marginLeft: 'auto', marginRight: 'auto' }}>
              Sauvegardez des questions depuis la génération IA pour les réutiliser ici et assembler des sujets d'examen.
            </p>
          </div>
        ) : (
          <div className="table-responsive">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--background)' }}>
                  <th style={{ padding: '12px 14px', width: 36 }}></th>
                  <th style={{ padding: '12px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Type</th>
                  <th style={{ padding: '12px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Titre / Énoncé</th>
                  <th style={{ padding: '12px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Bloom</th>
                  <th style={{ padding: '12px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em' }}>EC</th>
                  <th style={{ padding: '12px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {questions.map(q => {
                  const st = typeSt(q.question_type)
                  const isSelected = selected.has(q.id)
                  return (
                    <tr key={q.id} style={{ background: isSelected ? '#eff6ff' : undefined, transition: 'background .15s' }}>
                      <td style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
                        <input type="checkbox" checked={isSelected} onChange={() => toggle(q.id)}
                          style={{ width: 16, height: 16, accentColor: '#2563eb', cursor: 'pointer' }} />
                      </td>
                      <td style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
                        <span style={{ ...st, padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700 }}>
                          {typeLabel(q.question_type)}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 600, color: 'var(--text)', maxWidth: 360 }}>
                        {q.title}
                      </td>
                      <td style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', fontSize: 12, color: 'var(--text-muted)' }}>
                        {q.bloom_level || '—'}
                      </td>
                      <td style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', fontSize: 12, color: 'var(--text-muted)' }}>
                        {q.ec_name || '—'}
                      </td>
                      <td style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => setPreview(q)} title="Aperçu"
                            style={{ background: '#eff6ff', border: 'none', color: '#3b82f6', padding: '5px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>
                            <i className="fas fa-eye" />
                          </button>
                          <button onClick={() => deleteQ(q.id)} title="Supprimer"
                            style={{ background: '#fef2f2', border: 'none', color: '#ef4444', padding: '5px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>
                            <i className="fas fa-trash" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Légende types */}
      {questions.length > 0 && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {Object.entries(TYPE_LABEL).map(([k, v]) => {
            const st = typeSt(k)
            return (
              <span key={k} style={{ ...st, fontSize: 11, padding: '2px 10px', borderRadius: 99, fontWeight: 600 }}>
                {v}
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}
