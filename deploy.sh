#!/bin/bash
set -e
cd "$(dirname "$0")"
npm run build
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public 2>/dev/null || true
systemctl restart cei-next
echo "Deployed — $(curl -s -o /dev/null -w '%{http_code}' http://localhost:5173/)"
