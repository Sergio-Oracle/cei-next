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
}

export interface QTypes { qcm: boolean; open: boolean; vf: boolean }

interface UploadPayload {
  title: string
  ecId: string
  qTypes: QTypes
  file: File
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

  async function upload({ title, ecId, qTypes, file }: UploadPayload) {
    const labelMap: Record<keyof QTypes, string> = {
      qcm: 'QCM', open: 'Questions ouvertes', vf: 'Vrai/Faux',
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
      fd.append('file', file)

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
