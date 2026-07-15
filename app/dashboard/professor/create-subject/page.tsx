'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'
import { useSubjectUpload } from '@/hooks/useSubjectUpload'
import { useQuestionBank, BankQuestion } from '@/hooks/useQuestionBank'

/* ── Types ────────────────────────────────────────────────────── */
interface ECItem {
  id: number; code: string; name: string
  ue_code?: string; ue_id?: number; ue_name?: string
  formation_id?: number; formation_name?: string; formation_level?: string
  pole_id?: number; pole_code?: string; pole_name?: string
}
interface FormationItem { id: number; code: string; name: string; level: string; pole_id?: number; pole_code?: string; pole_name?: string }

const POLE_COLORS: Record<string, string> = { STN: '#6366f1', LSHE: '#10b981', SEJA: '#f59e0b' }
const poleColor = (code?: string | null) => POLE_COLORS[code || ''] || '#64748b'
interface BasketVersion { label: string; content: string; rubric: string }

type Mode = 'upload' | 'bank'

const TYPE_LABELS: Record<string, string>  = { qcm: 'QCM', vf: 'Vrai/Faux', open: 'Ouvert', subopen: 'Sous-questions' }
const TYPE_COLORS: Record<string, { bg: string; fg: string }> = {
  qcm:     { bg: '#dbeafe', fg: '#1d4ed8' },
  vf:      { bg: '#dcfce7', fg: '#15803d' },
  open:    { bg: '#fef9c3', fg: '#854d0e' },
  subopen: { bg: '#fee2e2', fg: '#b91c1c' },
}
const BLOOM_LEVELS = ['Connaissance','Compréhension','Application','Analyse','Synthèse','Évaluation']

