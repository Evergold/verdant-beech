# <img src="./public/favicon-32x32.png" width="36" height="36" align="absmiddle" /> Verdant Beech - Cartography Assistant

Verdant Beech is a next-generation map-making application powered by Agentic AI. It features a hardware-accelerated Babylon.js map canvas for large-scale map viewing and full 3D topography visualization. Our unified WebGPU/WebGL architecture guarantees that **Verdant Beech is fully GPU-agnostic and OS-independent**. It runs smoothly on Windows, macOS, and Linux across NVIDIA, AMD, Intel, or Apple Silicon hardware.

---

## 🌟 Core Features

- **Proactive Cartographer Agent**: "Green," an AI assistant living in the sidecar chat panel, analyzes your prompts and provides expert cartography guidance in character as a diligent cartography student.
- **Library Manager & Portfolios**: A dynamic, non-destructive file system that stores your map generation portfolios, style guidelines, and tags directly to disk as human-readable `.yaml` configurations.
- **Cartography RAG Vector Store**: An integrated offline ChromaDB knowledge base loaded with expert rules on typography, color theory, lighting, and diverse mapping styles (e.g., Cyberpunk Tactical Holograms, Imhof Swiss Hillshading, Tolkien High-Fantasy, and Golden Age Portolan charts). The agent queries this mid-conversation for historically and mathematically accurate map generation advice.
- **Tiered Memory Architecture**: This architecture prevents "attention dilution" over long 100-turn maps. Context is controlled via isolated Project environments, and memory is divided into tiers:
  - **Working Memory**: Kept tight (last 10 messages) to maintain focus.
  - **Episodic Memory**: Older conversation context is continuously compacted and summarized in the background by the agent, embedded into ChromaDB, and retrieved dynamically.
  - **Semantic Memory**: Generalized facts learned over time, specifically storing your overarching project preferences, stylistic choices, and creative goals. These are embedded alongside expert cartography rules to ensure the agent remains permanently aligned with your vision.
- **Hardware-Accelerated WebGPU**: Uses Babylon.js v9 for buttery-smooth panning and zooming across stitched 4K textures, safely gracefully falling back to WebGL on older browsers.
- **Dynamic Canvas Tooling**: The agent can natively manipulate your scene lighting, apply post-processing filters, overlay hex grids, drop markers, and control weather effects.
- **Real-Time VLM Sync (Coming Soon)**: A debounced local Vision-Language Model watches your canvas strokes to provide instant, context-aware feedback.

---

## 🗺️ Model Ecosystem & Requirements

The application uses a `models.yaml` file to let you hot-swap LLMs seamlessly via LiteLLM.

### Assistant Models (Green-persona)
We recommend models capable of highly complex spatial planning and schema adherence:

- **Default Local Choice:** `gemma4:e4b` via Ollama. We **ALWAYS prefer QAT variants of Gemma 4** (e.g., `ollama_chat/gemma-4-e4b-qat` or `gemma4:e4b`).
- **Default API Choice:** `gemini/gemini-3.5-flash` (or `gemini-3.1-pro` for maximal reasoning). Both support configurable reasoning tabs in the UI!

#### 🖥️ Hardware Requirements for Gemma 4 (4.5B)
Running the default local assistant model (`gemma4:e4b`) is highly optimized thanks to QAT quantization. Actual observed resource usage is exceptionally light:
- **VRAM (GPU Memory)**: ~3 GB
- **System RAM**: ~6 GB

