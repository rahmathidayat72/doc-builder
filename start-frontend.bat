@echo off
setlocal
title Doc-builder Frontend Dev Server
cd /d "%~dp0frontend"

echo [INFO] Menjalankan frontend dev server pada http://127.0.0.1:5173...
echo [INFO] Tekan CTRL+C untuk menghentikan server.
echo.

call npm run dev -- --host 127.0.0.1 --port 5173
pause
