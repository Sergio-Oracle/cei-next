#!/usr/bin/env python
"""Moteur d'exécution du code DANS LE NAVIGATEUR (lib/codeRunner.ts + public/code-runner/) — essai en Chromium réel, sans serveur CEI.
    cd cei-next && /tmp/pwenv/bin/python scripts/test_code_runner.py
Vérifie : Python (Pyodide) et JavaScript, entrée standard, erreurs, boucle infinie arrêtée au délai (et exécution suivante possible), sortie bornée,
et l'ISOLATION : le code ne joint ni l'API, ni l'extérieur (fetch, XHR, WebSocket, importScripts), n'a ni page, ni cookies, ni stockage, origine « null »."""
import glob, http.server, json, os, shutil, socketserver, subprocess, sys, tempfile, threading
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHROME = (sorted(glob.glob('/root/.cache/ms-playwright/chromium-*/chrome-linux*/chrome')) or [None])[-1]
D = tempfile.mkdtemp(prefix='cr-')
os.makedirs(D + '/lib')
subprocess.run([ROOT + '/node_modules/.bin/tsc', 'lib/codeTests.ts', 'lib/codeRunner.ts', '--outDir', D + '/lib', '--module', 'es2020', '--target', 'es2020', '--lib', 'es2020,dom', '--skipLibCheck', '--moduleResolution', 'node'], cwd=ROOT, capture_output=True)
p = D + '/lib/codeRunner.js'; src = open(p).read(); open(p, 'w').write(src.replace("'@/lib/codeTests'", "'./codeTests.js'"))
shutil.copytree(ROOT + '/public/code-runner', D + '/code-runner')
open(D + '/index.html', 'w').write("<!doctype html><meta charset=utf-8><body><script type=module>import * as R from './lib/codeRunner.js';import * as T from './lib/codeTests.js';window.R=R;window.T=T;window.READY=true</script>")

class H(http.server.SimpleHTTPRequestHandler):
    def __init__(s, *a, **k): super().__init__(*a, directory=D, **k)
    def end_headers(s): s.send_header('Access-Control-Allow-Origin', '*'); s.send_header('Cache-Control', 'no-store'); super().end_headers()
    def log_message(s, *a): pass
H.extensions_map['.wasm'] = 'application/wasm'; H.extensions_map['.js'] = 'text/javascript'
socketserver.TCPServer.allow_reuse_address = True
srv = socketserver.TCPServer(('127.0.0.1', 0), H); PORT = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()

RES = []
def chk(n, ok, d=''):
    RES.append(bool(ok)); print(('  ✔ ' if ok else '  ✘ ') + n + (f'  — {str(d)[:300]}' if d and not ok else ''), flush=True)

