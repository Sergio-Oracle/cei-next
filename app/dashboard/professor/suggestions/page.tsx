'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'
import { useSuggestionFlow } from '@/hooks/useSuggestionFlow'
import SearchableSelect from '@/components/ui/SearchableSelect'

/* ── Types ─────────────────────────────────────────────────────── */
interface EC {
  id: number; code: string; name: string; ue_code?: string
  pole_id?: number; pole_code?: string; pole_name?: string
  formation_id?: number; formation_name?: string
}
interface FormationItem { id: number; name: string; pole_id?: number }

interface Suggestion {
  title: string; description: string; exam_type: string
  difficulty: string; duration: number; key_points: string[]
  questions_examples?: string[]; suggested_questions?: string[]
  grading_criteria?: string; detected_domain?: string; student_level?: string
}

interface CreatedSubject { id: number; title: string; content: string; rubric?: string; created_at?: string }
interface BasketVersion { label: string; content: string; rubric: string }

/* Retour #8 — détecte les questions du texte généré (numéro + titre + bloc brut)
   pour permettre de les éliminer individuellement avant validation, sans
   nécessiter le parseur complet de types (réservé à app/exam/[id]/page.tsx). */
function extractQuestionBlocks(content: string): { num: string; title: string; raw: string }[] {
  const lines = content.split('\n')
  const Q_RE = /^Question\s+(\d{1,3})\s*[—\-–:.]\s*(.+)/
  const blocks: { num: string; title: string; raw: string }[] = []
  let current: { num: string; title: string; lines: string[] } | null = null
  for (const line of lines) {
    const m = line.match(Q_RE)
    if (m) {
      if (current) blocks.push({ num: current.num, title: current.title, raw: current.lines.join('\n') })
      current = { num: m[1], title: m[2].replace(/\.{3,}.*$/, '').replace(/\[[A-Z_]+\]\s*$/, '').trim(), lines: [line] }
    } else if (current) {
      current.lines.push(line)
    }
  }
  if (current) blocks.push({ num: current.num, title: current.title, raw: current.lines.join('\n') })
  return blocks
}

const DIFF_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  'Facile':         { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0' },
  'Moyen':          { bg: '#fef3c7', color: '#92400e', border: '#fde68a' },
  'Difficile':      { bg: '#fff7ed', color: '#c2410c', border: '#fed7aa' },
  'Très Difficile': { bg: '#fef2f2', color: '#b91c1c', border: '#fecaca' },
}

const BLOOM_COLORS: Record<string, { active: string }> = {
  connaissance:  { active: '#1d4ed8' }, comprehension: { active: '#0369a1' },
  application:   { active: '#10b981' }, analyse:       { active: '#f59e0b' },
  synthese:      { active: '#ef4444' }, evaluation:    { active: '#0891b2' },
}

const BLOOM_LEVELS = ['Connaissance','Compréhension','Application','Analyse','Synthèse','Évaluation']

