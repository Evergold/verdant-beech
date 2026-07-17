# Verdant Beech - AI Cartography Agent 🗺️

Verdant Beech is a next-generation map-making application powered by Agentic AI. It features a hardware-accelerated Babylon.js map canvas for massive map viewing and 2.5D displacement, a unified FastAPI + Vite architecture, and seamless multi-modal AI integration.

## Features
- **Proactive Cartographer Agent**: An AI assistant living in the sidecar chat panel that analyzes prompts and provides expert cartography guidance.
- **Hardware-Accelerated WebGL**: Uses Babylon.js for buttery-smooth panning and zooming across massive stitched 4K textures.
- **Non-Destructive Layers**: Paint features onto the map on separate transparent layers, allowing for reversible Photoshop-style editing.
- **Real-Time VLM Sync**: A debounced local Vision-Language Model watches your canvas strokes to provide instant, context-aware feedback.

## Setup Instructions

### 1. Python Backend
```bash
cd server
uv venv .venv
uv pip install -e .
.venv/bin/uvicorn main:app --reload
```

### 2. Frontend (Vite)
```bash
npm install
npm run dev
```

## Testing
Please refer to [TESTING.md](TESTING.md) for all testing documentation and E2E setup instructions.
