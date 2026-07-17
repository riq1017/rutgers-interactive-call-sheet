@echo off
setlocal
cd /d "%~dp0"
set "CFB27_PYTHON="
for %%P in (python.exe py.exe) do if not defined CFB27_PYTHON for /f "delims=" %%I in ('where %%P 2^>nul') do set "CFB27_PYTHON=%%I"
if not defined CFB27_PYTHON if exist "C:\Program Files\Blender Foundation\Blender 4.3\4.3\python\bin\python.exe" set "CFB27_PYTHON=C:\Program Files\Blender Foundation\Blender 4.3\4.3\python\bin\python.exe"
if not defined CFB27_PYTHON (
  echo Python 3 was not found. Install Python or configure it on PATH.
  exit /b 1
)
"%CFB27_PYTHON%" tools\weekly_refresh.py --config config\weekly_refresh.json %*
set "CFB27_EXIT=%ERRORLEVEL%"
echo.
if not "%CFB27_EXIT%"=="0" echo Refresh stopped. Review the report path above.
pause
exit /b %CFB27_EXIT%
