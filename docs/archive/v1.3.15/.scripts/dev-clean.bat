@echo off
echo ====================================
echo  Clean Development Environment
echo ====================================
echo.

echo [1/4] Killing all Obscur processes...
taskkill /F /IM obscur_desktop_app.exe /T 2>nul
if %ERRORLEVEL% EQU 0 (
    echo     Processes killed successfully
) else (
    echo     No processes found (this is OK)
)
echo.

echo [2/4] Cleaning Rust build cache...
cargo clean --manifest-path apps/desktop/src-tauri/Cargo.toml
echo.

echo [3/4] Clearing Next.js cache...
rd /s /q apps\pwa\.next 2>nul
if %ERRORLEVEL% EQU 0 (
    echo     Cache cleared
) else (
    echo     No cache found (this is OK)
)
echo.

echo [4/4] Ready to start fresh dev server
echo.
echo Run: pnpm dev:desktop
echo.
pause
