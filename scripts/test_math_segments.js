#!/usr/bin/env node
// Formules dans les énoncés et les réponses (lib/mathSegments.ts) : découpage \( \) \[ \] $$ $, puces, lecture des nombres ; et rendu KaTeX réel des formules du sujet de la capture du 24/11/2026.
// Usage : cd cei-next && node scripts/test_math_segments.js
const { execSync } = require('child_process'), fs = require('fs'), os = require('os'), path = require('path')
const root = path.join(__dirname, '..'), out = fs.mkdtempSync(path.join(os.tmpdir(), 'math-'))
execSync(`node_modules/.bin/tsc lib/mathSegments.ts --outDir ${out} --module commonjs --target es2020 --skipLibCheck`, { cwd: root, stdio: 'pipe' })
const { splitMath, hasMath, insideMath, bulletize, parseNumberFr, splitNumberUnit } = require(path.join(out, 'mathSegments.js'))
const katex = require(path.join(root, 'node_modules/katex'))
let ok = 0, ko = 0
const check = (n, c, d) => { c ? ok++ : ko++; console.log((c ? '  ✔ ' : '  ✘ ') + n + (c || d === undefined ? '' : '  — ' + JSON.stringify(d))) }
const kinds = t => splitMath(t).map(s => s.kind[0] + (s.display ? 'D' : '')).join('')

console.log('== Découpage ==')
check('texte sans formule : un seul segment texte', kinds('Calculez la somme.') === 't')
check('\\( … \\) : formule dans la ligne', kinds('Soit \\(x^2\\) positif') === 'tmt' && splitMath('Soit \\(x^2\\) positif')[1].value === 'x^2')
check('\\[ … \\] et $$ … $$ : formule en bloc', kinds('a \\[x\\] b') === 'tmDt' && kinds('a $$x$$ b') === 'tmDt')
const cap = "Calculez l'intégrale \\(I=\\displaystyle\\int_{0}^{\\,3} e^{\\,3x}\\,dx\\)."
check("énoncé de la capture (calcul à variables) : 1 formule entre deux textes", kinds(cap) === 'tmt', splitMath(cap).map(s => s.kind))
const dir = '* définit les sommes de Darboux pour \\(g(x)=\\begin{cases}1 & x\\in\\mathbb{Q}\\\\0 & x\\notin\\mathbb{Q}\\end{cases}\\),'
check('énoncé de la capture (cases, \\\\, \\mathbb) : une seule formule, virgule finale en texte', kinds(dir) === 'tmt' && splitMath(dir)[2].value === ',', splitMath(dir).map(s => s.value))
check('$ … $ seulement si LaTeX (\\ ^ _ { })', kinds('soit $x^2$ ici') === 'tmt' && kinds('soit $\\alpha$ ici') === 'tmt')
check('« 5 $ et 6 $ » : jamais une formule', kinds('Il paie 5 $ et 6 $ au total') === 't')
check('« $x$ » sans signe LaTeX : reste du texte', kinds('la variable $x$ ici') === 't')
check('formule vide ignorée', kinds('a \\(  \\) b') === 't')
check('plusieurs formules', kinds('\\(a\\) et \\(b\\) et \\[c\\]') === 'mtmtmD')
check('les positions couvrent tout le texte, sans trou', (() => { const t = 'A \\(x\\) B $$y$$ C'; const s = splitMath(t); return s.map(x => x.raw).join('') === t && s[0].start === 0 && s[s.length - 1].end === t.length })())
check('hasMath / insideMath', hasMath('a \\(x\\)') && !hasMath('a b') && insideMath('a \\(xy\\) b', 5) && !insideMath('a \\(xy\\) b', 1) && !insideMath('a \\(xy\\) b', 9))
check('les astérisques DANS une formule ne sont pas touchés', splitMath('\\(a*b\\)')[0].value === 'a*b')

console.log('\n== Puces ==')
check('« * item » devient « • item »', bulletize('* définit les sommes') === '• définit les sommes')
check('« * » au milieu du texte : inchangé', bulletize('2 * 3') === '2 * 3' && bulletize('a* b') === 'a* b')

console.log('\n== Lecture d\'un nombre (identique au serveur) ==')
const num = (s, v) => check(`« ${s} » → ${v}`, parseNumberFr(s) === v, parseNumberFr(s))
num('12,5', 12.5); num('1 250.75', 1250.75); num('−3', -3); num('  7 ', 7); num('2,5e3', 2500); num('abc', null); num('', null); num('-', null); num('12 m', 12); num('1.000,5', null)

check('« 5,5 kW » → 5,5 + unité kW', JSON.stringify(splitNumberUnit('5,5 kW')) === '{"value":5.5,"unit":"kW"}')
check('« 12 » → sans unité ; « abc » → rien', splitNumberUnit('12').unit === null && splitNumberUnit('abc').value === null)
check('« 5 eV » : l\'unité eV, pas un exposant ; « 2,5e3 W » = 2500 W', splitNumberUnit('5 eV').unit === 'eV' && splitNumberUnit('2,5e3 W').value === 2500)
console.log('\n== Rendu KaTeX réel ==')
const render = (l, d) => katex.renderToString(l, { displayMode: d, throwOnError: true, strict: 'ignore', trust: false, output: 'htmlAndMathml', maxExpand: 1000 })
check("intégrale de la capture rendue", render('I=\\displaystyle\\int_{0}^{\\,3} e^{\\,3x}\\,dx', false).includes('katex'))
check('définition par cas (cases + \\mathbb) rendue', render('g(x)=\\begin{cases}1 & x\\in\\mathbb{Q}\\\\0 & x\\notin\\mathbb{Q}\\end{cases}', false).includes('katex'))
check('sommes de Darboux (\\sum, \\inf, \\sup) rendues', render('U(f,P)=\\sum_{i=1}^{n} M_i\\,\\Delta x_i,\\quad \\sup_{x\\in[a,b]} f(x)', false).includes('katex'))
let bad = false; try { render('\\frac{1}{', false) } catch { bad = true }
check('formule invalide : exception (le composant affiche alors le texte tel qu\'écrit)', bad)
check('KaTeX n\'exécute rien venant du texte (<script> échappé, \\href refusé)', !/<script/i.test(render('\\text{<script>alert(1)</script>}', false)) && (() => { try { return !/href="javascript/i.test(render('\\href{javascript:alert(1)}{x}', false)) } catch { return true } })())
let t0 = Date.now(); let boom = false; try { render('\\def\\a{\\a\\a}\\a', false) } catch { boom = true }
check('macro récursive : bornée (maxExpand), pas de blocage', boom && Date.now() - t0 < 2000, Date.now() - t0)
console.log(`\n${ok}/${ok + ko} vérifications réussies`); process.exit(ko ? 1 : 0)
