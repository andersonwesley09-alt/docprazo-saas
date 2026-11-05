@echo off
chcp 65001 >nul
cd /d "%~dp0"
title DocPrazo V3.1 - Servidor
where node >nul 2>&1
if errorlevel 1 (
  echo Node.js nao foi encontrado. Instale Node.js 22.13 ou superior.
  pause
  exit /b 1
)
echo =========================================================
echo   DOCPRAZO V3.1
 echo   Abra no navegador: http://localhost:3005
 echo   Para encerrar, pressione CTRL+C
 echo =========================================================
call npm start
pause
