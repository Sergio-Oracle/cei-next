'use client'
/**
 * useSuggestionFlow
 * Manages course upload + AI suggestion generation flow.
 * Extracted from suggestions/page.tsx.
 */
import { useRef, useState } from 'react'
import api from '@/lib/api'

export interface Suggestion {
  title: string
  description: string
  exam_type: string
  duration: number
  difficulty: string
  key_points: string[]
  questions_examples: string[]
  grading_criteria: string
  detected_domain?: string
  student_level?: string
  question_types?: string
}

export interface SuggestionResult {
  success: boolean
  course_summary: string
  detected_domain: string
  main_topics: string[]
  suggestions: Suggestion[]
  course_filename: string
  from_cache?: boolean
}

export interface QTypes { qcm: boolean; open: boolean; vf: boolean }

interface GeneratePayload {
  courseFile: File
  difficulty: string
  studentLevel: string
  examType: string
  qTypes: QTypes
}

export interface UseSuggestionFlowReturn {
  generating: boolean
  genElapsed: number
  result: SuggestionResult | null
  error: string
  generate: (payload: GeneratePayload) => Promise<void>
  reset: () => void
}

export function useSuggestionFlow(): UseSuggestionFlowReturn {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [generating,  setGenerating]  = useState(false)
  const [genElapsed,  setGenElapsed]  = useState(0)
  const [result,      setResult]      = useState<SuggestionResult | null>(null)
  const [error,       setError]       = useState('')

  function reset() {
    if (timerRef.current) clearInterval(timerRef.current)
    setGenerating(false); setGenElapsed(0); setResult(null); setError('')
  }

  async function generate({ courseFile, difficulty, studentLevel, examType, qTypes }: GeneratePayload) {
    reset()
    setGenerating(true)
    setGenElapsed(0)
    timerRef.current = setInterval(() => setGenElapsed(s => s + 1), 1000)

    try {
      const labelMap: Record<keyof QTypes, string> = {
        qcm: 'QCM', open: 'Questions ouvertes', vf: 'Vrai/Faux',
      }
      const selectedTypes = (Object.keys(qTypes) as (keyof QTypes)[])
        .filter(k => qTypes[k])
        .map(k => labelMap[k])

      const fd = new FormData()
      fd.append('course_file', courseFile)
      fd.append('difficulty', difficulty)
      fd.append('student_level', studentLevel)
      if (examType) fd.append('exam_type', examType)
      if (selectedTypes.length) fd.append('question_types', selectedTypes.join(','))

      const data = await api.upload<SuggestionResult>('/api/ai/generate-exam-suggestions', fd)
      setResult(data)
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la génération')
    } finally {
      if (timerRef.current) clearInterval(timerRef.current)
      setGenerating(false)
    }
  }

  return { generating, genElapsed, result, error, generate, reset }
}
