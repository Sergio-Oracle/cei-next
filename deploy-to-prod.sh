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

# Garde-fou (incident du 19/10/2026) : les lecteurs de sujet du serveur et du navigateur doivent lire les mêmes questions.
echo "== Garde-fou : lecteurs de sujet (serveur = navigateur) =="
if [ -x ../cei-api-v2/.venv-base/bin/python ]; then
  if ! (cd ../cei-api-v2 && .venv-base/bin/python scripts/test_parseur_sujets.py > /tmp/test_parseur_sujets.log 2>&1); then
    tail -25 /tmp/test_parseur_sujets.log
    echo "ERREUR : le test des lecteurs de sujet échoue — déploiement refusé." >&2
    exit 1
  fi
  tail -1 /tmp/test_parseur_sujets.log
else
  echo "(test des lecteurs de sujet ignoré : environnement Python local introuvable)"
fi

PROD_API_URL="https://cei.unchk.sn"
PROD_HOST="serge@196.207.246.205"   # thieboudiene, nouveau réseau depuis le 30/09 (avant : 102.36.139.24)
PROD_PORT="3120"
PROD_KEY="$HOME/.ssh/id_ed25519_unchk"
PROD_PATH="/home/serge/projet-cei/cei-next"

echo "== Build (NEXT_PUBLIC_API_URL=$PROD_API_URL, en dur, ignore .env.local) =="
# Production = préproduction (exigence du 21/10/2026) : aucun interrupteur d'interface, Moodle et Moteur RAG visibles
# comme sur la préproduction ; seule l'adresse de l'API change.
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

echo "== C-19 : allègement des commentaires internes de sw.js (artefact déployé uniquement) =="
node scripts/strip-sw-comments.js .next/standalone/public/sw.js

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

echo "== Redémarrage ROULANT des instances (une à la fois, jamais toutes ensemble) =="
# Avant : les 6 instances étaient redémarrées simultanément, d'où une coupure de
# quelques secondes. Désormais on découvre les instances sur le serveur
# (cei-next, cei-next-2, …, quel qu'en soit le nombre) et on attend que chacune
# réponde 200 avant de passer à la suivante : nginx (least_conn) sert pendant ce
# temps les instances encore en place, sans interruption visible.
ssh -i "$PROD_KEY" -p "$PROD_PORT" -o ConnectTimeout=15 "$PROD_HOST" '
  units=$(systemctl list-unit-files "cei-next*.service" --no-legend | awk "{print \$1}" | sed "s/\.service$//" | sort -V)
  [ -n "$units" ] || { echo "ERREUR : aucune instance cei-next* trouvée" >&2; exit 1; }
  for u in $units; do
    port=$(systemctl show "$u" -p Environment --value | tr " " "\n" | sed -n "s/^PORT=//p")
    sudo -n systemctl restart "$u" || { echo "ERREUR : redémarrage de $u refusé" >&2; exit 1; }
    ok=""
    for i in $(seq 1 40); do
      [ "$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$port/")" = "200" ] && { ok=1; break; }
      sleep 0.5
    done
    if [ -n "$ok" ]; then echo "  $u (port $port) -> 200"; else echo "  ERREUR : $u (port $port) ne répond pas après 20 s" >&2; exit 1; fi
  done
'

echo "== Terminé =="
echo ""
echo "!! ATTENTION : ce dossier local (.next/) contient maintenant le build de PRODUCTION"
echo "   (NEXT_PUBLIC_API_URL=$PROD_API_URL). Le service local cei-next.service sert CE dossier."
echo "   Avant de retester en local (dev-cei.ddns.net), lancez :"
echo "     cd $(dirname "$0") && npm run build && systemctl restart cei-next"
echo "   Sinon dev-cei.ddns.net appellera l'API de production (échec CORS)."
