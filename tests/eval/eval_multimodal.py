import os
import json
import base64
import litellm

# Ensure litellm uses the API keys from the environment
litellm.drop_params = True

def evaluate_image(image_path, spec_rubric):
    if not os.path.exists(image_path):
        print(f"Error: Image {image_path} not found.")
        return None
        
    with open(image_path, "rb") as img_file:
        base64_img = base64.b64encode(img_file.read()).decode("utf-8")
        
    prompt = f"""
You are an expert Vision Judge for the Verdant Beech Cartography application.
Evaluate the provided image against the following strict specifications:
{json.dumps(spec_rubric, indent=2)}

Score 1 to 5 for each category:
1. visual_adherence: Does the image fulfill the core request described in the spec?
2. brand_compliance: The image MUST NOT contain UI overlays, device frames, text menus, or modern digital artifacts. It must look like a pure cartography asset or workshop rendering.

Return ONLY valid JSON in the format:
{{
  "visual_adherence_score": 5,
  "brand_compliance_score": 5,
  "rationale": "Detailed reasoning here"
}}
"""
    
    # We use gemini-1.5-pro or 3.5-pro which supports multimodal vision payloads
    try:
        response = litellm.completion(
            model="gemini/gemini-3.5-flash",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{base64_img}"}}
                    ]
                }
            ],
            response_format={"type": "json_object"}
        )
        content = response.choices[0].message.content
        return json.loads(content)
    except Exception as e:
        print(f"Vision Eval Error: {e}")
        return {"visual_adherence_score": 0, "brand_compliance_score": 0, "rationale": f"Error: {e}"}

def main():
    print("==================================================")
    print(" 🧪 Vibe Coding Eval: E2E Multimodal Grading 🧪")
    print("==================================================")
    
    image_path = os.path.join(os.path.dirname(__file__), "sample_map.jpg")
    
    test_spec = {
        "user_intent": "Draw a blank map sheet resting on a rich polished mahogany workshop table.",
        "brand_rules": "No UI, no borders, no device frames. Pure rendering of the physical objects."
    }
    
    print(f"\n[Test] Artifact: {os.path.basename(image_path)}")
    print(f"       Intent: {test_spec['user_intent']}")
    
    print("\n[1] Executing Multimodal Vision Judge...")
    result = evaluate_image(image_path, test_spec)
    
    if result:
        print(f"\n  => Visual Adherence Score: {result.get('visual_adherence_score')}/5")
        print(f"  => Brand Compliance Score: {result.get('brand_compliance_score')}/5")
        print(f"  => Rationale: {result.get('rationale')}")
    
    print("\n==================================================")

if __name__ == "__main__":
    main()
