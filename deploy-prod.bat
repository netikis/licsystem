@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo === LICSYSTEM — deploy produção (Vercel CLI) ===
echo Nao use "Upload files" no GitHub com pasta api/ inteira.
echo NUNCA suba: .env, chaves, EDITAIS, extract-itens.js, chat-editais.js, firebase-config.js
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo ERRO: Node.js nao encontrado. Instale em https://nodejs.org
  pause
  exit /b 1
)

echo Contando funcoes api\*.js ...
set COUNT=0
for %%F in (api\*.js) do set /a COUNT+=1
echo Funcoes: %COUNT%  (Hobby max 12)
if %COUNT% GTR 12 (
  echo ERRO: mais de 12 APIs — o deploy Hobby vai falhar.
  pause
  exit /b 1
)

echo.
echo Publicando...
call npx --yes vercel --prod --yes
if errorlevel 1 (
  echo.
  echo Deploy FALHOU. Veja a mensagem acima.
  pause
  exit /b 1
)

echo.
echo OK — https://licsystem.vercel.app
echo Dica: Ctrl+F5 no navegador apos o deploy.
pause
