# Doc-builder Compatibility Launcher (PowerShell)
Write-Host "===================================================" -ForegroundColor Yellow
Write-Host "              DOC-BUILDER ALIAS NOTICE             " -ForegroundColor Yellow
Write-Host "  Doc-builder kini resmi berganti nama: SATUKIT    " -ForegroundColor Cyan
Write-Host "        Satu Tempat, Banyak Solusi Digital         " -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Yellow
Write-Host "[INFO] Meneruskan eksekusi ke start-satukit.ps1...`n" -ForegroundColor Gray

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
& (Join-Path $ScriptDir "start-satukit.ps1")
