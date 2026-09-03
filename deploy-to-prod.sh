#!/bin/bash
# Construit ce dépôt localement puis envoie UNIQUEMENT l'artefact
# .next/standalone/ vers thieboudiene (production réelle, cei.unchk.sn) —
# jamais le code source, jamais un `npm run build` exécuté sur le serveur.
#
# Existe précisément pour éliminer le risque signalé par l'utilisateur le
# 03/09 : ce dépôt sert AUSSI à mon propre serveur de vérification locale
# (dev-cei.ddns.net, via .env.local -> NEXT_PUBLIC_API_URL=dev-cei.ddns.net),
# donc un simple `npm run build` sans ce script prend par défaut l'URL de
# DEV — correct pour la vérification locale habituelle, mais faux si envoyé
# tel quel vers la vraie production (c'est exactement ce qui a cassé la
# connexion en direct ce jour-là : URL de dev figée dans le JS envoyé au
# navigateur, aucun moyen de la corriger après coup côté serveur).
#
# Ce script ne dépend d'AUCUN fichier .env ambiant pour l'URL de prod — elle
# est écrite en dur juste en dessous, donc ce script ne peut pas se tromper
# de la même façon, quel que soit l'état de .env.local à ce moment-là.
set -euo pipefail
cd "$(dirname "$0")"

PROD_API_URL="https://cei.unchk.sn"
PROD_HOST="serge@102.36.139.24"
PROD_PORT="3120"
PROD_KEY="$HOME/.ssh/id_ed25519_unchk"
PROD_PATH="/home/serge/projet-cei/cei-next"

echo "== Build (NEXT_PUBLIC_API_URL=$PROD_API_URL, en dur, ignore .env.local) =="
NEXT_PUBLIC_API_URL="$PROD_API_URL" npm run build

echo "== Garde-fou : vérifier qu'aucune URL de dev n'a fui dans le build =="
if grep -rl "dev-cei.ddns.net" .next/static/ >/dev/null 2>&1; then
  echo "ERREUR : dev-cei.ddns.net trouvé dans .next/static/ — build refusé, ne pas déployer." >&2
  exit 1
fi
if ! grep -rl "$PROD_API_URL" .next/static/ >/dev/null 2>&1; then
  echo "ERREUR : $PROD_API_URL introuvable dans .next/static/ — build suspect, ne pas déployer." >&2
  exit 1
fi
echo "OK — build propre."

echo "== Assemblage de l'artefact standalone =="
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public
BUILD_ID=$(cat .next/BUILD_ID)
sed -i "s/__BUILD_ID__/$BUILD_ID/" .next/standalone/public/sw.js
echo "BUILD_ID=$BUILD_ID"

echo "== Envoi vers thieboudiene (rsync, artefact seul, pas le code source) =="
rsync -az --delete -e "ssh -i $PROD_KEY -p $PROD_PORT -o ConnectTimeout=15" \
  .next/standalone/ "$PROD_HOST:$PROD_PATH/.next/standalone/"

echo "== Garde-fou : re-vérifier sur le serveur lui-même après transfert =="
ssh -i "$PROD_KEY" -p "$PROD_PORT" -o ConnectTimeout=15 "$PROD_HOST" "
  if grep -rl 'dev-cei.ddns.net' '$PROD_PATH/.next/standalone/.next/static/' >/dev/null 2>&1; then
    echo 'ERREUR CRITIQUE : dev-cei.ddns.net présent sur le serveur après transfert — redémarrage ANNULÉ.' >&2
    exit 1
  fi
  echo 'OK — vérifié sur le serveur, aucune URL de dev.'
"

echo "== Redémarrage des 6 instances =="
ssh -i "$PROD_KEY" -p "$PROD_PORT" -o ConnectTimeout=15 "$PROD_HOST" \
  "sudo -n systemctl restart cei-next cei-next-2 cei-next-3 cei-next-4 cei-next-5 cei-next-6"
sleep 3

echo "== Vérification des 6 ports =="
ssh -i "$PROD_KEY" -p "$PROD_PORT" -o ConnectTimeout=15 "$PROD_HOST" '
  for p in 5175 5176 5177 5178 5179 5180; do
    echo "  port $p -> $(curl -s -o /dev/null -w "%{http_code}" http://localhost:$p/)"
  done
'
echo "== Terminé =="
