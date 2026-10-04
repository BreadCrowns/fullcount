@echo off
title Full Count - Local Development Server
cd /d "%~dp0"
echo Starting Full Count local development server...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve.ps1"
pause
