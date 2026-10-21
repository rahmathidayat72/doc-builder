# Doc-builder Local Server Launcher (PowerShell)
$ErrorActionPreference = "Stop"

Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "             DOC-BUILDER LAUNCHER                 " -ForegroundColor Cyan
Write-Host "        Resume Builder & Document Tools           " -ForegroundColor Cyan
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
    Write-Host "[INFO] Membangun bundel produksi antarmuka frontend..." -ForegroundColor Yellow
    npm --prefix frontend run build
}

# 3. Buka browser
Start-Job -ScriptBlock {
    Start-Sleep -Seconds 2
    Start-Process "http://127.0.0.1:8000"
} | Out-Null

# 4. Jalankan server
Write-Host "[INFO] Menjalankan server pada http://127.0.0.1:8000..." -ForegroundColor Green
Write-Host "[INFO] Tekan CTRL+C untuk menghentikan server.`n" -ForegroundColor Gray

& $PythonExe -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
