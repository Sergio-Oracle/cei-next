/* Exécuteur de code des questions « Maths / Programmation » — tourne DANS UN TRAVAILLEUR du navigateur, lui-même dans une enceinte isolée
 * (iframe sandbox sans origine, sans réseau : voir lib/codeRunner.ts). Rien n'est exécuté sur nos serveurs.
 * Langages : Python (Pyodide = CPython 3.13 compilé en WebAssembly) et JavaScript (comportement de Node pour console.log / readline / process).
 * Protocole :  reçoit {type:'run', id, lang, source, stdin, base}  →  envoie {type:'started', id} (une fois le langage prêt : le délai d'exécution commence là)
 *              puis {type:'result', id, status: ok|runtime_error|output|unavailable, stdout, stderr}.
 * (Le dépassement de temps est géré par l'enceinte, qui arrête ce travailleur : une boucle infinie ne bloque jamais la page.)
 */
'use strict'
var MAX_OUT = 65536
var BASE = ''
var pyReady = null
var py = null

function send(m) { self.postMessage(m) }

/* ───────── Python ───────── */
var PY_HARNESS = [
  'import sys, traceback',
  'def __cei_run(src):',
  '    g = {"__name__": "__main__", "__builtins__": __builtins__}',
  '    try:',
  '        exec(compile(src, "<réponse>", "exec"), g)',
  '    except SystemExit as e:',
  '        c = e.code',
  '        if c is None or c == 0:',
  '            return 0',
  '        if isinstance(c, int):',
  '            return c',
  '        print(c, file=sys.stderr)',
  '        return 1',
  '    except BaseException as e:',
  '        tb = e.__traceback__.tb_next if e.__traceback__ else None',
  '        traceback.print_exception(type(e), e, tb)',
  '        return 1',
  '    return 0',
].join('\n')

function initPython() {
  if (pyReady) return pyReady
  pyReady = (async function () {
    importScripts(BASE + 'pyodide/pyodide.js')
    py = await self.loadPyodide({ indexURL: BASE + 'pyodide/' })
    py.runPython(PY_HARNESS)
  })()
  pyReady.catch(function () { pyReady = null })
  return pyReady
}

function splitLines(stdin) {
  var t = String(stdin || '')
  if (!t) return []
  var l = t.replace(/\r\n?/g, '\n').split('\n')
  if (l.length && l[l.length - 1] === '') l.pop()
  return l
}

async function runPython(id, source, stdin) {
  await initPython()
  send({ type: 'started', id: id })
  var out = [], err = [], outN = 0, over = false, lines = splitLines(stdin), li = 0
  py.setStdin({ stdin: function () { return li < lines.length ? lines[li++] : null }, isatty: false })
  py.setStdout({ raw: function (b) { if (++outN > MAX_OUT) { over = true; throw new Error('OUTPUT_LIMIT') } out.push(b) }, isatty: false })
  py.setStderr({ raw: function (b) { if (err.length < 8000) err.push(b) }, isatty: false })
  var code = 1
  try { code = py.globals.get('__cei_run')(source) } catch (e) { err.push.apply(err, Array.from(new TextEncoder().encode(String(e && e.message || e)))); code = 1 }
  var dec = new TextDecoder('utf-8')
  return { status: over ? 'output' : (code === 0 ? 'ok' : 'runtime_error'), stdout: dec.decode(new Uint8Array(out)), stderr: dec.decode(new Uint8Array(err)).slice(-2000) }
}

