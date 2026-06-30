import { Suspense } from 'react'
import serverApi from '@/lib/serverApi'
import SubjectsClient from './SubjectsClient'
import type { Subject, EC } from '@/types'

async function fetchData() {
  try {
    const [s, e] = await Promise.all([
      serverApi.get<Subject[] | { subjects: Subject[] }>('/api/subjects'),
      serverApi.get<EC[]   | { ecs: EC[] }>('/api/ecs'),
    ])
    const subjects = Array.isArray(s) ? s : (s as any).subjects ?? []
    const ecs      = Array.isArray(e) ? e : (e as any).ecs ?? []
    return { subjects, ecs }
  } catch {
    return { subjects: [], ecs: [] }
  }
}

export default async function AdminSubjectsPage() {
  const { subjects, ecs } = await fetchData()
  return (
    <Suspense fallback={<SubjectsSkeleton />}>
      <SubjectsClient initialSubjects={subjects} initialEcs={ecs} />
    </Suspense>
  )
}

function SubjectsSkeleton() {
  return (
    <div>
      <div className="page-header">
        <div>
          <div style={{ width: 240, height: 24, background: 'var(--border)', borderRadius: 6, marginBottom: 8 }} />
          <div style={{ width: 320, height: 14, background: 'var(--border)', borderRadius: 6 }} />
        </div>
      </div>
      <div className="card">
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                {['Titre','Créateur','Copies','Examens','Date','Actions'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[1,2,3,4,5].map(i => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ width: 200, height: 14, background: 'var(--border)', borderRadius: 4, marginBottom: 6 }} />
                    <div style={{ width: 80, height: 18, background: '#dbeafe', borderRadius: 99, opacity: 0.6 }} />
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--border)' }} />
                      <div style={{ width: 100, height: 13, background: 'var(--border)', borderRadius: 4 }} />
                    </div>
                  </td>
                  <td style={{ padding: '14px 16px' }}><div style={{ width: 36, height: 22, background: 'var(--border)', borderRadius: 99 }} /></td>
                  <td style={{ padding: '14px 16px' }}><div style={{ width: 36, height: 22, background: 'var(--border)', borderRadius: 99 }} /></td>
                  <td style={{ padding: '14px 16px' }}><div style={{ width: 90, height: 13, background: 'var(--border)', borderRadius: 4 }} /></td>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <div style={{ width: 32, height: 28, background: 'var(--border)', borderRadius: 6 }} />
                      <div style={{ width: 32, height: 28, background: 'var(--border)', borderRadius: 6 }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
