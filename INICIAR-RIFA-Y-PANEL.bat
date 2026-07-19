@echo off
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel%==0 (
  start "Servidor Rifa" cmd /k py -m http.server 8000
) else (
  where python >nul 2>nul
  if %errorlevel%==0 (
    start "Servidor Rifa" cmd /k python -m http.server 8000
  ) else (
    echo No se encontro Python. Instala Python o activa Firebase para sincronizar datos.
    pause
    exit /b
  )
)
timeout /t 2 >nul
start http://localhost:8000/app/public/index.html
start http://localhost:8000/app/admin/index.html
