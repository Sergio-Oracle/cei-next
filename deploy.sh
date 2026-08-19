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
# 4 instances derrière nginx (voir /etc/nginx/sites-available/cei,
# upstream cei_next_upstream) — toutes partagent ce même répertoire de build,
# il faut toutes les redémarrer sous peine de laisser certaines servir
# l'ancien code selon l'instance sur laquelle nginx route la requête.
systemctl restart cei-next cei-next-2 cei-next-3 cei-next-4
sleep 2
echo "Deployed (build $BUILD_ID)"
for p in 5175 5176 5177 5178; do
  echo "  port $p -> $(curl -s -o /dev/null -w '%{http_code}' http://localhost:$p/)"
done
