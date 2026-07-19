@echo off
chcp 65001 >nul
title Rifa con Causa - Servidor para celular
cd /d "%~dp0"
echo.
echo =====================================================
echo   RIFA CON CAUSA - VERSION DEFINITIVA RC1
echo =====================================================
echo.
echo El servidor se iniciara en el puerto 8080.
echo.
echo En esta computadora:
echo   Pagina publica: http://localhost:8080/app/public/
echo   Panel admin:    http://localhost:8080/app/admin/
echo.
echo En el celular, conectado al mismo Wi-Fi, abre:
echo   http://IP-DE-TU-COMPUTADORA:8080/app/public/
echo   http://IP-DE-TU-COMPUTADORA:8080/app/admin/
echo.
echo Para conocer la IP, busca "Direccion IPv4" en la ventana
echo que se abrira a continuacion.
echo.
start "" http://localhost:8080/app/public/
start "" http://localhost:8080/app/admin/
start cmd /k ipconfig
python -m http.server 8080 --bind 0.0.0.0
if errorlevel 1 (
  py -m http.server 8080 --bind 0.0.0.0
)
pause
