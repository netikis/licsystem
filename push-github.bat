@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo === LICSYSTEM — Push para GitHub (dispara deploy Vercel) ===
echo Repositório: https://github.com/netikis/licsystem
echo Site:        https://licsystem.vercel.app
echo.
echo NUNCA suba: .env, chaves, EDITAIS, credenciais
echo.

where git >nul 2>&1
if errorlevel 1 (
  echo ERRO: Git nao encontrado. Instale em https://git-scm.com
  pause
  exit /b 1
)

for /f "delims=" %%B in ('git rev-parse --abbrev-ref HEAD') do set BRANCH=%%B
echo Branch atual: %BRANCH%
echo.

git status --short
echo.

set /p MSG=Mensagem do commit: 
if "%MSG%"=="" (
  echo Cancelado: informe uma mensagem de commit.
  pause
  exit /b 1
)

git add -A
git diff --cached --quiet
if not errorlevel 1 (
  echo Nada para commitar.
  pause
  exit /b 0
)

git commit -m "%MSG%"
if errorlevel 1 (
  echo ERRO: commit falhou.
  pause
  exit /b 1
)

echo.
echo Enviando para origin/%BRANCH% ...
git push -u origin %BRANCH%
if errorlevel 1 (
  echo.
  echo Push FALHOU. Se a branch remota estiver a frente, tente:
  echo   git pull origin %BRANCH% --rebase
  echo   push-github.bat
  pause
  exit /b 1
)

echo.
if /i "%BRANCH%"=="main" (
  echo OK — push em main enviado. O Vercel fara deploy automaticamente.
) else (
  echo OK — push enviado na branch %BRANCH%.
  echo Para ir a producao, faca merge em main no GitHub ou rode:
  echo   git checkout main ^&^& git merge %BRANCH% ^&^& git push origin main
)
echo.
pause
