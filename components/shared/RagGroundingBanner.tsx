'use client'

/* Résultat du contrôle anti-invention du sujet complet (moteur RAG) :
   chaque réponse attendue a été comparée au passage du cours cité dans le
   barème. Les questions non justifiées sont signalées, pas retirées :
   l'enseignant les corrige ou les supprime dans l'aperçu. */
export interface Grounding {
  checked: number; status: 'ok' | 'partial'
  unsupported: { question: number; title: string; reason: string; cited?: string[] }[]
}

export default function RagGroundingBanner({ g }: { g: Grounding | null }) {
  if (!g || !g.checked) return null
  const bad = g.unsupported
  const ok = bad.length === 0
  return (
    <div style={{ display: 'grid', gap: 8, padding: '12px 16px', borderRadius: 10, marginBottom: 16,
                  background: ok ? '#ecfdf5' : '#fffbeb', border: `1px solid ${ok ? '#a7f3d0' : '#fde68a'}` }}>
      <div style={{ fontWeight: 700, fontSize: 15.5, color: ok ? '#047857' : '#92400e' }}>
        <i className={`fas ${ok ? 'fa-circle-check' : 'fa-triangle-exclamation'}`} style={{ marginRight: 7 }} />
        {ok ? `Les ${g.checked} questions sont justifiées par les passages du cours cités dans le barème`
            : `${bad.length} question(s) sur ${g.checked} à revoir : réponse non justifiée par le cours`}
      </div>
      {!ok && (
        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14.5, lineHeight: 1.6, color: '#334155' }}>
          {bad.map(u => (
            <li key={u.question}><strong>Question {u.question}</strong>{u.cited?.length ? ` (passage${u.cited.length > 1 ? 's' : ''} ${u.cited.join(', ')})` : ''} : {u.reason}</li>
          ))}
        </ul>
      )}
      {!ok && <div style={{ fontSize: 13.5, color: '#92400e' }}>Corrigez ou supprimez ces questions dans l’aperçu avant d’enregistrer le sujet.</div>}
      {g.status === 'partial' && <div style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>Une partie des questions n’a pas pu être vérifiée (service d’IA indisponible un instant).</div>}
    </div>
  )
}
