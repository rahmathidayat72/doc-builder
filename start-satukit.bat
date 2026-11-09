@echo off
setlocal
title Satukit Local Server

echo ===================================================
echo                 SATUKIT LAUNCHER
echo         Satu Tempat, Banyak Solusi Digital
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
    echo [INFO] Membangun bundel produksi antarmuka Satukit...
    call npm --prefix frontend run build
    if errorlevel 1 (
        echo [ERROR] Gagal membangun frontend dist! Pastikan Node.js dan npm terpasang.
        pause
        exit /b 1
    )
)

:: 2.5 Cek model AI U2NetP untuk fitur Hapus Latar Belakang Foto
if exist "backend\models\u2netp.onnx" goto :model_ready
echo [INFO] Mengunduh model AI U2NetP untuk fitur Hapus Latar Belakang Foto 4.3 MB...
"%PYTHON_EXE%" -c "import urllib.request, os; os.makedirs('backend/models', exist_ok=True); urllib.request.urlretrieve('https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2netp.onnx', 'backend/models/u2netp.onnx')"
:model_ready

:: 3. Buka browser secara otomatis setelah jeda singkat
start "" cmd /c "timeout /t 2 /nobreak >nul && start http://127.0.0.1:8000"

:: 4. Jalankan backend server FastAPI Satukit
echo [INFO] Menjalankan backend server Satukit pada http://127.0.0.1:8000...
echo [INFO] Tekan CTRL+C untuk menghentikan server.
echo.
set "PYTHONPATH=%~dp0backend;%PYTHONPATH%"
"%PYTHON_EXE%" -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
pause
