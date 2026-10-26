@echo off
echo ==============================================
echo           Starting NodeDR POS
echo ==============================================

cd /d "%~dp0"

echo [1/2] Starting Backend Server on port 4000...
start "NodeDR POS - Backend" /min cmd /c "cd /d "%~dp0backend" && node src/server.js"

echo [2/2] Starting Frontend Server on port 1994...
start "NodeDR POS - Frontend" /min cmd /c "cd /d "%~dp0frontend" && npm run dev"

echo Waiting for services to initialize...
timeout /t 4 /nobreak >nul

echo Opening POS in your browser...
start http://localhost:1994

echo ==============================================
echo NodeDR POS is running at:
echo http://localhost:1994
echo ==============================================
