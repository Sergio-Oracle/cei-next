'use client'

/**
 * Réponse à une question « Maths / Programmation » — l'éditeur des plateformes d'évaluation standard (CodeMirror 6, comme CodeRunner/Moodle en Ace) :
 *  - coloration syntaxique (Python, JavaScript, Java, C, C++) ou LaTeX pour une démonstration, numéros de ligne pour le code ;
 *  - Tab indente (Maj+Tab désindente ; Échap puis Tab quitte la zone), Entrée garde l'indentation, annuler / rétablir ;
 *  - barre de symboles mathématiques qui insère le LaTeX au curseur (dans \( … \) si le curseur n'est pas déjà dans une formule) ;
 *  - éditeur VISUEL de formules (MathLive, comme l'éditeur d'équations de Canvas) : l'étudiant compose la formule, « Insérer » ajoute le LaTeX ;
 *  - aperçu en direct de la réponse dès qu'elle contient une formule.
 * La réponse enregistrée reste le texte brut : rien ne change pour la correction. Tout est servi par notre site (aucun CDN).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Compartment, EditorState, type Extension } from '@codemirror/state'
import { EditorView, keymap, lineNumbers, drawSelection, highlightActiveLine, placeholder as cmPlaceholder } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentMore, indentLess, temporarilySetTabFocusMode } from '@codemirror/commands'
import { syntaxHighlighting, defaultHighlightStyle, indentOnInput, bracketMatching, indentUnit } from '@codemirror/language'
import { MathText } from '@/components/shared/MathText'
import { hasMath, insideMath } from '@/lib/mathSegments'

export type EditorLang = 'latex' | 'python' | 'javascript' | 'java' | 'c' | 'cpp'
export const LANG_LABEL: Record<EditorLang, string> = { latex: 'LaTeX / texte', python: 'Python', javascript: 'JavaScript', java: 'Java', c: 'C', cpp: 'C++' }

async function langExtension(l: EditorLang): Promise<Extension> {
  switch (l) {
    case 'python': return (await import('@codemirror/lang-python')).python()
    case 'javascript': return (await import('@codemirror/lang-javascript')).javascript()
    case 'java': return (await import('@codemirror/lang-java')).java()
    case 'c': case 'cpp': return (await import('@codemirror/lang-cpp')).cpp()
    default: {
      const { StreamLanguage } = await import('@codemirror/language')
      const { stex } = await import('@codemirror/legacy-modes/mode/stex')
      return StreamLanguage.define(stex)
    }
  }
}

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

export default function MathCodeEditor({ value, onChange, placeholder, rows = 10, borderColor, lang = 'latex', fixedLang = false, ariaLabel, storageKey }: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  rows?: number
  borderColor?: string
  lang?: EditorLang              // langage initial
  fixedLang?: boolean            // vrai : le langage est imposé par la question (pas de menu de choix)
  ariaLabel?: string
  storageKey?: string            // mémorise le langage choisi par l'étudiant
}) {
  const host = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const langComp = useRef(new Compartment())
  const lastEmitted = useRef(value ?? '')
  const emitted = useRef<string[]>([])            // valeurs récemment émises par l'éditeur : leur écho tardif (re-rendu de la page) ne doit JAMAIS écraser ce que l'étudiant vient de taper
  const onChangeRef = useRef(onChange); onChangeRef.current = onChange
  const [cur, setCur] = useState<EditorLang>(() => {
    if (!fixedLang && storageKey) { try { const v = localStorage.getItem(storageKey) as EditorLang | null; if (v && v in LANG_LABEL) return v } catch {} }
    return lang
  })
  useEffect(() => { if (fixedLang) setCur(lang) }, [lang, fixedLang])          // le langage de la question arrive après l'ouverture de l'éditeur
  const [showSyms, setShowSyms] = useState(true)
  const [text, setText] = useState(value ?? '')

  // Création de l'éditeur (une fois)
  useEffect(() => {
    if (!host.current) return
    const update = EditorView.updateListener.of(u => {
      if (!u.docChanged) return
      const doc = u.state.doc.toString()
      lastEmitted.current = doc; emitted.current.push(doc); if (emitted.current.length > 60) emitted.current.shift()
      setText(doc); onChangeRef.current(doc)
    })
    const theme = EditorView.theme({
      '&': { fontSize: '15.5px', background: '#0f172a08', borderRadius: '0', border: 'none' },
      '.cm-content': { fontFamily: "ui-monospace,'Cascadia Mono',Menlo,Consolas,'Courier New',monospace", minHeight: `${rows * 1.6}em`, padding: '10px 0', caretColor: '#0f172a' },
      '.cm-scroller': { lineHeight: '1.6', overflow: 'auto', maxHeight: '60vh' },
      '.cm-gutters': { background: '#f1f5f9', color: '#94a3b8', border: 'none', borderRight: '1px solid #e2e8f0' },
      '.cm-activeLine': { background: '#e0f2fe55' },
      '.cm-activeLineGutter': { background: '#e0f2fe' },
      '&.cm-focused': { outline: 'none' },
      '.cm-placeholder': { color: '#94a3b8' },
    })
    const state = EditorState.create({
      doc: value ?? '',
      extensions: [
        history(), drawSelection(), highlightActiveLine(), indentOnInput(), bracketMatching(), indentUnit.of('    '),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        keymap.of([
          { key: 'Escape', run: v => { temporarilySetTabFocusMode(v); return false } },          // Échap puis Tab : on quitte la zone (accessibilité clavier)
          { key: 'Tab', run: indentMore }, { key: 'Shift-Tab', run: indentLess },
          ...historyKeymap, ...defaultKeymap,
        ]),
        langComp.current.of([]),
        cmPlaceholder(placeholder ?? ''),
        EditorView.contentAttributes.of({ 'aria-label': ariaLabel ?? 'Réponse', spellcheck: 'false', autocapitalize: 'off', autocorrect: 'off', 'data-gramm': 'false' }),
        update, theme,
      ],
    })
    const view = new EditorView({ state, parent: host.current })
    viewRef.current = view
    return () => { view.destroy(); viewRef.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Langage : coloration + numéros de ligne pour le code (pas pour une démonstration LaTeX)
  useEffect(() => {
    let off = false
    ;(async () => {
      const ext = await langExtension(cur)
      if (off || !viewRef.current) return
      viewRef.current.dispatch({ effects: langComp.current.reconfigure([ext, ...(cur === 'latex' ? [EditorView.lineWrapping] : [lineNumbers()])]) })
    })()
    return () => { off = true }
  }, [cur])

  // Valeur modifiée de l'extérieur (reprise d'une sauvegarde) : l'éditeur la suit
  useEffect(() => {
    const v = viewRef.current; const nv = value ?? ''
    if (!v || nv === lastEmitted.current || nv === v.state.doc.toString() || emitted.current.includes(nv)) return      // écho d'une valeur déjà émise : ignoré
    v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: nv } }); lastEmitted.current = nv; setText(nv)
  }, [value])

  const insertText = useCallback((latex: string, cursorInLatex?: number) => {
    const v = viewRef.current; if (!v) return
    const { from, to } = v.state.selection.main
    const doc = v.state.doc.toString()
    const sel = doc.slice(from, to)
    let body = latex
    if (sel) body = body.includes('{}') ? body.replace('{}', `{${sel}}`) : body + sel          // le texte sélectionné remplace le premier « {} » vide ou suit le symbole
    const inMath = insideMath(doc, from)
    const pre = inMath ? '' : '\\(', post = inMath ? '' : '\\)'
    const caret = sel ? from + pre.length + body.length : from + pre.length + (cursorInLatex ?? body.length)
    v.dispatch({ changes: { from, to, insert: pre + body + post }, selection: { anchor: caret } })
    v.focus()
  }, [])

  // Éditeur visuel de formules (MathLive), chargé à la demande
  const [visual, setVisual] = useState(false)
  const mfHost = useRef<HTMLDivElement>(null)
  const mfRef = useRef<any>(null)
  useEffect(() => {
    if (!visual) return
    let off = false
    ;(async () => {
      const { MathfieldElement } = await import('mathlive')
      if (off || !mfHost.current) return
      MathfieldElement.fontsDirectory = '/mathlive/fonts'          // polices servies par notre site
      MathfieldElement.soundsDirectory = null
      const mf: any = new MathfieldElement()
      mf.setAttribute('aria-label', 'Éditeur de formule')
      mf.style.cssText = 'display:block;width:100%;font-size:22px;padding:8px 12px;border:1.5px solid #cbd5e1;border-radius:8px;background:#fff'
      try { mf.menuItems = [] } catch {}
      mfHost.current.replaceChildren(mf); mfRef.current = mf
      setTimeout(() => { try { mf.focus() } catch {} }, 50)
    })()
    return () => { off = true; try { mfRef.current?.remove() } catch {}; mfRef.current = null }
  }, [visual])
  function insertVisual() {
    const latex = String(mfRef.current?.getValue?.('latex') ?? '').trim()
    if (!latex) return
    insertText(latex)
    try { mfRef.current.setValue('') } catch {}
  }

  const chooseLang = (l: EditorLang) => { setCur(l); if (storageKey) { try { localStorage.setItem(storageKey, l) } catch {} } }
  const isCode = cur !== 'latex'                    // programme : ni barre de symboles, ni éditeur de formule, ni aperçu (réservés aux démonstrations)
  const withMath = !isCode && hasMath(text)
  const btn: React.CSSProperties = { minWidth: 30, height: 30, padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: 6, background: '#fff', color: '#0f172a', cursor: 'pointer', fontSize: 15, fontFamily: "'Cambria Math','STIX Two Math',serif", lineHeight: 1 }
  const link: React.CSSProperties = { border: 'none', background: 'none', color: '#2563eb', cursor: 'pointer', fontSize: 13.5, fontWeight: 600 }

  return (
    <div data-cei-answer={text}>
      <div style={{ border: '1.5px solid #e2e8f0', borderBottom: 'none', borderRadius: '8px 8px 0 0', background: '#f8fafc', padding: '6px 8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13.5, color: '#475569', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
            Langage :
            {fixedLang
              ? <span style={{ padding: '2px 10px', borderRadius: 99, background: '#ecfdf5', color: '#065f46', fontWeight: 700 }}>{LANG_LABEL[cur]}</span>
              : <select value={cur} onChange={e => chooseLang(e.target.value as EditorLang)} aria-label="Langage de la réponse" style={{ padding: '3px 8px', border: '1px solid #cbd5e1', borderRadius: 6, background: '#fff', fontSize: 13.5 }}>
                  {(Object.keys(LANG_LABEL) as EditorLang[]).map(l => <option key={l} value={l}>{LANG_LABEL[l]}</option>)}
                </select>}
          </span>
          {!isCode && <span style={{ display: 'flex', gap: 14 }}>
            <button type="button" onClick={() => setVisual(v => !v)} style={link} aria-expanded={visual}>{visual ? 'Fermer l’éditeur de formule' : 'Éditeur de formule'}</button>
            <button type="button" onClick={() => setShowSyms(s => !s)} style={link}>{showSyms ? 'Masquer les symboles' : 'Symboles mathématiques'}</button>
          </span>}
        </div>
        {!isCode && showSyms && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 6 }} role="toolbar" aria-label="Symboles mathématiques">
            {SYMBOLS.map(s => (
              <button key={s.title} type="button" title={s.title} aria-label={s.title} onMouseDown={e => e.preventDefault()} onClick={() => insertText(s.latex, s.cursor)} style={btn}>{s.label}</button>
            ))}
          </div>
        )}
        {!isCode && visual && (
          <div style={{ marginTop: 8, padding: 10, border: '1px solid #bfdbfe', borderRadius: 8, background: '#eff6ff' }}>
            <div style={{ fontSize: 13, color: '#1e40af', marginBottom: 6, fontWeight: 600 }}>Composez votre formule, puis cliquez sur « Insérer dans la réponse » (le clavier mathématique s&apos;ouvre avec l&apos;icône du champ).</div>
            <div ref={mfHost} style={{ minHeight: 48 }}>Chargement de l&apos;éditeur…</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button type="button" onClick={insertVisual} style={{ padding: '6px 14px', border: 'none', borderRadius: 7, background: '#2563eb', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 14.5 }}>Insérer dans la réponse</button>
              <button type="button" onClick={() => setVisual(false)} style={{ padding: '6px 14px', border: '1px solid #cbd5e1', borderRadius: 7, background: '#fff', color: '#334155', fontWeight: 600, cursor: 'pointer', fontSize: 14.5 }}>Fermer</button>
            </div>
          </div>
        )}
      </div>
      <div ref={host} style={{ border: `1.5px solid ${borderColor ?? '#e2e8f0'}`, borderRadius: withMath ? 0 : '0 0 8px 8px', overflow: 'hidden', background: '#0f172a08' }} />
      {withMath && (
        <div style={{ border: '1.5px solid #e2e8f0', borderTop: 'none', borderRadius: '0 0 8px 8px', background: '#fff', padding: '10px 14px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 6 }}>Aperçu de votre réponse</div>
          <div style={{ fontSize: 17, color: '#0f172a', lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}><MathText text={text} /></div>
          <div style={{ fontSize: 12.5, color: '#94a3b8', marginTop: 6 }}>Les formules s&apos;écrivent entre \( … \) ou \[ … \]. La barre ci-dessus et l&apos;éditeur de formule les ajoutent pour vous.</div>
        </div>
      )}
    </div>
  )
}
