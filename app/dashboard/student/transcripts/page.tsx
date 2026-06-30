'use client'

import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'
import type { GradeTranscript } from '@/types'

export default function StudentTranscriptsPage() {
  const { error } = useToast()
  const [transcripts, setTranscripts] = useState<GradeTranscript[]>([])
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState<number | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const res = await api.get<GradeTranscript[]>('/api/student/transcripts')
      setTranscripts(Array.isArray(res) ? res : (res as any).transcripts ?? [])
    } catch { error('Erreur de chargement') }
    finally { setLoading(false) }
  }

  async function downloadPdf(id: number) {
    setDownloading(id)
    try {
      const blob = await api.blob(`/api/transcripts/${id}/pdf`)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `releve_notes_${id}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e: any) { error(e.message || 'Erreur téléchargement') }
    finally { setDownloading(null) }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2><i className="fa-solid fa-scroll" style={{ marginRight: 10, color: 'var(--primary)' }} />Relevés de notes</h2>
          <p>Consultez et téléchargez vos relevés de notes</p>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><i className="fa-solid fa-spinner spin" style={{ fontSize: 32 }} /></div>
      ) : transcripts.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 60 }}>
          <i className="fa-solid fa-scroll" style={{ fontSize: 48, color: 'var(--text-muted)', marginBottom: 16, display: 'block' }} />
          <h3>Aucun relevé disponible</h3>
          <p style={{ color: 'var(--text-muted)' }}>Vos relevés apparaîtront ici lorsqu'ils seront publiés.</p>
        </div>
      ) : (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
          {transcripts.map(t => (
            <div key={t.id} className="card">
              <div style={{ padding: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <div>
                    <h3 style={{ marginBottom: 4 }}>{t.semester_name ?? `Semestre ${t.semester_id}`}</h3>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      Généré le {new Date(t.generated_at).toLocaleDateString('fr-FR')}
                    </div>
                  </div>
                  <span className={`status-badge ${t.is_published ? 'success' : 'secondary'}`}>
                    {t.is_published ? 'Publié' : 'Brouillon'}
                  </span>
                </div>

                <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                  <div style={{ textAlign: 'center', padding: 12, background: 'var(--background)', borderRadius: 'var(--radius)' }}>
                    <div style={{ fontSize: 24, fontWeight: 700, color: t.gpa != null && t.gpa >= 10 ? 'var(--success)' : 'var(--danger)' }}>
                      {t.gpa != null ? t.gpa.toFixed(2) : '—'}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Moyenne GPA</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: 12, background: 'var(--background)', borderRadius: 'var(--radius)' }}>
                    <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--primary)' }}>
                      {t.obtained_credits ?? '?'}/{t.total_credits}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Crédits ECTS</div>
                  </div>
                </div>

                {t.is_published ? (
                  <button className="btn btn-primary btn-block" onClick={() => downloadPdf(t.id)} disabled={downloading === t.id}>
                    {downloading === t.id
                      ? <><i className="fa-solid fa-spinner spin" /> Téléchargement...</>
                      : <><i className="fa-solid fa-file-pdf" /> Télécharger PDF</>
                    }
                  </button>
                ) : (
                  <div className="alert alert-info" style={{ margin: 0, textAlign: 'center' }}>
                    <i className="fa-solid fa-clock" /> En attente de publication
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
