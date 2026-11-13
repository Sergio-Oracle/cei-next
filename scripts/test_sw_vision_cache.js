// Service worker : le cache durable des modèles de vision survit aux déploiements, ?probe= n est pas intercepté. Usage : node scripts/test_sw_vision_cache.js
const fs = require('fs'), vm = require('vm')
let ok = 0, ko = 0
const check = (n, c) => { c ? ok++ : ko++; console.log((c ? '  ✔ ' : '  ✘ ') + n) }
function load(buildId, store) {
  const handlers = {}
  const caches = {
    keys: async () => Object.keys(store), delete: async k => { delete store[k]; return true },
    open: async k => (store[k] ||= { map: new Map(), put: async function (r, v) { this.map.set(typeof r === 'string' ? r : r.url, v) }, addAll: async () => {}, match: async function (r) { return this.map.get(typeof r === 'string' ? r : r.url) } }),
    match: async r => { for (const c of Object.values(store)) { const v = c.map && c.map.get(r.url || r); if (v) return v } },
  }
  const self = { location: { origin: 'https://x.test' }, addEventListener: (t, f) => { handlers[t] = f }, skipWaiting: () => {}, clients: { claim: async () => {} } }
  const src = fs.readFileSync(require('path').join(__dirname, '..', 'public', 'sw.js'), 'utf8').replace('__BUILD_ID__', buildId)
  vm.runInNewContext(src, { self, caches, URL, fetch: async () => ({ ok: true, status: 200, headers: { get: () => 'application/octet-stream' }, clone() { return this } }), Request: class {}, Response: class {}, Promise, Set, console })
  return { handlers, caches, store }
}
;(async () => {
  const store = {}
  // 1) ancien build : caches statique + pages + vision remplis
  let sw = load('OLD', store)
  for (const k of ['cei-static-OLD', 'cei-pages-OLD', 'cei-vision-v1', 'cei-vision-v0']) await sw.caches.open(k)
  const v1 = store['cei-vision-v1']; await v1.put('https://x.test/models/mediapipe/face_landmarker.task', { id: 'modele' })
  // 2) nouveau déploiement : l'activation du nouveau service worker purge les anciens caches
  sw = load('NEW', store)
  let waited; await sw.handlers.activate({ waitUntil: p => { waited = p } }); await waited
  const keys = Object.keys(store)
  check('l\'ancien cache statique (build précédent) est purgé', !keys.includes('cei-static-OLD'))
  check('l\'ancien cache de pages est purgé', !keys.includes('cei-pages-OLD'))
  check('le cache de vision courant SURVIT au déploiement', keys.includes('cei-vision-v1'))
  check('le contenu du cache de vision est intact', store['cei-vision-v1'].map.size === 1)
  check('un ancien cache de vision (v0) est purgé', !keys.includes('cei-vision-v0'))
  // 3) interception
  const fetchEvent = (path) => { let resp; const e = { request: { method: 'GET', url: 'https://x.test' + path, headers: { has: () => false } }, respondWith: p => { resp = p } }; sw.handlers.fetch(e); return resp }
  check('un modèle en cache est servi sans réseau', (await fetchEvent('/models/mediapipe/face_landmarker.task')).id === 'modele')
  check('la mesure de débit (?probe=) n\'est PAS interceptée', fetchEvent('/models/faceapi/face_landmark_68_model-shard1?probe=1') === undefined)
  check('un fichier absent du cache est récupéré puis rangé dans le cache de vision', await (async () => { await fetchEvent('/models/yolo/yolo26n.onnx'); await new Promise(r => setTimeout(r, 20)); return store['cei-vision-v1'].map.has('https://x.test/models/yolo/yolo26n.onnx') })())
  console.log(`\n${ok}/${ok + ko} vérifications réussies`); process.exit(ko ? 1 : 0)
})()
