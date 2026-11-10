#!/bin/sh
# ✅ Brza provjera prije objave (lokalno i na GitHubu, .github/workflows/check.yml):
#   sintaksa svih skripti igre + regresijski test (tools/sim/regress.js: popravljene greške + svaka moć svakog junaka)
#   + kratka simulacija normalne i brze igre (botovi vode oba tima; pad = greška u logici igre)
#   sh tools/check.sh            (traje ~1,5 min)
set -e
cd "$(dirname "$0")/.."
for f in *.js; do node --check "$f"; done
echo "✓ sintaksa"
node tools/sim/regress.js
node tools/sim/sim.js 1 --max=240 --quiet
node tools/sim/sim.js 1 --max=180 --quiet --turbo --en
node tools/sim/sim.js 1 --max=120 --quiet --cy --lane=jungle
echo "✓ provjera prošla"
