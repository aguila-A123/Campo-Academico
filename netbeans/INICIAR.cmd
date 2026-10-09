@echo off
cd /d "%~dp0"
echo Java Noir - tu espacio personal de Java
echo Abre http://localhost:4318 en tu navegador.
echo Mantén esta ventana abierta mientras programas.
echo.
if exist "%ProgramFiles%\nodejs\node.exe" (
  "%ProgramFiles%\nodejs\node.exe" server/index.mjs
) else (
  node server/index.mjs
)
pause
