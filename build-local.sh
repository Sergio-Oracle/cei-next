#!/bin/bash
# Build local complet pour dev-cei.ddns.net (ce serveur), à utiliser à la
# place d'un simple `npm run build` — sans ça, `.next/standalone/` (ce que
# servent réellement les 6 cei-next*.service, WorkingDirectory=/root/cei-next)
# reste sans ses fichiers statiques (public/, .next/static/) : chunks JS en
# 404, sw.js introuvable. Erreur commise le 05/09, ne plus refaire.
# Topologie (6 instances 5175-5180 derrière nginx, comme en prod) : voir
# ../cei-api-v2/DEPLOYMENT.md
set -euo pipefail
cd "$(dirname "$0")"

echo "== Build (NEXT_PUBLIC_API_URL depuis .env.local) =="
npm run build

echo "== Assemblage de l'artefact standalone (local) =="
rm -rf .next/standalone/.next/static .next/standalone/public
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public
BUILD_ID=$(cat .next/BUILD_ID)
sed -i "s/__BUILD_ID__/$BUILD_ID/" .next/standalone/public/sw.js
echo "BUILD_ID=$BUILD_ID"

echo "== Redémarrage local (6 instances, comme en prod) =="
NEXT_UNITS="cei-next cei-next-2 cei-next-3 cei-next-4 cei-next-5 cei-next-6"
systemctl restart $NEXT_UNITS
sleep 3
systemctl is-active $NEXT_UNITS

echo "== Vérification =="
for p in 5175 5176 5177 5178 5179 5180; do
  echo "  instance :$p -> $(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:$p/login)"
done
curl -s -o /dev/null -w "login page: %{http_code}\n" https://dev-cei.ddns.net/login
curl -s -o /dev/null -w "sw.js: %{http_code}\n" https://dev-cei.ddns.net/sw.js
echo "== Terminé =="