/* ───────── JavaScript : util.inspect fidèle à Node (console.log d'objets / tableaux) ───────── */
var IDENT = /^[a-zA-Z_][a-zA-Z_0-9]*$/
function quote(s) {
  var q = "'"
  if (s.indexOf("'") !== -1) { if (s.indexOf('"') === -1) q = '"'; else if (s.indexOf('`') === -1 && s.indexOf('${') === -1) q = '`' }
  var r = s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/\t/g, '\\t').replace(/\r/g, '\\r').replace(/\x08/g, '\\b').replace(/\f/g, '\\f')
  if (q === "'") r = r.replace(/'/g, "\\'")
  return q + r + q
}
function groupArrayElements(ctx, output, value) {
  var totalLength = 0, maxLength = 0, i = 0, outputLength = output.length
  if (ctx.extra) outputLength--
  var sep = 2, dataLen = new Array(outputLength)
  for (; i < outputLength; i++) { var len = output[i].length; dataLen[i] = len; totalLength += len + sep; if (maxLength < len) maxLength = len }
  var actualMax = maxLength + sep
  if (actualMax * 3 + ctx.indentationLvl < 80 && (totalLength / actualMax > 5 || maxLength <= 6)) {
    var averageBias = Math.sqrt(actualMax - totalLength / output.length), biasedMax = Math.max(actualMax - 3 - averageBias, 1)
    var columns = Math.min(Math.round(Math.sqrt(2.5 * biasedMax * outputLength) / biasedMax), Math.floor((80 - ctx.indentationLvl) / actualMax), 12, 15)
    if (columns <= 1) return output
    var tmp = [], maxLineLength = []
    for (i = 0; i < columns; i++) { var lineLength = 0; for (var j = i; j < output.length; j += columns) if (dataLen[j] > lineLength) lineLength = dataLen[j]; maxLineLength.push(lineLength + sep) }
    var padStart = true
    if (value !== undefined) for (i = 0; i < output.length; i++) if (typeof value[i] !== 'number' && typeof value[i] !== 'bigint') { padStart = false; break }
    for (i = 0; i < outputLength; i += columns) {
      var max = Math.min(i + columns, outputLength), str = '', k = i
      for (; k < max - 1; k++) { var cell = output[k] + ', ', pad = maxLineLength[k - i]; str += padStart ? cell.padStart(pad, ' ') : cell.padEnd(pad, ' ') }
      if (padStart) str += output[k].padStart(maxLineLength[k - i] - sep, ' '); else str += output[k]
      tmp.push(str)
    }
    if (ctx.extra) tmp.push(output[outputLength])
    output = tmp
  }
  return output
}
function reduceToSingleString(ctx, output, base, braces, isArray, recurseTimes, value) {
  var entries = output.length
  if (isArray && entries > 6) output = groupArrayElements(ctx, output, value)
  if (ctx.currentDepth - recurseTimes < 3 && entries === output.length) {
    var start = output.length + ctx.indentationLvl + braces[0].length + base.length + 10
    var total = output.length + start, ok = total + output.length <= 80
    if (ok) for (var i = 0; i < output.length; i++) { total += output[i].length; if (total > 80) { ok = false; break } }
    if (ok && (base === '' || base.indexOf('\n') === -1)) {
      var joined = output.join(', ')
      if (joined.indexOf('\n') === -1) return (base ? base + ' ' : '') + braces[0] + ' ' + joined + ' ' + braces[1]
    }
  }
  var ind = '\n' + ' '.repeat(ctx.indentationLvl)
  return (base ? base + ' ' : '') + braces[0] + ind + '  ' + output.join(',' + ind + '  ') + ind + braces[1]
}
function fmtValue(ctx, v, recurseTimes, top) {
  if (typeof v === 'string') return top ? v : quote(v)
  if (typeof v === 'number') return Object.is(v, -0) ? '-0' : String(v)
  if (typeof v === 'bigint') return v + 'n'
  if (typeof v === 'boolean' || v === undefined || v === null) return String(v)
  if (typeof v === 'symbol') return v.toString()
  if (typeof v === 'function') {
    var cls = /^class\b/.test(Function.prototype.toString.call(v))
    var nm = v.name ? ': ' + v.name : ' (anonymous)'
    return cls ? '[class ' + (v.name || '(anonymous)') + ']' : '[Function' + nm + ']'
  }
  if (ctx.seen.indexOf(v) !== -1) return '[Circular *1]'
  if (v instanceof Error) return (v.stack || (v.name + ': ' + v.message)).toString()
  if (v instanceof Date) return isNaN(v) ? 'Invalid Date' : v.toISOString()
  if (v instanceof RegExp) return v.toString()
  var isArr = Array.isArray(v), isMap = v instanceof Map, isSet = v instanceof Set
  var ctor = ''
  try { var p = Object.getPrototypeOf(v); ctor = p && p.constructor ? p.constructor.name : '[Object: null prototype]' } catch (e) { ctor = 'Object' }
  if (recurseTimes > 2) return isArr ? '[Array]' : '[' + (ctor || 'Object') + ']'
  ctx.seen.push(v)
  ctx.currentDepth = recurseTimes
  var output = [], braces, base = '', extra = false
  var fmtChild = function (x) { ctx.indentationLvl += 2; var r = fmtValue(ctx, x, recurseTimes + 1, false); ctx.indentationLvl -= 2; return r }
  if (isArr) {
    braces = ['[', ']']; if (ctor !== 'Array') braces[0] = ctor + '(' + v.length + ') ['
    var n = Math.min(v.length, 100), holes = 0
    for (var i = 0; i < n; i++) { if (!(i in v)) { holes++; continue } if (holes) { output.push('<' + holes + ' empty item' + (holes > 1 ? 's' : '') + '>'); holes = 0 } output.push(fmtChild(v[i])) }
    if (holes) output.push('<' + holes + ' empty item' + (holes > 1 ? 's' : '') + '>')
    if (v.length > n) { output.push('... ' + (v.length - n) + ' more item' + (v.length - n > 1 ? 's' : '')); extra = true }
    Object.keys(v).filter(function (k) { return !/^\d+$/.test(k) }).forEach(function (k) { output.push((IDENT.test(k) ? k : quote(k)) + ': ' + fmtChild(v[k])) })
    if (!output.length) { ctx.seen.pop(); return braces[0] + ']' }
  } else if (isMap) {
    braces = ['Map(' + v.size + ') {', '}']
    v.forEach(function (val, key) { output.push(fmtChild(key) + ' => ' + fmtChild(val)) })
    if (!output.length) { ctx.seen.pop(); return 'Map(0) {}' }
  } else if (isSet) {
    braces = ['Set(' + v.size + ') {', '}']
    v.forEach(function (val) { output.push(fmtChild(val)) })
    if (!output.length) { ctx.seen.pop(); return 'Set(0) {}' }
  } else {
    braces = ['{', '}']; if (ctor && ctor !== 'Object') braces[0] = ctor + ' {'
    Object.keys(v).forEach(function (k) {
      var d = Object.getOwnPropertyDescriptor(v, k), val
      if (d && (d.get || d.set)) val = d.get && d.set ? '[Getter/Setter]' : (d.get ? '[Getter]' : '[Setter]'); else val = fmtChild(v[k])
      output.push((IDENT.test(k) ? k : quote(k)) + ': ' + val)
    })
    if (!output.length) { ctx.seen.pop(); return (ctor && ctor !== 'Object' ? ctor + ' ' : '') + '{}' }
  }
  ctx.extra = extra
  var res = reduceToSingleString(ctx, output, base, braces, isArr, recurseTimes, isArr ? v : undefined)
  ctx.seen.pop()
  return res
}
function inspect(v, top) { return fmtValue({ seen: [], indentationLvl: 0, currentDepth: 0, extra: false }, v, 0, top) }
function format() {
  var a = Array.prototype.slice.call(arguments), s = ''
  if (typeof a[0] === 'string' && a[0].indexOf('%') !== -1 && a.length > 1) {
    var i = 1
    s = a.shift().replace(/%[sdifjoO%]/g, function (m) {
      if (m === '%%') return '%'
      if (!a.length) return m
      var x = a.shift()
      switch (m) {
        case '%s': return typeof x === 'string' ? x : (typeof x === 'object' && x !== null ? inspect(x) : String(x))
        case '%d': return typeof x === 'bigint' ? x + 'n' : String(Number(x))
        case '%i': return String(parseInt(x))
        case '%f': return String(parseFloat(x))
        case '%j': try { return JSON.stringify(x) } catch (e) { return '[Circular]' }
        default: return inspect(x)
      }
    })
    if (a.length) s += ' ' + a.map(function (x) { return inspect(x, true) }).join(' ')
    return s
  }
  return a.map(function (x) { return inspect(x, true) }).join(' ')
}

