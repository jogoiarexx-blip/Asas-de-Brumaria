@echo off
chcp 65001 >nul
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0publicar-v1.6.0.ps1" %*
if errorlevel 1 (
  echo.
  echo A publicacao NAO foi concluida. Leia a mensagem acima.
) else (
  echo.
  echo Processo concluido. Confira o GitHub e o site.
)
pause
