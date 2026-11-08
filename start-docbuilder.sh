#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$DIR"

echo "==================================================="
echo "              DOC-BUILDER ALIAS NOTICE             "
echo "  Doc-builder kini resmi berganti nama: SATUKIT    "
echo "        Satu Tempat, Banyak Solusi Digital         "
echo "==================================================="
echo "[INFO] Meneruskan eksekusi ke ./start-satukit.sh..."
echo ""

exec "$DIR/start-satukit.sh" "$@"
