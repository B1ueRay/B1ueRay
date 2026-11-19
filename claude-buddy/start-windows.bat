@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Нужен Node.js 20+ : https://nodejs.org  ^(LTS^)
  pause
  exit /b 1
)
rem Проверяем сам Electron, а не папку node_modules: прерванная установка оставляет пустышку
if not exist "node_modules\electron\dist\electron.exe" (
  echo Ставлю зависимости, это один раз...
  call npm install
  if errorlevel 1 (
    echo.
    echo Установка не удалась. Проверь интернет и запусти ещё раз.
    pause
    exit /b 1
  )
  if not exist "node_modules\electron\dist\electron.exe" (
    call node node_modules\electron\install.js
  )
  if not exist "node_modules\electron\dist\electron.exe" (
    echo.
    echo Electron не скачался. Удали папку node_modules и запусти ещё раз.
    pause
    exit /b 1
  )
)
rem Запускаем как обычную программу: консоль можно закрыть, бадди останется жить в трее
start "" "node_modules\electron\dist\electron.exe" .
