@echo off
chcp 65001 > nul
set PYTHONIOENCODING=utf-8
title AI Universal Assistant - JARVIS
cd /d "%~dp0"
python main.py
pause
