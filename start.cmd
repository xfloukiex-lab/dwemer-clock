@echo off
rem ES modules cannot load over file:// - always serve over http.
cd /d "%~dp0"
start "" http://localhost:8128/
python -m http.server 8128
