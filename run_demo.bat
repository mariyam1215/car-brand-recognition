@echo off
rem Double-click this file to start the car brand website on your computer.
title Car Brand Recognition - local website
cd /d "%~dp0web"

set PY=
where python >nul 2>nul && set PY=python
if "%PY%"=="" where py >nul 2>nul && set PY=py
if "%PY%"=="" (
  echo.
  echo Python is not installed yet.
  echo 1. Go to https://www.python.org/downloads/ and install Python.
  echo 2. IMPORTANT: tick "Add python.exe to PATH" on the first installer screen.
  echo 3. Then double-click this file again.
  echo.
  pause
  exit /b 1
)

echo.
echo Starting the website...  Your browser will open in a moment.
echo Keep this window open while you use the site. Close it to stop.
echo.
start "" cmd /c "timeout /t 2 >nul & start http://localhost:8000"
%PY% -m http.server 8000
pause