### Image Generation Models (Verdant-persona)
Used for the actual tile stitching and map baking. Due to the high architectural demands of topology, we strictly rely on cutting-edge 2026 models:
- **Primary:** `gemini/imagen-4.0-generate` (Top-tier for photorealism and zero-shot spatial accuracy).
- **Conversational Iteration (Nano Banana):** `gemini/nano-banana-2` (for rapid iteration) and `gemini/nano-banana-pro` (for 4K production-grade consistency and complex editing).
- **Alternatives:** `gpt-image-2` (OpenAI's DALL-E successor, excellent for general scene composition) or `huggingface/black-forest-labs/FLUX.2` (for camera-accurate optics) can be seamlessly swapped via `models.yaml`.

### Embedding Models (Memory & RAG Retrieval)
To power our Tiered Memory Architecture, we rely heavily on accurate semantic retrieval for past chat history and Cartography Rules.
- **Default Choice:** `embeddinggemma` 
*Why a dedicated Gemma-based Embedding model?* Traditional baseline embedding models (like ChromaDB's default `all-MiniLM-L6-v2`) act as shallow fuzzy keyword matchers. By utilizing an embeddings generator trained directly on the Gemma architecture, we inject **deep contextual reasoning** straight into the retrieval layer. This means the database actually comprehends *intent*. If you ask for a "spooky ocean vibe," EmbeddingGemma's structural reasoning natively links the abstract concept of "spooky" to an older, seemingly unrelated episodic memory about "foggy bathymetry," entirely bypassing the need for exact keyword overlap.
- **Recommended Local Alternative:** `paraphrase-multilingual-MiniLM-L12-v2` (Unlike the baseline `all-` variant, this `multilingual` variant maps 50+ languages to the exact same vector space, allowing a French prompt to successfully retrieve an English cartography rule).
- **Cloud APIs (Multi-language):** Google Gemini (`text-embedding-004`) or OpenAI (`text-embedding-3-large`). Both gracefully support cross-lingual retrieval that overlaps perfectly with our 50+ language target.

---

## 🚀 Setup Instructions

### Prerequisites & Environment
If you intend to run the application using our **Default Local Choice** (Gemma 4), **no API keys are required whatsoever.**

However, the backend utilizes `litellm` to interface with generative models, meaning you can seamlessly hot-swap to almost any commercial cloud API by exporting the respective keys before starting the server:

**For API-based Assistant Models (Green-persona):**
- **Google Gemini** (e.g., `gemini-3.5-flash`): `export GEMINI_API_KEY="your_key"`
- **OpenAI** (e.g., `gpt-5.6-sol`): `export OPENAI_API_KEY="your_key"`
- **Anthropic** (e.g., `claude-sonnet-5`): `export ANTHROPIC_API_KEY="your_key"`
- **Groq** (e.g., `groq/llama-4-maverick`): `export GROQ_API_KEY="your_key"`
- **Mistral** (e.g., `mistral/mistral-large-latest`): `export MISTRAL_API_KEY="your_key"`

**For Image Generation Models (Verdant-persona):**
- **Google Gemini API** (e.g., `gemini/imagen-4.0-generate`, `gemini/nano-banana-2`, `gemini/nano-banana-pro`): `export GEMINI_API_KEY="your_key"`
- **Stability AI** (e.g., `stabilityai/stable-diffusion-3`): `export STABILITY_API_KEY="your_key"`
- **OpenAI** (e.g., `gpt-image-2`): `export OPENAI_API_KEY="your_key"`
- **Amazon Bedrock** (e.g., `bedrock/amazon.titan-image-generator-v1`): `export AWS_ACCESS_KEY_ID="your_id" AWS_SECRET_ACCESS_KEY="your_key" AWS_REGION_NAME="us-east-1"`
- **HuggingFace** (e.g., `huggingface/black-forest-labs/FLUX.2`): `export HUGGINGFACE_API_KEY="your_key"`

### 1. Installation

#### Option A: Unified Quick Setup (Recommended)
For a completely hands-off installation, we provide automated setup scripts that check for Ollama, install frontend Node packages, and build the Python backend isolated environment.

**macOS / Linux:**
```bash
chmod +x setup.sh
./setup.sh
```

**Windows:**
```bat
setup.bat
```

#### Option B: Manual Setup (Alternative)

**1. Install Ollama & Default Models:**
Install the engine from [ollama.com](https://ollama.com), then pull the required local models:
```bash
ollama pull gemma4:e4b
ollama pull embeddinggemma
```

**2. Python Backend (with test dependencies):**
```bash
uv venv server/.venv
uv pip install -e "server[test]"
```

**3. Frontend (Vite):**
```bash
npm install
```

---

### 2. Running the Application

**Development Mode (Hot Reloading)**
To run both the backend server and the frontend Vite server simultaneously with HMR (Hot Module Replacement) enabled:

*Note: The unified dev script requires Node.js v22+. If your system Node is older, we recommend using NVM (Node Version Manager) to temporarily satisfy the dependency before starting:*
```bash
# (Optional) Ensure Node 22 is active:
nvm install 22
nvm use 22
```

```bash
npm run dev
```
*(The frontend will be available at `http://localhost:5173`)*

**UI Localization / Locale Override**
Verdant Beech officially supports [50 languages](./src/locales/) and will natively detect your browser's language setting. If your language is unsupported, it defaults gracefully to English (`en`).
You can explicitly override the UI language by passing the `VITE_LOCALE` environment variable using an ISO 639-1 code (must be one of the [50 supported languages](./src/locales/)):
```bash
VITE_LOCALE="fr" npm run dev
```

**Production Mode**
To serve the optimized, static production build through the FastAPI backend directly (without a separate Vite dev server):
```bash
npm run build
npm run start
```
*(The app will be available at `http://localhost:8001`)*

---

## 📦 Dependencies

**Backend Stack:**
- `fastapi` & `uvicorn`: High-performance asynchronous API server.
- `litellm`: Unified interface for seamlessly hot-swapping generative AI models.
- `chromadb`: Local vector database powering the Tiered Memory architecture.
- `httpx`: Asynchronous HTTP client for background Ollama management.
- `pyyaml`: Configuration management for projects, libraries, and models.
- `ollama`: Required locally to power the Gemma 4 and EmbeddingGemma models.

**Frontend Stack (Node/Vite):**
- `vite`: Lightning-fast modern build tool and dev server.
- `babylonjs`: Hardware-accelerated 3D WebGL/WebGPU rendering engine.
- `marked`, `dompurify`, & `highlight.js`: Secure Markdown parsing and syntax highlighting.

**Testing Stack:**
- `pytest`, `pytest-cov`, `pytest-asyncio`: Automated Python backend unit testing and coverage reporting.
- `@playwright/test`: Automated cross-browser end-to-end UI testing.

---

## 🧪 Testing

Please refer to [TESTING.md](TESTING.md) for all testing documentation and E2E setup instructions. We maintain 100% backend unit test coverage and automate end-to-end user interactions using Playwright.
