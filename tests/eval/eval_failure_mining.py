import json
import litellm

# Ensure litellm uses the API keys from the environment
litellm.drop_params = True

# Mocked trace data representing negative user corrections from past sessions
mock_abandoned_sessions = [
    {"session_id": "s1", "correction": "No, I said no UI borders around the map."},
    {"session_id": "s2", "correction": "The wood looks too modern, it should be rustic mahogany."},
    {"session_id": "s3", "correction": "Remove the digital interface overlays."},
    {"session_id": "s4", "correction": "This doesn't look like an underground forge, where is the lava?"},
    {"session_id": "s5", "correction": "I explicitly asked for no text on the map."},
    {"session_id": "s6", "correction": "The lighting is too bright, make it cinematic and dark."}
]

def mine_failures(corrections):
    print("==================================================")
    print(" 🧪 Vibe Coding Eval: Failure Mining (Step 5) 🧪")
    print("==================================================")
    print(f"Analyzing {len(corrections)} user corrections from abandoned sessions...\n")
    
    # In a real environment, we'd use OpenTelemetry to pull traces where 'abandoned == True'
    # Here, we use Gemini to semantically cluster the failure modes
    
    prompt = f"""
You are an Agentic Security and Evaluation expert.
Review the following user corrections (which represent failed vibe-coding sessions):
{json.dumps(corrections, indent=2)}

Group them into 2-3 distinct 'Failure Mode' clusters. 
For each cluster, provide:
1. The Core Issue (what the RAG or Prompt Assembly failed to enforce)
2. Affected Sessions
3. Recommended Fix (how to auto-refactor the RAG Knowledge Base to prevent this)

Return ONLY valid JSON in the format:
{{
  "clusters": [
    {{"issue": "...", "sessions": ["s1"], "fix": "..."}}
  ]
}}
    """
    
    try:
        response = litellm.completion(
            model="gemini/gemini-3.5-flash",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"}
        )
        content = json.loads(response.choices[0].message.content)
        
        for i, cluster in enumerate(content.get("clusters", [])):
            print(f"🔥 Failure Mode #{i+1}: {cluster.get('issue')}")
            print(f"   Affected Sessions: {', '.join(cluster.get('sessions', []))}")
            print(f"   Recommended Auto-Fix: {cluster.get('fix')}\n")
            
    except Exception as e:
        print(f"Failure Mining Error: {e}")

if __name__ == "__main__":
    mine_failures(mock_abandoned_sessions)
