#!/usr/bin/env python3
import os
import json
import sys

script_dir = os.path.dirname(os.path.abspath(__file__))
locales_dir = os.path.abspath(os.path.join(script_dir, "..", "src", "locales"))
en_path = os.path.join(locales_dir, "en.json")

if not os.path.exists(en_path):
    print(f"Error: Could not find {en_path}")
    sys.exit(1)

with open(en_path, 'r', encoding='utf-8') as f:
    en_data = json.load(f)

def extract_strings(data, prefix=""):
    strings = {}
    for k, v in data.items():
        key = f"{prefix}.{k}" if prefix else k
        if isinstance(v, dict):
            strings.update(extract_strings(v, key))
        else:
            strings[key] = str(v)
    return strings

en_strings = extract_strings(en_data)
auto_fix = "--fix" in sys.argv

deleted_count = 0
errors_found = False

# Keys that are universally identical to English (acronyms, technical names, etc.)
whitelist = {
    "chat.ram", "chat.vram", "style.studio", "style.goldenHour",
    "style.halogen", "style.uniformStudio", "style.moodyCandlelit",
    "asset.exploratoryMode", "asset.title", "projects.newProject",
    "chat.send", "chat.pause"
}

for file in os.listdir(locales_dir):
    if file.endswith(".json") and file != "en.json":
        filepath = os.path.join(locales_dir, file)
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
            
        def check_node(node, prefix=""):
            global deleted_count, errors_found
            keys_to_delete = []
            for k, v in node.items():
                full_key = f"{prefix}.{k}" if prefix else k
                if isinstance(v, dict):
                    check_node(v, full_key)
                    if not v: # dict is empty
                        keys_to_delete.append(k)
                elif full_key in en_strings and str(v) == en_strings[full_key]:
                    # Only flag if it contains alphabet characters (ignore pure symbols)
                    # and if it is not explicitly whitelisted
                    if full_key not in whitelist and any(c.isalpha() for c in str(v)):
                        if auto_fix:
                            keys_to_delete.append(k)
                        else:
                            print(f"[{file}] Untranslated English detected for key '{full_key}': {v}")
                            errors_found = True
            
            if auto_fix:
                for k in keys_to_delete:
                    del node[k]
                    deleted_count += 1
                
        check_node(data)
        
        if auto_fix:
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)

if auto_fix:
    if deleted_count > 0:
        print(f"Linter successfully scrubbed {deleted_count} untranslated English strings!")
    else:
        print("All locales passed linting! No untranslated strings found.")
else:
    if errors_found:
        print("\nLinting failed! Run 'npm run lint:locales -- --fix' to automatically scrub leaked english strings.")
        sys.exit(1)
    else:
        print("All locales passed linting! No untranslated strings found.")
