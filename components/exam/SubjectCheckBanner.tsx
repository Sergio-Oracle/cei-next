'use client'

import { useEffect, useState } from 'react'
import api from '@/lib/api'

interface Issue { level: 'error' | 'warn' | 'info'; message: string }
interface Report { ok: boolean; questions: number; by_type: Record<string, number>; issues: Issue[] }

const TYPE_LABEL: Record<string, string> = { qcm: 'QCM', qcm_multi: 'QCM multiples', vf: 'Vrai/Faux', open: 'ouvertes', subopen: 'à sous-questions', appariement: 'appariement', code: 'code' }

/** « Les étudiants verront-ils bien toutes les questions ? » — rapport du contrôle du sujet, visible du personnel
 *  sur la page de l'examen (vert si tout est lu, rouge/orange sinon). */
export default function SubjectCheckBanner({ examId }: { examId: number | string }) {
  const [r, setR] = useState<Report | null>(null)
  useEffect(() => {
    api.get<Report>(`/api/online_exams/${examId}/subject_check`).then(setR).catch(() => setR(null))
  }, [examId])
  if (!r) return null
  const err = r.issues.some(i => i.level === 'error')
  const warn = !err && r.issues.some(i => i.level === 'warn')
  const infos = r.issues.filter(i => i.level === 'info')          // information sobre (ex. barème sur 10 points ramené sur 20) : jamais un défaut
  const c = err ? { bg: '#fef2f2', bd: '#fecaca', fg: '#b91c1c', ic: 'fa-triangle-exclamation' }
    : warn ? { bg: '#fffbeb', bd: '#fde68a', fg: '#b45309', ic: 'fa-circle-exclamation' }
    : { bg: '#eff6ff', bd: '#dbe7f7', fg: '#1d4ed8', ic: 'fa-circle-check' }
  const types = Object.entries(r.by_type).map(([k, n]) => `${n} ${TYPE_LABEL[k] ?? k}`).join(' · ')
  return (
    <div style={{ background: c.bg, border: `1px solid ${c.bd}`, color: c.fg, borderRadius: 12, padding: '12px 16px', marginBottom: 16, fontSize: 15 }}>
      <div style={{ fontWeight: 700 }}>
        <i className={`fas ${c.ic}`} style={{ marginRight: 8 }} />
        {err ? 'Sujet à corriger avant l’examen' : warn ? 'Sujet : points à vérifier' : 'Sujet lu correctement'}
        {` — ${r.questions} question(s) reconnue(s)`}{types ? ` (${types})` : ''}
      </div>
      {r.issues.some(i => i.level !== 'info') && (
        <ul style={{ margin: '6px 0 0', paddingLeft: 20 }}>
          {r.issues.filter(i => i.level !== 'info').map((i, k) => <li key={k}>{i.message}</li>)}
        </ul>
      )}
      {infos.length > 0 && (
        <div style={{ marginTop: 6, fontSize: 14, fontWeight: 400, color: '#475569' }}>{infos.map(i => i.message).join(' ')}</div>
      )}
    </div>
  )
}
