@echo off
REM Build script for VNDB-GUI (Tauri) - portable single exe
setlocal
set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

set "VERSION_SUFFIX="
if not "%VNDB_GUI_VERSION%"=="" set "VERSION_SUFFIX=-%VNDB_GUI_VERSION%"
if not exist release mkdir release

echo [1/3] Installing dependencies...
call npm ci --no-audit --no-fund || call npm install

echo [2/3] Building release...
call npm run tauri build
if errorlevel 1 (
    echo ERROR: Build failed. Check the logs above.
    exit /b 1
)

echo [3/3] Copying portable exe to release...
set "BIN=src-tauri\target\release\vndb-gui.exe"
if not exist "%BIN%" (
    echo ERROR: Binary not found: %BIN%
    exit /b 1
)
copy /y "%BIN%" "release\VNDB-GUI%VERSION_SUFFIX%.exe" >nul

echo ========================================================
echo  SUCCESS! Built: release\VNDB-GUI%VERSION_SUFFIX%.exe
echo ========================================================