/* ── Page ─────────────────────────────────────────────────────── */
export default function ProfessorCreateSubjectPage() {
  const router  = useRouter()
  const { error: toastErr, success: toastOk } = useToast()
  const fileRef = useRef<HTMLInputElement>(null)

  /* ── shared ── */
  const [allEcs,     setAllEcs]     = useState<ECItem[]>([])
  const [formations, setFormations] = useState<FormationItem[]>([])
  const [dataReady,  setDataReady]  = useState(false)
  const [mode,       setMode]       = useState<Mode>('upload')

  /* ── upload form ── */
  const [title,           setTitle]           = useState('')
  const [ecId,            setEcId]            = useState('')
  const [filterPole,      setFilterPole]      = useState('')
  const [filterFormation, setFilterFormation] = useState('')
  const [filterLevel,     setFilterLevel]     = useState('')
  const [file,            setFile]            = useState<File | null>(null)
  const [qTypes, setQTypes] = useState({ qcm: true, open: true, vf: false })

  /* ── basket ── */
  const [basket,      setBasket]      = useState<BasketVersion[]>([])
  const [showCompare, setShowCompare] = useState(false)

  /* ── bank save modal ── */
  const [showBankModal, setShowBankModal] = useState(false)
  const [bankSaveType,  setBankSaveType]  = useState<'open'|'qcm'|'vf'>('open')
  const [bankSaveBloom, setBankSaveBloom] = useState('')
  const [bankSaveEc,    setBankSaveEc]    = useState('')
  const [bankSaving,    setBankSaving]    = useState(false)

  /* ── bank browser ── */
  const [bankSel,      setBankSel]      = useState<Set<number>>(new Set())
  const [bankSearch,   setBankSearch]   = useState('')
  const [bankTypeF,    setBankTypeF]    = useState('')
  const [bankPoleF,    setBankPoleF]    = useState('')
  const [bankFormF,    setBankFormF]    = useState('')
  const [bankUeF,      setBankUeF]      = useState('')
  const [bankEcF,      setBankEcF]      = useState('')
  const [showAssemble, setShowAssemble] = useState(false)
  const [asmTitle,     setAsmTitle]     = useState('Examen Assemblé')
  const [asmDuration,  setAsmDuration]  = useState('60')
  const [asmLevel,     setAsmLevel]     = useState('Licence 3')
  const [asmEc,        setAsmEc]        = useState('')
  const [assembling,   setAssembling]   = useState(false)
  const [preview,      setPreview]      = useState<BankQuestion | null>(null)

  /* ── hooks ── */
  const {
    uploading, phase, created, editContent, editRubric, dragOver,
    setEditContent, setEditRubric, setDragOver, setCreated,
    upload, reset: resetUpload,
  } = useSubjectUpload(
    () => { setBankSaveEc(ecId) },
    (msg) => toastErr(msg),
  )

  const { questions: bankQ, loading: bankLoading, saveQuestion, deleteQuestion, refresh: refreshBank } = useQuestionBank()

  /* ── load shared data ── */
  useEffect(() => {
    Promise.all([api.get<ECItem[]>('/api/ecs'), api.get<FormationItem[]>('/api/formations')])
      .then(([ecs, fms]) => { setAllEcs(Array.isArray(ecs) ? ecs : []); setFormations(Array.isArray(fms) ? fms : []) })
      .catch(e => toastErr(e.message || 'Erreur chargement'))
      .finally(() => setDataReady(true))
  }, []) // eslint-disable-line

  /* ── reload bank when entering bank mode ── */
  useEffect(() => { if (mode === 'bank') refreshBank() }, [mode]) // eslint-disable-line

  /* ── derived ── */
  const uniquePoles  = Array.from(new Map(formations.filter(f=>f.pole_id).map(f=>[f.pole_id,{id:f.pole_id!,code:f.pole_code!,name:f.pole_name!}])).values())
  const uniqueLevels = Array.from(new Set(allEcs.filter(e=>!filterPole||String(e.pole_id)===filterPole).map(e => e.formation_level).filter(Boolean))) as string[]
  const filteredForms = formations.filter(f => !filterPole || String(f.pole_id) === filterPole)
  const filteredEcs  = allEcs.filter(ec => {
    if (filterPole      && String(ec.pole_id)       !== filterPole)      return false
    if (filterFormation && String(ec.formation_id) !== filterFormation) return false
    if (filterLevel     && ec.formation_level      !== filterLevel)     return false
    return true
  })

  const bankPoles      = Array.from(new Map(bankQ.filter(q=>q.pole_id).map(q=>[q.pole_id,{id:q.pole_id!,code:q.pole_code||'',name:q.pole_name||''}])).values())
  const bankFormations = Array.from(new Map(bankQ.filter(q=>q.formation_id&&(!bankPoleF||String(q.pole_id)===bankPoleF)).map(q=>[q.formation_id,{id:q.formation_id!,name:q.formation_name||''}])).values())
  const bankUes        = Array.from(new Map(bankQ.filter(q=>q.ue_id&&(!bankFormF||String(q.formation_id)===bankFormF)).map(q=>[q.ue_id,{id:q.ue_id!,code:q.ue_code||'',name:q.ue_name||''}])).values())
  const bankEcs        = Array.from(new Map(bankQ.filter(q=>q.ec_id&&(!bankUeF||String(q.ue_id)===bankUeF)).map(q=>[q.ec_id,{id:q.ec_id!,code:q.ec_code||'',name:q.ec_name||''}])).values())
  const bankFiltered   = bankQ.filter(q => {
    if (bankPoleF && String(q.pole_id)       !== bankPoleF) return false
    if (bankTypeF && q.question_type         !== bankTypeF) return false
    if (bankFormF && String(q.formation_id)  !== bankFormF) return false
    if (bankUeF   && String(q.ue_id)         !== bankUeF)   return false
    if (bankEcF   && String(q.ec_id)         !== bankEcF)   return false
    if (bankSearch) { const s = bankSearch.toLowerCase(); if (!q.title.toLowerCase().includes(s) && !(q.ec_name||'').toLowerCase().includes(s)) return false }
    return true
  })
  const asmEcOptions = Array.from(new Map(bankQ.filter(q=>bankSel.has(q.id)&&q.ec_id).map(q=>[q.ec_id,{id:q.ec_id!,label:`${q.ue_code?q.ue_code+' › ':''}${q.ec_code||''} — ${q.ec_name||''}`}])).values())

  /* ── determine bank type from form selection ── */
  function typeFromSelection(): 'qcm' | 'vf' | 'open' {
    if (qTypes.qcm) return 'qcm'
    if (qTypes.vf)  return 'vf'
    return 'open'
  }

  function openBankModal() {
    setBankSaveType(typeFromSelection())
    setShowBankModal(true)
  }

  /* ── file handlers ── */
  function handleDrop(e: React.DragEvent) { e.preventDefault(); setDragOver(false); const f=e.dataTransfer.files[0]; if(f) setFile(f) }
  function clearFile() { setFile(null); if (fileRef.current) fileRef.current.value = '' }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) { toastErr('Le titre est requis'); return }
    if (!file)         { toastErr('Sélectionnez un fichier'); return }
    await upload({ title, ecId, qTypes, file })
  }

  /* ── basket ── */
  function addToBasket() {
    if (!created) return
    const label = `Version ${basket.length + 1} — ${new Date().toLocaleTimeString('fr-FR')}`
    setBasket(p => [...p, { label, content: editContent, rubric: editRubric }])
    toastOk('Version ajoutée au panier')
  }
  function removeFromBasket(i: number) { setBasket(p => p.filter((_, j) => j !== i)) }

  /* ── bank save ── */
  async function handleBankSave() {
    if (!editContent.trim()) { toastErr('Aucun contenu à sauvegarder'); return }
    setBankSaving(true)
    try {
      const contentLines = editContent.split('\n')
      const titleLine = contentLines.map(l=>l.replace(/^#+\s*/,'').replace(/^[\s═─━=\-_*]+$/,'').trim()).find(l=>l.length>2) || created?.title || 'Question'
      const res = await saveQuestion({
        title: titleLine.substring(0, 80),
        content: editContent,
        rubric:  editRubric,
        question_type: bankSaveType,
        bloom_level:   bankSaveBloom || undefined,
        ec_id: bankSaveEc ? parseInt(bankSaveEc) : null,
      })
      if (res.duplicates && res.duplicates.length > 0) {
        toastOk(`Sauvegardé ⚠ Doublon probable détecté (${res.duplicates[0].similarity}% similaire à "${res.duplicates[0].title}")`)
      } else {
        toastOk('Sauvegardé dans la banque de questions')
      }
      setShowBankModal(false)
    } catch (err: any) { toastErr(err.message || 'Erreur sauvegarde banque') }
    finally { setBankSaving(false) }
  }

  /* ── bank browser ── */
  function bankToggle(id: number) { setBankSel(p=>{ const n=new Set(p); n.has(id)?n.delete(id):n.add(id); return n }) }
  function bankSelectAll()        { setBankSel(new Set(bankFiltered.map(q=>q.id))) }
  function bankClearAll()         { setBankSel(new Set()) }

  async function handleAssemble() {
    if (!asmTitle.trim()) { toastErr('Le titre est requis'); return }
    const ids = Array.from(bankSel)
    if (!ids.length) { toastErr('Sélectionnez au moins une question'); return }
    setAssembling(true)
    try {
      const res = await api.post<{ success: boolean; subject: { id:number; title:string; content?:string; rubric?:string; created_at?:string|null } }>('/api/question_bank/assemble', {
        question_ids: ids, title: asmTitle,
        duration: parseInt(asmDuration)||60, student_level: asmLevel,
        ec_id: asmEc ? parseInt(asmEc) : null,
      })
      toastOk(`Sujet "${asmTitle}" créé — ${ids.length} question(s).`)
      setShowAssemble(false); setBankSel(new Set())
      setCreated(res.subject)
      setEditContent(res.subject.content || '')
      setEditRubric(res.subject.rubric || '')
      setMode('upload')
    } catch (err: any) { toastErr(err.message || 'Erreur création') }
    finally { setAssembling(false) }
  }

  async function deleteBankQ(id: number) {
    if (!confirm('Supprimer cette question de la banque ?')) return
    try {
      await deleteQuestion(id)
      setBankSel(p=>{ const n=new Set(p); n.delete(id); return n })
      toastOk('Question supprimée')
    } catch (err: any) { toastErr(err.message||'Erreur') }
  }

  /* ═══════════════════════════════════════════════════════════════
   * PROCESSING SCREEN
   * ═══════════════════════════════════════════════════════════════ */
  if (uploading) {
    const phases = [
      { icon: 'fa-file-arrow-up',    label: 'Extraction du contenu du fichier',   desc: 'Lecture et analyse du document' },
      { icon: 'fa-magnifying-glass', label: 'Analyse des questions et structure',  desc: 'Identification des types et niveaux' },
      { icon: 'fa-sliders',          label: 'Génération du barème de notation',    desc: 'Calcul automatique des points par question' },
    ]
    return (
      <div>
        <div className="page-header">
          <div>
            <h2 style={{ display:'flex', alignItems:'center', gap:10 }}>
              <i className="fas fa-file-circle-plus" style={{ color:'var(--primary)' }} />Créer un Sujet d'Examen
            </h2>
            <p>Uploadez un fichier ou assemblez des questions depuis la banque</p>
          </div>
        </div>
        <div style={{ maxWidth:560, margin:'0 auto' }}>
          <div style={{ background:'var(--surface)', borderRadius:16, border:'1px solid var(--border)', overflow:'hidden', boxShadow:'var(--shadow-md)' }}>
            <div style={{ background:'var(--primary)', padding:'28px 28px 24px', textAlign:'center' }}>
              <div style={{ width:60, height:60, borderRadius:14, background:'rgba(255,255,255,.15)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 14px' }}>
                <i className="fas fa-robot" style={{ fontSize:26, color:'#fff' }} />
              </div>
              <h3 style={{ margin:0, fontSize:17, fontWeight:700, color:'#fff' }}>Analyse IA en cours…</h3>
              <p style={{ margin:'6px 0 0', color:'rgba(255,255,255,.75)', fontSize:13 }}>
                L'IA analyse votre fichier et génère le barème de notation
              </p>
            </div>
            <div style={{ padding:'24px 28px', display:'flex', flexDirection:'column', gap:10 }}>
              {phases.map((p, i) => {
                const pNum   = i + 1
                const isDone = phase > pNum || phase === 4
                const isActive = phase === pNum
                return (
                  <div key={p.icon} style={{ display:'flex', alignItems:'center', gap:14, padding:'14px 16px', background: isDone ? '#f0fdf4' : 'var(--background)', borderRadius:12, border:`1px solid ${isDone ? '#bbf7d0' : isActive ? 'var(--primary)' : 'var(--border)'}`, transition:'all .4s' }}>
                    <div style={{ width:40, height:40, borderRadius:10, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', background: isDone ? '#dcfce7' : isActive ? '#eff6ff' : 'var(--surface)', border:`1px solid ${isDone ? '#bbf7d0' : isActive ? '#bfdbfe' : 'var(--border)'}` }}>
                      {isDone
                        ? <i className="fas fa-check" style={{ fontSize:15, color:'#16a34a' }} />
                        : isActive
                          ? <i className={`fas ${p.icon} fa-spin`} style={{ fontSize:14, color:'var(--primary)' }} />
                          : <i className={`fas ${p.icon}`} style={{ fontSize:14, color:'var(--text-muted)' }} />
                      }
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:14, fontWeight: isActive||isDone ? 600 : 400, color: isDone ? '#15803d' : isActive ? 'var(--primary)' : 'var(--text-muted)' }}>{p.label}</div>
                      <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>{p.desc}</div>
                    </div>
                    {isActive && (
                      <div style={{ display:'flex', gap:3, flexShrink:0 }}>
                        {[0,1,2].map(d => (
                          <span key={d} style={{ width:6, height:6, borderRadius:'50%', background:'var(--primary)', display:'inline-block', animation:`dot-pulse 1.2s ${d*0.2}s ease-in-out infinite` }} />
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            <div style={{ padding:'0 28px 24px' }}>
              <div style={{ height:6, background:'var(--border)', borderRadius:99, overflow:'hidden' }}>
                <div style={{ height:'100%', borderRadius:99, background:'var(--primary)', transition:'width .6s ease', width: phase===1?'20%': phase===2?'50%': phase===3?'80%': phase===4?'100%':'5%' }} />
              </div>
              <div style={{ marginTop:8, fontSize:12, color:'var(--text-muted)', textAlign:'center' }}>
                {phase===1?'Extraction en cours…': phase===2?'Analyse en cours…': phase===3?'Génération du barème…': 'Finalisation…'}
              </div>
            </div>
          </div>
        </div>
        <style>{`@keyframes dot-pulse { 0%,100%{opacity:.3;transform:scale(1)} 50%{opacity:1;transform:scale(1.3)} }`}</style>
      </div>
    )
  }

  /* ═══════════════════════════════════════════════════════════════
   * RESULT SCREEN
   * ═══════════════════════════════════════════════════════════════ */
  if (created) return (
    <div>
      <div className="page-header">
        <div>
          <h2 style={{ display:'flex', alignItems:'center', gap:10 }}>
            <i className="fas fa-file-circle-plus" style={{ color:'var(--primary)' }} />Créer un Sujet d'Examen
          </h2>
          <p>Uploadez un fichier ou assemblez des questions depuis la banque</p>
        </div>
      </div>
      <div style={{ maxWidth:900, margin:'0 auto' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18, flexWrap:'wrap', gap:10 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:38, height:38, background:'#dcfce7', borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <i className="fas fa-circle-check" style={{ color:'#16a34a', fontSize:18 }} />
            </div>
            <div>
              <div style={{ fontWeight:700, fontSize:16 }}>Sujet créé avec succès</div>
              <div style={{ fontSize:13, color:'var(--text-muted)' }}>Barème généré automatiquement par l'IA — modifiable ci-dessous</div>
            </div>
          </div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            <button onClick={() => router.push('/dashboard/professor/subjects')} className="btn btn-secondary" style={{ fontSize:12 }}>
              <i className="fas fa-list" /> Voir les sujets
            </button>
            <button onClick={() => { setCreated(null); setTitle(''); setFile(null); setEcId(''); setEditContent(''); setEditRubric('') }} className="btn btn-primary" style={{ fontSize:12 }}>
              <i className="fas fa-plus" /> Créer un autre
            </button>
          </div>
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'14px 18px', background:'var(--surface)', border:'1px solid var(--border)', borderLeft:'4px solid var(--primary)', borderRadius:10, marginBottom:16 }}>
          <i className="fas fa-file-alt" style={{ color:'var(--primary)', fontSize:18 }} />
          <div>
            <div style={{ fontWeight:700, fontSize:15 }}>{created.title}</div>
            {created.created_at && <div style={{ fontSize:12, color:'var(--text-muted)' }}>Créé le {new Date(created.created_at).toLocaleString('fr-FR')}</div>}
          </div>
          <span style={{ marginLeft:'auto', background:'#dcfce7', color:'#15803d', padding:'2px 10px', borderRadius:99, fontSize:11, fontWeight:700 }}>
            <i className="fas fa-robot" style={{ marginRight:4 }} />IA — Modifiable
          </span>
        </div>

        <div style={{ background:'var(--surface)', borderRadius:12, border:'1px solid var(--border)', overflow:'hidden', boxShadow:'var(--shadow-sm)', marginBottom:14 }}>
          <div style={{ padding:'13px 18px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:8, background:'var(--background)' }}>
            <i className="fas fa-file-lines" style={{ color:'var(--primary)' }} />
            <span style={{ fontWeight:600, fontSize:13 }}>Sujet d'Examen &amp; Questions</span>
            <span style={{ marginLeft:'auto', background:'#eff6ff', color:'var(--primary)', padding:'2px 8px', borderRadius:99, fontSize:11, fontWeight:600 }}>Généré par IA — modifiable</span>
          </div>
          <div style={{ padding:'0 14px 14px' }}>
            <textarea value={editContent} onChange={e => setEditContent(e.target.value)} rows={14}
              style={{ width:'100%', padding:14, background:'var(--background)', borderRadius:8, fontFamily:'monospace', fontSize:13, lineHeight:1.7, border:'1px solid var(--border)', resize:'vertical', boxSizing:'border-box', outline:'none', color:'var(--text)', marginTop:14, transition:'border-color .2s' }}
              onFocus={e => e.target.style.borderColor='var(--primary)'}
              onBlur={e => e.target.style.borderColor='var(--border)'} />
          </div>
        </div>

        <div style={{ background:'var(--surface)', borderRadius:12, border:'1px solid var(--border)', borderLeft:'4px solid #10b981', overflow:'hidden', boxShadow:'var(--shadow-sm)', marginBottom:16 }}>
          <div style={{ padding:'13px 18px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:8, background:'var(--background)' }}>
            <i className="fas fa-clipboard-list" style={{ color:'#10b981' }} />
            <span style={{ fontWeight:600, fontSize:13 }}>Barème de Notation</span>
            <span style={{ marginLeft:'auto', background:'#f0fdf4', color:'#15803d', padding:'2px 8px', borderRadius:99, fontSize:11, fontWeight:600 }}>
              <i className="fas fa-pencil-alt" style={{ marginRight:4 }} />Modifiable
            </span>
          </div>
          <div style={{ padding:'0 14px 14px' }}>
            <textarea value={editRubric} onChange={e => setEditRubric(e.target.value)} rows={9}
              style={{ width:'100%', padding:14, background:'#f0fdf4', borderRadius:8, fontFamily:'monospace', fontSize:13, lineHeight:1.8, border:'1px solid #bbf7d0', resize:'vertical', boxSizing:'border-box', outline:'none', color:'var(--text)', marginTop:14, transition:'border-color .2s' }}
              onFocus={e => e.target.style.borderColor='#10b981'}
              onBlur={e => e.target.style.borderColor='#bbf7d0'} />
          </div>
        </div>

        <div style={{ padding:12, background:'#fffbeb', border:'1px solid #fcd34d', borderRadius:8, marginBottom:18, fontSize:13, color:'#92400e' }}>
          <i className="fas fa-info-circle" style={{ marginRight:6 }} />
          <strong>Information :</strong> Ce sujet et son barème sont enregistrés. Vous pouvez les modifier et les sauvegarder dans la banque de questions pour les réutiliser.
        </div>

        <div style={{ display:'flex', gap:10, justifyContent:'flex-end', flexWrap:'wrap' }}>
          <button onClick={() => { setCreated(null); setTitle(''); setFile(null); setEcId('') }} className="btn btn-secondary" style={{ fontSize:13 }}>
            <i className="fas fa-arrow-left" /> Retour
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
          <button onClick={() => router.push('/dashboard/professor/subjects')} className="btn btn-primary" style={{ fontSize:13 }}>
            <i className="fas fa-save" /> Terminer
          </button>
        </div>
      </div>

      {/* BANK SAVE MODAL */}
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
                  {allEcs.map(ec => <option key={ec.id} value={String(ec.id)}>{ec.ue_code?`${ec.ue_code} › `:''}{ec.code} — {ec.name}</option>)}
                </select>
              </div>
            </div>
            <div style={{ padding:'14px 22px', borderTop:'1px solid var(--border)', display:'flex', gap:10, justifyContent:'flex-end' }}>
              <button onClick={() => setShowBankModal(false)} className="btn btn-secondary">Annuler</button>
              <button onClick={handleBankSave} disabled={bankSaving} className="btn btn-primary" style={{ minWidth:150 }}>
                {bankSaving?<><i className="fas fa-spinner fa-spin" style={{ marginRight:6 }} />Sauvegarde…</>:<><i className="fas fa-database" style={{ marginRight:6 }} />Sauvegarder</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* COMPARE MODAL */}
      {showCompare && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
          onClick={e => { if (e.target===e.currentTarget) setShowCompare(false) }}>
          <div style={{ background:'var(--surface)', borderRadius:16, width:'100%', maxWidth:Math.min(280*basket.length+80, 1400), boxShadow:'var(--shadow-lg)', overflow:'hidden', maxHeight:'90vh', display:'flex', flexDirection:'column' }}>
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

  /* ═══════════════════════════════════════════════════════════════
   * MAIN FORM + BANK
   * ═══════════════════════════════════════════════════════════════ */
  return (
    <div>
      <div className="page-header">
        <div>
          <h2 style={{ display:'flex', alignItems:'center', gap:10 }}>
            <i className="fas fa-file-circle-plus" style={{ color:'var(--primary)' }} />Créer un Sujet d'Examen
          </h2>
          <p>Uploadez un fichier ou assemblez des questions depuis la banque</p>
        </div>
      </div>

      {/* Mode selector */}
      <div style={{ display:'flex', gap:0, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:4, marginBottom:24, width:'fit-content', boxShadow:'var(--shadow-sm)' }}>
        {([{ key:'upload', icon:'fa-cloud-arrow-up', label:'Uploader un fichier' }, { key:'bank', icon:'fa-database', label:'Banque de questions' }] as { key:Mode; icon:string; label:string }[]).map(m => (
          <button key={m.key} onClick={() => setMode(m.key)} style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 18px', border:'none', borderRadius:9, fontSize:13, fontWeight:mode===m.key?700:500, cursor:'pointer', transition:'all .2s', background:mode===m.key?'var(--primary)':'transparent', color:mode===m.key?'#fff':'var(--text-muted)' }}>
            <i className={`fas ${m.icon}`} style={{ fontSize:13 }} />{m.label}
          </button>
        ))}
      </div>

      {/* UPLOAD MODE */}
      {mode === 'upload' && (
        <div className="grid" style={{ display:'grid', gridTemplateColumns:'1fr 300px', gap:24, alignItems:'start' }}>
          <div style={{ background:'var(--surface)', borderRadius:14, border:'1px solid var(--border)', borderTop:'3px solid var(--primary)', boxShadow:'var(--shadow-sm)' }}>
            <div style={{ padding:'18px 24px 14px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:9 }}>
              <i className="fas fa-pen-to-square" style={{ color:'var(--primary)', fontSize:15 }} />
              <h3 style={{ margin:0, fontSize:15, fontWeight:700 }}>Informations du sujet</h3>
            </div>
            <form onSubmit={handleUpload} style={{ padding:24 }}>
              {/* Titre */}
              <div style={{ marginBottom:20 }}>
                <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, fontWeight:600, marginBottom:7 }}>
                  <i className="fas fa-heading" style={{ color:'var(--primary)', width:14 }} />Titre du sujet <span style={{ color:'#ef4444', fontSize:11 }}>*</span>
                </label>
                <input type="text" value={title} onChange={e => setTitle(e.target.value)} required
                  placeholder="Ex : Examen final — Réseaux informatiques S2"
                  style={{ width:'100%', padding:'11px 13px', border:'1.5px solid var(--border)', borderRadius:8, fontSize:14, background:'var(--background)', color:'var(--text)', outline:'none', boxSizing:'border-box', transition:'border-color .2s' }}
                  onFocus={e=>e.target.style.borderColor='var(--primary)'} onBlur={e=>e.target.style.borderColor='var(--border)'} />
              </div>

              {/* Types de questions */}
              <div style={{ marginBottom:22 }}>
                <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, fontWeight:600, marginBottom:10 }}>
                  <i className="fas fa-list-check" style={{ color:'var(--primary)', width:14 }} />Types de questions
                </label>
                <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                  {([['qcm','QCM','fa-circle-question','#1d4ed8','#dbeafe','#bfdbfe'],['open','Questions ouvertes','fa-pen-line','#0369a1','#e0f2fe','#7dd3fc'],['vf','Vrai / Faux','fa-toggle-on','#15803d','#dcfce7','#86efac']] as const).map(([k,label,icon,color,bg,border])=>(
                    <button key={k} type="button" onClick={()=>setQTypes(p=>({...p,[k]:!p[k]}))}
                      style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 16px', border:`1.5px solid ${qTypes[k]?border:'var(--border)'}`, borderRadius:10, cursor:'pointer', background:qTypes[k]?bg:'var(--surface)', transition:'all .15s', fontWeight:qTypes[k]?700:400, fontSize:13, color:qTypes[k]?color:'var(--text)' }}>
                      <i className={`fas ${icon}`} style={{ fontSize:14, color:qTypes[k]?color:'var(--text-muted)' }} />{label}
                      {qTypes[k]&&<i className="fas fa-check" style={{ fontSize:10, marginLeft:2, color }} />}
                    </button>
                  ))}
                </div>
              </div>

              {/* EC filters — cascade Pôle → Formation → Niveau → EC */}
              <div className="grid" style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:8 }}>
                <div>
                  <label style={{ display:'flex', alignItems:'center', gap:5, fontSize:12, fontWeight:700, color:'#6366f1', marginBottom:5 }}>
                    <i className="fas fa-sitemap" style={{ width:12 }} />Pôle
                  </label>
                  <select value={filterPole} onChange={e=>{setFilterPole(e.target.value);setFilterFormation('');setFilterLevel('');setEcId('')}} style={{ width:'100%', padding:'8px 11px', border:'1.5px solid var(--border)', borderRadius:8, fontSize:12, background:'var(--background)', color:'var(--text)', outline:'none', boxSizing:'border-box' }}>
                    <option value="">— Tous —</option>
                    {uniquePoles.map(p=><option key={p.id} value={String(p.id)} style={{ color: poleColor(p.code) }}>{p.code} — {p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display:'flex', alignItems:'center', gap:5, fontSize:12, fontWeight:600, color:'var(--text-muted)', marginBottom:5 }}>
                    <i className="fas fa-university" style={{ color:'var(--primary)', width:12 }} />Formation
                  </label>
                  <select value={filterFormation} onChange={e=>{setFilterFormation(e.target.value);setEcId('')}} style={{ width:'100%', padding:'8px 11px', border:'1.5px solid var(--border)', borderRadius:8, fontSize:12, background:'var(--background)', color:'var(--text)', outline:'none', boxSizing:'border-box' }}>
                    <option value="">— Toutes —</option>
                    {filteredForms.map(f=><option key={f.id} value={String(f.id)}>{f.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display:'flex', alignItems:'center', gap:5, fontSize:12, fontWeight:600, color:'var(--text-muted)', marginBottom:5 }}>
                    <i className="fas fa-layer-group" style={{ color:'var(--primary)', width:12 }} />Niveau
                  </label>
                  <select value={filterLevel} onChange={e=>{setFilterLevel(e.target.value);setEcId('')}} style={{ width:'100%', padding:'8px 11px', border:'1.5px solid var(--border)', borderRadius:8, fontSize:12, background:'var(--background)', color:'var(--text)', outline:'none', boxSizing:'border-box' }}>
                    <option value="">— Tous —</option>
                    {uniqueLevels.map(l=><option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
              </div>

              {/* EC */}
              <div style={{ marginBottom:22 }}>
                <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, fontWeight:600, marginBottom:7 }}>
                  <i className="fas fa-book-open" style={{ color:'var(--primary)', width:15 }} />EC <span style={{ color:'var(--text-muted)', fontSize:11, fontWeight:400 }}>optionnel</span>
                </label>
                <select value={ecId} onChange={e=>setEcId(e.target.value)} disabled={!dataReady}
                  style={{ width:'100%', padding:'11px 13px', border:'1.5px solid var(--border)', borderRadius:8, fontSize:13, background:'var(--background)', color:'var(--text)', outline:'none', boxSizing:'border-box', transition:'border-color .2s' }}
                  onFocus={e=>e.target.style.borderColor='var(--primary)'} onBlur={e=>e.target.style.borderColor='var(--border)'}>
                  <option value="">{!dataReady?'Chargement…':'— Aucun (sujet indépendant) —'}</option>
                  {filteredEcs.map(ec=><option key={ec.id} value={String(ec.id)}>{ec.ue_code?`${ec.ue_code} › `:''}{ec.code} — {ec.name}</option>)}
                </select>
              </div>

              {/* File */}
              <div style={{ marginBottom:22 }}>
                <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, fontWeight:600, marginBottom:7 }}>
                  <i className="fas fa-file-arrow-up" style={{ color:'#16a34a', width:15 }} />Fichier <span style={{ color:'#ef4444', fontSize:11 }}>*</span>
                </label>
                {!file?(
                  <label style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:10, padding:'28px 20px', border:`2px dashed ${dragOver?'#16a34a':'var(--border)'}`, borderRadius:12, cursor:'pointer', background:dragOver?'#f0fdf4':'var(--background)', transition:'all .2s', textAlign:'center' }}
                    onDragOver={e=>{e.preventDefault();setDragOver(true)}} onDragLeave={()=>setDragOver(false)} onDrop={handleDrop}>
                    <i className="fas fa-cloud-arrow-up" style={{ fontSize:34, color:'var(--text-muted)' }} />
                    <div><div style={{ fontWeight:600, fontSize:14 }}>Glissez votre fichier ici</div><div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>ou cliquez pour parcourir</div></div>
                    <div style={{ display:'flex', gap:6 }}>
                      {[{l:'PDF',bg:'#dbeafe',fg:'#1d4ed8'},{l:'DOCX',bg:'#dcfce7',fg:'#15803d'},{l:'TXT',bg:'#fef9c3',fg:'#854d0e'}].map(b=><span key={b.l} style={{ background:b.bg,color:b.fg,padding:'2px 9px',borderRadius:99,fontSize:11,fontWeight:700 }}>{b.l}</span>)}
                    </div>
                    <input ref={fileRef} type="file" accept=".pdf,.docx,.doc,.txt" style={{ display:'none' }} onChange={e=>{if(e.target.files?.[0]) setFile(e.target.files[0])}} />
                  </label>
                ):(
                  <div style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', background:'#f0fdf4', border:'1px solid #86efac', borderRadius:10 }}>
                    <i className="fas fa-file-check" style={{ color:'#16a34a', fontSize:20, flexShrink:0 }} />
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:600, color:'#15803d', fontSize:13 }}>{file.name}</div>
                      <div style={{ fontSize:12, color:'var(--text-muted)' }}>{(file.size/1024/1024).toFixed(2)} Mo</div>
                    </div>
                    <button type="button" onClick={clearFile} style={{ background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer', fontSize:16, padding:4 }}><i className="fas fa-times-circle" /></button>
                  </div>
                )}
              </div>

              {/* Submit */}
              <div style={{ display:'flex', gap:10, paddingTop:8, borderTop:'1px solid var(--border)' }}>
                <button type="submit" className="btn btn-primary" style={{ flex:1, padding:'12px', fontSize:14, fontWeight:600 }}>
                  <i className="fas fa-wand-magic-sparkles" style={{ marginRight:7 }} />Créer le Sujet
                </button>
                <button type="button" onClick={()=>router.push('/dashboard/professor/subjects')} className="btn btn-secondary" style={{ padding:'12px 18px' }}>
                  <i className="fas fa-times" />
                </button>
              </div>
            </form>
          </div>

          {/* Side panel */}
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div style={{ background:'var(--surface)', borderRadius:12, border:'1px solid var(--border)', borderTop:'3px solid #16a34a', padding:18 }}>
              <h4 style={{ margin:'0 0 12px', fontSize:13, fontWeight:700, display:'flex', alignItems:'center', gap:7 }}>
                <i className="fas fa-file-circle-check" style={{ color:'#16a34a' }} />Formats acceptés
              </h4>
              {[{icon:'fa-file-pdf',color:'#ef4444',label:'PDF',desc:'Natif ou scanné'},{icon:'fa-file-word',color:'var(--primary)',label:'DOCX / DOC',desc:'Microsoft Word'},{icon:'fa-file-lines',color:'#16a34a',label:'TXT',desc:'Texte brut'}].map(f=>(
                <div key={f.label} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 10px', background:'var(--background)', borderRadius:8, marginBottom:6 }}>
                  <i className={`fas ${f.icon}`} style={{ color:f.color, fontSize:18, width:22, textAlign:'center', flexShrink:0 }} />
                  <div><div style={{ fontWeight:600, fontSize:12 }}>{f.label}</div><div style={{ fontSize:11, color:'var(--text-muted)' }}>{f.desc}</div></div>
                </div>
              ))}
            </div>
            <div style={{ background:'var(--surface)', borderRadius:12, border:'1px solid var(--border)', borderTop:'3px solid var(--primary)', padding:18 }}>
              <h4 style={{ margin:'0 0 12px', fontSize:13, fontWeight:700, display:'flex', alignItems:'center', gap:7 }}>
                <i className="fas fa-robot" style={{ color:'var(--primary)' }} />Ce que fait l'IA
              </h4>
              {[{icon:'fa-magnifying-glass',text:'Analyse le contenu et la structure des questions'},{icon:'fa-scale-balanced',text:'Attribue des points selon la difficulté et les types choisis'},{icon:'fa-list-check',text:'Génère un barème détaillé adapté aux types sélectionnés'}].map(item=>(
                <div key={item.icon} style={{ display:'flex', gap:9, alignItems:'flex-start', marginBottom:9 }}>
                  <i className={`fas ${item.icon}`} style={{ color:'var(--primary)', marginTop:2, flexShrink:0 }} />
                  <p style={{ margin:0, fontSize:12, color:'var(--text-muted)', lineHeight:1.5 }}>{item.text}</p>
                </div>
              ))}
            </div>
            <div style={{ padding:14, background:'#fffbeb', border:'1px solid #fde68a', borderRadius:10 }}>
              <p style={{ margin:'0 0 5px', fontWeight:600, fontSize:12, color:'#92400e' }}><i className="fas fa-lightbulb" style={{ color:'#f59e0b', marginRight:5 }} />Conseil</p>
              <p style={{ margin:0, fontSize:12, color:'#78350f', lineHeight:1.6 }}>Sélectionnez les types de questions présents dans votre document pour que l'IA génère un barème adapté.</p>
            </div>
          </div>
        </div>
      )}

      {/* BANK MODE */}
      {mode === 'bank' && (
        <div>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14, flexWrap:'wrap', gap:10 }}>
            <div>
              <div style={{ fontWeight:700, fontSize:15 }}>Banque de questions</div>
              <div style={{ fontSize:13, color:'var(--text-muted)' }}>{bankQ.length} question(s) — sélectionnez pour assembler un sujet</div>
            </div>
            <button onClick={bankSelectAll} className="btn btn-secondary" style={{ fontSize:12 }}>
              <i className="fas fa-check-square" />Tout sélectionner
            </button>
          </div>

          {/* Filters — cascade Pôle → Formation → UE → EC */}
          <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap' }}>
            <input type="text" value={bankSearch} onChange={e=>setBankSearch(e.target.value)} placeholder="Rechercher…"
              style={{ flex:1, minWidth:140, padding:'8px 12px', border:'1.5px solid var(--border)', borderRadius:8, fontSize:13, background:'var(--background)', color:'var(--text)', outline:'none' }} />
            <select value={bankTypeF} onChange={e=>setBankTypeF(e.target.value)} style={{ padding:'8px 10px', border:'1.5px solid var(--border)', borderRadius:8, fontSize:12, background:'var(--background)', color:'var(--text)', outline:'none' }}>
              <option value="">Type</option><option value="qcm">QCM</option><option value="vf">Vrai/Faux</option><option value="open">Ouvert</option><option value="subopen">Sous-questions</option>
            </select>
            <select value={bankPoleF} onChange={e=>{setBankPoleF(e.target.value);setBankFormF('');setBankUeF('');setBankEcF('')}} style={{ padding:'8px 10px', border:`1.5px solid ${bankPoleF?poleColor(bankPoles.find(p=>String(p.id)===bankPoleF)?.code):'var(--border)'}`, borderRadius:8, fontSize:12, background:'var(--background)', color:'var(--text)', outline:'none' }}>
              <option value="">Pôle</option>
              {bankPoles.map(p=><option key={p.id} value={String(p.id)}>{p.code} — {p.name}</option>)}
            </select>
            <select value={bankFormF} onChange={e=>{setBankFormF(e.target.value);setBankUeF('');setBankEcF('')}} style={{ padding:'8px 10px', border:'1.5px solid var(--border)', borderRadius:8, fontSize:12, background:'var(--background)', color:'var(--text)', outline:'none' }}>
              <option value="">Formation</option>
              {bankFormations.map(f=><option key={f.id} value={String(f.id)}>{f.name}</option>)}
            </select>
            <select value={bankUeF} onChange={e=>{setBankUeF(e.target.value);setBankEcF('')}} style={{ padding:'8px 10px', border:'1.5px solid var(--border)', borderRadius:8, fontSize:12, background:'var(--background)', color:'var(--text)', outline:'none' }}>
              <option value="">UE</option>
              {bankUes.map(u=><option key={u.id} value={String(u.id)}>{u.code} — {u.name}</option>)}
            </select>
            <select value={bankEcF} onChange={e=>setBankEcF(e.target.value)} style={{ padding:'8px 10px', border:'1.5px solid var(--border)', borderRadius:8, fontSize:12, background:'var(--background)', color:'var(--text)', outline:'none' }}>
              <option value="">EC</option>
              {bankEcs.map(ec=><option key={ec.id} value={String(ec.id)}>{ec.code} — {ec.name}</option>)}
            </select>
            {(bankSearch||bankTypeF||bankPoleF||bankFormF||bankUeF||bankEcF)&&(
              <button onClick={()=>{setBankSearch('');setBankTypeF('');setBankPoleF('');setBankFormF('');setBankUeF('');setBankEcF('')}} style={{ padding:'8px 12px', border:'1px solid var(--border)', borderRadius:8, fontSize:12, background:'var(--background)', color:'var(--text-muted)', cursor:'pointer' }}>
                <i className="fas fa-times" />
              </button>
            )}
          </div>

          {/* Toolbar */}
          {bankSel.size>0&&(
            <div style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 18px', background:'var(--primary)', borderRadius:12, marginBottom:14, flexWrap:'wrap' }}>
              <div style={{ flex:1, color:'#fff', fontWeight:700, fontSize:14 }}>{bankSel.size} question{bankSel.size>1?'s':''} sélectionnée{bankSel.size>1?'s':''}</div>
              <button onClick={bankClearAll} style={{ background:'rgba(255,255,255,.15)', border:'none', color:'#fff', padding:'7px 13px', borderRadius:8, fontSize:12, fontWeight:600, cursor:'pointer' }}>
                <i className="fas fa-times" style={{ marginRight:5 }} />Désélectionner
              </button>
              <button onClick={()=>setShowAssemble(true)} style={{ background:'#fff', border:'none', color:'var(--primary)', padding:'9px 18px', borderRadius:8, fontSize:13, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:7 }}>
                <i className="fas fa-layer-group" />Créer un sujet
              </button>
            </div>
          )}

          {/* Table */}
          <div style={{ background:'var(--surface)', borderRadius:12, border:'1px solid var(--border)', overflow:'hidden', boxShadow:'var(--shadow-sm)' }}>
            {bankLoading?(
              <div style={{ padding:48, textAlign:'center', color:'var(--text-muted)' }}><i className="fas fa-spinner fa-spin" style={{ fontSize:24, display:'block', marginBottom:10 }} />Chargement…</div>
            ):bankQ.length===0?(
              <div style={{ padding:56, textAlign:'center', color:'var(--text-muted)' }}><i className="fas fa-inbox" style={{ fontSize:36, display:'block', marginBottom:12 }} />Banque vide — sauvegardez des questions depuis la génération IA pour les réutiliser ici.</div>
            ):(
              <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr style={{ background:'var(--background)' }}>
                    <th style={{ padding:'10px 14px', width:36 }}></th>
                    <th style={{ padding:'10px 14px', textAlign:'left', fontSize:11, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'.05em' }}>Type</th>
                    <th style={{ padding:'10px 14px', textAlign:'left', fontSize:11, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'.05em' }}>Titre</th>
                    <th style={{ padding:'10px 14px', textAlign:'left', fontSize:11, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'.05em' }}>Formation / UE / EC</th>
                    <th style={{ padding:'10px 14px', textAlign:'left', fontSize:11, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'.05em' }}>Bloom</th>
                    <th style={{ padding:'10px 14px', textAlign:'left', fontSize:11, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'.05em' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {bankFiltered.length===0?(
                    <tr><td colSpan={6} style={{ padding:32, textAlign:'center', color:'var(--text-muted)', fontSize:13 }}>Aucune question ne correspond aux filtres</td></tr>
                  ):bankFiltered.map(q=>{
                    const tc=TYPE_COLORS[q.question_type]||{bg:'#f1f5f9',fg:'#475569'}; const sel=bankSel.has(q.id)
                    return(
                      <tr key={q.id} onClick={()=>bankToggle(q.id)} style={{ background:sel?'#eff6ff':'var(--surface)', borderBottom:'1px solid var(--border)', transition:'background .15s', cursor:'pointer' }}>
                        <td style={{ padding:'10px 14px' }} onClick={e=>e.stopPropagation()}>
                          <input type="checkbox" checked={sel} onChange={()=>bankToggle(q.id)} style={{ width:16, height:16, accentColor:'var(--primary)', cursor:'pointer' }} />
                        </td>
                        <td style={{ padding:'10px 14px' }}>
                          <span style={{ fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:99, background:tc.bg, color:tc.fg, whiteSpace:'nowrap' }}>{TYPE_LABELS[q.question_type]||q.question_type}</span>
                        </td>
                        <td style={{ padding:'10px 14px', fontSize:13, fontWeight:600, maxWidth:280 }}>
                          <div style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{q.title}</div>
                        </td>
                        <td style={{ padding:'10px 14px' }}>
                          <div style={{ fontSize:11, color:'var(--text-muted)', lineHeight:1.7 }}>
                            {q.formation_name&&<div style={{ fontWeight:600, color:'var(--text)' }}>{q.formation_name}{q.formation_level&&` — ${q.formation_level}`}</div>}
                            {q.ue_code&&<div><i className="fas fa-book" style={{ marginRight:4, fontSize:9 }} />{q.ue_code}{q.ue_name&&` — ${q.ue_name}`}</div>}
                            {q.ec_code&&<div><i className="fas fa-puzzle-piece" style={{ marginRight:4, fontSize:9 }} />{q.ec_code}{q.ec_name&&` — ${q.ec_name}`}</div>}
                            {!q.formation_name&&!q.ec_name&&<span>—</span>}
                          </div>
                        </td>
                        <td style={{ padding:'10px 14px', fontSize:12, color:'var(--text-muted)', whiteSpace:'nowrap' }}>{q.bloom_level||'—'}</td>
                        <td style={{ padding:'10px 14px' }} onClick={e=>e.stopPropagation()}>
                          <div style={{ display:'flex', gap:5 }}>
                            <button onClick={()=>setPreview(q)} title="Aperçu" style={{ background:'#dbeafe', border:'none', color:'#1d4ed8', padding:'5px 9px', borderRadius:6, fontSize:12, cursor:'pointer' }}><i className="fas fa-eye" /></button>
                            <button onClick={()=>deleteBankQ(q.id)} title="Supprimer" style={{ background:'#fee2e2', border:'none', color:'#dc2626', padding:'5px 9px', borderRadius:6, fontSize:12, cursor:'pointer' }}><i className="fas fa-trash" /></button>
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
          <div style={{ marginTop:12, display:'flex', gap:10, flexWrap:'wrap' }}>
            {Object.entries(TYPE_LABELS).map(([k,v])=>{const tc=TYPE_COLORS[k]||{bg:'#f1f5f9',fg:'#475569'};return<span key={k} style={{ fontSize:11, padding:'2px 8px', borderRadius:99, background:tc.bg, color:tc.fg, fontWeight:600 }}>{v}</span>})}
          </div>
        </div>
      )}

      {/* ASSEMBLE MODAL */}
      {showAssemble&&(
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.45)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }} onClick={e=>{if(e.target===e.currentTarget)setShowAssemble(false)}}>
          <div style={{ background:'var(--surface)', borderRadius:16, width:'100%', maxWidth:580, boxShadow:'var(--shadow-lg)', overflow:'hidden', maxHeight:'90vh', display:'flex', flexDirection:'column' }}>
            <div style={{ padding:'18px 24px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
              <i className="fas fa-layer-group" style={{ color:'var(--primary)', fontSize:17 }} />
              <h3 style={{ margin:0, fontSize:15, fontWeight:700 }}>Créer un sujet à partir de {bankSel.size} question{bankSel.size>1?'s':''}</h3>
              <button onClick={()=>setShowAssemble(false)} style={{ marginLeft:'auto', background:'none', border:'none', fontSize:18, cursor:'pointer', color:'var(--text-muted)' }}><i className="fas fa-times" /></button>
            </div>
            <div style={{ padding:'20px 24px', overflowY:'auto', flex:1, display:'flex', flexDirection:'column', gap:14 }}>
              <div><label style={{ fontSize:13, fontWeight:600, display:'block', marginBottom:6 }}>Titre de l'examen *</label>
                <input type="text" value={asmTitle} onChange={e=>setAsmTitle(e.target.value)} style={{ width:'100%', padding:'10px 12px', border:'1.5px solid var(--border)', borderRadius:8, fontSize:14, background:'var(--background)', color:'var(--text)', outline:'none', boxSizing:'border-box' }} onFocus={e=>e.target.style.borderColor='var(--primary)'} onBlur={e=>e.target.style.borderColor='var(--border)'} /></div>
              <div className="grid" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div><label style={{ fontSize:13, fontWeight:600, display:'block', marginBottom:6 }}>Durée (min)</label><input type="number" value={asmDuration} onChange={e=>setAsmDuration(e.target.value)} min="15" max="360" style={{ width:'100%', padding:'10px 12px', border:'1.5px solid var(--border)', borderRadius:8, fontSize:14, background:'var(--background)', color:'var(--text)', outline:'none', boxSizing:'border-box' }} /></div>
                <div><label style={{ fontSize:13, fontWeight:600, display:'block', marginBottom:6 }}>Niveau</label>
                  <select value={asmLevel} onChange={e=>setAsmLevel(e.target.value)} style={{ width:'100%', padding:'10px 12px', border:'1.5px solid var(--border)', borderRadius:8, fontSize:14, background:'var(--background)', color:'var(--text)', outline:'none', boxSizing:'border-box' }}>
                    <option>Licence 1</option><option>Licence 2</option><option>Licence 3</option><option>Master 1</option><option>Master 2</option><option>Doctorat</option>
                  </select></div>
              </div>
              <div><label style={{ fontSize:13, fontWeight:600, display:'block', marginBottom:6 }}>EC</label>
                <select value={asmEc} onChange={e=>setAsmEc(e.target.value)} style={{ width:'100%', padding:'10px 12px', border:'1.5px solid var(--border)', borderRadius:8, fontSize:14, background:'var(--background)', color:'var(--text)', outline:'none', boxSizing:'border-box' }}>
                  <option value="">— Aucun —</option>
                  {asmEcOptions.map(ec=><option key={ec.id} value={String(ec.id)}>{ec.label}</option>)}
                </select></div>
              <div style={{ background:'var(--background)', borderRadius:8, padding:12, maxHeight:180, overflowY:'auto' }}>
                <p style={{ margin:'0 0 8px', fontSize:11, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase' }}>Questions sélectionnées :</p>
                {Array.from(bankSel).map((id,i)=>{const q=bankQ.find(x=>x.id===id);if(!q)return null;const tc=TYPE_COLORS[q.question_type]||{bg:'#f1f5f9',fg:'#475569'};return(
                  <div key={id} style={{ display:'flex', alignItems:'center', gap:8, padding:'4px 0', borderBottom:'1px solid var(--border)' }}>
                    <span style={{ background:tc.bg, color:tc.fg, fontSize:10, fontWeight:700, padding:'1px 6px', borderRadius:99, flexShrink:0 }}>{TYPE_LABELS[q.question_type]}</span>
                    <span style={{ fontSize:12, flex:1 }}>{i+1}. {q.title}</span>
                    {q.ec_name&&<span style={{ fontSize:11, color:'var(--text-muted)', whiteSpace:'nowrap' }}>{q.ec_name}</span>}
                  </div>
                )})}
              </div>
            </div>
            <div style={{ padding:'14px 24px', borderTop:'1px solid var(--border)', display:'flex', gap:10, justifyContent:'flex-end', flexShrink:0 }}>
              <button onClick={()=>setShowAssemble(false)} className="btn btn-secondary">Annuler</button>
              <button onClick={handleAssemble} disabled={assembling} className="btn btn-primary" style={{ minWidth:160 }}>
                {assembling?<><i className="fas fa-spinner fa-spin" style={{ marginRight:6 }} />Création…</>:<><i className="fas fa-layer-group" style={{ marginRight:6 }} />Créer le sujet</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PREVIEW MODAL */}
      {preview&&(
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.45)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }} onClick={e=>{if(e.target===e.currentTarget)setPreview(null)}}>
          <div style={{ background:'var(--surface)', borderRadius:16, width:'100%', maxWidth:560, boxShadow:'var(--shadow-lg)', overflow:'hidden' }}>
            <div style={{ padding:'15px 20px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:10 }}>
              <span style={{ fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:99, background:(TYPE_COLORS[preview.question_type]||{bg:'#f1f5f9'}).bg, color:(TYPE_COLORS[preview.question_type]||{fg:'#475569'}).fg }}>{TYPE_LABELS[preview.question_type]}</span>
              <h3 style={{ margin:0, fontSize:14, fontWeight:700, flex:1 }}>{preview.title}</h3>
              <button onClick={()=>setPreview(null)} style={{ background:'none', border:'none', fontSize:16, cursor:'pointer', color:'var(--text-muted)' }}><i className="fas fa-times" /></button>
            </div>
            <div style={{ padding:'16px 20px' }}>
              {(preview.formation_name||preview.ec_name)&&(
                <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:12 }}>
                  {preview.formation_name&&<span style={{ fontSize:11, background:'var(--background)', border:'1px solid var(--border)', padding:'2px 8px', borderRadius:99, color:'var(--text-muted)' }}>{preview.formation_name}{preview.formation_level&&` — ${preview.formation_level}`}</span>}
                  {preview.ue_code&&<span style={{ fontSize:11, background:'var(--background)', border:'1px solid var(--border)', padding:'2px 8px', borderRadius:99, color:'var(--text-muted)' }}>{preview.ue_code}</span>}
                  {preview.ec_name&&<span style={{ fontSize:11, background:'var(--background)', border:'1px solid var(--border)', padding:'2px 8px', borderRadius:99, color:'var(--text-muted)' }}>{preview.ec_name}</span>}
                </div>
              )}
              <pre style={{ background:'var(--background)', border:'1px solid var(--border)', borderRadius:8, padding:12, fontSize:13, whiteSpace:'pre-wrap', maxHeight:280, overflowY:'auto', margin:0 }}>{preview.content}</pre>
              {preview.rubric&&(<><h4 style={{ margin:'14px 0 6px', fontSize:13 }}>Barème</h4><pre style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:8, padding:12, fontSize:12, whiteSpace:'pre-wrap', maxHeight:180, overflowY:'auto', color:'#15803d', margin:0 }}>{preview.rubric}</pre></>)}
            </div>
            <div style={{ padding:'12px 20px', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'flex-end' }}>
              <button onClick={()=>setPreview(null)} className="btn btn-secondary" style={{ fontSize:13 }}>Fermer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
