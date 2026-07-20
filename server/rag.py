import chromadb
from chromadb.config import Settings
import chromadb.utils.embedding_functions as embedding_functions
import os

KNOWLEDGE_BASE = [
    {
        "id": "kb_typography_expert",
        "category": "Typography",
        "title": "Expert Typography & Hierarchy",
        "content": "Labels demand rigorous visual hierarchy. Natural features (rivers, oceans, mountains) strictly use serif fonts, often italicized; political/human features (cities, borders) use sans-serif. Water features must follow the spline (curve) of the river. Enforce 'halation' (subtle white text halos) to maintain legibility against complex terrain. Country names require all-caps with generous kerning (tracking) to visually span their territory. Scale font weight down logarithmically with administrative level."
    },
    {
        "id": "kb_color_expert",
        "category": "Color Theory",
        "title": "Advanced Color Theory & Hypsometry",
        "content": "Hypsometric tinting (elevation coloring) must utilize perceptually uniform color spaces (e.g., CIELAB). Lowlands use desaturated, cooler greens; mid-elevations transition to warmer, arid yellows/tans; alpine zones use stark whites/grays. Bathymetry uses sequential blue palettes darkening non-linearly with depth. Employ 'atmospheric perspective': distant or low-importance areas should have lower saturation and contrast to direct the viewer's eye."
    },
    {
        "id": "kb_lighting_expert",
        "category": "3D Rendering & Shading",
        "title": "Analytical Hillshading & 3D Lighting",
        "content": "For 2.5D/3D maps, enforce a light source azimuth of 315° (North-West) and a zenith angle of 45°. This specific angle prevents the optical illusion of 'relief inversion' where mountains look like craters. Combine Lambertian diffuse shading with subtle ambient occlusion in valleys. Utilize normal mapping for micro-texture (e.g., parchment grain) and absolute vertex displacement for macro-topography."
    },
    {
        "id": "kb_projection_expert",
        "category": "Geometry & Projection",
        "title": "Geodesy & Tissot's Indicatrices",
        "content": "Projection choice is paramount. Use Conformal projections (Mercator) exclusively for navigation where maintaining local angles is critical. Use Equal-Area projections (Albers, Peters) for thematic choropleth maps to prevent area distortion bias. For global aesthetic maps, use Compromise projections (Winkel Tripel, Robinson). Always define a coordinate reference system (CRS) datum (e.g., WGS84)."
    },
    {
        "id": "kb_style_imhof",
        "category": "Style: Imhof Analytical",
        "title": "Eduard Imhof Swiss Hillshading",
        "content": "To emulate Eduard Imhof's renowned Swiss cartography: abandon harsh black/gray shadows. Use aerial perspective. Illuminated slopes facing the NW light source must be tinted warm (pale yellow/orange), while cast shadows on SE slopes must be tinted cool (blue/violet). This simulates realistic atmospheric scattering and provides immense 3D clarity without darkening the map."
    },
    {
        "id": "kb_style_beck",
        "category": "Style: Beck Topological",
        "title": "Harry Beck Transit Schematics",
        "content": "To emulate Harry Beck's London Underground maps: discard geographical accuracy entirely in favor of topological clarity. All lines must be strictly drawn at 0°, 45°, or 90° angles. Stations are uniform ticks or nodes. Distances between stations should be visually equalized regardless of actual physical distance."
    },
    {
        "id": "kb_style_golden_age",
        "category": "Style: Golden Age",
        "title": "Age of Discovery & Portolan Charts",
        "content": "Golden Age and Portolan maritime charts require heavily decorated compass roses with intersecting rhumb lines (windrose networks) traversing the seas. Utilize 'horror vacui' (fear of empty space) by filling uncharted landmasses with illustrations of mythical beasts, lions, or elephants. Coastlines should be exaggerated with detailed, dense port cities, leaving interiors relatively blank."
    },
    {
        "id": "kb_style_ttrpg",
        "category": "Style: TTRPG HexCrawl",
        "title": "Tabletop RPG Hexagonal Maps",
        "content": "For TTRPG and HexCrawl styles, discretize the world into a strict hexagonal grid. Each hex should represent a single dominant biome (e.g., forest, swamp, mountain) using a centralized, repeated icon. This facilitates travel tracking and procedural generation mechanics. Edges between conflicting biomes should be hard, distinct borders rather than smooth gradients."
    },
    {
        "id": "kb_style_fantasy",
        "category": "Style: Fantasy & Vintage",
        "title": "Tolkien High-Fantasy",
        "content": "High-fantasy maps demand monochrome or sepia-toned parchment aesthetics. Mountains are drawn individually as 'caterpillar' ridges with hatched shading on the eastern slopes. Coastlines require concentric horizontal 'waterline' hatching fading outward into the sea. Forests are drawn as clustered, bubbly tree canopies."
    },
    {
        "id": "kb_style_medieval",
        "category": "Style: Medieval",
        "title": "Historical Style: Mappa Mundi",
        "content": "Mappa Mundi styles are highly allegorical, often placing East (Orient) at the top of the map. Mathematical projection is entirely ignored in favor of theological importance (e.g., T-O maps). Focus heavily on illuminated initials, and prominently feature walled-city icons."
    },
    {
        "id": "kb_style_contemporary",
        "category": "Style: Contemporary",
        "title": "Modern & Minimalist Cartography",
        "content": "Contemporary web maps emphasize high-contrast minimalism. Use dark modes with neon accents for transit networks, or ultra-clean vector styles with zero terrain textures. Focus heavily on negative space, strict geometric alignment, and crisp sans-serif typography."
    },
    {
        "id": "kb_style_natgeo",
        "category": "Style: National Geographic",
        "title": "Classic National Geographic Atlas",
        "content": "To emulate National Geographic atlases: use extremely legible, classic serif typefaces. Political borders must feature 'boundary ribbons'—a distinct colored stroke along the border that fades gently into the interior of the country. Terrain should use a very gentle, realistic shaded relief without harsh shadows."
    },
    {
        "id": "kb_style_johnsnow",
        "category": "Style: Data Journalism",
        "title": "John Snow Spatial Analysis",
        "content": "For epidemiological or spatial analysis (e.g., the 1854 Cholera Map): strip all unnecessary geographical features to leave a high-contrast, minimalist street grid. Emphasize data using prominent dot-density markers and utilize Voronoi diagrams to visually delineate zones of influence around key points."
    },
    {
        "id": "kb_projection_dymaxion",
        "category": "Geometry & Projection",
        "title": "Buckminster Fuller's Dymaxion Projection",
        "content": "The Dymaxion (Fuller) projection unfolds the Earth onto an icosahedron. It eliminates cultural 'up/down' biases by having no fixed North or South. It is heavily prioritized for thematic global maps because it drastically reduces distortion of both relative shapes and sizes, and does not slice any major landmasses."
    },
    {
        "id": "kb_style_pirate",
        "category": "Style: Vintage Pirate",
        "title": "Treasure Maps & Golden Age Piracy",
        "content": "Pirate and treasure maps demand heavily distressed, burnt-edge parchment. Apply a deep, aggressive sepia wash. Crucial landmarks must be exaggerated, utilizing 'X marks the spot' iconography. Seas must be crossed by prominent rhumb lines and populated with hand-drawn ships or krakens."
    },
    {
        "id": "kb_style_cyberpunk",
        "category": "Style: Sci-Fi & Cyberpunk",
        "title": "Tactical Hologram / Cyberpunk",
        "content": "Cyberpunk or sci-fi tactical displays require dark/black backgrounds with monochromatic glowing accents (e.g., cyan, magenta, or neon green). Terrain should be rendered as wireframe topologies or rigid glowing grids. Apply CRT scanline filters, heavy bloom, and UI crosshairs or hex-overlays to mimic a digital HUD."
    }
]