var AsyncFunction = Object.getPrototypeOf(async function () {}).constructor

async function runJs(id, source, stdin) {
  send({ type: 'started', id: id })
  var out = [], err = [], outN = 0, over = false
  var lines = splitLines(stdin), li = 0, pending = 0
  var text = lines.length ? lines.join('\n') + '\n' : ''
  var realST = self.setTimeout.bind(self), realCT = self.clearTimeout.bind(self)
  function write(s) { s = String(s); outN += s.length; if (outN > MAX_OUT) { over = true; throw new Error('OUTPUT_LIMIT') } out.push(s) }
  function ewrite(s) { if (err.join('').length < 8000) err.push(String(s)) }
  function Exit(c) { this.code = c }
  var con = {
    log: function () { write(format.apply(null, arguments) + '\n') }, info: null, debug: null,
    error: function () { ewrite(format.apply(null, arguments) + '\n') }, warn: null,
  }
  con.info = con.log; con.debug = con.log; con.warn = con.error
  var rlMake = function (opts) {
    var handlers = { line: [], close: [] }, closed = false, started = false
    var emitClose = function () { if (!closed) { closed = true; handlers.close.forEach(function (f) { f() }) } }
    var pump = function () {
      if (started) return; started = true; pending++
      realST(function step() {
        if (closed) { pending--; return }
        if (li < lines.length && handlers.line.length) { var l = lines[li++]; handlers.line.forEach(function (f) { f(l) }); realST(step, 0) }
        else { pending--; emitClose() }
      }, 0)
    }
    var rl = {
      on: function (ev, f) { (handlers[ev] = handlers[ev] || []).push(f); if (ev === 'line') pump(); else if (ev === 'close' && !started && !handlers.line.length) { started = true; pending++; realST(function () { pending--; emitClose() }, 0) } return rl },
      once: function (ev, f) { return rl.on(ev, f) },
      question: function (q, cb) { if (opts && opts.output) write(q); pending++; realST(function () { pending--; cb(li < lines.length ? lines[li++] : undefined) }, 0) },
      setPrompt: function () {}, prompt: function () {}, pause: function () { return rl }, resume: function () { return rl },
      close: function () { closed = true; handlers.close.forEach(function (f) { f() }) },
    }
    rl[Symbol.asyncIterator] = function () { return { next: function () { return Promise.resolve(li < lines.length ? { value: lines[li++], done: false } : { value: undefined, done: true }) }, return: function () { return Promise.resolve({ done: true }) } } }
    return rl
  }
  var fs = {
    readFileSync: function (f, enc) { if (f === 0 || f === '/dev/stdin') return text; var e = new Error("ENOENT: no such file or directory, open '" + f + "'"); e.code = 'ENOENT'; throw e },
    writeSync: function (fd, s) { if (fd === 1) write(s); else ewrite(s) },
    existsSync: function () { return false },
  }
  var util = { format: format, inspect: function (x) { return inspect(x, false) } }
  var proc = {
    stdout: { write: function (s) { write(s); return true }, isTTY: false }, stderr: { write: function (s) { ewrite(s); return true }, isTTY: false },
    stdin: { setEncoding: function () {}, on: function (ev, f) { if (ev === 'data') { realST(function () { if (text) f(text) }, 0) } else if (ev === 'end' || ev === 'close') { pending++; realST(function () { pending--; f() }, 0) } return proc.stdin }, resume: function () {}, isTTY: false },
    argv: ['node', 'main.js'], env: {}, platform: 'linux', version: 'v20.0.0', versions: { node: '20.0.0' },
    exit: function (c) { throw new Exit(c || 0) }, nextTick: function (f) { var a = Array.prototype.slice.call(arguments, 1); queueMicrotask(function () { f.apply(null, a) }) },
    hrtime: Object.assign(function () { var t = performance.now(); return [Math.floor(t / 1000), Math.floor((t % 1000) * 1e6)] }, { bigint: function () { return BigInt(Math.floor(performance.now() * 1e6)) } }),
    memoryUsage: function () { return { rss: 0, heapTotal: 0, heapUsed: 0, external: 0 } }, cwd: function () { return '/' }, on: function () { return proc },
  }
  var mods = { fs: fs, readline: { createInterface: rlMake }, util: util, process: proc }
  var req = function (n) { n = String(n).replace(/^node:/, ''); if (mods[n]) return mods[n]; var e = new Error("Cannot find module '" + n + "'"); e.code = 'MODULE_NOT_FOUND'; throw e }
  var st = function (f, ms) { var a = Array.prototype.slice.call(arguments, 2); pending++; return realST(function () { try { f.apply(null, a) } finally { pending-- } }, ms) }
  var ct = function (h) { realCT(h) }
  var mod = { exports: {} }
  var status = 'ok'
  try {
    var fn = new AsyncFunction('require', 'module', 'exports', 'console', 'process', 'setTimeout', 'clearTimeout', 'prompt', 'readline', source)
    await fn(req, mod, mod.exports, con, proc, st, ct, function () { return li < lines.length ? lines[li++] : null }, undefined)
    var guard = 0
    while (pending > 0 && guard++ < 200000) await new Promise(function (r) { realST(r, 1) })
  } catch (e) {
    if (e instanceof Exit) { status = e.code === 0 ? 'ok' : 'runtime_error' }
    else if (over) { status = 'output' }
    else { status = 'runtime_error'; ewrite((e && e.stack ? String(e.stack).split('\n').slice(0, 6).join('\n') : String(e)) + '\n') }
  }
  if (over) status = 'output'
  return { status: status, stdout: out.join(''), stderr: err.join('').slice(-2000) }
}

self.onmessage = async function (e) {
  var m = e.data || {}
  if (m.type !== 'run') return
  BASE = m.base || BASE
  try {
    var r = m.lang === 'python' ? await runPython(m.id, m.source, m.stdin) : (m.lang === 'javascript' ? await runJs(m.id, m.source, m.stdin) : { status: 'unavailable', stdout: '', stderr: '' })
    send({ type: 'result', id: m.id, status: r.status, stdout: r.stdout, stderr: r.stderr })
  } catch (err) {
    send({ type: 'result', id: m.id, status: 'unavailable', stdout: '', stderr: String(err && err.message || err).slice(0, 500) })
  }
}
