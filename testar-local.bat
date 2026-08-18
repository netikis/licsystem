@echo off
chcp 65001 >nul
cd /d "%~dp0"
title LICSYSTEM - Teste Local
echo.
echo ========================================
echo   LICSYSTEM - Teste local do index.html
echo ========================================
echo.
echo Pasta: %CD%
echo.

where vercel >nul 2>&1
if %ERRORLEVEL%==0 goto VERCEL

where npx >nul 2>&1
if %ERRORLEVEL%==0 goto NPX

where py >nul 2>&1
if %ERRORLEVEL%==0 goto PY

where python >nul 2>&1
if %ERRORLEVEL%==0 goto PYTHON

echo [AVISO] Nao encontrei Node.js / Vercel / Python nesta maquina.
echo.
echo Opcoes:
echo  1) Instale Node.js LTS em https://nodejs.org
echo     Depois rode:  npm i -g vercel
echo     E execute de novo este arquivo (testar-local.bat)
echo.
echo  2) No Cursor: clique direito em index.html -^> Open with Live Server
echo     (testa so a tela; login/IA precisam do Vercel Dev)
echo.
pause
exit /b 1

:VERCEL
echo [OK] Usando Vercel Dev (HTML + /api + .env)
echo     Abra: http://localhost:3000
echo     Pare com Ctrl+C
echo.
start "" "http://localhost:3000"
vercel dev --listen 3000
goto END

:NPX
echo [OK] Usando npx vercel (HTML + /api + .env)
echo     Na 1a vez pode pedir login na Vercel.
echo     Abra: http://localhost:3000
echo.
start "" "http://localhost:3000"
npx --yes vercel@latest dev --listen 3000
goto END

:PY
echo [AVISO] Modo estatico com Python (sem /api local)
echo     Login Firebase e Analise IA NAO funcionam aqui.
echo     Serve so para olhar layout/menus.
echo     Abra: http://localhost:5500
echo.
start "" "http://localhost:5500"
py -m http.server 5500
goto END

:PYTHON
echo [AVISO] Modo estatico com Python (sem /api local)
echo     Login Firebase e Analise IA NAO funcionam aqui.
echo     Abra: http://localhost:5500
echo.
start "" "http://localhost:5500"
python -m http.server 5500
goto END

:END
