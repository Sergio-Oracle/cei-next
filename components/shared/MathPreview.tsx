'use client'

/** Aperçu avec formules rendues, sous un champ de saisie du texte brut (éditeur de sujet, banque de questions) : visible seulement si le texte contient une formule. */
import { MathText } from '@/components/shared/MathText'
import { hasMath } from '@/lib/mathSegments'

export default function MathPreview({ text, label = 'Aperçu avec formules' }: { text: string; label?: string }) {
  if (!hasMath(text ?? '')) return null
  return (
    <div style={{ marginTop: 8, border: '1px solid var(--border, #e2e8f0)', borderRadius: 8, background: 'var(--surface, #fff)', padding: '10px 14px' }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</div>
      <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.7, fontSize: 16 }}><MathText text={text} /></div>
    </div>
  )
}
