# Satukit Local Server Launcher (PowerShell)
$ErrorActionPreference = "Stop"

Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "                SATUKIT LAUNCHER                   " -ForegroundColor Cyan
Write-Host "        Satu Tempat, Banyak Solusi Digital         " -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host ""

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

# 1. Tentukan Python
$PythonExe = Join-Path $ScriptDir "backend\.venv\Scripts\python.exe"
if (-not (Test-Path $PythonExe)) {
    $PythonExe = "python"
}

# 2. Cek frontend dist
$IndexHtml = Join-Path $ScriptDir "frontend\dist\index.html"
if (-not (Test-Path $IndexHtml)) {
    Write-Host "[INFO] Membangun bundel produksi antarmuka Satukit..." -ForegroundColor Yellow
    npm --prefix frontend run build
}

# 2.5 Cek model AI U2NetP
$ModelFile = Join-Path $ScriptDir "backend\models\u2netp.onnx"
if (-not (Test-Path $ModelFile)) {
    Write-Host "[INFO] Mengunduh model AI U2NetP untuk fitur Hapus Latar Belakang Foto (4.3 MB)..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Force -Path (Join-Path $ScriptDir "backend\models") | Out-Null
    Invoke-WebRequest -Uri "https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2netp.onnx" -OutFile $ModelFile
}

# 3. Buka browser
Start-Job -ScriptBlock {
    Start-Sleep -Seconds 2
    Start-Process "http://127.0.0.1:8000"
} | Out-Null

# 4. Jalankan server
Write-Host "[INFO] Menjalankan server Satukit pada http://127.0.0.1:8000..." -ForegroundColor Green
Write-Host "[INFO] Tekan CTRL+C untuk menghentikan server.`n" -ForegroundColor Gray

$env:PYTHONPATH = "$ScriptDir\backend;" + $env:PYTHONPATH
& $PythonExe -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
