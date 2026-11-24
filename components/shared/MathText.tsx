'use client'

/**
 * Affichage standard des formules dans les énoncés, les choix et les réponses (comme Moodle/MathJax, Canvas/KaTeX) : \( … \), \[ … \], $$ … $$.
 * - rendu KaTeX (jamais de HTML venant du texte : KaTeX échappe tout, `trust` désactivé) ;
 * - une formule invalide s'affiche telle qu'écrite, jamais un message d'erreur technique ;
 * - rendu mémorisé : la page d'examen se redessine chaque seconde (minuteur), une formule n'est calculée qu'une fois.
 */
import React, { memo, useMemo } from 'react'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import { splitMath } from '@/lib/mathSegments'

const CACHE = new Map<string, string | null>()
const CACHE_MAX = 3000
const LATEX_MAX = 4000       // une réponse d'étudiant est un contenu non fiable : formules démesurées refusées (repli : texte brut)

function toHtml(latex: string, display: boolean): string | null {
  const key = (display ? 'D|' : 'I|') + latex
  if (CACHE.has(key)) return CACHE.get(key) ?? null
  let html: string | null = null
  if (latex.length <= LATEX_MAX) {
    try {
      html = katex.renderToString(latex, { displayMode: display, throwOnError: true, strict: 'ignore', trust: false, output: 'htmlAndMathml', maxExpand: 1000 })
    } catch { html = null }
  }
  if (CACHE.size >= CACHE_MAX) CACHE.clear()
  CACHE.set(key, html)
  return html
}

export const MathText = memo(function MathText({ text, fmt }: { text: string; fmt?: (t: string) => string }) {
  const segs = useMemo(() => splitMath(text ?? ''), [text])
  return (
    <>
      {segs.map((s, i) => {
        if (s.kind === 'text') return <React.Fragment key={i}>{fmt ? fmt(s.value) : s.value}</React.Fragment>
        const html = toHtml(s.value, s.display)
        if (html === null) return <React.Fragment key={i}>{s.raw}</React.Fragment>
        return s.display
          ? <span key={i} style={{ display: 'block', margin: '.45em 0', overflowX: 'auto', overflowY: 'hidden' }} dangerouslySetInnerHTML={{ __html: html }} />
          : <span key={i} dangerouslySetInnerHTML={{ __html: html }} />
      })}
    </>
  )
})

export default MathText
