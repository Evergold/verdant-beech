@echo off
setlocal

echo ========================================
echo  🌳 Verdant Beech - Quick Setup 🗺️
echo ========================================
echo.

:: 1. Check for Ollama
echo 🔍 Checking for Ollama...
where ollama >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ⚠️  WARNING: Ollama could not be found on your system.
    echo    Verdant Beech relies on Ollama for local AI features.
    echo    Please install it from https://ollama.com before starting the app.
    echo.
) else (
    echo ✅ Ollama is installed.
    echo.
)

:: 2. Setup Frontend (Node.js v22+)
echo 📦 Installing Frontend Node dependencies...
where npm >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ ERROR: 'npm' is not installed. Node.js v22+ is required.
    echo    Please install Node.js v22+ or use nvm-windows.
    exit /b 1
)
call npm install
echo ✅ Frontend setup complete.
echo.

:: 3. Setup Backend (Python / uv)
echo 🐍 Setting up Python Backend...
where uv >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ⚠️  'uv' package manager not found. Attempting to install it globally...
    pip install uv || pip3 install uv
)

:: Create virtual environment inside the server folder
echo    Creating virtual environment (server\.venv)...
call uv venv server\.venv

echo    Installing backend dependencies (including testing suites)...
call uv pip install -e "server[test]"
echo ✅ Backend setup complete.
echo.

echo ========================================
echo  ✨ All dependencies successfully installed!
echo ========================================
echo To start the application, run:
echo.
echo   set GEMINI_API_KEY="your_key"  # (Optional: Only if using cloud models)
echo   npm run dev
echo ========================================
