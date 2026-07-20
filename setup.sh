# setup.sh (c) 2026 Evergold <261058386+Evergold@users.noreply.github.com>
# Licensed under the MIT License (see LICENSE for details)

#!/bin/bash
set -e

echo "========================================"
echo " 🌳 Verdant Beech - Quick Setup 🗺️"
echo "========================================"
echo ""

# 1. Check for Ollama
echo "🔍 Checking for Ollama..."
if ! command -v ollama &> /dev/null; then
    echo "⚠️  WARNING: Ollama could not be found on your system."
    echo "   Verdant Beech relies on Ollama for local AI features."
    echo "   Please install it from https://ollama.com before starting the app."
    echo ""
else
    echo "✅ Ollama is installed."
    echo ""
fi

# 2. Setup Frontend (Node.js v22+)
echo "📦 Checking Frontend Node.js dependencies..."
if ! command -v npm &> /dev/null; then
    echo "❌ ERROR: 'npm' is not installed. Node.js v22+ is required."
    echo "   We highly recommend using NVM (Node Version Manager):"
    echo "   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash"
    echo "   nvm install 22 && nvm use 22"
    exit 1
fi

NODE_MAJOR=$(node -v | cut -d 'v' -f 2 | cut -d '.' -f 1)
if [ "$NODE_MAJOR" -lt 22 ]; then
    echo "⚠️  WARNING: Node.js v22 or higher is required (found v$NODE_MAJOR)."
    echo "   If installation or 'npm run dev' fails, please upgrade via NVM:"
    echo "   nvm install 22 && nvm use 22"
fi
npm install
echo "✅ Frontend setup complete."
echo ""

# 3. Setup Backend (Python / uv)
echo "🐍 Setting up Python Backend..."
if ! command -v uv &> /dev/null; then
    echo "⚠️  'uv' package manager not found. Attempting to install it globally..."
    pip install uv || pip3 install uv
fi

# Create virtual environment inside the server folder to match the manual instructions
echo "   Creating virtual environment (server/.venv)..."
uv venv server/.venv

echo "   Installing backend dependencies (including testing suites)..."
uv pip install -e "server[test]"
echo "✅ Backend setup complete."
echo ""

echo "========================================"
echo " ✨ All dependencies successfully installed!"
echo "========================================"
echo "To start the application, run:"
echo ""
echo "  export GEMINI_API_KEY=\"your_key\"  # (Optional: Only if using cloud models)"
echo "  npm run dev"
echo "========================================"
