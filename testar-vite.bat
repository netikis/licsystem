@echo off
chcp 65001 >nul
cd /d "%~dp0"
title LICSYSTEM - Vite / Teste Local
echo.
echo ========================================
echo   LICSYSTEM - Vite (dev / build / preview)
echo ========================================
echo.
echo Pasta: %CD%
echo.

where npm >nul 2>&1
if %ERRORLEVEL% NEQ 0 goto NO_NODE

if not exist "node_modules\vite" (
  echo [1/2] Instalando dependencias (npm install)...
  call npm install
  if %ERRORLEVEL% NEQ 0 (
    echo [ERRO] npm install falhou.
    pause
    exit /b 1
  )
)

echo.
echo Escolha o modo:
echo   1 - Dev  (vite) ............ http://localhost:5173
echo   2 - Build + Preview ........ gera dist/ e abre preview
echo   3 - So Build ............... so gera pasta dist/
echo.
set /p OPT="Opcao [1]: "
if "%OPT%"=="" set OPT=1
if "%OPT%"=="2" goto BUILD_PREVIEW
if "%OPT%"=="3" goto BUILD_ONLY

echo.
echo [OK] Vite Dev — frontend com hot reload
echo     Login Firebase usa VITE_FIREBASE_* do .env
echo     Rotas /api: rode em outro terminal: npm run dev:api
echo     Abra: http://localhost:5173
echo.
start "" "http://localhost:5173"
call npm run dev
goto END

:BUILD_PREVIEW
echo.
echo [OK] Build (minify/ofuscacao) + Preview
call npm run build
if %ERRORLEVEL% NEQ 0 (
  echo [ERRO] Build falhou.
  pause
  exit /b 1
)
echo.
echo Pasta gerada: dist\
echo Preview: http://localhost:4173
echo.
start "" "http://localhost:4173"
call npm run preview
goto END

:BUILD_ONLY
echo.
echo [OK] Apenas build → pasta dist\
call npm run build
if %ERRORLEVEL% NEQ 0 (
  echo [ERRO] Build falhou.
  pause
  exit /b 1
)
echo.
echo Concluido. Confira a pasta dist\ (JS minificado com hash).
pause
goto END

:NO_NODE
echo [AVISO] Node.js / npm nao encontrados nesta maquina.
echo.
echo Instale o Node.js LTS: https://nodejs.org
echo Depois feche e abra de novo o terminal e rode este .bat
echo   ou execute:
echo     npm install
echo     npm run build
echo     npm run preview
echo.
pause
exit /b 1

:END
