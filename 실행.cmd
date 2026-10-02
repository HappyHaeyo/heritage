@echo off
cd /d "%~dp0"
if exist "E:\nodejs\npm.cmd" (
  call "E:\nodejs\npm.cmd" run dev
) else (
  call npm run dev
)
pause
