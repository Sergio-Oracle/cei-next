#!/usr/bin/env node
// Abonnements LiveKit (lib/lkSubscriptions.ts) : plus de « chacun reçoit tout le monde ».
// Usage : cd cei-next && node scripts/test_lk_subscriptions.js
const { execSync } = require('child_process'), fs = require('fs'), os = require('os'), path = require('path')
const root = path.join(__dirname, '..'), out = fs.mkdtempSync(path.join(os.tmpdir(), 'lks-'))
execSync(`node_modules/.bin/tsc lib/lkSubscriptions.ts --outDir ${out} --module commonjs --target es2020 --skipLibCheck --lib es2020`, { cwd: root, stdio: 'pipe' })
const L = require(path.join(out, 'lkSubscriptions.js'))
let ok = 0, ko = 0
const check = (n, c) => { c ? ok++ : ko++; console.log((c ? '  ✔ ' : '  ✘ ') + n) }
check("l'étudiant ne s'abonne JAMAIS à un autre étudiant (ni caméra principale ni téléphone)", !L.studentShouldSubscribe('student-12') && !L.studentShouldSubscribe('student-12-phone'))
check("l'étudiant s'abonne au surveillant, à l'enseignant et aux autres rôles du personnel", ['proctor-3', 'teacher-7', 'surveillant-4', 'responsable_examen-9', 'admin-1', 'superviseur-2'].every(L.studentShouldSubscribe))
const vis = ['student-1', 'student-2']
check('le surveillant s\'abonne à la VIDÉO d\'une tuile affichée (caméra, écran = même identité)', L.monitorShouldSubscribe('student-1', 'video', vis))
check('… et à la caméra du téléphone de cette tuile', L.monitorShouldSubscribe('student-2-phone', 'video', vis))
check("… mais jamais à l'audio d'un étudiant, affiché ou non", !L.monitorShouldSubscribe('student-1', 'audio', vis) && !L.monitorShouldSubscribe('student-9', 'audio', vis))
check("… ni à la vidéo d'un étudiant dont la tuile n'est pas affichée (page suivante)", !L.monitorShouldSubscribe('student-9', 'video', vis) && !L.monitorShouldSubscribe('student-9-phone', 'video', vis))
check('le surveillant reste abonné à tout le personnel (voyants caméra/micro des collègues)', L.monitorShouldSubscribe('proctor-3', 'audio', vis) && L.monitorShouldSubscribe('teacher-7', 'video', []))
check('aucune tuile affichée : aucune vidéo d\'étudiant demandée', !L.monitorShouldSubscribe('student-1', 'video', []))
check("les alertes en direct ne vont qu'au personnel présent (pas aux 800 autres étudiants)", JSON.stringify(L.staffIdentities(['student-1', 'proctor-3', 'student-2-phone', 'teacher-7', 'student-5'])) === JSON.stringify(['proctor-3', 'teacher-7']))
check('aucun membre du personnel présent : liste vide (rien à envoyer)', L.staffIdentities(['student-1', 'student-2']).length === 0)
// ordre de grandeur : 800 étudiants, 3 pistes chacun, 12 membres du personnel
const N = 800, tracks = 3, staff = 12
const avant = N * (N - 1) * tracks + staff * N * tracks, apres = N * staff * tracks + staff * 12 * 1
check(`abonnements : ${avant.toLocaleString('fr-FR')} avant → ${apres.toLocaleString('fr-FR')} après (≥ 20 fois moins)`, avant / apres > 20)
console.log(`\n${ok}/${ok + ko} vérifications réussies`); process.exit(ko ? 1 : 0)
