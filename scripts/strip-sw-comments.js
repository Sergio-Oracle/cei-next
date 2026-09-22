#!/usr/bin/env node
// C-19 (audit DITSI-SSSI AVR-2026-09-CEI-AUDIT) : sw.js contenait des
// commentaires internes detailles (LiveKit, MediaPipe, incidents passes,
// strategie de deploiement) - utile pour la maintenance, mais servi tel
// quel aux navigateurs facilite la cartographie fonctionnelle par un
// attaquant. Cette passe ne touche QUE l'artefact deploye (appelee par
// deploy-to-preprod.sh / deploy-to-prod.sh apres la copie de public/ dans
// .next/standalone/), jamais public/sw.js lui-meme - build-local.sh (dev)
// continue de servir la version commentee, sans changement.
//
// Volontairement pas un vrai minifieur (pas de dependance ajoutee) : sw.js
// ne contient aucune chaine de code avec un double slash a l'interieur,
// donc un retrait de commentaires par expression reguliere est sur ici.
// Ne pas reutiliser tel quel sur un fichier qui contiendrait des URLs ou
// des chemins Windows a l'interieur de chaines.
const fs = require('fs');
const path = process.argv[2];
if (!path) {
  console.error('Usage: strip-sw-comments.js <fichier.js>');
  process.exit(1);
}
let src = fs.readFileSync(path, 'utf8');
src = src.replace(/\/\*[\s\S]*?\*\//g, '');   // blocs /* ... */
src = src.replace(/^[ \t]*\/\/.*$/gm, '');    // lignes // ...
src = src.replace(/[ \t]+\/\/.*$/gm, '');     // // ... en fin de ligne de code
src = src.replace(/\n{3,}/g, '\n\n');         // effondre les lignes vides en rafale
fs.writeFileSync(path, src.trimStart());
console.log(`sw.js allégé : ${fs.statSync(path).size} octets`);
