@echo off
setlocal EnableExtensions
cd /d "%~dp0"

echo ========================================
echo   CLUTCHER ONLINE - INICIAR
echo ========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: No se encontro Node.js.
  echo Instala Node.js LTS y vuelve a ejecutar este archivo.
  pause
  exit /b 1
)
where npm >nul 2>nul
if errorlevel 1 (
  echo ERROR: No se encontro NPM.
  echo Reinstala Node.js LTS y vuelve a ejecutar este archivo.
  pause
  exit /b 1
)

if not exist "app\node_modules\electron\electron.exe" (
  echo [1/3] Instalando Electron...
  pushd "app"
  call npm install
  if errorlevel 1 (
    popd
    echo.
    echo ERROR instalando Electron.
    pause
    exit /b 1
  )
  popd
)

if not exist "server\node_modules\ws\package.json" (
  echo [2/3] Instalando servidor online...
  pushd "server"
  call npm install
  if errorlevel 1 (
    popd
    echo.
    echo ERROR instalando el servidor online.
    pause
    exit /b 1
  )
  popd
)

echo [3/3] Iniciando servidor online...
pushd "server"
start "Clutcher Online Server" /min node server.js
popd

timeout /t 2 /nobreak >nul

echo Abriendo Clutcher...
pushd "app"
call npm start
set "ERR=%ERRORLEVEL%"
popd

if not "%ERR%"=="0" (
  echo.
  echo Clutcher se cerro con codigo %ERR%.
  pause
)
exit /b %ERR%
