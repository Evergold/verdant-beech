# Verdant Beech - Cartography Assistant 🗺️

Verdant Beech is a next-generation map-making application powered by Agentic AI. It features a hardware-accelerated Babylon.js map canvas for massive map viewing and 2.5D displacement, a unified FastAPI + Vite architecture, and seamless multi-modal AI integration.

### Hardware & Platform Support
Our unified WebGPU/WebGL architecture alongside the FastAPI + Vite stack guarantees that **Verdant Beech is fully GPU-agnostic and OS-independent**. It runs smoothly on Windows, macOS, and Linux across NVIDIA, AMD, or Apple Silicon hardware.

---

## 🌟 Core Features

- **Proactive Cartographer Agent**: "Green," an AI assistant living in the sidecar chat panel, analyzes your prompts and provides expert cartography guidance in character as a diligent cartography student.
- **Library Manager & Portfolios**: A dynamic, non-destructive file system that stores your map generation portfolios, style guidelines, and tags directly to disk as human-readable `.yaml` configurations.
- **Cartography RAG Vector Store**: An integrated offline ChromaDB knowledge base loaded with expert rules on typography, color theory, lighting, and fantasy styles. The agent queries this mid-conversation for historically and mathematically accurate map generation advice.
- **Hardware-Accelerated WebGPU**: Uses Babylon.js v9 for buttery-smooth panning and zooming across massive stitched 4K textures, safely gracefully falling back to WebGL on older browsers.
- **Dynamic Canvas Tooling**: The agent can natively manipulate your scene lighting, apply post-processing filters, overlay hex grids, drop markers, and control weather effects.
- **Real-Time VLM Sync (Coming Soon)**: A debounced local Vision-Language Model watches your canvas strokes to provide instant, context-aware feedback.

---

## 🧠 Model Ecosystem & Requirements

The application uses a `models.yaml` file to let you hot-swap LLMs seamlessly via LiteLLM.

### Assistant Models (Chat & Logic)
We recommend models capable of highly complex spatial planning and strict schema adherence:

- **Primary API Choice:** `gemini/gemini-3.5-flash` (or `gemini-3.1-pro` for maximal reasoning). Both support configurable reasoning tabs in the UI!
- **Primary Local Choice (Default):** We **ALWAYS prefer QAT variants of Gemma 4** (e.g., `ollama_chat/gemma-4-e4b-qat` or `gemma4:e4b`). Quantization-Aware Training (QAT) allows massive memory savings without degrading the reasoning capability, which is critical for cartography planning.

#### 🖥️ Hardware Requirements for Gemma 4 (4.5B)
Running the default local assistant model (`gemma4:e4b`) is highly optimized thanks to QAT quantization. Actual observed resource usage is exceptionally light:
- **VRAM (GPU Memory)**: ~3 GB
- **System RAM**: ~6 GB
- *Note: Our lazy-loading logic unloads the model from VRAM when not in use, preserving GPU memory for the heavy Babylon.js rendering scene.*

### Image Generation Models (Heavy Weight)
Used for the actual tile stitching and map baking.
- **Primary:** `vertex_ai/imagen-3.0-generate`
- **Alternatives:** `dall-e-3` or `stabilityai/stable-diffusion-3` can be swapped via `models.yaml`.

---

## 🚀 Setup Instructions

### Prerequisites & Environment
The backend Cartography Agent utilizes `litellm` to interface with generative models. You must export your Google API key to your environment before starting the server:

```bash
export GEMINI_API_KEY="your_api_key_here"
```
*(Note: `GOOGLE_API_KEY` can also be used as an alternative depending on your Google Cloud setup).*

### 1. Python Backend (FastAPI + ChromaDB)
The backend runs on port `8001`. Always run it from the root directory to maintain Python module paths.
```bash
uv venv .venv
uv pip install -e server
PYTHONPATH=. server/.venv/bin/uvicorn server.main:app --reload --port 8001
```

### 2. Frontend (Vite)
The frontend runs on port `5173` and automatically proxies `/api` calls to the backend.
```bash
npm install
npm run dev
```

---

## 🧪 Testing

Please refer to [TESTING.md](TESTING.md) for all testing documentation and E2E setup instructions. We maintain strict 100% backend unit test coverage and automate end-to-end user interactions using Playwright.
