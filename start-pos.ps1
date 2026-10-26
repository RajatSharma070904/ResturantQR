Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "          Starting NodeDR POS" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan

$root = $PSScriptRoot
Set-Location $root

Write-Host "[1/2] Starting Backend Server on port 4000..." -ForegroundColor Yellow
Start-Process -FilePath "cmd.exe" -ArgumentList "/c cd /d `"$root\backend`" && node src/server.js" -WindowStyle Minimized

Write-Host "[2/2] Starting Frontend Server on port 1994..." -ForegroundColor Yellow
Start-Process -FilePath "cmd.exe" -ArgumentList "/c cd /d `"$root\frontend`" && npm run dev" -WindowStyle Minimized

Start-Sleep -Seconds 4
Write-Host "Opening http://localhost:1994 in browser..." -ForegroundColor Green
Start-Process "http://localhost:1994"

Write-Host "NodeDR POS is running at http://localhost:1994" -ForegroundColor Cyan
