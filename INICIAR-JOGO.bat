@echo off
setlocal
cd /d "%~dp0"
title Brumaria Elo dos Dragoes - Servidor do Jogo
where py >nul 2>&1
if %errorlevel%==0 (
    py -3 start_game.py
    goto end
)
where python >nul 2>&1
if %errorlevel%==0 (
    python start_game.py
    goto end
)
echo ERRO: Python 3 nao encontrado.
echo Instale Python 3 de https://www.python.org/downloads/ e marque Add to PATH.
echo Depois execute este arquivo novamente.
:end
pause
