@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Нужен Node.js 20+ : https://nodejs.org  ^(LTS^)
  pause
  exit /b 1
)
if not exist node_modules (
  echo Ставлю зависимости, это один раз...
  call npm install
  if errorlevel 1 ( pause & exit /b 1 )
)
start "" /b cmd /c "npx electron ."
