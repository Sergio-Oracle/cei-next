'use client'
import { useCallback, useEffect, useState } from 'react'
import api from '@/lib/api'

export interface BankQuestion {
  id: number
  title: string
  content: string
  rubric?: string
  question_type: 'qcm' | 'vf' | 'open' | 'subopen'
  bloom_level?: string | null
  ec_id?: number | null
  ec_code?: string | null
  ec_name?: string | null
  ue_id?: number | null
  ue_code?: string | null
  ue_name?: string | null
  formation_id?: number | null
  formation_name?: string | null
  formation_level?: string | null
}

export interface SaveQuestionPayload {
  title: string
  content: string
  rubric?: string
  question_type: 'qcm' | 'vf' | 'open' | 'subopen'
  bloom_level?: string
  ec_id?: number | null
}

export interface UseQuestionBankReturn {
  questions: BankQuestion[]
  loading: boolean
  saveQuestion: (payload: SaveQuestionPayload) => Promise<BankQuestion>
  deleteQuestion: (id: number) => Promise<void>
  refresh: () => Promise<void>
}

export function useQuestionBank(): UseQuestionBankReturn {
  const [questions, setQuestions] = useState<BankQuestion[]>([])
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.get<BankQuestion[]>('/api/question_bank')
      setQuestions(Array.isArray(data) ? data : [])
    } catch {
      // silently ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  async function saveQuestion(payload: SaveQuestionPayload): Promise<BankQuestion> {
    const saved = await api.post<BankQuestion>('/api/question_bank', payload)
    setQuestions(prev => [saved, ...prev])
    return saved
  }

  async function deleteQuestion(id: number): Promise<void> {
    await api.delete(`/api/question_bank/${id}`)
    setQuestions(prev => prev.filter(q => q.id !== id))
  }

  return { questions, loading, saveQuestion, deleteQuestion, refresh }
}
