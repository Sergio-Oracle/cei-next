/**
 * Safe arithmetic expression evaluator — no eval()/Function(). Small
 * recursive-descent parser supporting +,-,*,/,^,%, parentheses, unary minus,
 * sqrt/sin/cos/tan/log/ln/abs and the constants pi/e. Trig functions operate
 * in degrees (more intuitive for a general-purpose exam calculator than
 * radians).
 */

type Token = { type: 'num' | 'ident' | 'op' | 'lparen' | 'rparen'; value: string }

function tokenize(src: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  while (i < src.length) {
    const c = src[i]
    if (/\s/.test(c)) { i++; continue }
    if (/[0-9.]/.test(c)) {
      let j = i + 1
      while (j < src.length && /[0-9.]/.test(src[j])) j++
      tokens.push({ type: 'num', value: src.slice(i, j) })
      i = j
      continue
    }
    if (/[a-zA-Z]/.test(c)) {
      let j = i + 1
      while (j < src.length && /[a-zA-Z]/.test(src[j])) j++
      tokens.push({ type: 'ident', value: src.slice(i, j).toLowerCase() })
      i = j
      continue
    }
    if (c === '(') { tokens.push({ type: 'lparen', value: c }); i++; continue }
    if (c === ')') { tokens.push({ type: 'rparen', value: c }); i++; continue }
    if ('+-*/^%'.includes(c)) { tokens.push({ type: 'op', value: c }); i++; continue }
    if (c === '×') { tokens.push({ type: 'op', value: '*' }); i++; continue }
    if (c === '÷') { tokens.push({ type: 'op', value: '/' }); i++; continue }
    throw new Error(`Caractère invalide : ${c}`)
  }
  return tokens
}

const CONSTANTS: Record<string, number> = { pi: Math.PI, e: Math.E }
const FUNCTIONS: Record<string, (x: number) => number> = {
  sqrt: Math.sqrt,
  abs: Math.abs,
  sin: (x) => Math.sin((x * Math.PI) / 180),
  cos: (x) => Math.cos((x * Math.PI) / 180),
  tan: (x) => Math.tan((x * Math.PI) / 180),
  log: Math.log10,
  ln: Math.log,
}

class Parser {
  tokens: Token[]
  pos = 0
  constructor(tokens: Token[]) { this.tokens = tokens }
  peek() { return this.tokens[this.pos] }
  next() { return this.tokens[this.pos++] }

  parseExpr(): number {
    let v = this.parseTerm()
    while (this.peek() && this.peek().type === 'op' && (this.peek().value === '+' || this.peek().value === '-')) {
      const op = this.next().value
      const rhs = this.parseTerm()
      v = op === '+' ? v + rhs : v - rhs
    }
    return v
  }

  parseTerm(): number {
    let v = this.parsePower()
    while (this.peek() && this.peek().type === 'op' && (this.peek().value === '*' || this.peek().value === '/' || this.peek().value === '%')) {
      const op = this.next().value
      const rhs = this.parsePower()
      if (op === '*') v = v * rhs
      else if (op === '/') {
        if (rhs === 0) throw new Error('Division par zéro')
        v = v / rhs
      } else v = v % rhs
    }
    return v
  }

  parsePower(): number {
    const base = this.parseUnary()
    if (this.peek() && this.peek().type === 'op' && this.peek().value === '^') {
      this.next()
      const exp = this.parsePower() // right-associative
      return Math.pow(base, exp)
    }
    return base
  }

  parseUnary(): number {
    if (this.peek() && this.peek().type === 'op' && this.peek().value === '-') {
      this.next()
      return -this.parseUnary()
    }
    if (this.peek() && this.peek().type === 'op' && this.peek().value === '+') {
      this.next()
      return this.parseUnary()
    }
    return this.parsePrimary()
  }

  parsePrimary(): number {
    const tok = this.peek()
    if (!tok) throw new Error('Expression incomplète')
    if (tok.type === 'num') {
      this.next()
      return parseFloat(tok.value)
    }
    if (tok.type === 'ident') {
      this.next()
      const name = tok.value
      if (name in CONSTANTS) return CONSTANTS[name]
      if (name in FUNCTIONS) {
        if (!this.peek() || this.peek().type !== 'lparen') throw new Error(`${name}(...) attend des parenthèses`)
        this.next()
        const arg = this.parseExpr()
        if (!this.peek() || this.peek().type !== 'rparen') throw new Error('Parenthèse fermante manquante')
        this.next()
        return FUNCTIONS[name](arg)
      }
      throw new Error(`Fonction inconnue : ${name}`)
    }
    if (tok.type === 'lparen') {
      this.next()
      const v = this.parseExpr()
      if (!this.peek() || this.peek().type !== 'rparen') throw new Error('Parenthèse fermante manquante')
      this.next()
      return v
    }
    throw new Error('Expression invalide')
  }
}

export function evaluateExpression(expr: string): number {
  const trimmed = expr.trim()
  if (!trimmed) throw new Error('Expression vide')
  const tokens = tokenize(trimmed)
  const parser = new Parser(tokens)
  const result = parser.parseExpr()
  if (parser.pos < tokens.length) throw new Error('Expression invalide')
  if (!isFinite(result)) throw new Error('Résultat indéfini')
  return result
}
