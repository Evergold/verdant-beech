import chromadb
from chromadb.config import Settings
import os

KNOWLEDGE_BASE = [
    {
        "id": "kb_typography_1",
        "category": "Typography",
        "title": "Typography Hierarchy in Maps",
        "content": "Labels should follow a strict visual hierarchy. Water features should be italicized and in a blue hue. Country names should be all-caps with generous letter spacing. City names should be standard title case. In medieval styles (e.g., Mappa Mundi), use Gothic or Blackletter fonts with illuminated initials. For contemporary styles, use clean sans-serif like Inter or Helvetica."
    },
    {
        "id": "kb_color_1",
        "category": "Color Theory",
        "title": "Color Theory for Terrain",
        "content": "Elevation should use hypsometric tints. Contemporary lowlands use desaturated green (e.g., #b5cfa3), mid-elevations pale yellow/tan (#e3d4a6), and peaks stark white. Bathymetry darkens as depth increases. Medieval and vintage maps should rely heavily on warm sepia, raw sienna, and burnt umber, with verdigris green for forests."
    },
    {
        "id": "kb_style_fantasy",
        "category": "Style: Fantasy & Vintage",
        "title": "Historical Style: Tolkien / Fantasy",
        "content": "Fantasy maps often utilize sepia or parchment tones, with hand-drawn 'caterpillar' mountains. Coastlines should have horizontal hatching (waterlines) fading into the sea. Forests are often depicted as clustered tree canopies rather than solid color blocks."
    },
    {
        "id": "kb_style_medieval",
        "category": "Style: Medieval",
        "title": "Historical Style: Portolan & Mappa Mundi",
        "content": "Medieval Portolan charts should feature prominent compass roses and intersecting rhumb lines (windrose networks) criss-crossing the sea. Mappa Mundi styles should be highly allegorical, often placing East (Orient) at the top, featuring mythical beasts (sea monsters) in uncharted waters, and prominent walled-city icons."
    },
    {
        "id": "kb_style_contemporary",
        "category": "Style: Contemporary",
        "title": "Modern & Minimalist Cartography",
        "content": "Contemporary maps emphasize high-contrast minimalism. Use dark modes with neon accents for transit networks, or ultra-clean vector styles with zero terrain textures. Focus heavily on negative space and strict geometric alignment."
    },
    {
        "id": "kb_lighting_1",
        "category": "3D Rendering",
        "title": "Camera & Lighting in 3D Cartography",
        "content": "For 2.5D physical maps, the main light source (sun) should generally come from the top-left (north-west) to cast shadows to the bottom-right. This creates natural optical relief perception. An intensity of 0.7 to 1.2 is standard. For dramatic 'golden hour' renders, lower the light angle and tint it warm orange."
    },
    {
        "id": "kb_projection_1",
        "category": "Geometry & Projection",
        "title": "Scale and Projection",
        "content": "Always include a scale bar. When generating regions near the poles, be mindful of Mercator distortion. For aesthetic world maps, Robinson or Winkel Tripel projections are preferred over Mercator. Medieval maps often completely ignore mathematical projection in favor of theological or narrative importance (e.g., T-O maps)."
    }
]

class CartographyRAG:
    def __init__(self, db_path="./chroma_db"):
        os.makedirs(db_path, exist_ok=True)
        # Initialize persistent ChromaDB client
        self.client = chromadb.PersistentClient(path=db_path)
        
        # Get or create collection
        self.collection = self.client.get_or_create_collection(
            name="cartography_rules"
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
