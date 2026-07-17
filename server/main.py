from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
import os

app = FastAPI(title="Verdant Beech API", description="Backend for the Cartography Agent")

# Allow CORS for development (Vite dev server)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict this
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- API Endpoints ---
@app.get("/api/health")
async def health_check():
    return {"status": "ok", "service": "verdant-beech"}

# --- Agent / Litellm Stubs ---
@app.post("/api/chat")
async def chat_endpoint(message: str):
    # TODO: Implement local VLM sync + litellm routing
    return {"reply": "As an expert cartographer, I am analyzing your request..."}

@app.post("/api/generate")
async def generate_map(prompt: str):
    # TODO: Implement 4K max tile stitching via litellm/Imagen 3
    return {"status": "generation_started"}

# --- Static File Serving (Single-Process Production Setup) ---
# In production, we serve the Vite built files from ../dist
DIST_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "dist")

if os.path.isdir(DIST_DIR):
    app.mount("/assets", StaticFiles(directory=os.path.join(DIST_DIR, "assets")), name="assets")
    
    # Catch-all to serve index.html for SPA routing
    @app.get("/{full_path:path}")
    async def catch_all(full_path: str):
        index_path = os.path.join(DIST_DIR, "index.html")
        if os.path.isfile(index_path):
            return FileResponse(index_path)
        return {"error": "Frontend build not found. Run 'npm run build'."}
else:
    @app.get("/{full_path:path}")
    async def catch_all_dev(full_path: str):
        return {"message": "Frontend build not found. If in dev mode, use Vite dev server on port 5173."}