/* ── Page ──────────────────────────────────────────────────────── */
export default function ProfessorSuggestionsPage() {
  const { success, error: toastErr } = useToast()
  const router = useRouter()

  const [ecs,  setEcs]  = useState<EC[]>([])
  const [formations,      setFormations]      = useState<FormationItem[]>([])
  const [filterPole,      setFilterPole]      = useState('')
  const [filterFormation, setFilterFormation] = useState('')
  const [step, setStep] = useState<'form' | 'results' | 'preview' | 'created'>('form')
  const [dragOver,  setDragOver]  = useState(false)
  const [creating,  setCreating]  = useState<number | null>(null)

  /* full-exam generation loading screen (separate from suggestion generation) */
  const [genFull,        setGenFull]        = useState(false)
  const [genFullElapsed, setGenFullElapsed] = useState(0)
  const genFullTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  /* preview */
  const [previewTitle,   setPreviewTitle]   = useState('')
  const [previewContent, setPreviewContent] = useState('')
  const [previewRubric,  setPreviewRubric]  = useState('')
  const [savingSubject,  setSavingSubject]  = useState(false)
  const [createdSubject, setCreatedSubject] = useState<CreatedSubject | null>(null)

  /* basket */
  const [basket,      setBasket]      = useState<BasketVersion[]>([])
  const [showCompare, setShowCompare] = useState(false)
  const [elimSet,     setElimSet]     = useState<Set<string>>(new Set())

  /* bank modal */
  const [showBankModal, setShowBankModal] = useState(false)
  const [bankSaveType,  setBankSaveType]  = useState<'open'|'qcm'|'vf'>('open')
  const [bankSaveBloom, setBankSaveBloom] = useState('')
  const [bankSaveEc,    setBankSaveEc]    = useState('')
  const [bankSaving,    setBankSaving]    = useState(false)

  /* générer d'autres questions — point 3 des notes de tests */
  const [showMoreModal,  setShowMoreModal]  = useState(false)
  const [moreCount,      setMoreCount]      = useState(3)
  const [moreType,       setMoreType]       = useState('QCM')
  const [generatingMore, setGeneratingMore] = useState(false)

  /* médias (image/audio) insérés dans le sujet — Notes points 2/15 */
  const [mediaLinkKey,  setMediaLinkKey]  = useState('')
  const [uploadingMedia, setUploadingMedia] = useState(false)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const audioInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)
  const previewTextareaRef = useRef<HTMLTextAreaElement>(null)

  const fileRef = useRef<HTMLInputElement>(null)

  /* form fields */
  const [fileName,   setFileName]   = useState('')
  const [fileSize,   setFileSize]   = useState('')
  const [difficulty, setDifficulty] = useState('Moyen')
  const [level,      setLevel]      = useState('Licence 3')
  const [ecId,       setEcId]       = useState('')
  const [qTypes, setQTypes] = useState({ qcm: true, open: true, vf: false, qcm_multi: false, appariement: false, code: false, photo: false })
  const [bloom,  setBloom]  = useState({
    connaissance: false, comprehension: false,
    application: true,  analyse: true,
    synthese: false,     evaluation: false,
  })
  const [questionCount, setQuestionCount] = useState(20)
  const [suggestingCount, setSuggestingCount] = useState(false)

  async function suggestQuestionCount() {
    setSuggestingCount(true)
    try {
      const res = await api.post<{ suggested_count: number }>('/api/subjects/suggest-question-count', {
        duration: 60, difficulty, student_level: level,
        question_types: Object.entries(qTypes).filter(([, v]) => v).map(([k]) => k).join(',') || 'mixte',
      })
      setQuestionCount(res.suggested_count)
      success(`Suggestion IA : ${res.suggested_count} questions (pour un examen d'~1h, difficulté ${difficulty})`)
    } catch (e: any) { toastErr(e.message || 'Erreur de suggestion') }
    finally { setSuggestingCount(false) }
  }

  const MAX_MB = 50

  /* ── useSuggestionFlow hook (replaces loading+elapsed+timerRef+handleSubmit) ── */
  const {
    generating: loading,
    genElapsed: elapsed,
    result,
    error: suggError,
    generate,
    reset: suggReset,
  } = useSuggestionFlow()

  useEffect(() => {
    api.get<any>('/api/ecs').then(r => setEcs(Array.isArray(r) ? r : r.ecs ?? [])).catch(() => {})
    api.get<any>('/api/formations').then(r => setFormations(Array.isArray(r) ? r : r.formations ?? [])).catch(() => {})
  }, [])

  // Retour #3/#27 — cascade Pôle → Formation pour ne pas se retrouver avec
  // une liste d'EC trop longue, + recherche texte sur le sélecteur EC
  const uniquePoles = Array.from(new Map(ecs.filter(e => e.pole_id).map(e => [e.pole_id, { id: e.pole_id!, name: e.pole_name || '' }])).values())
  const filteredForms = formations.filter(f => !filterPole || String(f.pole_id) === filterPole)
  const filteredEcs = ecs.filter(ec => {
    if (filterPole      && String(ec.pole_id)      !== filterPole)      return false
    if (filterFormation && String(ec.formation_id) !== filterFormation) return false
    return true
  })

  useEffect(() => () => { if (genFullTimer.current) clearInterval(genFullTimer.current) }, [])

  /* Show error from hook as toast */
  useEffect(() => { if (suggError) toastErr(suggError) }, [suggError]) // eslint-disable-line

  /* Advance to results when generate completes */
  useEffect(() => {
    if (result?.suggestions?.length) {
      setStep('results')
      success(`${result.suggestions.length} suggestion(s) générée(s) avec succès`)
    }
  }, [result]) // eslint-disable-line

  function pickFile(file: File) {
    const sizeMb = file.size / 1024 / 1024
    if (sizeMb > MAX_MB) { toastErr(`Fichier trop volumineux : ${sizeMb.toFixed(1)} Mo. Maximum : ${MAX_MB} Mo`); return }
    if (!fileRef.current) return
    const dt = new DataTransfer(); dt.items.add(file); fileRef.current.files = dt.files
    setFileName(file.name); setFileSize(sizeMb.toFixed(2) + ' Mo')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const file = fileRef.current?.files?.[0]
    if (!file) { toastErr('Sélectionnez un fichier de cours'); return }
    await generate({ courseFile: file, difficulty, studentLevel: level, examType: '', qTypes })
  }

  /* ── Use suggestion → generate full exam → show preview ── */
  async function useSuggestion(s: Suggestion, i: number) {
    // Retour #9 — ne pas perdre un sujet déjà présent dans l'aperçu si on en génère un autre
    if (previewContent.trim()) {
      setBasket(p => p.some(v => v.content === previewContent)
        ? p
        : [...p, { label: `Version ${p.length + 1} — ${new Date().toLocaleTimeString('fr-FR')}`, content: previewContent, rubric: previewRubric }])
    }
    setCreating(i); setGenFull(true); setGenFullElapsed(0)
    genFullTimer.current = setInterval(() => setGenFullElapsed(x => x + 1), 1000)
    try {
      const qMap: Record<string, string> = { qcm:'QCM', open:'Questions ouvertes', vf:'Vrai/Faux', qcm_multi:'QCM (réponses multiples)', appariement:'Appariement', code:'Maths et programmation', photo:'Photo / Scan' }
      const selectedTypes = Object.entries(qTypes).filter(([,v])=>v).map(([k])=>qMap[k])
      const selectedBloom = Object.entries(bloom).filter(([,v])=>v).map(([k])=>k)
      const suggestionWithTypes = {
        ...s,
        question_types: selectedTypes.join(','),
        exam_type: selectedTypes.join(',') || s.exam_type,
        bloom_levels: selectedBloom,
        question_count: questionCount,
      }
      const data = await api.post<{ success: boolean; title: string; content: string; rubric: string; duplicates?: { similarity: number }[] }>(
        '/api/subjects/generate-full-exam', { suggestion: suggestionWithTypes }
      )
      setPreviewTitle(data.title || s.title)
      setPreviewContent(data.content || '')
      setPreviewRubric(data.rubric || '')
      setBankSaveEc(ecId)
      setElimSet(new Set())
      setStep('preview')
      if (data.duplicates && data.duplicates.length > 0) {
        toastErr(`⚠ ${data.duplicates.length} question(s) générée(s) se ressemblent fortement entre elles (jusqu'à ${Math.max(...data.duplicates.map(d=>d.similarity))}% similaire) — vérifiez avant de valider.`)
      }
    } catch (e: any) { toastErr(e.message || 'Erreur génération du sujet') }
    finally {
      setCreating(null); setGenFull(false)
      if (genFullTimer.current) { clearInterval(genFullTimer.current); genFullTimer.current = null }
    }
  }

  /* ── Save to DB ── */
  async function handleSaveSubject() {
    setSavingSubject(true)
    try {
      const titleLine = previewContent.split('\n')
        .map(l => l.replace(/^#+\s*/, '').replace(/^[\s═─━=\-_*]+$/, '').trim())
        .find(l => l.length > 2) || previewTitle
      const res = await api.post<{ success: boolean; subject: CreatedSubject }>('/api/subjects/create-from-suggestion', {
        title:           titleLine.substring(0, 100),
        content:         previewContent,
        rubric_override: previewRubric,
        ec_id:           ecId ? Number(ecId) : null,
        metadata:        { generated_by_ai: true },
        media_link_key:  mediaLinkKey || undefined,
      })
      setCreatedSubject(res.subject)
      setStep('created')
      success('Sujet enregistré avec succès')
    } catch (e: any) { toastErr(e.message || 'Erreur enregistrement') }
    finally { setSavingSubject(false) }
  }

  /* ── Générer d'autres questions à ajouter au sujet ── */
  /* ── Insérer une image/audio/vidéo dans le sujet en cours de composition ── */
  async function handleMediaUpload(file: File, mediaType: 'image' | 'audio' | 'video') {
    setUploadingMedia(true)
    try {
      let linkKey = mediaLinkKey
      if (!linkKey) { linkKey = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`; setMediaLinkKey(linkKey) }
      const fd = new FormData()
      fd.append('media_type', mediaType)
      fd.append('link_key', linkKey)
      fd.append('file', file)
      const res = await api.upload<{ success: boolean; media: { marker: string; filename: string } }>('/api/subjects/upload_media', fd)
      const ta = previewTextareaRef.current
      const insertion = `\n${res.media.marker}\n`
      if (ta && document.activeElement === ta) {
        const start = ta.selectionStart ?? previewContent.length
        const end = ta.selectionEnd ?? previewContent.length
        setPreviewContent(p => p.slice(0, start) + insertion + p.slice(end))
      } else {
        setPreviewContent(p => `${p.trimEnd()}\n${insertion}`)
      }
      const mediaLabel = mediaType === 'image' ? 'Image' : mediaType === 'video' ? 'Vidéo' : 'Audio'
      success(`${mediaLabel} inséré(e) : ${res.media.filename}`)
    } catch (e: any) {
      toastErr(e.message || 'Erreur upload média')
    } finally {
      setUploadingMedia(false)
    }
  }

  async function handleGenerateMore() {
    setGeneratingMore(true)
    try {
      const data = await api.post<{ success: boolean; new_content: string; count_generated: number; duplicates: { similarity: number }[] }>(
        '/api/subjects/generate-more-questions',
        { existing_content: previewContent, count: moreCount, question_type: moreType, title: previewTitle, student_level: level, difficulty }
      )
      setPreviewContent(p => `${p.trimEnd()}\n\n${data.new_content}`)
      setShowMoreModal(false)
      if (data.duplicates && data.duplicates.length > 0) {
        toastErr(`${data.count_generated} question(s) ajoutée(s) — ⚠ ${data.duplicates.length} ressemble(nt) à des questions existantes (${data.duplicates[0].similarity}% similaire)`)
      } else {
        success(`${data.count_generated} question(s) ajoutée(s) au sujet`)
      }
    } catch (e: any) {
      toastErr(e.message || 'Erreur lors de la génération des questions supplémentaires')
    } finally {
      setGeneratingMore(false)
    }
  }

  /* ── Basket ── */
  function addToBasket() {
    const label = `Version ${basket.length + 1} — ${new Date().toLocaleTimeString('fr-FR')}`
    setBasket(p => [...p, { label, content: previewContent, rubric: previewRubric }])
    success('Version ajoutée au panier')
  }
  function removeFromBasket(i: number) { setBasket(p => p.filter((_, j) => j !== i)) }
  function loadFromBasket(i: number) {
    const v = basket[i]
    setPreviewContent(v.content); setPreviewRubric(v.rubric)
    setElimSet(new Set()); setStep('preview'); setShowCompare(false)
    success(`« ${v.label} » chargée dans l'aperçu`)
  }

  /* ── Retour #8 — éliminer des questions sélectionnées de l'aperçu ── */
  function toggleElim(num: string) {
    setElimSet(p => { const n = new Set(p); n.has(num) ? n.delete(num) : n.add(num); return n })
  }
  function handleEliminateSelected() {
    const blocks = extractQuestionBlocks(previewContent)
    const toRemove = blocks.filter(b => elimSet.has(b.num))
    if (toRemove.length === 0) return
    let next = previewContent
    for (const b of toRemove) next = next.replace(b.raw, '')
    next = next.replace(/\n{3,}/g, '\n\n').trim()
    setPreviewContent(next)
    setElimSet(new Set())
    success(`${toRemove.length} question(s) retirée(s) de l'aperçu`)
  }

  function typeFromSelection(): 'qcm' | 'vf' | 'open' {
    if (qTypes.qcm) return 'qcm'
    if (qTypes.vf)  return 'vf'
    return 'open'
  }

  function openBankModal() { setBankSaveType(typeFromSelection()); setShowBankModal(true) }

  /* ── Bank save ── */
  async function handleBankSave() {
    if (!previewContent.trim()) { toastErr('Aucun contenu à sauvegarder'); return }
    setBankSaving(true)
    try {
      const titleLine = previewContent.split('\n')
        .map(l => l.replace(/^#+\s*/, '').replace(/^[\s═─━=\-_*]+$/, '').trim())
        .find(l => l.length > 2) || previewTitle
      const res = await api.post<{ success: boolean; question: any; duplicates?: { id: number; title: string; similarity: number }[] }>('/api/question_bank', {
        title: titleLine.substring(0, 80),
        content: previewContent,
        rubric:  previewRubric,
        question_type: bankSaveType,
        bloom_level:   bankSaveBloom || undefined,
        ec_id: bankSaveEc ? parseInt(bankSaveEc) : null,
      })
      if (res.duplicates && res.duplicates.length > 0) {
        success(`Sauvegardé ⚠ Doublon probable détecté (${res.duplicates[0].similarity}% similaire à "${res.duplicates[0].title}")`)
      } else {
        success('Sauvegardé dans la banque de questions')
      }
      setShowBankModal(false)
    } catch (err: any) { toastErr(err.message || 'Erreur sauvegarde banque') }
    finally { setBankSaving(false) }
  }

  const fmtElapsed = (s: number) => `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`

  /* ══ LOADING (suggestion generation) ══════════════════════════ */
  if (loading) return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'60vh', gap:28 }}>
      <div style={{ width:72, height:72, background:'#eff6ff', borderRadius:20, display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 8px 32px rgba(59,130,246,.2)' }}>
        <i className="fas fa-robot" style={{ fontSize:32, color:'var(--primary)' }} />
      </div>
      <div style={{ textAlign:'center' }}>
        <h3 style={{ margin:'0 0 8px', fontSize:20 }}>Analyse IA en cours…</h3>
        <p style={{ margin:0, color:'var(--text-muted)', fontSize:14 }}>L'IA lit et analyse votre cours. Cela peut prendre 1 à 2 minutes.</p>
      </div>
      <div style={{ width:320, height:6, background:'var(--border)', borderRadius:99, overflow:'hidden' }}>
        <div style={{ height:'100%', borderRadius:99, background:'var(--primary)', animation:'aibar 2s ease-in-out infinite alternate', width:'60%' }} />
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:10, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10, padding:'10px 20px' }}>
        <i className="fas fa-clock" style={{ color:'var(--primary)' }} />
        <span style={{ fontFamily:'monospace', fontWeight:700, fontSize:18, color:'var(--primary)' }}>{fmtElapsed(elapsed)}</span>
        <span style={{ fontSize:13, color:'var(--text-muted)' }}>— temps écoulé</span>
      </div>
      <style>{`@keyframes aibar { from { width:15%; } to { width:85%; } }`}</style>
    </div>
  )

  /* ══ GENERATING FULL EXAM ════════════════════════════════════════ */
  if (genFull) return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'60vh', gap:28 }}>
      <div style={{ width:72, height:72, background:'#eff6ff', borderRadius:20, display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 8px 32px rgba(59,130,246,.2)' }}>
        <i className="fas fa-wand-magic-sparkles" style={{ fontSize:32, color:'var(--primary)' }} />
      </div>
      <div style={{ textAlign:'center' }}>
        <h3 style={{ margin:'0 0 8px', fontSize:20 }}>Génération du sujet en cours…</h3>
        <p style={{ margin:0, color:'var(--text-muted)', fontSize:14 }}>L'IA génère les questions et le barème. Cela peut prendre 1 à 2 minutes.</p>
      </div>
      <div style={{ width:320, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:'14px 18px', display:'flex', flexDirection:'column', gap:10 }}>
        {[
          { icon:'fa-file-lines',     label:'Structuration des questions',     done: genFullElapsed >= 10 },
          { icon:'fa-list-check',     label:'Génération QCM / VF / Ouvertes', done: genFullElapsed >= 25 },
          { icon:'fa-scale-balanced', label:'Calcul du barème de notation',    done: genFullElapsed >= 40 },
        ].map(({ icon, label, done }) => (
          <div key={label} style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:28, height:28, borderRadius:8, background: done ? '#f0fdf4' : '#eff6ff', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              {done
                ? <i className="fas fa-check-circle" style={{ color:'#15803d', fontSize:13 }} />
                : <i className={`fas ${icon} fa-spin`} style={{ color:'var(--primary)', fontSize:12 }} />}
            </div>
            <span style={{ fontSize:13, color: done ? '#15803d' : 'var(--text)', fontWeight: done ? 600 : 400 }}>{label}</span>
          </div>
        ))}
      </div>
      <div style={{ width:320, height:6, background:'var(--border)', borderRadius:99, overflow:'hidden' }}>
        <div style={{ height:'100%', borderRadius:99, background:'var(--primary)', animation:'aibar 2s ease-in-out infinite alternate' }} />
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:10, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10, padding:'10px 20px' }}>
        <i className="fas fa-clock" style={{ color:'var(--primary)' }} />
        <span style={{ fontFamily:'monospace', fontWeight:700, fontSize:18, color:'var(--primary)' }}>{fmtElapsed(genFullElapsed)}</span>
        <span style={{ fontSize:13, color:'var(--text-muted)' }}>— temps écoulé</span>
      </div>
      <style>{`@keyframes aibar { from { width:15%; } to { width:85%; } }`}</style>
    </div>
  )

  /* ══ PREVIEW ════════════════════════════════════════════════════ */
  if (step === 'preview') return (
    <div>
      <div className="page-header">
        <div>
          <h2><i className="fas fa-eye" style={{ marginRight:10, color:'var(--primary)' }} />Aperçu du Sujet Généré</h2>
          <p>L'IA a créé un sujet complet avec questions et barème de notation</p>
        </div>
      </div>
      <div style={{ maxWidth:900, margin:'0 auto' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'14px 18px', background:'var(--surface)', border:'1px solid var(--border)', borderLeft:'4px solid var(--primary)', borderRadius:10, marginBottom:16 }}>
          <i className="fas fa-file-alt" style={{ color:'var(--primary)', fontSize:18 }} />
          <div style={{ fontWeight:700, fontSize:15 }}>{previewTitle}</div>
          <span style={{ marginLeft:'auto', background:'#dcfce7', color:'#15803d', padding:'2px 10px', borderRadius:99, fontSize:11, fontWeight:700 }}>
            <i className="fas fa-robot" style={{ marginRight:4 }} />IA — Modifiable
          </span>
        </div>

        <div style={{ background:'var(--surface)', borderRadius:12, border:'1px solid var(--border)', overflow:'hidden', boxShadow:'var(--shadow-sm)', marginBottom:14 }}>
          <div style={{ padding:'13px 18px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:8, background:'var(--background)' }}>
            <i className="fas fa-file-lines" style={{ color:'var(--primary)' }} />
            <span style={{ fontWeight:600, fontSize:13 }}>Sujet d'Examen &amp; Questions</span>
            <span style={{ marginLeft:'auto', background:'#eff6ff', color:'var(--primary)', padding:'2px 8px', borderRadius:99, fontSize:11, fontWeight:600 }}>
              <i className="fas fa-robot" style={{ marginRight:4 }} />Généré par IA — modifiable
            </span>
          </div>
          <div style={{ padding:'14px 14px 0', display:'flex', gap:8 }}>
            <button type="button" onClick={() => imageInputRef.current?.click()} disabled={uploadingMedia}
              style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 14px', border:'1px solid #bfdbfe', background:'#eff6ff', color:'var(--primary)', borderRadius:8, fontSize:12, fontWeight:600, cursor:'pointer' }}>
              <i className={`fas ${uploadingMedia ? 'fa-spinner fa-spin' : 'fa-image'}`} /> Insérer une image
            </button>
            <button type="button" onClick={() => audioInputRef.current?.click()} disabled={uploadingMedia}
              style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 14px', border:'1px solid #ddd6fe', background:'#f5f3ff', color:'#6d28d9', borderRadius:8, fontSize:12, fontWeight:600, cursor:'pointer' }}>
              <i className={`fas ${uploadingMedia ? 'fa-spinner fa-spin' : 'fa-music'}`} /> Insérer un audio
            </button>
            <button type="button" onClick={() => videoInputRef.current?.click()} disabled={uploadingMedia}
              style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 14px', border:'1px solid #fed7aa', background:'#fff7ed', color:'#c2410c', borderRadius:8, fontSize:12, fontWeight:600, cursor:'pointer' }}>
              <i className={`fas ${uploadingMedia ? 'fa-spinner fa-spin' : 'fa-film'}`} /> Insérer une vidéo
            </button>
            <input ref={imageInputRef} type="file" accept="image/*" style={{ display:'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleMediaUpload(f, 'image'); e.target.value = '' }} />
            <input ref={audioInputRef} type="file" accept="audio/*" style={{ display:'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleMediaUpload(f, 'audio'); e.target.value = '' }} />
            <input ref={videoInputRef} type="file" accept="video/*" style={{ display:'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleMediaUpload(f, 'video'); e.target.value = '' }} />
          </div>
          <div style={{ padding:'0 14px 14px' }}>
            <textarea ref={previewTextareaRef} value={previewContent} onChange={e => setPreviewContent(e.target.value)} rows={14}
              style={{ width:'100%', padding:14, background:'var(--background)', borderRadius:8, fontFamily:'monospace', fontSize:13, lineHeight:1.7, border:'1px solid var(--border)', resize:'vertical', boxSizing:'border-box', outline:'none', color:'var(--text)', marginTop:14, transition:'border-color .2s' }}
              onFocus={e=>e.target.style.borderColor='var(--primary)'} onBlur={e=>e.target.style.borderColor='var(--border)'} />
            <p style={{ margin:'6px 0 0', fontSize:11, color:'var(--text-muted)' }}>
              <i className="fas fa-info-circle" style={{ marginRight:4 }} />Le marqueur <code>[IMAGE:...]</code>/<code>[AUDIO:...]</code> inséré s'affichera à côté de la question pendant l'examen.
            </p>
          </div>
        </div>

        {/* Retour #8 — cocher des questions détectées pour les éliminer avant validation */}
        {(() => {
          const qBlocks = extractQuestionBlocks(previewContent)
          if (qBlocks.length === 0) return null
          return (
            <div style={{ background:'var(--surface)', borderRadius:12, border:'1px solid var(--border)', borderLeft:'4px solid #f59e0b', overflow:'hidden', boxShadow:'var(--shadow-sm)', marginBottom:16 }}>
              <div style={{ padding:'13px 18px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:8, background:'var(--background)' }}>
                <i className="fas fa-list-check" style={{ color:'#f59e0b' }} />
                <span style={{ fontWeight:600, fontSize:13 }}>Questions détectées ({qBlocks.length}) — cochez pour éliminer</span>
                <button onClick={handleEliminateSelected} disabled={elimSet.size === 0}
                  style={{ marginLeft:'auto', padding:'6px 14px', background:elimSet.size ? '#fee2e2' : 'var(--background)', color:elimSet.size ? '#dc2626' : 'var(--text-muted)', border:'1px solid ' + (elimSet.size ? '#fecaca' : 'var(--border)'), borderRadius:8, fontSize:12, fontWeight:700, cursor:elimSet.size ? 'pointer' : 'not-allowed' }}>
                  <i className="fas fa-trash-alt" style={{ marginRight:6 }} />Retirer la sélection ({elimSet.size})
                </button>
              </div>
              <div style={{ padding:12, display:'flex', flexDirection:'column', gap:4, maxHeight:220, overflowY:'auto' }}>
                {qBlocks.map(b => (
                  <label key={b.num} style={{ display:'flex', alignItems:'center', gap:9, padding:'6px 8px', borderRadius:6, cursor:'pointer', background:elimSet.has(b.num) ? '#fef2f2' : 'transparent' }}>
                    <input type="checkbox" checked={elimSet.has(b.num)} onChange={() => toggleElim(b.num)} />
                    <span style={{ fontSize:12.5, color:'var(--text)' }}><strong>Question {b.num}</strong> — {b.title}</span>
                  </label>
                ))}
              </div>
            </div>
          )
        })()}

        <div style={{ background:'var(--surface)', borderRadius:12, border:'1px solid var(--border)', borderLeft:'4px solid #10b981', overflow:'hidden', boxShadow:'var(--shadow-sm)', marginBottom:16 }}>
          <div style={{ padding:'13px 18px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:8, background:'var(--background)' }}>
            <i className="fas fa-clipboard-list" style={{ color:'#10b981' }} />
            <span style={{ fontWeight:600, fontSize:13 }}>Barème de Notation</span>
            <span style={{ marginLeft:'auto', background:'#f0fdf4', color:'#15803d', padding:'2px 8px', borderRadius:99, fontSize:11, fontWeight:600 }}>
              <i className="fas fa-pencil-alt" style={{ marginRight:4 }} />Modifiable
            </span>
          </div>
          <div style={{ padding:'0 14px 14px' }}>
            <textarea value={previewRubric} onChange={e => setPreviewRubric(e.target.value)} rows={9}
              style={{ width:'100%', padding:14, background:'#f0fdf4', borderRadius:8, fontFamily:'monospace', fontSize:13, lineHeight:1.8, border:'1px solid #bbf7d0', resize:'vertical', boxSizing:'border-box', outline:'none', color:'var(--text)', marginTop:14, transition:'border-color .2s' }}
              onFocus={e=>e.target.style.borderColor='#10b981'} onBlur={e=>e.target.style.borderColor='#bbf7d0'} />
          </div>
        </div>

        <div style={{ padding:12, background:'#fffbeb', border:'1px solid #fcd34d', borderRadius:8, marginBottom:18, fontSize:13, color:'#92400e' }}>
          <i className="fas fa-info-circle" style={{ marginRight:6 }} />
          <strong>Information :</strong> Ce sujet et son barème seront sauvegardés. Les étudiants verront les questions avec leurs points lors de l'examen en ligne.
        </div>

        <div style={{ display:'flex', gap:10, justifyContent:'flex-end', flexWrap:'wrap' }}>
          <button onClick={() => setStep('results')} className="btn btn-secondary" style={{ fontSize:13 }}>
            <i className="fas fa-arrow-left" /> Retour aux suggestions
          </button>
          <button onClick={addToBasket} style={{ display:'flex', alignItems:'center', gap:7, padding:'9px 16px', border:'1px solid #bbf7d0', background:'#f0fdf4', color:'#15803d', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer', position:'relative' }}>
            <i className="fas fa-shopping-basket" /> Panier
            {basket.length > 0 && <span style={{ position:'absolute', top:-6, right:-6, background:'#ef4444', color:'#fff', borderRadius:'50%', width:18, height:18, fontSize:10, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center' }}>{basket.length}</span>}
          </button>
          <button onClick={() => setShowCompare(true)} disabled={basket.length === 0} style={{ display:'flex', alignItems:'center', gap:7, padding:'9px 16px', border:'1px solid #bfdbfe', background:'#eff6ff', color:basket.length>0?'var(--primary)':'var(--text-muted)', borderRadius:8, fontSize:13, fontWeight:600, cursor:basket.length>0?'pointer':'not-allowed' }}>
            <i className="fas fa-columns" /> Comparer
          </button>
          <button onClick={openBankModal} style={{ display:'flex', alignItems:'center', gap:7, padding:'9px 16px', border:'1px solid #bfdbfe', background:'#eff6ff', color:'var(--primary)', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer' }}>
            <i className="fas fa-database" /> Banque
          </button>
          <button onClick={() => setShowMoreModal(true)} style={{ display:'flex', alignItems:'center', gap:7, padding:'9px 16px', border:'1px solid #ddd6fe', background:'#f5f3ff', color:'#6d28d9', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer' }}>
            <i className="fas fa-wand-magic-sparkles" /> Générer d'autres questions
          </button>
          <button onClick={handleSaveSubject} disabled={savingSubject} className="btn btn-primary" style={{ fontSize:13, minWidth:180 }}>
            {savingSubject ? <><i className="fas fa-spinner fa-spin" style={{ marginRight:6 }} />Enregistrement…</> : <><i className="fas fa-save" style={{ marginRight:6 }} />Enregistrer ce Sujet</>}
          </button>
        </div>
      </div>

      {/* BANK MODAL */}
      {showBankModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.45)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
          onClick={e => { if (e.target===e.currentTarget) setShowBankModal(false) }}>
          <div style={{ background:'var(--surface)', borderRadius:16, width:'100%', maxWidth:480, boxShadow:'var(--shadow-lg)', overflow:'hidden' }}>
            <div style={{ padding:'16px 22px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:9 }}>
              <i className="fas fa-database" style={{ color:'var(--primary)', fontSize:16 }} />
              <h3 style={{ margin:0, fontSize:15, fontWeight:700 }}>Sauvegarder dans la banque</h3>
              <button onClick={() => setShowBankModal(false)} style={{ marginLeft:'auto', background:'none', border:'none', fontSize:17, cursor:'pointer', color:'var(--text-muted)' }}><i className="fas fa-times" /></button>
            </div>
            <div style={{ padding:'18px 22px', display:'flex', flexDirection:'column', gap:14 }}>
              <div>
                <label style={{ fontSize:13, fontWeight:600, display:'block', marginBottom:8 }}>
                  <i className="fas fa-brain" style={{ color:'var(--primary)', marginRight:6 }} />Niveau de Bloom <span style={{ fontSize:11, fontWeight:400, color:'var(--text-muted)' }}>(optionnel)</span>
                </label>
                <select value={bankSaveBloom} onChange={e => setBankSaveBloom(e.target.value)}
                  style={{ width:'100%', padding:'9px 11px', border:'1.5px solid var(--border)', borderRadius:8, fontSize:13, background:'var(--background)', color:'var(--text)', outline:'none', boxSizing:'border-box' }}>
                  <option value="">— Sélectionner un niveau —</option>
                  {BLOOM_LEVELS.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize:13, fontWeight:600, display:'block', marginBottom:8 }}>
                  <i className="fas fa-book-open" style={{ color:'var(--primary)', marginRight:6 }} />EC associé <span style={{ fontSize:11, fontWeight:400, color:'var(--text-muted)' }}>(optionnel)</span>
                </label>
                <select value={bankSaveEc} onChange={e => setBankSaveEc(e.target.value)}
                  style={{ width:'100%', padding:'9px 11px', border:'1.5px solid var(--border)', borderRadius:8, fontSize:13, background:'var(--background)', color:'var(--text)', outline:'none', boxSizing:'border-box' }}>
                  <option value="">— Aucun EC —</option>
                  {ecs.map(ec => <option key={ec.id} value={String(ec.id)}>{ec.ue_code ? `${ec.ue_code} › ` : ''}{ec.code} — {ec.name}</option>)}
                </select>
              </div>
            </div>
            <div style={{ padding:'14px 22px', borderTop:'1px solid var(--border)', display:'flex', gap:10, justifyContent:'flex-end' }}>
              <button onClick={() => setShowBankModal(false)} className="btn btn-secondary">Annuler</button>
              <button onClick={handleBankSave} disabled={bankSaving} className="btn btn-primary" style={{ minWidth:150 }}>
                {bankSaving ? <><i className="fas fa-spinner fa-spin" style={{ marginRight:6 }} />Sauvegarde…</> : <><i className="fas fa-database" style={{ marginRight:6 }} />Sauvegarder</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GÉNÉRER D'AUTRES QUESTIONS MODAL */}
      {showMoreModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.45)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
          onClick={e => { if (e.target===e.currentTarget && !generatingMore) setShowMoreModal(false) }}>
          <div style={{ background:'var(--surface)', borderRadius:16, width:'100%', maxWidth:440, boxShadow:'var(--shadow-lg)', overflow:'hidden' }}>
            <div style={{ padding:'16px 22px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:9 }}>
              <i className="fas fa-wand-magic-sparkles" style={{ color:'#6d28d9', fontSize:16 }} />
              <h3 style={{ margin:0, fontSize:15, fontWeight:700 }}>Générer d'autres questions</h3>
              {!generatingMore && <button onClick={() => setShowMoreModal(false)} style={{ marginLeft:'auto', background:'none', border:'none', fontSize:17, cursor:'pointer', color:'var(--text-muted)' }}><i className="fas fa-times" /></button>}
            </div>
            {generatingMore ? (
              <div style={{ padding:'32px 22px', display:'flex', flexDirection:'column', alignItems:'center', gap:14, textAlign:'center' }}>
                <i className="fas fa-wand-magic-sparkles fa-spin" style={{ fontSize:28, color:'#6d28d9' }} />
                <div>
                  <div style={{ fontWeight:700, fontSize:14, marginBottom:4 }}>Génération en cours…</div>
                  <div style={{ fontSize:12, color:'var(--text-muted)' }}>L'IA rédige {moreCount} nouvelle{moreCount>1?'s':''} question{moreCount>1?'s':''} en évitant les doublons avec le sujet existant.</div>
                </div>
              </div>
            ) : (<>
              <div style={{ padding:'18px 22px', display:'flex', flexDirection:'column', gap:14 }}>
                <p style={{ margin:0, fontSize:13, color:'var(--text-muted)' }}>
                  Les nouvelles questions seront <strong>ajoutées</strong> à la fin du sujet actuel (rien n'est remplacé).
                </p>
                <div>
                  <label style={{ fontSize:13, fontWeight:600, display:'block', marginBottom:8 }}>
                    <i className="fas fa-list-check" style={{ color:'#6d28d9', marginRight:6 }} />Type de question
                  </label>
                  <select value={moreType} onChange={e => setMoreType(e.target.value)}
                    style={{ width:'100%', padding:'9px 11px', border:'1.5px solid var(--border)', borderRadius:8, fontSize:13, background:'var(--background)', color:'var(--text)', outline:'none', boxSizing:'border-box' }}>
                    <option value="QCM">QCU (choix unique)</option>
                    <option value="QCM_MULTI">QCM (réponses multiples)</option>
                    <option value="VF">Vrai / Faux</option>
                    <option value="OUVERT">Question ouverte</option>
                    <option value="APPARIEMENT">Appariement</option>
                    <option value="CODE">Maths et programmation</option>
                    <option value="PHOTO">Photo / Scan</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize:13, fontWeight:600, display:'block', marginBottom:8 }}>
                    <i className="fas fa-hashtag" style={{ color:'#6d28d9', marginRight:6 }} />Nombre de questions
                  </label>
                  <input type="number" min={1} max={10} value={moreCount} onChange={e => setMoreCount(Math.max(1, Math.min(10, Number(e.target.value))))}
                    style={{ width:'100%', padding:'9px 11px', border:'1.5px solid var(--border)', borderRadius:8, fontSize:13, background:'var(--background)', color:'var(--text)', outline:'none', boxSizing:'border-box' }} />
                </div>
              </div>
              <div style={{ padding:'14px 22px', borderTop:'1px solid var(--border)', display:'flex', gap:10, justifyContent:'flex-end' }}>
                <button onClick={() => setShowMoreModal(false)} className="btn btn-secondary">Annuler</button>
                <button onClick={handleGenerateMore} style={{ minWidth:150, display:'flex', alignItems:'center', justifyContent:'center', gap:7, padding:'9px 18px', border:'none', background:'#6d28d9', color:'#fff', borderRadius:8, fontSize:13, fontWeight:700, cursor:'pointer' }}>
                  <i className="fas fa-wand-magic-sparkles" /> Générer
                </button>
              </div>
            </>)}
          </div>
        </div>
      )}

      {/* COMPARE MODAL */}
      {showCompare && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
          onClick={e => { if (e.target===e.currentTarget) setShowCompare(false) }}>
          <div style={{ background:'var(--surface)', borderRadius:16, width:'100%', maxWidth:Math.min(280*basket.length+80, 1200), boxShadow:'var(--shadow-lg)', overflow:'hidden', maxHeight:'90vh', display:'flex', flexDirection:'column' }}>
            <div style={{ padding:'16px 22px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:9, flexShrink:0 }}>
              <i className="fas fa-columns" style={{ color:'var(--primary)', fontSize:16 }} />
              <h3 style={{ margin:0, fontSize:15, fontWeight:700 }}>Comparer les versions ({basket.length})</h3>
              <button onClick={() => setShowCompare(false)} style={{ marginLeft:'auto', background:'none', border:'none', fontSize:17, cursor:'pointer', color:'var(--text-muted)' }}><i className="fas fa-times" /></button>
            </div>
            <div className="grid" style={{ display:'grid', gridTemplateColumns:`repeat(${basket.length}, 1fr)`, gap:14, padding:20, overflowY:'auto', flex:1 }}>
              {basket.map((v, i) => (
                <div key={i} style={{ minWidth:240 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                    <div style={{ fontWeight:700, fontSize:13, flex:1 }}>{v.label}</div>
                    <button onClick={() => loadFromBasket(i)} title="Charger cette version dans l'aperçu"
                      style={{ background:'#eff6ff', border:'none', color:'var(--primary)', padding:'3px 9px', borderRadius:6, fontSize:11, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:5 }}>
                      <i className="fas fa-arrow-rotate-left" /> Charger
                    </button>
                    <button onClick={() => removeFromBasket(i)} style={{ background:'#fee2e2', border:'none', color:'#dc2626', padding:'3px 7px', borderRadius:6, fontSize:11, cursor:'pointer' }}>
                      <i className="fas fa-trash" />
                    </button>
                  </div>
                  <div style={{ marginBottom:8 }}>
                    <div style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', marginBottom:4 }}>CONTENU</div>
                    <pre style={{ background:'var(--background)', border:'1px solid var(--border)', borderRadius:8, padding:10, fontSize:11, whiteSpace:'pre-wrap', maxHeight:200, overflowY:'auto', margin:0 }}>{v.content}</pre>
                  </div>
                  <div>
                    <div style={{ fontSize:11, fontWeight:700, color:'#15803d', marginBottom:4 }}>BARÈME</div>
                    <pre style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:8, padding:10, fontSize:11, whiteSpace:'pre-wrap', maxHeight:180, overflowY:'auto', color:'#15803d', margin:0 }}>{v.rubric}</pre>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )

  /* ══ CREATED ══════════════════════════════════════════════════════ */
  if (step === 'created' && createdSubject) return (
    <div>
      <div className="page-header">
        <div>
          <h2><i className="fas fa-magic" style={{ marginRight:10, color:'var(--primary)' }} />Générer des Suggestions d'Examen avec IA</h2>
          <p>Uploadez votre cours, l'IA analysera le contenu et proposera des sujets d'examen adaptés</p>
        </div>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:20, maxWidth:900, margin:'0 auto' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
          <div style={{ display:'flex', alignItems:'center', gap:14 }}>
            <div style={{ width:48, height:48, background:'#dcfce7', borderRadius:14, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <i className="fas fa-check-circle" style={{ fontSize:22, color:'#10b981' }} />
            </div>
            <div>
              <h2 style={{ margin:0, fontSize:20, fontWeight:700 }}>Sujet créé avec succès</h2>
              <p style={{ margin:'3px 0 0', fontSize:13, color:'var(--text-muted)' }}>Le sujet a été enregistré et est prêt à être utilisé</p>
            </div>
          </div>
          <div style={{ display:'flex', gap:10 }}>
            <button className="btn btn-secondary" onClick={() => router.push('/dashboard/professor/subjects')}>
              <i className="fas fa-list" /> Voir mes sujets
            </button>
            <button className="btn btn-primary" onClick={() => { setStep('form'); setCreatedSubject(null); suggReset() }}>
              <i className="fas fa-plus" /> Nouvelle génération
            </button>
          </div>
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:12, padding:'16px 20px', background:'var(--surface)', border:'1px solid var(--border)', borderLeft:'4px solid var(--primary)', borderRadius:10 }}>
          <i className="fas fa-file-alt" style={{ fontSize:26, color:'var(--primary)' }} />
          <div>
            <h3 style={{ margin:0, fontSize:17 }}>{createdSubject.title}</h3>
            {createdSubject.created_at && <small style={{ color:'var(--text-muted)', fontSize:12 }}><i className="fas fa-calendar" style={{ marginRight:5 }} />Créé le {new Date(createdSubject.created_at).toLocaleString('fr-FR')}</small>}
          </div>
        </div>

        <div style={{ background:'var(--surface)', borderRadius:12, border:'1px solid var(--border)', overflow:'hidden' }}>
          <div style={{ padding:'13px 18px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:8, background:'var(--background)' }}>
            <i className="fas fa-file-lines" style={{ color:'var(--primary)' }} />
            <span style={{ fontWeight:600 }}>Contenu du Sujet</span>
          </div>
          <div style={{ padding:20 }}>
            <pre style={{ margin:0, maxHeight:340, overflowY:'auto', padding:16, background:'var(--background)', borderRadius:8, fontSize:13, lineHeight:1.7, whiteSpace:'pre-wrap', fontFamily:'monospace' }}>
              {createdSubject.content || 'Contenu non disponible'}
            </pre>
          </div>
        </div>

        {createdSubject.rubric && (
          <div style={{ background:'var(--surface)', borderRadius:12, border:'1px solid var(--border)', borderLeft:'4px solid #10b981', overflow:'hidden' }}>
            <div style={{ padding:'13px 18px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:8, background:'var(--background)' }}>
              <i className="fas fa-clipboard-list" style={{ color:'#10b981' }} />
              <span style={{ fontWeight:600 }}>Barème de Notation</span>
              <span style={{ marginLeft:'auto', background:'#dcfce7', color:'#15803d', padding:'2px 10px', borderRadius:99, fontSize:12, fontWeight:600 }}>
                <i className="fas fa-robot" style={{ marginRight:4 }} />Auto-généré
              </span>
            </div>
            <div style={{ padding:20 }}>
              <pre style={{ margin:0, maxHeight:400, overflowY:'auto', padding:16, background:'#f0fdf4', borderRadius:8, fontSize:13, lineHeight:1.8, whiteSpace:'pre-wrap', fontFamily:'monospace', color:'#15803d' }}>
                {createdSubject.rubric}
              </pre>
            </div>
          </div>
        )}

        <div style={{ padding:16, background:'#eff6ff', borderRadius:10, border:'1px solid #bfdbfe' }}>
          <i className="fas fa-lightbulb" style={{ color:'var(--primary)', marginRight:8 }} />
          <strong style={{ color:'#1e40af' }}>Conseil :</strong>
          <span style={{ color:'#1e40af', marginLeft:6, fontSize:14 }}>
            Vous pouvez maintenant créer un examen en ligne à partir de ce sujet depuis la page Sujets.
          </span>
        </div>
      </div>
    </div>
  )

  /* ══ MAIN (form + results) ════════════════════════════════════════ */
  return (
    <div>
      <div className="page-header">
        <div>
          <h2><i className="fas fa-magic" style={{ marginRight:10, color:'var(--primary)' }} />Générer des Suggestions d'Examen avec IA</h2>
          <p>Uploadez votre cours, l'IA analysera le contenu et proposera des sujets d'examen adaptés</p>
        </div>
        {step === 'results' && (
          <button className="btn btn-secondary" onClick={() => setStep('form')}>
            <i className="fas fa-arrow-left" /> Nouvelle génération
          </button>
        )}
      </div>

      {/* FORM */}
      {step === 'form' && (
        <div className="grid" style={{ display:'grid', gridTemplateColumns:'1fr 290px', gap:24, alignItems:'start' }}>
          <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:20 }}>

            {/* Upload */}
            <div className="card" style={{ padding:0, overflow:'hidden' }}>
              <div className="card-header" style={{ background:'var(--primary)', borderBottom:'none' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', width:'100%' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                    <div style={{ width:34, height:34, background:'rgba(255,255,255,.2)', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center' }}>
                      <i className="fas fa-upload" style={{ color:'#fff' }} />
                    </div>
                    <div>
                      <h3 style={{ margin:0, color:'#fff', fontSize:15 }}>Fichier de cours</h3>
                      <p style={{ margin:0, color:'rgba(255,255,255,.75)', fontSize:12 }}>PDF, DOCX ou TXT</p>
                    </div>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:6, background:'rgba(255,255,255,.15)', border:'1px solid rgba(255,255,255,.3)', borderRadius:8, padding:'5px 12px' }}>
                    <i className="fas fa-weight-hanging" style={{ color:'#fff', fontSize:12 }} />
                    <span style={{ color:'#fff', fontSize:13, fontWeight:700 }}>Max : {MAX_MB} Mo</span>
                  </div>
                </div>
              </div>
              <div style={{ padding:24 }}>
                <div onClick={() => fileRef.current?.click()}
                  onDragOver={e=>{e.preventDefault();setDragOver(true)}} onDragLeave={()=>setDragOver(false)}
                  onDrop={e=>{e.preventDefault();setDragOver(false);const f=e.dataTransfer.files[0];if(f)pickFile(f)}}
                  style={{ border:`2px dashed ${dragOver?'var(--primary)':fileName?'#10b981':'var(--border)'}`, borderRadius:12, padding:'40px 24px', textAlign:'center', cursor:'pointer', background:dragOver?'#eff6ff':fileName?'#f0fdf4':'var(--background)', transition:'all .2s' }}>
                  {fileName ? (
                    <>
                      <div style={{ width:52, height:52, background:'#dcfce7', borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 12px' }}>
                        <i className="fas fa-file-circle-check" style={{ fontSize:22, color:'#10b981' }} />
                      </div>
                      <div style={{ fontWeight:700, fontSize:14, color:'#15803d', marginBottom:6 }}>{fileName}</div>
                      <div style={{ width:220, margin:'0 auto 6px' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'#10b981', marginBottom:4 }}>
                          <span>{fileSize}</span><span>/ {MAX_MB} Mo max</span>
                        </div>
                        <div style={{ height:5, background:'#bbf7d0', borderRadius:99, overflow:'hidden' }}>
                          <div style={{ height:'100%', borderRadius:99, background:'#10b981', width:`${Math.min(100,(parseFloat(fileSize)/MAX_MB)*100)}%`, transition:'width .3s' }} />
                        </div>
                      </div>
                      <div style={{ fontSize:12, color:'#10b981', marginTop:4 }}>Cliquez pour changer le fichier</div>
                    </>
                  ) : (
                    <>
                      <div style={{ width:52, height:52, background:'#eff6ff', borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 12px' }}>
                        <i className="fas fa-cloud-upload-alt" style={{ fontSize:22, color:'var(--primary)' }} />
                      </div>
                      <div style={{ fontWeight:600, fontSize:15, color:'var(--text)', marginBottom:6 }}>Glissez votre fichier ici</div>
                      <div style={{ fontSize:13, color:'var(--text-muted)', marginBottom:16 }}>ou</div>
                      <span style={{ display:'inline-block', background:'var(--primary)', color:'#fff', padding:'9px 22px', borderRadius:8, fontSize:13, fontWeight:600 }}>
                        <i className="fas fa-folder-open" style={{ marginRight:7 }} />Parcourir les fichiers
                      </span>
                      <div style={{ marginTop:14, fontSize:12, color:'var(--text-muted)' }}>
                        <i className="fas fa-info-circle" style={{ marginRight:5 }} />
                        Taille maximale autorisée : <strong>{MAX_MB} Mo</strong>
                      </div>
                    </>
                  )}
                </div>
                <input ref={fileRef} type="file" accept=".pdf,.docx,.doc,.txt" style={{ display:'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) pickFile(f) }} />
              </div>
            </div>

            {/* Options */}
            <div className="card" style={{ padding:0, overflow:'hidden' }}>
              <div className="card-header">
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <i className="fas fa-sliders" style={{ color:'var(--text-muted)', fontSize:14 }} />
                  <h3 style={{ margin:0, fontSize:15 }}>Options de génération</h3>
                </div>
              </div>
              <div style={{ padding:24, display:'flex', flexDirection:'column', gap:24 }}>
                <div className="grid" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
                  <div>
                    <label style={{ display:'block', fontSize:13, fontWeight:600, color:'var(--text)', marginBottom:10 }}>
                      <i className="fas fa-signal" style={{ color:'var(--primary)', marginRight:6 }} />Niveau de difficulté
                    </label>
                    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                      {['Facile','Moyen','Difficile','Très Difficile'].map(v => {
                        const s = DIFF_STYLE[v]; const sel = difficulty === v
                        return (
                          <button key={v} type="button" onClick={() => setDifficulty(v)}
                            style={{ padding:'10px 14px', borderRadius:8, border:`1.5px solid ${sel?s.border:'var(--border)'}`, background:sel?s.bg:'var(--surface)', color:sel?s.color:'var(--text)', fontWeight:sel?700:400, fontSize:13, cursor:'pointer', textAlign:'left', display:'flex', alignItems:'center', justifyContent:'space-between', transition:'all .15s' }}>
                            {v}{sel&&<i className="fas fa-circle-check" style={{ color:s.color }} />}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  <div>
                    <label style={{ display:'block', fontSize:13, fontWeight:600, color:'var(--text)', marginBottom:10 }}>
                      <i className="fas fa-user-graduate" style={{ color:'var(--primary)', marginRight:6 }} />Niveau des étudiants
                    </label>
                    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                      {['Licence 1','Licence 2','Licence 3','Master 1','Master 2'].map(v => {
                        const sel = level === v
                        return (
                          <button key={v} type="button" onClick={() => setLevel(v)}
                            style={{ padding:'10px 14px', borderRadius:8, border:`1.5px solid ${sel?'var(--primary)':'var(--border)'}`, background:sel?'#eff6ff':'var(--surface)', color:sel?'#1d4ed8':'var(--text)', fontWeight:sel?700:400, fontSize:13, cursor:'pointer', textAlign:'left', display:'flex', alignItems:'center', justifyContent:'space-between', transition:'all .15s' }}>
                            {v}{sel&&<i className="fas fa-circle-check" style={{ color:'var(--primary)' }} />}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>

                <div>
                  <label style={{ display:'block', fontSize:13, fontWeight:600, color:'var(--text)', marginBottom:10 }}>
                    <i className="fas fa-list-check" style={{ color:'var(--primary)', marginRight:6 }} />Types de questions
                  </label>
                  <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                    {([
                      ['qcm','QCM','fa-circle-question','var(--primary)','#eff6ff','#dbeafe'],
                      ['qcm_multi','QCM multiple','fa-square-check','#7c3aed','#f5f3ff','#ddd6fe'],
                      ['open','Questions ouvertes','fa-pen-line','#0369a1','#e0f2fe','#bae6fd'],
                      ['vf','Vrai / Faux','fa-toggle-on','#10b981','#f0fdf4','#bbf7d0'],
                      ['appariement','Appariement','fa-link','#db2777','#fdf2f8','#fbcfe8'],
                      ['code','Maths / Programmation','fa-code','#ea580c','#fff7ed','#fed7aa'],
                      ['photo','Photo / Scan','fa-camera','#0891b2','#ecfeff','#a5f3fc'],
                    ] as const).map(([k,label,icon,color,bg,border]) => (
                      <button key={k} type="button" onClick={() => setQTypes(p => ({...p,[k]:!p[k]}))}
                        style={{ display:'flex', alignItems:'center', gap:9, padding:'10px 18px', border:`1.5px solid ${qTypes[k]?border:'var(--border)'}`, borderRadius:10, cursor:'pointer', background:qTypes[k]?bg:'var(--surface)', transition:'all .15s', fontWeight:qTypes[k]?700:400, fontSize:13, color:qTypes[k]?color:'var(--text)' }}>
                        <i className={`fas ${icon}`} style={{ fontSize:15, color:qTypes[k]?color:'var(--text-muted)' }} />
                        {label}
                        {qTypes[k]&&<i className="fas fa-check" style={{ marginLeft:4, fontSize:11, color }} />}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label style={{ display:'block', fontSize:13, fontWeight:600, color:'var(--text)', marginBottom:4 }}>
                    <i className="fas fa-brain" style={{ color:'var(--primary)', marginRight:6 }} />Niveaux taxonomiques de Bloom
                  </label>
                  <p style={{ margin:'0 0 10px', fontSize:12, color:'var(--text-muted)' }}>
                    <i className="fas fa-info-circle" style={{ marginRight:4 }} />Niveaux cognitifs à cibler dans la génération
                  </p>
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                    {([
                      ['connaissance','Connaissance'], ['comprehension','Compréhension'], ['application','Application'],
                      ['analyse','Analyse'],           ['synthese','Synthèse'],          ['evaluation','Évaluation'],
                    ] as const).map(([k,label]) => {
                      const c = BLOOM_COLORS[k]; const active = bloom[k]
                      return (
                        <button key={k} type="button" onClick={() => setBloom(p => ({...p,[k]:!p[k]}))}
                          style={{ padding:'7px 16px', borderRadius:99, fontSize:13, fontWeight:active?700:400, cursor:'pointer', border:`1.5px solid ${active?c.active:'var(--border)'}`, background:active?c.active:'var(--surface)', color:active?'#fff':'var(--text)', transition:'all .15s' }}>
                          {active&&<i className="fas fa-check" style={{ marginRight:5, fontSize:10 }} />}{label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div>
                  <label style={{ display:'block', fontSize:13, fontWeight:600, color:'var(--text)', marginBottom:8 }}>
                    <i className="fas fa-hashtag" style={{ color:'var(--primary)', marginRight:6 }} />
                    Nombre de questions
                  </label>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <input type="number" className="form-control" min={1} max={60} value={questionCount}
                      onChange={e => setQuestionCount(Math.max(1, Math.min(60, Number(e.target.value) || 20)))} style={{ maxWidth:140 }} />
                    <button type="button" onClick={suggestQuestionCount} disabled={suggestingCount}
                      title="Suggestion IA basée sur la difficulté et le niveau, pour un examen d'environ 1h"
                      style={{ display:'flex', alignItems:'center', gap:6, padding:'9px 14px', border:'1px solid #ddd6fe', background:'#f5f3ff', color:'#6d28d9', borderRadius:8, fontSize:12, fontWeight:600, cursor:suggestingCount?'not-allowed':'pointer' }}>
                      <i className={`fas ${suggestingCount ? 'fa-spinner fa-spin' : 'fa-wand-magic-sparkles'}`} />
                      {suggestingCount ? 'Suggestion…' : 'Suggérer (IA)'}
                    </button>
                  </div>
                </div>

                <div className="grid" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:4 }}>
                  <div>
                    <label style={{ display:'block', fontSize:12, fontWeight:700, color:'#6366f1', marginBottom:6 }}>
                      <i className="fas fa-sitemap" style={{ marginRight:5 }} />Pôle
                    </label>
                    <select className="form-control" value={filterPole} onChange={e => { setFilterPole(e.target.value); setFilterFormation(''); setEcId('') }}>
                      <option value="">— Tous —</option>
                      {uniquePoles.map(p => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display:'block', fontSize:12, fontWeight:600, color:'var(--text-muted)', marginBottom:6 }}>
                      <i className="fas fa-university" style={{ color:'var(--primary)', marginRight:5 }} />Formation
                    </label>
                    <select className="form-control" value={filterFormation} onChange={e => { setFilterFormation(e.target.value); setEcId('') }}>
                      <option value="">— Toutes —</option>
                      {filteredForms.map(f => <option key={f.id} value={String(f.id)}>{f.name}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ display:'block', fontSize:13, fontWeight:600, color:'var(--text)', marginBottom:8 }}>
                    <i className="fas fa-layer-group" style={{ color:'var(--primary)', marginRight:6 }} />
                    Élément Constitutif
                    <span style={{ fontSize:11, color:'var(--text-muted)', fontWeight:400, marginLeft:6, background:'var(--background)', border:'1px solid var(--border)', padding:'2px 8px', borderRadius:99 }}>optionnel</span>
                  </label>
                  <SearchableSelect
                    value={ecId} onChange={setEcId}
                    placeholder="— Lier à un EC (optionnel) —"
                    emptyLabel="— Lier à un EC (optionnel) —"
                    options={filteredEcs.map(ec => ({ value: String(ec.id), label: `${ec.ue_code ? ec.ue_code + ' - ' : ''}${ec.code}: ${ec.name}` }))} />
                </div>
              </div>
            </div>

            <button type="submit" className="btn btn-primary" style={{ width:'100%', padding:16, fontSize:15, fontWeight:700, borderRadius:12, justifyContent:'center' }}>
              <i className="fas fa-wand-magic-sparkles" /> Générer les Suggestions
            </button>
          </form>

          {/* Sidebar */}
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <div className="card" style={{ padding:0, overflow:'hidden' }}>
              <div className="card-header">
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <i className="fas fa-circle-info" style={{ color:'var(--primary)', fontSize:14 }} />
                  <h4 style={{ margin:0, fontSize:14 }}>Comment ça marche ?</h4>
                </div>
              </div>
              <div style={{ padding:'16px 18px', display:'flex', flexDirection:'column', gap:16 }}>
                {([
                  ['fa-upload','var(--primary)','#dbeafe','Uploadez votre cours','PDF, DOCX ou TXT acceptés'],
                  ['fa-robot','#0369a1','#e0f2fe',"L'IA analyse le contenu",'Extraction des thèmes clés'],
                  ['fa-eye','#f59e0b','#fef3c7','Prévisualisation éditables','Modifiez avant d\'enregistrer'],
                  ['fa-check-circle','#10b981','#dcfce7','3 suggestions générées','Adaptées à votre niveau'],
                ] as const).map(([icon,color,bg,title,sub],i) => (
                  <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:12 }}>
                    <div style={{ width:36, height:36, background:bg, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      <i className={`fas ${icon}`} style={{ color, fontSize:15 }} />
                    </div>
                    <div>
                      <div style={{ fontSize:13, fontWeight:700, color:'var(--text)' }}>{title}</div>
                      <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>{sub}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card" style={{ padding:0, overflow:'hidden' }}>
              <div className="card-header">
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <i className="fas fa-paperclip" style={{ color:'var(--text-muted)', fontSize:14 }} />
                  <h4 style={{ margin:0, fontSize:14 }}>Formats acceptés</h4>
                </div>
              </div>
              <div style={{ padding:'12px 16px', display:'flex', flexDirection:'column', gap:6 }}>
                {([
                  ['fa-file-pdf','#ef4444','PDF','.pdf — Idéal pour les cours'],
                  ['fa-file-word','#2563eb','Word','.docx — Documents Word'],
                  ['fa-file-alt','#64748b','TXT','.txt — Texte brut'],
                ] as const).map(([icon,color,type,desc]) => (
                  <div key={type} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 10px', borderRadius:8, background:'var(--background)' }}>
                    <i className={`fas ${icon}`} style={{ color, fontSize:18, width:22, textAlign:'center' }} />
                    <div>
                      <div style={{ fontSize:12, fontWeight:700, color:'var(--text)' }}>{type}</div>
                      <div style={{ fontSize:11, color:'var(--text-muted)' }}>{desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background:'#fffbeb', border:'1px solid #fde68a', borderRadius:12, padding:'14px 16px', display:'flex', gap:10 }}>
              <i className="fas fa-lightbulb" style={{ color:'#f59e0b', fontSize:18, flexShrink:0, marginTop:2 }} />
              <div>
                <div style={{ fontSize:12, fontWeight:700, color:'#92400e', marginBottom:4 }}>Conseil</div>
                <div style={{ fontSize:11, color:'#78350f', lineHeight:1.6 }}>
                  Plus votre cours est détaillé, plus les suggestions seront pertinentes. Privilégiez des cours complets plutôt que des résumés.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RESULTS */}
      {step === 'results' && result && (
        <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
          <div className="card" style={{ padding:0, overflow:'hidden' }}>
            <div className="card-header">
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ width:34, height:34, background:'#dcfce7', border:'1px solid #bbf7d0', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <i className="fas fa-book-open" style={{ color:'#10b981', fontSize:14 }} />
                </div>
                <div>
                  <h3 style={{ margin:0, fontSize:15 }}>Résumé du cours analysé</h3>
                  <p style={{ margin:0, fontSize:12, color:'var(--text-muted)' }}>Contenu extrait et analysé par l'IA</p>
                </div>
              </div>
            </div>
            <div style={{ padding:'20px 24px' }}>
              <p style={{ margin:'0 0 16px', color:'var(--text-muted)', lineHeight:1.8, fontSize:14 }}>{result.course_summary}</p>
              {result.main_topics?.length > 0 && (
                <div style={{ display:'flex', flexWrap:'wrap', gap:8, alignItems:'center' }}>
                  <span style={{ fontSize:12, color:'var(--text-muted)', fontWeight:700 }}>
                    <i className="fas fa-tags" style={{ marginRight:5 }} />Thèmes :
                  </span>
                  {result.main_topics.map((t, i) => (
                    <span key={i} className="status-badge secondary" style={{ fontSize:12 }}>
                      <i className="fas fa-bookmark" style={{ fontSize:10 }} /> {t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ width:38, height:38, background:'#fef3c7', border:'1px solid #fde68a', borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center' }}>
                <i className="fas fa-wand-magic-sparkles" style={{ color:'#d97706', fontSize:16 }} />
              </div>
              <div>
                <h3 style={{ margin:0 }}>Suggestions de Sujets d'Examen</h3>
                <p style={{ margin:0, fontSize:13, color:'var(--text-muted)' }}>
                  {result.suggestions.length} suggestion(s) — cliquez "Utiliser" pour générer le sujet complet avec questions et barème
                </p>
              </div>
            </div>
            <button className="btn btn-secondary" onClick={() => setStep('form')}>
              <i className="fas fa-arrow-left" /> Nouvelle génération
            </button>
          </div>

          {result.suggestions.map((s, i) => {
            const diffStyle = DIFF_STYLE[s.difficulty] ?? DIFF_STYLE['Moyen']
            return (
              <div key={i} className="card" style={{ padding:0, overflow:'hidden' }}>
                <div style={{ height:3, background:'var(--primary)' }} />
                <div style={{ padding:'20px 24px' }}>
                  <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:20, flexWrap:'wrap' }}>
                    <div style={{ flex:1, minWidth:260 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
                        <div style={{ width:30, height:30, background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                          <span style={{ fontWeight:800, color:'#2563eb', fontSize:13 }}>{i + 1}</span>
                        </div>
                        <h4 style={{ margin:0, fontSize:15, fontWeight:700 }}>{s.title}</h4>
                      </div>
                      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:14 }}>
                        <span className="status-badge secondary" style={{ fontSize:12 }}>
                          <i className="fas fa-book" /> {s.exam_type}
                        </span>
                        <span style={{ background:diffStyle.bg, color:diffStyle.color, border:`1px solid ${diffStyle.border}`, borderRadius:99, padding:'3px 12px', fontSize:12, fontWeight:600 }}>
                          <i className="fas fa-signal" style={{ marginRight:5 }} />{s.difficulty}
                        </span>
                        <span className="status-badge secondary" style={{ fontSize:12 }}>
                          <i className="fas fa-clock" /> {s.duration} min
                        </span>
                      </div>
                      <p style={{ margin:'0 0 16px', color:'var(--text-muted)', fontSize:14, lineHeight:1.7 }}>{s.description}</p>
                      {s.key_points?.length > 0 && (
                        <div style={{ background:'var(--background)', borderRadius:10, padding:'12px 16px' }}>
                          <div style={{ fontSize:12, fontWeight:700, color:'var(--text-muted)', marginBottom:8 }}>
                            <i className="fas fa-list-check" style={{ color:'var(--primary)', marginRight:6 }} />Points clés du cours
                          </div>
                          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                            {s.key_points.map((p, j) => (
                              <div key={j} style={{ display:'flex', alignItems:'flex-start', gap:8, fontSize:13, color:'var(--text-muted)' }}>
                                <i className="fas fa-circle" style={{ fontSize:5, color:'var(--primary)', marginTop:7, flexShrink:0 }} />{p}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <button onClick={() => useSuggestion(s, i)} disabled={creating !== null}
                      className="btn btn-primary" style={{ flexShrink:0, padding:'12px 22px', fontSize:14, fontWeight:700 }}>
                      <i className={`fas ${creating === i ? 'fa-spinner fa-spin' : 'fa-wand-magic-sparkles'}`} />
                      {creating === i ? 'Génération…' : 'Utiliser ce Sujet'}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
