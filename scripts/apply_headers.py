# apply_headers.py (c) 2026 Evergold <261058386+Evergold@users.noreply.github.com>
# Licensed under the MIT License (see LICENSE for details)

import os

HEADER_TEMPLATE = {
    ".py": "# {filename} (c) 2026 Evergold <261058386+Evergold@users.noreply.github.com>\n# Licensed under the MIT License (see LICENSE for details)\n\n",
    ".js": "// {filename} (c) 2026 Evergold <261058386+Evergold@users.noreply.github.com>\n// Licensed under the MIT License (see LICENSE for details)\n\n",
    ".css": "/* {filename} (c) 2026 Evergold <261058386+Evergold@users.noreply.github.com> */\n/* Licensed under the MIT License (see LICENSE for details) */\n\n",
    ".html": "<!-- {filename} (c) 2026 Evergold <261058386+Evergold@users.noreply.github.com> -->\n<!-- Licensed under the MIT License (see LICENSE for details) -->\n\n"
}

# The core files we've authored
TARGETS = [
    "index.html",
    "src/main.js",
    "src/style.css",
    "src/CartographyProps.js",
    "src/MapLayers.js",
    "server/main.py",
    "server/rag.py",
    "tests/test_backend.py",
    "tests/e2e.spec.js",
    "tests/test_i18n.js",
    "scripts/generate_locales.py",
    "scripts/apply_headers.py"
]

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def main():
    for target in TARGETS:
        filepath = os.path.join(PROJECT_ROOT, target)
        if not os.path.exists(filepath): 
            print(f"Not found: {target}")
            continue
            
        ext = os.path.splitext(target)[1]
        if ext not in HEADER_TEMPLATE:
            print(f"Skipping (no extension match): {target}")
            continue
                
        header = HEADER_TEMPLATE[ext].format(filename=os.path.basename(target))
        
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()
            
        if "(c) 2026 Evergold" in content or "Apache License" in content:
            print(f"Already licensed or vendored: {target}")
            continue
            
        # Inject header
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(header + content)
        print(f"Applied header to: {target}")

if __name__ == "__main__":
    main()
