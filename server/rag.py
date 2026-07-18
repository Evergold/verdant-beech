import chromadb
from chromadb.config import Settings
import os

KNOWLEDGE_BASE = [
    {
        "id": "kb_1",
        "title": "Typography Hierarchy in Maps",
        "content": "Labels should follow a strict visual hierarchy. Water features should be italicized and in a blue hue. Country names should be all-caps with generous letter spacing. City names should be standard title case."
    },
    {
        "id": "kb_2",
        "title": "Color Theory for Terrain",
        "content": "Elevation should use hypsometric tints. Lowlands should be a desaturated green (e.g., #b5cfa3), mid-elevations in pale yellow/tan (#e3d4a6), and peaks in stark white or light gray. Bathymetry should darken as depth increases."
    },
    {
        "id": "kb_3",
        "title": "Historical Style: Tolkien / Fantasy",
        "content": "Fantasy maps often utilize sepia or parchment tones, with hand-drawn 'caterpillar' mountains. Coastlines should have horizontal hatching (waterlines) fading into the sea."
    },
    {
        "id": "kb_4",
        "title": "Camera & Lighting in 3D Cartography",
        "content": "For 2.5D physical maps, the main light source (sun) should generally come from the top-left (north-west) to cast shadows to the bottom-right. This creates natural optical relief perception. An intensity of 0.7 to 1.2 is standard."
    },
    {
        "id": "kb_5",
        "title": "Scale and Projection",
        "content": "Always include a scale bar. When generating regions near the poles, be mindful of Mercator distortion. For aesthetic world maps, Robinson or Winkel Tripel projections are preferred over Mercator."
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
        
        # Populate if empty
        if self.collection.count() == 0:
            print("Populating Cartography RAG Vector Store...")
            self.collection.add(
                documents=[doc["content"] for doc in KNOWLEDGE_BASE],
                metadatas=[{"title": doc["title"]} for doc in KNOWLEDGE_BASE],
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
