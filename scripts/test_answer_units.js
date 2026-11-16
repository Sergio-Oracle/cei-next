#!/usr/bin/env node
// Compteur de progression de l'étudiant (lib/answerUnits.ts) : des RÉPONSES, pas des blocs.
// Usage : cd cei-next && node scripts/test_answer_units.js
const { execSync } = require('child_process'), fs = require('fs'), os = require('os'), path = require('path')
const root = path.join(__dirname, '..'), out = fs.mkdtempSync(path.join(os.tmpdir(), 'au-'))
execSync(`node_modules/.bin/tsc lib/answerUnits.ts --outDir ${out} --module commonjs --target es2020 --skipLibCheck`, { cwd: root, stdio: 'pipe' })
const { answerUnits, answeredUnits, totalUnits, totalAnswered } = require(path.join(out, 'answerUnits.js'))
let ok = 0, ko = 0
const check = (n, c) => { c ? ok++ : ko++; console.log((c ? '  ✔ ' : '  ✘ ') + n) }
const items = n => Array.from({ length: n }, (_, i) => ({ i }))
// sujet « Épreuve de synthèse » : 15 QCM + 10 V/F + 2 associations de 8 paires + 10 trous d'un champ = 51 réponses attendues
const blocks = [
  ...Array.from({ length: 15 }, (_, i) => ({ type: 'qcm', num: i + 1 })),
  ...Array.from({ length: 10 }, (_, i) => ({ type: 'vf', num: 16 + i })),
  { type: 'association', num: 26, items: items(8) },
  ...Array.from({ length: 10 }, (_, i) => ({ type: 'cloze', num: 27 + i, items: items(1) })),
  { type: 'association', num: 37, items: items(8) },
]
check('37 blocs mais 51 réponses attendues (comme le dit le sujet)', blocks.length === 37 && totalUnits(blocks) === 51)
check('rien de répondu -> 0', totalAnswered(blocks, {}) === 0)
const a = { pq_1: 'B', pq_16: 'Vrai', pq_26_0: 'E', pq_26_1: 'H', pq_26_2: '', pq_27_0: 'dedans', pq_37_7: 'F' }
check('QCM, V/F, 2 paires d\'association, 1 trou, 1 paire de la 2e association = 6 réponses (une paire vide ne compte pas)', totalAnswered(blocks, a) === 6, totalAnswered(blocks, a))
const full = {}
blocks.forEach(b => { if (b.items) b.items.forEach((_, i) => { full[`pq_${b.num}_${i}`] = 'x' }); else full[`pq_${b.num}`] = 'x' })
check('tout répondu -> 51 / 51', totalAnswered(blocks, full) === 51)
check('appariement : une réponse par paire', answerUnits({ type: 'appariement', num: 1, pairs: items(5) }) === 5 && answeredUnits({ type: 'appariement', num: 1, pairs: items(5) }, { pq_1_0: 'a', pq_1_4: 'b' }) === 2)
check('question ouverte : 1 réponse, comptée seulement si non vide', answerUnits({ type: 'open', num: 3 }) === 1 && answeredUnits({ type: 'open', num: 3 }, { pq_3: '   ' }) === 0 && answeredUnits({ type: 'open', num: 3 }, { pq_3: 'texte' }) === 1)
check('sous-questions : 1 réponse dès qu\'une lettre est remplie', answeredUnits({ type: 'subopen', num: 4, choices: [{ letter: 'a' }, { letter: 'b' }] }, { pq_4_b: 'x' }) === 1)
check('bloc sans champ (items absents) : au moins 1 réponse attendue, jamais 0', answerUnits({ type: 'cloze', num: 9 }) === 1 && answerUnits({ type: 'association', num: 9, items: [] }) === 1)
console.log(`\n${ok}/${ok + ko} vérifications réussies`); process.exit(ko ? 1 : 0)
