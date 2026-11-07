@echo off
setlocal
title Doc-builder Backend Dev Server
cd /d "%~dp0"

set "PYTHONPATH=%~dp0backend;%PYTHONPATH%"
echo [INFO] Menjalankan backend dev server pada http://127.0.0.1:8000...
echo [INFO] Tekan CTRL+C untuk menghentikan server.
echo.

backend\.venv\Scripts\python.exe -m uvicorn app.main:app --app-dir backend --reload --host 127.0.0.1 --port 8000
pause
