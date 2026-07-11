#!/bin/bash
set -e
cd "$(dirname "$0")"
npm run build
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public 2>/dev/null || true
# Injecte le build ID dans le service worker déployé pour invalider les caches PWA
# des clients à chaque déploiement (sinon un téléphone peut garder en cache une page
# qui référence des chunks JS supprimés par ce build -> app cassée sur mobile).
BUILD_ID=$(cat .next/BUILD_ID)
sed -i "s/__BUILD_ID__/$BUILD_ID/" .next/standalone/public/sw.js
systemctl restart cei-next
echo "Deployed (build $BUILD_ID) — $(curl -s -o /dev/null -w '%{http_code}' http://localhost:5173/)"
