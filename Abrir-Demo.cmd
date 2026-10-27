@echo off
rem PITCH — versão de apresentação. Duplo clique: compila e abre http://localhost:4180/demo
rem (sem login, dados fictícios). Para usar no telemóvel, liga-o ao mesmo Wi-Fi e abre o
rem endereço "Network" que aparece abaixo, com /demo no fim.
set "PATH=%LOCALAPPDATA%\node-portable\node-v22.12.0-win-x64;%PATH%"
cd /d "%~dp0"
call npm run demo
pause
