/**
 * Exécution du code des questions « Maths / Programmation » DANS LE NAVIGATEUR (WebAssembly) — jamais sur nos serveurs.
 *
 * Isolation (la même pour l'étudiant et pour l'enseignant qui exécute la copie d'un étudiant) :
 *  - le code tourne dans un travailleur (public/code-runner/worker.js) créé par une iframe `sandbox="allow-scripts"` SANS origine :
 *    aucun accès aux cookies, au stockage, à la page, ni au jeton de l'utilisateur ;
 *  - une politique CSP posée dans le document de l'iframe n'autorise que les fichiers de /code-runner/ (connect-src / script-src) :
 *    aucune requête réseau vers l'API ou vers l'extérieur n'est possible, quoi que fasse le code ;
 *  - temps borné : le travailleur est arrêté au dépassement (boucle infinie) et recréé ; sortie bornée (64 Ko).
 * Langages : Python (Pyodide, CPython en WebAssembly, ~10 Mo téléchargés une seule fois, seulement au premier test) et JavaScript.
 */
import { CodeTest, RunStatus, TestResult, isRunnable, programFor, verdict } from '@/lib/codeTests'

export type RunResult = { status: RunStatus; stdout: string; stderr: string }
export const RUN_TIMEOUT_MS = 5000          // un peu plus large qu'un serveur : le code s'exécute sur l'appareil de l'étudiant (WebAssembly ≈ 2 à 3 fois plus lent)
const INIT_TIMEOUT_MS = 180000              // premier chargement de Python (réseau lent)

export function frameDoc(origin: string): string {
  const base = `${origin}/code-runner/`
  const csp = `default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' blob: ${base}; worker-src blob:; connect-src ${base}`
  const js = `
var W=null,cur=null,BASE=${JSON.stringify(base)};
function reply(m){parent.postMessage(m,'*')}
function kill(){if(W){try{W.terminate()}catch(e){} W=null}}
async function mk(){
  if(W)return W;
  var r=await fetch(BASE+'worker.js'); var t=await r.text();
  var u=URL.createObjectURL(new Blob([t],{type:'text/javascript'}));
  var w=new Worker(u); URL.revokeObjectURL(u);
  w.onmessage=function(e){var m=e.data||{};
    if(!cur||m.id!==cur.id)return;
    if(m.type==='started'){clearTimeout(cur.initT);cur.runT=setTimeout(function(){var c=cur;cur=null;kill();reply({type:'result',id:c.id,status:'timeout',stdout:'',stderr:''})},cur.timeoutMs)}
    else if(m.type==='result'){clearTimeout(cur.initT);clearTimeout(cur.runT);var c=cur;cur=null;reply(m)}
  };
  w.onerror=function(){if(cur){var c=cur;cur=null;clearTimeout(c.initT);clearTimeout(c.runT);kill();reply({type:'result',id:c.id,status:'unavailable',stdout:'',stderr:''})}};
  W=w;return w;
}
addEventListener('message',async function(e){
  if(e.source!==parent)return; var m=e.data||{}; if(m.type!=='run')return;
  try{
    var w=await mk();
    cur={id:m.id,timeoutMs:m.timeoutMs||5000};
    cur.initT=setTimeout(function(){var c=cur;cur=null;kill();if(c)reply({type:'result',id:c.id,status:'unavailable',stdout:'',stderr:''})},${INIT_TIMEOUT_MS});
    w.postMessage({type:'run',id:m.id,lang:m.lang,source:m.source,stdin:m.stdin,base:BASE});
  }catch(err){reply({type:'result',id:m.id,status:'unavailable',stdout:'',stderr:''})}
});
reply({type:'ready'});
`
  return `<!doctype html><meta http-equiv="Content-Security-Policy" content="${csp}"><script>${js}<\/script>`
}

let frame: HTMLIFrameElement | null = null
let frameReady: Promise<boolean> = Promise.resolve(false)
let markReady: (ok: boolean) => void = () => {}
let seq = 0
let chain: Promise<unknown> = Promise.resolve()
const waiting = new Map<number, (r: RunResult) => void>()
let listening = false

function ensureFrame(): HTMLIFrameElement {
  if (!listening) {
    listening = true
    window.addEventListener('message', (e: MessageEvent) => {
      if (!frame || e.source !== frame.contentWindow) return
      const m = e.data || {}
      if (m.type === 'ready') { markReady(true); return }
      if (m.type !== 'result') return
      const done = waiting.get(m.id)
      if (done) { waiting.delete(m.id); done({ status: m.status, stdout: String(m.stdout || ''), stderr: String(m.stderr || '') }) }
    })
  }
  if (frame && document.body.contains(frame)) return frame
  const f = document.createElement('iframe')
  f.setAttribute('sandbox', 'allow-scripts')           // pas d'allow-same-origin : origine opaque, aucun accès à la page ni à ses données
  f.setAttribute('aria-hidden', 'true')
  f.tabIndex = -1
  f.style.cssText = 'position:fixed;width:0;height:0;border:0;opacity:0;pointer-events:none;left:-9999px;top:0'
  frameReady = new Promise<boolean>(res => { markReady = res; setTimeout(() => res(false), 15000) })
  f.srcdoc = frameDoc(window.location.origin)
  document.body.appendChild(f)
  frame = f
  return f
}

/** Exécute un programme. Ne lève jamais d'exception ; les exécutions se font l'une après l'autre. */
export function runCode(lang: string, source: string, stdin = '', timeoutMs = RUN_TIMEOUT_MS): Promise<RunResult> {
  const task = async (): Promise<RunResult> => {
    if (typeof window === 'undefined' || !isRunnable(lang)) return { status: 'unavailable', stdout: '', stderr: '' }
    const f = ensureFrame()
    const id = ++seq
    const p = new Promise<RunResult>(resolve => { waiting.set(id, resolve) })
    if (!(await frameReady)) { waiting.delete(id); frame?.remove(); frame = null; return { status: 'unavailable', stdout: '', stderr: '' } }
    f.contentWindow?.postMessage({ type: 'run', id, lang, source, stdin, timeoutMs }, '*')
    const guard = new Promise<RunResult>(resolve => setTimeout(() => { waiting.delete(id); resolve({ status: 'unavailable', stdout: '', stderr: '' }) }, INIT_TIMEOUT_MS + timeoutMs + 5000))
    return Promise.race([p, guard])
  }
  const next = chain.then(task, task)
  chain = next.catch(() => undefined)
  return next
}

/** Exécute les tests d'une question sur `source`. `onEach` reçoit chaque résultat dès qu'il est connu. */
export async function runTests(lang: string, source: string, tests: CodeTest[], onEach?: (r: TestResult, i: number) => void): Promise<TestResult[]> {
  const out: TestResult[] = []
  for (let i = 0; i < tests.length; i++) {
    const t = tests[i]
    const { program, stdin } = programFor(source, t)
    const r = await runCode(lang, program, stdin)
    const res = verdict(t, r.status, r.stdout, r.stderr)
    out.push(res)
    onEach?.(res, i)
  }
  return out
}