import yaml
import litellm
from chromadb import Documents, EmbeddingFunction, Embeddings

class LiteLLMEmbeddingFunction(EmbeddingFunction):
    def __init__(self, model_name: str):
        self.model_name = model_name
        
    def __call__(self, input: Documents) -> Embeddings:
        response = litellm.embedding(model=self.model_name, input=input)
        return [data["embedding"] for data in response.data]

class CartographyRAG:
    def __init__(self, db_path="./chroma_db"):
        os.makedirs(db_path, exist_ok=True)
        # Initialize persistent ChromaDB client (with telemetry disabled for privacy)
        self.client = chromadb.PersistentClient(
            path=db_path,
            settings=Settings(anonymized_telemetry=False)
        )
        
        # Read the embedding model from models.yaml
        embedding_model_id = "ollama/embeddinggemma"  # fallback
        try:
            with open("../models.yaml", "r") as f:
                models_config = yaml.safe_load(f)
                if "embedding_models" in models_config and len(models_config["embedding_models"]) > 0:
                    embedding_model_id = models_config["embedding_models"][0]["id"]
        except Exception as e:
            print(f"[RAG] Warning: Could not read models.yaml for embedding config: {e}. Falling back to default.")
            
        print(f"[RAG] Initializing with embedding model: {embedding_model_id}")
        self.embedding_function = LiteLLMEmbeddingFunction(model_name=embedding_model_id)
        
        # Get or create collection
        self.collection = self.client.get_or_create_collection(
            name="cartography_rules",
            embedding_function=self.embedding_function
        )
        
        # Always upsert to keep the database in sync with the KNOWLEDGE_BASE array
        print("Syncing Cartography RAG Vector Store...")
        self.collection.upsert(
            documents=[doc["content"] for doc in KNOWLEDGE_BASE],
            metadatas=[{"title": doc["title"], "category": doc.get("category", "General")} for doc in KNOWLEDGE_BASE],
            ids=[doc["id"] for doc in KNOWLEDGE_BASE]
        )

    def query(self, text: str, n_results: int = 2) -> list[str]:
        results = self.collection.query(
            query_texts=[text],
            n_results=n_results
        )
        
        if not results['documents'] or not results['documents'][0]:
            return []
            
        return results['documents'][0]

# Singleton instance
rag_store = CartographyRAG()
