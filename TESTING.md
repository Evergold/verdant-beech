# Testing Documentation

Verdant Beech enforces a strict testing methodology to ensure absolute reliability across the codebase.

## 1. End-to-End (E2E) Frontend Testing
We utilize **Playwright** to automate all frontend testing. 

### Existing Test Coverage (`tests/e2e.spec.js`):
- **Canvas Rendering**: Verifies the Babylon.js WebGPU/WebGL engine mounts successfully and the `#renderCanvas` element is active.
- **Chat Interface**: Simulates sending prompts to the agent, asserting that the chat history populates correctly and error/warning toasts appear properly.
- **Localization (i18n)**: Validates that the UI successfully hooks into `i18next` and displays localized strings (e.g., "Verdant Beech").
- **State Persistence**: Ensures that changing model configurations via the dropdown successfully writes to `localStorage` and persists across page reloads.

### Running E2E Tests:
```bash
# Run tests headlessly
npx playwright test

# Run tests with a visible browser UI
npx playwright test --ui
```

## 2. Backend & Agent Logic
We maintain a strict **100% test coverage** standard for all backend services, API routes, and complex agent memory logic using `pytest`. The test suite is organized across multiple files (`test_backend.py`, `test_coverage_100.py`, `test_coverage_gaps.py`, `test_projects.py`).

### Key Covered Features:
- **Elastic Window & Time-Aware Recall**: Mocks ChromaDB to ensure that dynamic episodic memory slices are fetched via `start_idx` and `end_idx` metadata, and correctly injected under the `TELEPORTED HISTORICAL CONTEXT` tag.
- **Revery Semantic Pipeline (CRUD)**: Validates the NLP-gated continuous compaction task. Tests ensure the background LLM correctly identifies permanent facts, vectorizes them to check for duplicates, and writes them to the `projects.yaml` state.
- **Bottom-Heavy Prompt Architecture**: Asserts that `CARTOGRAPHY RULES` and `Revery Profiles` are injected directly at the bottom of the prompt to combat LLM "Lost in the Middle" syndrome.
- **Defensive Type Checking**: The backend includes robust `isinstance()` checking against `res.usage.prompt_tokens` to gracefully handle `MagicMock` behaviors in test environments when monitoring VRAM truncation risks.
- **LiteLLM Agent Mocks**: Intercepts LiteLLM completions to ensure the agent correctly processes payloads and executes generative function tools (e.g., changing lighting, dropping markers).

### Running Backend Tests:
```bash
# Run pytest with a terminal coverage report ensuring 100% coverage
PYTHONPATH=. server/.venv/bin/pytest tests/ --cov=server --cov-report=term-missing
```

## 3. Hardware Concurrency & VRAM Stress Testing
Verdant Beech employs an aggressive dual-model memory architecture designed to run flawlessly on 8GB VRAM consumer GPUs.

To verify this, we maintain standalone stress test scripts (e.g., `scratch/test_models.py`).
- **Methodology**: Uses `asyncio.gather` to force simultaneous inference overlap between the heavyweight foreground model (e.g., `gemma4:e4b`) and the lightweight background memory model (e.g., `gemma4:e2b`).
- **Constraints**: Verifies the strict API caps (Live Chat capped at `num_ctx=2048`, Background Tasks capped at `num_ctx=1024`).
- **Results**: Proves that the models can safely contend for memory bandwidth and GPU compute cores for 30+ seconds simultaneously without throwing an Out-Of-Memory (OOM) error or falling back to slow system RAM.

## 4. Strict Rules
*   **Test Location**: ALL tests must be placed in the `tests/` directory at the project root.
*   **Artifacts**: Never commit test results, Playwright traces, coverage HTML, or cache files (`.pytest_cache`) to the git repository.
