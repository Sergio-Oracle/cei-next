#!/usr/bin/env node
// Reconnexion à la salle de surveillance (lib/lkRetry.ts) : jamais d'abandon, délais plafonnés et étalés.
// Usage : cd cei-next && node scripts/test_lk_retry.js
const { execSync } = require('child_process'), fs = require('fs'), os = require('os'), path = require('path')
const root = path.join(__dirname, '..'), out = fs.mkdtempSync(path.join(os.tmpdir(), 'lk-'))
execSync(`node_modules/.bin/tsc lib/lkRetry.ts --outDir ${out} --module commonjs --target es2020 --skipLibCheck`, { cwd: root, stdio: 'pipe' })
const { retryDelayMs, JOIN_JITTER_MS } = require(path.join(out, 'lkRetry.js'))
let ok = 0, ko = 0
const check = (n, c) => { c ? ok++ : ko++; console.log((c ? '  ✔ ' : '  ✘ ') + n) }
check('1er nouvel essai : autour de 2 s (1,2 à 2,8 s)', retryDelayMs(1, 0) === 1200 && retryDelayMs(1, 1) === 2800)
check('le délai grandit puis se stabilise', retryDelayMs(2, 0.5) > retryDelayMs(1, 0.5) && retryDelayMs(12, 0.5) === retryDelayMs(40, 0.5))
check('plafond : jamais plus de 84 s (60 s + 40 %), même après 1000 essais', retryDelayMs(1000, 1) <= 84000 && retryDelayMs(1000, 1) >= 60000)
check('étalement : à essai égal, deux étudiants ne retombent pas au même instant (aléa ±40 %)', retryDelayMs(8, 0) < retryDelayMs(8, 1))
check('la première connexion est étalée sur 15 s', JOIN_JITTER_MS === 15000)
check('jamais de délai nul ni négatif, jamais NaN', [0, 1, 2, 5, 50].every(n => retryDelayMs(n, 0) > 0 && Number.isFinite(retryDelayMs(n))))
let total = 0; for (let n = 1; n <= 10; n++) total += retryDelayMs(n, 0.5)
check('600 étudiants qui échouent : au plus ~1 requête de jeton toutes les 60 s chacun en régime (≈ 10 req/s), pas une rafale', 600 / (retryDelayMs(100, 0.5) / 1000) < 12)
console.log(`\n${ok}/${ok + ko} vérifications réussies`); process.exit(ko ? 1 : 0)
