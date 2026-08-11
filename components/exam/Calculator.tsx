'use client'

/**
 * Calculatrice scientifique intégrée à la page de composition (Retour DFIP) —
 * évite que l'étudiant sorte une calculatrice physique ou son téléphone
 * (matériel non vérifiable par le surveillant, potentiellement assimilé à de
 * la triche). Purement côté client : aucun appel réseau, aucune fonction de
 * recherche — un pur outil de calcul, pas d'accès à des ressources externes.
 * N'utilise jamais eval()/Function() : passe par lib/safeMathEval.
 */
import { useState } from 'react'
import { evaluateExpression } from '@/lib/safeMathEval'

interface Props { onClose: () => void }

const BTN: React.CSSProperties = {
  border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: 'pointer',
  height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center',
}

export default function Calculator({ onClose }: Props) {
  const [expr, setExpr] = useState('')
  const [result, setResult] = useState<string>('')
  const [err, setErr] = useState('')
  const [memory, setMemory] = useState(0)
  const [sci, setSci] = useState(false)

  function insert(s: string) {
    setErr('')
    setExpr(e => e + s)
  }
  function clearAll() { setExpr(''); setResult(''); setErr('') }
  function backspace() { setExpr(e => e.slice(0, -1)); setErr('') }
  function equals() {
    try {
      const v = evaluateExpression(expr)
      const rounded = Math.round(v * 1e10) / 1e10
      setResult(String(rounded))
      setErr('')
    } catch (e: any) {
      setErr(e.message || 'Expression invalide')
      setResult('')
    }
  }

  const digits = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '0', '.']

  return (
    <div style={{
      position: 'fixed', bottom: 16, right: 16, width: sci ? 300 : 260, background: 'white',
      borderRadius: 14, boxShadow: '0 10px 30px rgba(0,0,0,.25)', border: '1px solid #e2e8f0',
      zIndex: 9400, overflow: 'hidden', fontFamily: "-apple-system,'Segoe UI',Roboto,sans-serif",
    }}>
      <div style={{ background: '#1e293b', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <i className="fas fa-calculator" style={{ color: '#60a5fa' }} />
        <span style={{ color: 'white', fontWeight: 700, fontSize: 13, flex: 1 }}>Calculatrice</span>
        <button onClick={() => setSci(s => !s)} title="Fonctions scientifiques"
          style={{ background: sci ? '#3b82f6' : 'rgba(255,255,255,.12)', border: 'none', color: 'white', borderRadius: 6, padding: '4px 8px', fontSize: 11, cursor: 'pointer', fontWeight: 700 }}>
          fx
        </button>
        <button onClick={onClose} title="Fermer"
          style={{ background: 'rgba(255,255,255,.12)', border: 'none', color: 'white', borderRadius: 6, width: 26, height: 26, cursor: 'pointer' }}>
          <i className="fas fa-times" style={{ fontSize: 12 }} />
        </button>
      </div>

      <div style={{ padding: '10px 12px 0' }}>
        <div style={{ background: '#0f172a', borderRadius: 8, padding: '10px 12px', marginBottom: 10, minHeight: 54 }}>
          <div style={{ color: '#94a3b8', fontSize: 12, minHeight: 16, wordBreak: 'break-all', fontFamily: 'monospace' }}>{expr || '0'}</div>
          <div style={{ color: err ? '#f87171' : '#4ade80', fontSize: 18, fontWeight: 700, fontFamily: 'monospace', wordBreak: 'break-all' }}>
            {err || (result !== '' ? `= ${result}` : ' ')}
          </div>
        </div>
      </div>

      <div style={{ padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {sci && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
            {[
              ['sin(', 'sin'], ['cos(', 'cos'], ['tan(', 'tan'], ['sqrt(', '√'], ['^2', 'x²'],
              ['log(', 'log'], ['ln(', 'ln'], ['^', 'x^y'], ['pi', 'π'], ['e', 'e'],
            ].map(([val, label]) => (
              <button key={label} onClick={() => insert(val)} style={{ ...BTN, background: '#eff6ff', color: '#1d4ed8', height: 34, fontSize: 12 }}>{label}</button>
            ))}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
          <button onClick={clearAll} style={{ ...BTN, background: '#fee2e2', color: '#dc2626' }}>C</button>
          <button onClick={() => insert('(')} style={{ ...BTN, background: '#f1f5f9', color: '#334155' }}>(</button>
          <button onClick={() => insert(')')} style={{ ...BTN, background: '#f1f5f9', color: '#334155' }}>)</button>
          <button onClick={() => insert('%')} style={{ ...BTN, background: '#f1f5f9', color: '#334155' }}>%</button>

          {digits.slice(0, 3).map(d => <button key={d} onClick={() => insert(d)} style={{ ...BTN, background: '#f8fafc', color: '#0f172a' }}>{d}</button>)}
          <button onClick={() => insert('/')} style={{ ...BTN, background: '#eff6ff', color: '#1d4ed8' }}>÷</button>

          {digits.slice(3, 6).map(d => <button key={d} onClick={() => insert(d)} style={{ ...BTN, background: '#f8fafc', color: '#0f172a' }}>{d}</button>)}
          <button onClick={() => insert('*')} style={{ ...BTN, background: '#eff6ff', color: '#1d4ed8' }}>×</button>

          {digits.slice(6, 9).map(d => <button key={d} onClick={() => insert(d)} style={{ ...BTN, background: '#f8fafc', color: '#0f172a' }}>{d}</button>)}
          <button onClick={() => insert('-')} style={{ ...BTN, background: '#eff6ff', color: '#1d4ed8' }}>−</button>

          <button onClick={() => insert('0')} style={{ ...BTN, background: '#f8fafc', color: '#0f172a' }}>0</button>
          <button onClick={() => insert('.')} style={{ ...BTN, background: '#f8fafc', color: '#0f172a' }}>.</button>
          <button onClick={backspace} style={{ ...BTN, background: '#f1f5f9', color: '#334155' }}><i className="fas fa-delete-left" /></button>
          <button onClick={() => insert('+')} style={{ ...BTN, background: '#eff6ff', color: '#1d4ed8' }}>+</button>

          <button onClick={() => { setMemory(m => { try { return evaluateExpression(expr || result) } catch { return m } }) }}
            style={{ ...BTN, background: '#f1f5f9', color: '#475569', fontSize: 11 }}>M+</button>
          <button onClick={() => insert(String(memory))} style={{ ...BTN, background: '#f1f5f9', color: '#475569', fontSize: 11 }}>MR</button>
          <button onClick={() => setMemory(0)} style={{ ...BTN, background: '#f1f5f9', color: '#475569', fontSize: 11 }}>MC</button>
          <button onClick={equals} style={{ ...BTN, background: '#10b981', color: 'white' }}>=</button>
        </div>
      </div>
    </div>
  )
}
