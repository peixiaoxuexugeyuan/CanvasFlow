@echo off
setlocal
cd /d "%~dp0"
if exist "CanvasFlow.exe" (
  start "" "%~dp0CanvasFlow.exe"
  exit /b 0
)
if exist "dist-desktop\CanvasFlow-win32-x64\CanvasFlow.exe" (
  start "" "%~dp0dist-desktop\CanvasFlow-win32-x64\CanvasFlow.exe"
  exit /b 0
)
if exist ".runtime\python\python.exe" (
  ".runtime\python\python.exe" launch_local.py %*
  goto :done
)
if exist ".venv\Scripts\python.exe" (
  ".venv\Scripts\python.exe" launch_local.py %*
  goto :done
)
if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe" (
  "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe" launch_local.py %*
  goto :done
)
py -3 --version >nul 2>&1
if not errorlevel 1 (
  py -3 launch_local.py %*
  goto :done
)
python --version >nul 2>&1
if not errorlevel 1 (
  python launch_local.py %*
  goto :done
)
echo Python 3.10+ is required. Install Python or place it in .runtime\python.
pause
exit /b 1
:done
if errorlevel 1 pause
