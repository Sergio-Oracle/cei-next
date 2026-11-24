#!/usr/bin/env node
// Tests d'une question de code (lib/codeTests.ts) : même comparaison que le serveur (services/question_types.py), programmes d'appel / entrée standard.
// Usage : cd cei-next && node scripts/test_code_tests.js
const { execSync } = require('child_process'), fs = require('fs'), os = require('os'), path = require('path')
const root = path.join(__dirname, '..'), out = fs.mkdtempSync(path.join(os.tmpdir(), 'ct-'))
execSync(`node_modules/.bin/tsc lib/codeTests.ts --outDir ${out} --module commonjs --target es2020 --skipLibCheck`, { cwd: root, stdio: 'pipe' })
const { normalizeOutput, programFor, verdict, isRunnable, STATUS_TEXT } = require(path.join(out, 'codeTests.js'))
let ok = 0, ko = 0
const check = (n, c, d) => { c ? ok++ : ko++; console.log((c ? '  ✔ ' : '  ✘ ') + n + (c || d === undefined ? '' : '  — ' + JSON.stringify(d))) }

check('fins de ligne et espaces de fin ignorés', normalizeOutput('7  \r\n\n\n') === '7')
check('deux lignes ≠ une ligne', normalizeOutput('a\nb') !== normalizeOutput('a b'))
check('lignes vides internes conservées', normalizeOutput('a\n\nb\n') === 'a\n\nb')
const t1 = { n: 1, kind: 'stdin', input: '3 4', expected: '7' }
check("entrée standard : retour à la ligne final ajouté, programme inchangé", (p => p.stdin === '3 4\n' && p.program === 'CODE')(programFor('CODE', t1)))
check("entrée vide : rien à fournir", programFor('X', { ...t1, input: '' }).stdin === '')
check("appel : l'expression est ajoutée APRÈS le code, sans entrée", (p => p.stdin === '' && p.program === 'def f(): pass\nprint(f())\n')(programFor('def f(): pass  \n\n', { n: 1, kind: 'call', input: 'print(f())', expected: '' })))
check('verdict : sortie juste → réussi', verdict(t1, 'ok', '7\n').ok === true)
check('verdict : sortie fausse → échec', verdict(t1, 'ok', '8').ok === false)
check('verdict : délai dépassé → échec même avec la bonne sortie', verdict(t1, 'timeout', '7').ok === false)
check('verdict : erreur d’exécution → échec', verdict(t1, 'runtime_error', '7').ok === false)
check('langages exécutables : Python et JavaScript seulement', isRunnable('python') && isRunnable('javascript') && !isRunnable('java') && !isRunnable('c') && !isRunnable('cpp'))
check("messages montrés à l'étudiant : jamais de terme technique", Object.values(STATUS_TEXT).every(t => !/stderr|stdout|exception|traceback|wasm|worker|null|undefined/i.test(t)), STATUS_TEXT)
console.log(`\n${ok}/${ok + ko} vérifications réussies`)
process.exit(ko ? 1 : 0)
