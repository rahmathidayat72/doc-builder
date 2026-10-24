@echo off
setlocal
title Doc-builder Local Server

echo ===================================================
echo             DOC-BUILDER LAUNCHER
echo        Resume Builder & Document Tools
echo ===================================================
echo.

cd /d "%~dp0"

:: 1. Tentukan executable Python
set "PYTHON_EXE=backend\.venv\Scripts\python.exe"
if not exist "%PYTHON_EXE%" (
    set "PYTHON_EXE=python"
)

:: 2. Cek apakah bundel frontend telah di-build
if not exist "frontend\dist\index.html" (
    echo [INFO] Membangun bundel produksi antarmuka frontend...
    call npm --prefix frontend run build
    if errorlevel 1 (
        echo [ERROR] Gagal membangun frontend dist! Pastikan Node.js dan npm terpasang.
        pause
        exit /b 1
    )
)

:: 3. Buka browser secara otomatis setelah jeda singkat
start "" cmd /c "timeout /t 2 /nobreak >nul && start http://127.0.0.1:8000"

:: 4. Jalankan backend server FastAPI
echo [INFO] Menjalankan backend server pada http://127.0.0.1:8000...
echo [INFO] Tekan CTRL+C untuk menghentikan server.
echo.
set "PYTHONPATH=%~dp0backend;%PYTHONPATH%"
"%PYTHON_EXE%" -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
pause
