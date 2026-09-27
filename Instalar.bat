@echo off
cd /d "%~dp0"
where node >nul 2>nul || (echo ERROR: Instala Node.js LTS primero.&pause&exit /b 1)
call npm install
if errorlevel 1 (echo ERROR: No se pudo instalar ws.&pause&exit /b 1)
echo Servidor listo.
pause
