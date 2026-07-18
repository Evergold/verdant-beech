# Verdant Beech - Cartography Assistant 🗺️

Verdant Beech is a next-generation map-making application powered by Agentic AI. It features a hardware-accelerated Babylon.js map canvas for massive map viewing and 2.5D displacement, a unified FastAPI + Vite architecture, and seamless multi-modal AI integration.

## Features
- **Proactive Cartographer Agent**: An AI assistant living in the sidecar chat panel that analyzes prompts and provides expert cartography guidance.
- **Hardware-Accelerated WebGL**: Uses Babylon.js for buttery-smooth panning and zooming across massive stitched 4K textures.
- **Non-Destructive Layers**: Paint features onto the map on separate transparent layers, allowing for reversible Photoshop-style editing.
- **Real-Time VLM Sync**: A debounced local Vision-Language Model watches your canvas strokes to provide instant, context-aware feedback.
## Model Ecosystem & Recommendations
The application uses a `models.yaml` file to let you hot-swap LLMs via LiteLLM seamlessly. 

### Assistant Models (Chat & Logic)
We recommend models capable of highly complex spatial planning and strict schema adherence:
- **Primary API Choice:** `gemini/gemini-3.5-flash` (or `gemini-3.1-pro` for maximal reasoning). Both support configurable reasoning tabs in the UI!
- **Primary Local Choice:** We **ALWAYS prefer QAT variants of Gemma 4** (e.g. `ollama_chat/gemma-4-e4b-qat`). Quantization-Aware Training (QAT) allows massive memory savings without degrading the reasoning capability, which is critical for cartography planning.

### Image Generation Models (Heavy Weight)
Used for the actual tile stitching and map baking.
- **Primary:** `vertex_ai/imagen-3.0-generate`
- **Alternatives:** `dall-e-3` or `stabilityai/stable-diffusion-3` can be swapped via `models.yaml`.

## Setup Instructions

### Prerequisites & Environment
The backend Cartography Agent utilizes `litellm` to interface with generative models. You must export your Google API key to your environment before starting the server:
```bash
export GEMINI_API_KEY="your_api_key_here"
```
*(Note: `GOOGLE_API_KEY` can also be used as an alternative depending on your Google Cloud setup).*

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
