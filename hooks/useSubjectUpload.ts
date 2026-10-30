'use client'
/**
 * useSubjectUpload
 * Manages the full upload flow: file selection, phase animation, API call.
 * Extracted from create-subject/page.tsx to keep the page thin.
 */
import { useRef, useState } from 'react'
import api, { AI_TIMEOUT_MS } from '@/lib/api'

export interface CreatedSubject {
  id: number
  title: string
  content?: string
  rubric?: string
  created_at?: string | null
  /** Origine du barème : 'corrigé' (écrit sans IA depuis le corrigé fourni), 'ia' ou 'manuel'. */
  rubric_source?: 'corrigé' | 'ia' | 'manuel'
  has_corrige?: boolean
  corrige_warnings?: string[]
  normalization?: { counts: Record<string, number>; warnings: string[]; questions?: number }[]
  detection?: { counts: Record<string, number>; converted: string[]; warnings: string[]; questions_found?: number; expected?: number; declared?: number | null; lost_lines?: string[]; review?: { ok: boolean | null; issues: { question: string; probleme: string }[] } }
}

export interface QTypes {
  qcm: boolean; open: boolean; vf: boolean
  /** Types ajoutés pour couvrir ceux de Moodle (voir backend services/question_types.py). */
  association: boolean; tri: boolean; ordre: boolean; trous: boolean; court: boolean; numerique: boolean; cloze: boolean; calculee: boolean; zones: boolean
}

interface UploadPayload {
  title: string
  ecId: string
  qTypes: QTypes
  files: File[]
  rubricMode?: 'ai' | 'manual'
  totalPoints?: number
  /** Nombre de questions attendu (facultatif) : la plateforme contrôle qu'elle les a toutes reconnues. */
  expectedQuestions?: number
}

export interface UseSubjectUploadReturn {
  // state
  uploading: boolean
  phase: number       // 0=idle 1=extract 2=analyse 3=generate 4=done
  created: CreatedSubject | null
  editContent: string
  editRubric: string
  dragOver: boolean
  // setters exposed for the textarea edits
  setEditContent: (v: string) => void
  setEditRubric: (v: string) => void
  setDragOver: (v: boolean) => void
  setCreated: (s: CreatedSubject | null) => void
  // actions
  upload: (payload: UploadPayload) => Promise<void>
  reset: () => void
}

export function useSubjectUpload(
  onSuccess?: (s: CreatedSubject) => void,
  onError?: (msg: string) => void,
  onDuplicates?: (dups: { similarity: number }[]) => void,
): UseSubjectUploadReturn {
  const t1 = useRef<ReturnType<typeof setTimeout> | null>(null)
  const t2 = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [uploading,    setUploading]    = useState(false)
  const [phase,        setPhase]        = useState(0)
  const [created,      setCreated]      = useState<CreatedSubject | null>(null)
  const [editContent,  setEditContent]  = useState('')
  const [editRubric,   setEditRubric]   = useState('')
  const [dragOver,     setDragOver]     = useState(false)

  function reset() {
    setUploading(false); setPhase(0); setCreated(null)
    setEditContent(''); setEditRubric('')
  }

  async function upload({ title, ecId, qTypes, files, rubricMode = 'ai', totalPoints = 20, expectedQuestions }: UploadPayload) {
    const labelMap: Record<keyof QTypes, string> = {
      qcm: 'QCM', open: 'Questions ouvertes', vf: 'Vrai/Faux',
      association: 'Association', tri: 'Classement (tri)', ordre: 'Remise en ordre', trous: 'Texte à trous',
      court: 'Réponse courte', numerique: 'Réponse numérique', cloze: 'Champs à compléter (cloze)', calculee: 'Calcul à variables', zones: 'Placer sur image',
    }
    const selectedTypes = (Object.keys(qTypes) as (keyof QTypes)[])
      .filter(k => qTypes[k])
      .map(k => labelMap[k])

    setUploading(true)
    setPhase(1)
    t1.current = setTimeout(() => setPhase(2), 4000)
    t2.current = setTimeout(() => setPhase(3), 9000)

    try {
      const fd = new FormData()
      fd.append('title', title)
      if (ecId) fd.append('ec_id', ecId)
      if (selectedTypes.length) fd.append('question_types', selectedTypes.join(','))
      fd.append('rubric_mode', rubricMode)
      fd.append('total_points', String(totalPoints))
      if (expectedQuestions && expectedQuestions > 0) fd.append('expected_questions', String(expectedQuestions))
      files.forEach(f => fd.append('files', f))

      const res = await api.upload<{ success: boolean; subject: CreatedSubject; duplicates?: { similarity: number }[] }>(
        '/api/subjects/upload', fd, 'POST', { timeoutMs: AI_TIMEOUT_MS },
      )
      setPhase(4)
      await new Promise(r => setTimeout(r, 600))
      setCreated(res.subject)
      setEditContent(res.subject.content ?? '')
      setEditRubric(res.subject.rubric ?? '')
      onSuccess?.(res.subject)
      if (res.duplicates && res.duplicates.length > 0) onDuplicates?.(res.duplicates)
    } catch (err: any) {
      onError?.(err.message || 'Erreur lors de la création')
    } finally {
      if (t1.current) clearTimeout(t1.current)
      if (t2.current) clearTimeout(t2.current)
      setUploading(false)
      setPhase(0)
    }
  }

  return {
    uploading, phase, created, editContent, editRubric, dragOver,
    setEditContent, setEditRubric, setDragOver, setCreated,
    upload, reset,
  }
}
