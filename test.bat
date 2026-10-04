@echo off
title Full Count - Run Unit Tests
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0run-tests.ps1"
echo.
pause
