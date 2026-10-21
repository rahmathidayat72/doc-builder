#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$DIR"

echo "==================================================="
echo "             DOC-BUILDER LAUNCHER                 "
echo "        Resume Builder & Document Tools           "
echo "==================================================="
echo ""

# 1. Cari Python virtual environment atau binary sistem
if [ -f "$DIR/backend/.venv/bin/python" ]; then
    PYTHON_EXE="$DIR/backend/.venv/bin/python"
elif command -v python3 >/dev/null 2>&1; then
    PYTHON_EXE="python3"
elif command -v python >/dev/null 2>&1; then
    PYTHON_EXE="python"
else
    echo "[ERROR] Python tidak ditemukan di sistem!"
    exit 1
fi

# 2. Cek frontend dist
if [ ! -f "$DIR/frontend/dist/index.html" ]; then
    echo "[INFO] Membangun bundel produksi frontend..."
    npm --prefix frontend run build
fi

# 3. Buka browser di background
(
    sleep 2
    if command -v xdg-open >/dev/null 2>&1; then
        xdg-open "http://127.0.0.1:8000" >/dev/null 2>&1
    elif command -v open >/dev/null 2>&1; then
        open "http://127.0.0.1:8000" >/dev/null 2>&1
    fi
) &

# 4. Jalankan server
echo "[INFO] Menjalankan server pada http://127.0.0.1:8000..."
echo "[INFO] Tekan CTRL+C untuk menghentikan server."
echo ""
"$PYTHON_EXE" -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
