#!/usr/bin/env node
// Santé de la diffusion caméra/micro/écran (lib/mediaHealth.ts) : une caméra jamais publiée est détectée puis republiée.
// Usage : cd cei-next && node scripts/test_media_health.js
const { execSync } = require('child_process'), fs = require('fs'), os = require('os'), path = require('path')
const root = path.join(__dirname, '..'), out = fs.mkdtempSync(path.join(os.tmpdir(), 'mh-'))
execSync(`node_modules/.bin/tsc lib/mediaHealth.ts --outDir ${out} --module commonjs --target es2020 --skipLibCheck --lib es2020`, { cwd: root, stdio: 'pipe' })
const M = require(path.join(out, 'mediaHealth.js'))
let ok = 0, ko = 0
const check = (n, c) => { c ? ok++ : ko++; console.log((c ? '  ✔ ' : '  ✘ ') + n) }
const live = (source, kind) => ({ source, kind, track: { mediaStreamTrack: { readyState: 'live' } } })
const unk = (kind) => ({ source: 'unknown', kind, track: { mediaStreamTrack: { readyState: 'live' } } })
const dead = (source, kind) => ({ source, kind, track: { mediaStreamTrack: { readyState: 'ended' } } })
const have = { cam: true, mic: true, screen: true }
// Cas réel : l'écran est publié mais la caméra ne l'a jamais été
let m = M.missingMedia([live('screen_share', 'video'), live('microphone', 'audio')], have)
check('caméra jamais publiée (écran OK) : la caméra est à republier, pas le reste', m.cam && !m.mic && !m.screen)
m = M.missingMedia([live('camera', 'video'), live('microphone', 'audio'), live('screen_share', 'video')], have)
check('tout est publié et vivant : rien à faire', !m.cam && !m.mic && !m.screen)
m = M.missingMedia([dead('camera', 'video'), live('microphone', 'audio'), live('screen_share', 'video')], have)
check('caméra publiée mais flux source terminé : à republier', m.cam)
m = M.missingMedia([], have)
check('aucune publication : tout est à republier', m.cam && m.mic && m.screen)
m = M.missingMedia([], { cam: true, mic: false, screen: false })
check("une source que l'étudiant n'a pas (écran arrêté volontairement) n'est jamais republiée", m.cam && !m.mic && !m.screen)
m = M.missingMedia([unk('video'), unk('audio'), live('screen_share', 'video')], have)
check("piste publiée avec source « unknown » (caméra/micro) reconnue par son type : aucune republication en boucle", !m.cam && !m.mic && !m.screen)
check('publication sans piste = non saine', !M.pubIsLive({ source: 'camera', track: null }) && !M.pubIsLive(undefined))
// Vue surveillant
check("surveillant : étudiant connecté sans aucune caméra = 'absent'", M.cameraView([live('screen_share', 'video'), live('microphone', 'audio')]) === 'absent')
check("surveillant : l'écran partagé n'est jamais pris pour la caméra", M.cameraView([live('screen_share', 'video')]) === 'absent')
check("surveillant : caméra reçue = 'ok'", M.cameraView([live('camera', 'video')]) === 'ok')
check("surveillant : caméra publiée mais coupée = 'muted'", M.cameraView([{ source: 'camera', kind: 'video', isMuted: true, track: null }]) === 'muted')
check("surveillant : caméra publiée mais flux non arrivé = 'not_received'", M.cameraView([{ source: 'camera', kind: 'video', isMuted: false, track: null }]) === 'not_received')
// Anti-harcèlement
check('première demande autorisée, puis pause de 25 s', M.shouldAskRepublish(undefined, 1000) && !M.shouldAskRepublish(1000, 20000) && M.shouldAskRepublish(1000, 27000))
check('type de message stable', M.REQUEST_MEDIA_KIND === 'proctor_request_media')
console.log(`\n${ok} vérifications réussies, ${ko} échec(s)`)
process.exit(ko ? 1 : 0)
