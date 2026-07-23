import sys
import os
import json

# Add the project root to the python path so we can import server.rag
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from server.rag import rag_store

# Step 2: Testing Semantic Memory Retrieval
test_cases = [
    {
        "query": "I want to draw a map in the style of Eduard Imhof with Swiss hillshading.",
        "expected_kb_id": "kb_style_imhof"
    },
    {
        "query": "How should I design the London Underground transit schematic?",
        "expected_kb_id": "kb_style_beck"
    },
    {
        "query": "What projection should I use for a nautical navigation chart?",
        "expected_kb_id": "kb_projection_expert"
    },
    {
        "query": "Give me a high-fantasy Tolkien style map with caterpillar mountains.",
        "expected_kb_id": "kb_style_fantasy"
    }
]

def evaluate_rag_retrieval():
    print("==================================================")
    print(" 🧪 Vibe Coding Eval: RAG & Semantic Memory 🧪")
    print("==================================================")
    
    success_count = 0
    
    for case in test_cases:
        print(f"\n[Test] Query: '{case['query']}'")
        
        # 1. Execute the Retrieval
        results = rag_store.collection.query(
            query_texts=[case["query"]],
            n_results=1
        )
        
        if not results['documents'] or not results['documents'][0]:
            print("  ❌ FAIL: No documents retrieved.")
            continue
            
        retrieved_id = results['ids'][0][0]
        retrieved_content = results['documents'][0][0]
        
        print(f"  -> Retrieved ID: {retrieved_id}")
        
        # 2. Check Retrieval Accuracy
        if retrieved_id == case["expected_kb_id"]:
            print("  ✅ PASS: Exact semantic memory match.")
            success_count += 1
        else:
            print(f"  ❌ FAIL: Expected {case['expected_kb_id']} but got {retrieved_id}")
            print(f"     Content: {retrieved_content[:100]}...")

    print("\n==================================================")
    print(f" Final Score: {success_count}/{len(test_cases)} Semantic Retrieval Tests Passed")
    print("==================================================")

if __name__ == "__main__":
    evaluate_rag_retrieval()
