@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Publicando Rifa con Causa RC2 en Firebase...
where firebase >nul 2>nul
if errorlevel 1 (
  echo Instalando Firebase CLI...
  npm install -g firebase-tools
)
firebase login
firebase deploy --only hosting,firestore:rules,firestore:indexes
pause
