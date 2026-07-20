# Verdant Beech Tool Architecture

The Verdant Beech cartography assistant utilizes a highly optimized, dynamic tool registry to interface the `4.5B` conversational LLM with the Babylon.js 3D Canvas. To maximize speed and token efficiency, tools are deeply decoupled from the backend logic and are managed via a configuration-driven plugin system.

## 1. The Plugin Configuration (`server/tools.yaml`)
Instead of hardcoding tool definitions into Python, all tools are defined in `server/tools.yaml`. 
This makes the architecture purely "plug-and-play". When a new tool is added to the 3D Canvas in the frontend, you simply drop its configuration into `tools.yaml` to register it with the backend.

Each tool entry requires three components:
- **`schema`**: The strict JSON Schema describing the function (name, description, parameters). This is translated into native tool-calling syntax by LiteLLM.
- **`keywords`**: A plain-English list of trigger words used by the NLP Gate (e.g., `["light", "dark", "night"]`).
- **`few_shot`**: A conversational example teaching the LLM *when* and *how* to use the tool.

## 2. The Hot-Reloading Memory Cache
To eliminate slow disk I/O and YAML parsing on every chat request, `server/main.py` utilizes a hot-reloading memory cache. 
When the chat endpoint is hit, it checks the modification time (`mtime`) of `tools.yaml` (an operation taking microseconds). 
- If the file is unchanged, it loads the `TOOL_REGISTRY` instantly from memory.
- If you edit `tools.yaml` during development, Python detects the change, reads the disk exactly once to refresh the cache, and locks it back into memory.

## 3. The NLP Keyword Gate (Token Stripping)
Passing every tool schema to the LLM on every conversational turn is incredibly wasteful (consuming 300+ tokens per request). 

To solve this, the backend runs the user's message through an **NLP Keyword Gate**:
1. The system scans the user's message against the `keywords` array of every registered tool.
2. Only the tools that match the keywords are injected into the LLM payload. 
3. If the user asks a purely conversational question (e.g., *"Who is Verdant?"*), **zero tools** are attached to the payload. 

This optimization saves massive amounts of context space and dramatically speeds up standard conversation inference.

## 4. Few-Shot Prompt Injection
The AI doesn't need to learn raw JSON syntax; it needs to learn the *semantic intent* of the tools. 
When the Keyword Gate detects a match, it doesn't just attach the tool schema—it dynamically injects that specific tool's `few_shot` string directly into Green's `CARTOGRAPHER_PROMPT`. 

This guarantees near-100% accuracy in tool execution by showing the model an exact conversational example of how to trigger the requested feature.

## 5. The Frontend Execution Pipeline
1. The AI outputs a hidden native tool call string.
2. LiteLLM intercepts and standardizes it into the OpenAI `tool_calls` format.
3. The Python backend extracts these calls and sends them to the Vite frontend via the `data.tool_calls` JSON array.
4. `src/main.js` receives the array and routes it to `executeCanvasTools(toolCalls)`.
5. The Javascript switch statement reads the parsed JSON arguments and executes the physical Babylon.js commands (e.g., altering light intensity, applying materials, or dropping markers).
