@echo off
title Gridly-Desktop Auto-Sync
echo Starting Auto-Sync Script...
powershell -ExecutionPolicy Bypass -File "%~dp0autosync.ps1"
pause
