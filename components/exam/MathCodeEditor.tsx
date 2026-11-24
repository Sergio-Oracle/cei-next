'use client'

/**
 * Réponse à une question « Maths / Programmation » : zone de saisie de code / démonstration, avec les aides standard des éditeurs d'évaluation
 * (Moodle STACK / CodeRunner, Canvas) :
 *  - barre de symboles mathématiques (fraction, racine, intégrale, somme, ensembles, quantificateurs, lettres grecques…) qui insère le LaTeX
 *    à l'endroit du curseur (dans \( … \) si le curseur n'est pas déjà dans une formule) ;
 *  - aperçu en direct de la réponse dès qu'elle contient une formule (« voici comment votre réponse sera lue ») ;
 *  - confort de code : Tab indente (Maj+Tab désindente ; Échap puis Tab quitte la zone), Entrée conserve l'indentation.
 * La réponse enregistrée reste le texte brut : rien ne change pour la correction.
 */
import React, { useRef, useState } from 'react'
import { MathText } from '@/components/shared/MathText'
import { hasMath, insideMath } from '@/lib/mathSegments'

type Snippet = { label: string; title: string; latex: string; cursor?: number }       // cursor : position du curseur dans le LaTeX inséré (défaut : à la fin)

const SYMBOLS: Snippet[] = [
  { label: 'a⁄b', title: 'Fraction', latex: '\\frac{}{}', cursor: 6 },
  { label: '√', title: 'Racine carrée', latex: '\\sqrt{}', cursor: 6 },
  { label: 'xⁿ', title: 'Exposant', latex: '^{}', cursor: 2 },
  { label: 'xₙ', title: 'Indice', latex: '_{}', cursor: 2 },
  { label: '∫', title: 'Intégrale', latex: '\\int_{a}^{b} f(x)\\,dx' },
  { label: '∑', title: 'Somme', latex: '\\sum_{i=1}^{n} ' },
  { label: 'lim', title: 'Limite', latex: '\\lim_{n\\to\\infty} ' },
  { label: '≤', title: 'Inférieur ou égal', latex: '\\leq ' },
  { label: '≥', title: 'Supérieur ou égal', latex: '\\geq ' },
  { label: '≠', title: 'Différent', latex: '\\neq ' },
  { label: '∈', title: 'Appartient à', latex: '\\in ' },
  { label: '∉', title: "N'appartient pas à", latex: '\\notin ' },
  { label: 'ℝ', title: 'Réels', latex: '\\mathbb{R}' },
  { label: 'ℚ', title: 'Rationnels', latex: '\\mathbb{Q}' },
  { label: 'ℕ', title: 'Entiers naturels', latex: '\\mathbb{N}' },
  { label: 'ℤ', title: 'Entiers relatifs', latex: '\\mathbb{Z}' },
  { label: '∀', title: 'Pour tout', latex: '\\forall ' },
  { label: '∃', title: 'Il existe', latex: '\\exists ' },
  { label: '⇒', title: 'Implique', latex: '\\Rightarrow ' },
  { label: '⇔', title: 'Équivaut à', latex: '\\Leftrightarrow ' },
  { label: '→', title: 'Tend vers / flèche', latex: '\\to ' },
  { label: '∞', title: 'Infini', latex: '\\infty' },
  { label: '×', title: 'Multiplié', latex: '\\times ' },
  { label: '±', title: 'Plus ou moins', latex: '\\pm ' },
  { label: 'α', title: 'alpha', latex: '\\alpha' },
  { label: 'β', title: 'bêta', latex: '\\beta' },
  { label: 'ε', title: 'epsilon', latex: '\\varepsilon' },
  { label: 'δ', title: 'delta', latex: '\\delta' },
  { label: 'π', title: 'pi', latex: '\\pi' },
  { label: 'λ', title: 'lambda', latex: '\\lambda' },
  { label: '{ cas', title: 'Définition par cas', latex: '\\begin{cases} 1 & x \\in A \\\\ 0 & x \\notin A \\end{cases}' },
]