with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path=CHROME, args=['--no-sandbox']); pg = b.new_page()
    pg.goto(f'http://127.0.0.1:{PORT}/index.html'); pg.wait_for_function('window.READY===true')
    run = lambda lang, src, stdin='', t=5000: pg.evaluate('([l,s,i,t])=>window.R.runCode(l,s,i,t)', [lang, src, stdin, t])
    print('== JavaScript ==')
    r = run('javascript', 'console.log(1+2)'); chk('console.log', r['status'] == 'ok' and r['stdout'] == '3\n', r)
    r = run('javascript', 'console.log([1,2,3],{a:1,b:"x"},"s")'); chk('mise en forme des tableaux/objets comme Node', r['stdout'] == "[ 1, 2, 3 ] { a: 1, b: 'x' } s\n", r)
    r = run('javascript', 'console.log([1,2,3,4,5,6,7,8,9,10])'); chk('tableau de plus de 6 éléments : colonnes comme Node', r['stdout'] == '[\n  1, 2, 3, 4,  5,\n  6, 7, 8, 9, 10\n]\n', r)
    r = run('javascript', 'const l=require("fs").readFileSync(0,"utf8").trim().split("\\n");console.log(Number(l[0])+Number(l[1]))', '3\n4\n'); chk('lecture de l\'entrée standard (fs)', r['stdout'] == '7\n', r)
    r = run('javascript', 'const rl=require("readline").createInterface({input:process.stdin});let s=0;rl.on("line",x=>s+=+x);rl.on("close",()=>console.log(s))', '3\n4\n5\n'); chk('readline (événements line / close)', r['stdout'] == '12\n', r)
    r = run('javascript', 'const x = await new Promise(r=>setTimeout(()=>r(42),30)); console.log(x)'); chk('await et setTimeout attendus', r['stdout'] == '42\n', r)
    r = run('javascript', 'throw new Error("boom")'); chk('erreur → runtime_error avec le message', r['status'] == 'runtime_error' and 'boom' in r['stderr'], r)
    r = run('javascript', 'while(true){}', '', 1500); chk('boucle infinie → timeout au délai', r['status'] == 'timeout', r)
    r = run('javascript', 'console.log("encore là")'); chk('… et l\'exécution suivante fonctionne', r['stdout'] == 'encore là\n', r)
    r = run('javascript', 'for(;;) console.log("xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx")'); chk('sortie démesurée → statut « output », arrêt', r['status'] == 'output', {k: (v if k != 'stdout' else len(v)) for k, v in r.items()})
    print('== Python ==')
    r = run('python', 'print(2**10)'); chk('print (CPython en WebAssembly)', r['status'] == 'ok' and r['stdout'] == '1024\n', r)
    r = run('python', 'a=int(input());b=int(input());print(a+b)', '3\n4\n'); chk('input() lit l\'entrée standard', r['stdout'] == '7\n', r)
    r = run('python', 'print(1/0)'); chk('erreur → trace lisible, sans les lignes internes de l\'exécuteur', r['status'] == 'runtime_error' and 'ZeroDivisionError' in r['stderr'] and '__cei_run' not in r['stderr'], r)
    r = run('python', 'import sys\nprint("x")\nsys.exit(0)'); chk('sys.exit(0) → ok', r['status'] == 'ok' and r['stdout'] == 'x\n', r)
    r = run('python', 'import sys\nsys.exit(3)'); chk('sys.exit(3) → erreur', r['status'] == 'runtime_error', r)
    r = run('python', 'if __name__ == "__main__":\n    print("main")'); chk('garde __main__ respectée', r['stdout'] == 'main\n', r)
    r = run('python', 'import math, random, collections, itertools, functools, fractions, decimal, statistics, re, json\nprint(round(math.pi,3))'); chk('bibliothèque standard disponible', r['stdout'] == '3.142\n', r)
    r = run('python', 'while True: pass', '', 1500); chk('boucle infinie → timeout au délai', r['status'] == 'timeout', r)
    r = run('python', 'print("reprise")'); chk('… et Python se relance pour l\'exécution suivante', r['stdout'] == 'reprise\n', r)
    r = run('python', 'a=1\nprint(a)'); r2 = run('python', 'print("a" in dir())'); chk('variables d\'une exécution jamais visibles par la suivante', r2['stdout'] == 'False\n', r2)
    print('== Isolation (le code d\'un étudiant s\'exécute chez l\'enseignant) ==')
    JS = '''const res={};
const t=async(k,f)=>{try{await f();res[k]="FUITE"}catch(e){res[k]="bloqué"}};
await t('fetch-meme-origine',()=>fetch(location.origin+'/index.html'));
await t('fetch-exterieur',()=>fetch('https://example.com/'));
await t('xhr',()=>new Promise((ok,ko)=>{const x=new XMLHttpRequest();x.open('GET','http://127.0.0.1:%d/index.html');x.onload=ok;x.onerror=()=>ko(1);x.send()}));
await t('websocket',()=>new Promise((ok,ko)=>{const w=new WebSocket('ws://127.0.0.1:%d/');w.onopen=ok;w.onerror=()=>ko(1)}));
await t('importScripts',()=>{importScripts('http://127.0.0.1:%d/index.html')});
res.surface=[typeof document,typeof window,typeof localStorage,typeof caches].join(',');
res.origine=String(self.origin);
console.log(JSON.stringify(res));''' % (PORT, PORT, PORT)
    r = run('javascript', JS, '', 8000)
    try: j = json.loads(r['stdout'])
    except Exception: j = {}
    chk('fetch / XHR / WebSocket / importScripts vers l\'API ou l\'extérieur : tous bloqués', j and all(j[k] == 'bloqué' for k in ('fetch-meme-origine', 'fetch-exterieur', 'xhr', 'websocket', 'importScripts')), r)
    chk('aucun accès à la page, aux cookies ni au stockage ; origine « null »', j.get('surface') == 'undefined,undefined,undefined,undefined' and j.get('origine') == 'null', j)
    r = run('python', 'import urllib.request\ntry:\n    urllib.request.urlopen("http://127.0.0.1:%d/index.html"); print("FUITE")\nexcept Exception: print("bloqué")' % PORT, '', 8000); chk('Python : accès réseau impossible', r['stdout'] == 'bloqué\n', r)
    b.close()
srv.shutdown(); shutil.rmtree(D, ignore_errors=True)
print(f"\n{sum(RES)}/{len(RES)} vérifications réussies"); sys.exit(0 if all(RES) else 1)
