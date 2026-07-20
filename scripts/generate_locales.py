# generate_locales.py (c) 2026 Evergold <261058386+Evergold@users.noreply.github.com>
# Licensed under the MIT License (see LICENSE for details)

import os
import json
import asyncio
import litellm

# Target languages extracted from .cursorrules
LANGUAGES = [
    "ar", "bg", "bn", "cs", "da", "de", "el", "es", "et", "fa", "fi", "fr", "gu", 
    "he", "hi", "hr", "hu", "id", "is", "it", "ja", "jv", "ko", "lt", "lv", "ml", 
    "mr", "ms", "nl", "or", "pa", "pl", "pt", "ro", "ru", "sk", "sl", "sr", "sv", 
    "sw", "ta", "te", "th", "tl", "tr", "uk", "ur", "vi", "zh"
]

# We explicitly hardcode this since it's a dev-side internal automation script
MODEL = "gemini/gemini-3.5-flash"

async def translate_to_language(lang_code, source_json):
    print(f"Translating to {lang_code}...")
    prompt = f"""
You are an expert software localization engine. Translate the following English UI strings into the language corresponding to ISO 639-1 code '{lang_code}'.
Maintain all JSON keys exactly as they are. Only translate the string values.
If a string contains variables like {{model}} or {{name}}, KEEP THEM EXACTLY as {{model}} or {{name}}.
Return ONLY a raw valid JSON object. Do NOT wrap in markdown blocks like ```json.

Source JSON:
{json.dumps(source_json, indent=2)}
"""
    try:
        response = await litellm.acompletion(
            model=MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.0
        )
        content = response.choices[0].message.content.strip()
        
        # Strip markdown if the model hallucinated it
        if content.startswith("```json"):
            content = content[7:]
        if content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]
            
        translated_json = json.loads(content)
        
        # Write to file
        out_path = f"/home/chuubi/Desktop/vibe-coding-2026/verdant-beech/src/locales/{lang_code}.json"
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(translated_json, f, ensure_ascii=False, indent=2)
            
        print(f"✅ Successfully generated {lang_code}.json")
    except Exception as e:
        print(f"❌ Failed to generate {lang_code}.json: {str(e)}")

async def main():
    en_path = "/home/chuubi/Desktop/vibe-coding-2026/verdant-beech/src/locales/en.json"
    with open(en_path, "r", encoding="utf-8") as f:
        source_json = json.load(f)
        
    print(f"Loaded English baseline with {len(json.dumps(source_json))} bytes.")
    print(f"Kicking off translations for {len(LANGUAGES)} languages in parallel batches...")
    
    # Process in batches of 5 to avoid rate limits
    batch_size = 5
    for i in range(0, len(LANGUAGES), batch_size):
        batch = LANGUAGES[i:i+batch_size]
        tasks = [translate_to_language(lang, source_json) for lang in batch]
        await asyncio.gather(*tasks)
        
    print("All translations completed!")

if __name__ == "__main__":
    asyncio.run(main())