export default function MathCodeEditor({ value, onChange, placeholder, rows = 10, borderColor, onFocus, onBlur }: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  rows?: number
  borderColor?: string
  onFocus?: React.FocusEventHandler<HTMLTextAreaElement>
  onBlur?: React.FocusEventHandler<HTMLTextAreaElement>
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const tabFree = useRef(false)                        // Échap pressé : le prochain Tab quitte la zone (accessibilité clavier)
  const [showSyms, setShowSyms] = useState(true)
  const val = value ?? ''

  function edit(next: string, selStart: number, selEnd = selStart) {
    onChange(next)
    requestAnimationFrame(() => { const el = ref.current; if (el) { el.focus(); el.setSelectionRange(selStart, selEnd) } })
  }

  function insert(sn: Snippet) {
    const el = ref.current; if (!el) return
    const a = el.selectionStart ?? val.length, b = el.selectionEnd ?? a
    const inMath = insideMath(val, a)
    const sel = val.slice(a, b)
    let body = sn.latex
    // Texte sélectionné : il remplace le premier « {} » vide (fraction, racine…) ou suit le symbole.
    if (sel) body = body.includes('{}') ? body.replace('{}', `{${sel}}`) : body + sel
    const pre = inMath ? '' : '\\('
    const post = inMath ? '' : '\\)'
    const next = val.slice(0, a) + pre + body + post + val.slice(b)
    const caret = sel ? a + pre.length + body.length : a + pre.length + (sn.cursor ?? sn.latex.length)
    edit(next, caret)
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    const el = e.currentTarget
    if (e.key === 'Escape') { tabFree.current = true; return }
    if (e.key === 'Tab') {
      if (tabFree.current) { tabFree.current = false; return }                // Échap puis Tab : on quitte la zone
      e.preventDefault()
      const a = el.selectionStart, b = el.selectionEnd
      const lineStart = val.lastIndexOf('\n', a - 1) + 1
      if (e.shiftKey) {                                                       // désindente la ligne courante
        const m = /^( {1,4}|\t)/.exec(val.slice(lineStart))
        if (m) edit(val.slice(0, lineStart) + val.slice(lineStart + m[0].length), Math.max(lineStart, a - m[0].length), Math.max(lineStart, b - m[0].length))
        return
      }
      if (a !== b && val.slice(a, b).includes('\n')) {                        // plusieurs lignes sélectionnées : on indente chacune
        const block = val.slice(lineStart, b).replace(/^/gm, '    ')
        edit(val.slice(0, lineStart) + block + val.slice(b), a + 4, b + (block.length - (b - lineStart)))
        return
      }
      edit(val.slice(0, a) + '    ' + val.slice(b), a + 4)
      return
    }
    tabFree.current = false
    if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey && !e.shiftKey && el.selectionStart === el.selectionEnd) {
      const a = el.selectionStart
      const lineStart = val.lastIndexOf('\n', a - 1) + 1
      const indent = /^[ \t]*/.exec(val.slice(lineStart, a))?.[0] ?? ''
      if (indent) { e.preventDefault(); edit(val.slice(0, a) + '\n' + indent + val.slice(a), a + 1 + indent.length) }
    }
  }

  const withMath = hasMath(val)
  const btn: React.CSSProperties = { minWidth: 30, height: 30, padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: 6, background: '#fff', color: '#0f172a', cursor: 'pointer', fontSize: 15, fontFamily: "'Cambria Math','STIX Two Math',serif", lineHeight: 1 }

  return (
    <div>
      <div style={{ border: '1.5px solid #e2e8f0', borderBottom: 'none', borderRadius: '8px 8px 0 0', background: '#f8fafc', padding: '6px 8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ fontSize: 13.5, color: '#475569', fontWeight: 600 }}>Symboles mathématiques</span>
          <button type="button" onClick={() => setShowSyms(s => !s)} style={{ border: 'none', background: 'none', color: '#2563eb', cursor: 'pointer', fontSize: 13.5, fontWeight: 600 }}>{showSyms ? 'Masquer' : 'Afficher'}</button>
        </div>
        {showSyms && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 6 }} role="toolbar" aria-label="Symboles mathématiques">
            {SYMBOLS.map(s => (
              <button key={s.title} type="button" title={s.title} aria-label={s.title} onMouseDown={e => e.preventDefault()} onClick={() => insert(s)} style={btn}>{s.label}</button>
            ))}
          </div>
        )}
      </div>
      <textarea ref={ref} value={val} onChange={e => onChange(e.target.value)} rows={rows} spellCheck={false} autoCapitalize="off" autoCorrect="off"
        placeholder={placeholder} onKeyDown={onKeyDown} onFocus={onFocus} onBlur={onBlur}
        style={{ width: '100%', padding: '12px 14px', border: `1.5px solid ${borderColor ?? '#e2e8f0'}`, borderRadius: withMath ? 0 : '0 0 8px 8px', fontSize: 15.5, fontFamily: "ui-monospace,'Cascadia Mono',Menlo,Consolas,'Courier New',monospace", whiteSpace: 'pre', overflowX: 'auto', resize: 'vertical', color: '#0f172a', outline: 'none', boxSizing: 'border-box', lineHeight: 1.6, background: '#0f172a08', tabSize: 4 }} />
      {withMath && (
        <div style={{ border: '1.5px solid #e2e8f0', borderTop: 'none', borderRadius: '0 0 8px 8px', background: '#fff', padding: '10px 14px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 6 }}>Aperçu de votre réponse</div>
          <div style={{ fontSize: 17, color: '#0f172a', lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}><MathText text={val} /></div>
          <div style={{ fontSize: 12.5, color: '#94a3b8', marginTop: 6 }}>Les formules s&apos;écrivent entre \( … \) ou \[ … \]. La barre ci-dessus les ajoute pour vous.</div>
        </div>
      )}
    </div>
  )
}
