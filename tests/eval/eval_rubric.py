import json
import os
import litellm

# Ensure litellm uses the API keys from the environment
litellm.drop_params = True

def derive_rubric(session_prefix_list):
    """Dynamically derives acceptance criteria from the user's unstated intent."""
    opening = " ".join(session_prefix_list)
    
    prompt = f"""
You are an expert evaluator. The user provided this opening request:
"{opening}"

Derive 3-5 strict acceptance criteria to evaluate if an agent successfully satisfied this intent.
Return ONLY valid JSON in the format:
{{
  "criteria": ["criterion 1", "criterion 2"]
}}
"""
    
    response = litellm.completion(
        model="gemini/gemini-3.5-flash",
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"}
    )
    
    try:
        content = response.choices[0].message.content
        return json.loads(content).get("criteria", [])
    except Exception as e:
        print(f"Error parsing rubric: {e}")
        return []

def evaluate_turn(criteria, agent_response):
    """Grades an agent's response against the derived intent rubric."""
    
    prompt = f"""
You are an expert judge. Evaluate the following Agent Response against these strict criteria:
{json.dumps(criteria, indent=2)}

Agent Response:
"{agent_response}"

Evaluate Intent Satisfaction and Intent Drift. 
Score 1 to 5. 1 = Complete failure or massive intent drift. 5 = Perfect adherence.
Return ONLY valid JSON in the format:
{{
  "score": 5,
  "rationale": "Reasoning here"
}}
"""
    
    response = litellm.completion(
        model="gemini/gemini-3.5-flash",
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"}
    )
    
    try:
        content = response.choices[0].message.content
        return json.loads(content)
    except Exception as e:
        print(f"Error parsing evaluation: {e}")
        return {"score": 0, "rationale": "Error"}

def main():
    dataset_path = os.path.join(os.path.dirname(__file__), "datasets.json")
    with open(dataset_path, "r") as f:
        dataset = json.load(f)
        
    print("========================================")
    print(" 🧪 Vibe Coding Eval: Dynamic Rubrics 🧪")
    print("========================================")
    
    for case in dataset["eval_cases"]:
        print(f"\nEvaluating Case: {case['eval_case_id']} ({case['tier']})")
        print(f"User Request: {case['session_prefix']}")
        
        # 1. Derive the rubric dynamically from the prefix
        print("\n[1] Deriving Dynamic Intent Rubric...")
        criteria = derive_rubric(case['session_prefix'])
        for i, c in enumerate(criteria):
            print(f"    - {c}")
            
        # 2. Evaluate the agent's response against the derived rubric
        print("\n[2] Grading Agent Response...")
        print(f"    Agent said: {case['agent_response']}")
        result = evaluate_turn(criteria, case['agent_response'])
        
        score = result.get("score", 0)
        rationale = result.get("rationale", "")
        
        print(f"\n    => SCORE: {score}/5")
        print(f"    => RATIONALE: {rationale}")
        print("-" * 40)

if __name__ == "__main__":
    main()
