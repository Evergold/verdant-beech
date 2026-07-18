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
We maintain a near **100% test coverage** standard for all backend services, API routes, and agent logic using `pytest`.

### Existing Test Coverage (`tests/test_backend.py`):
- **FastAPI Endpoints**: Validates standard routes (`/api/health`, `/api/models`) and Ollama local hardware-polling endpoints (`status`, `prewarm`, `unload`).
- **LiteLLM Agent Mocks**: Intercepts LiteLLM completions to ensure the agent correctly processes payloads and executes function tools (e.g., changing lighting, dropping markers).
- **Cartography RAG Vector Store**: Mocks ChromaDB to ensure that the RAG store successfully fetches and injects relevant cartographic rules into the agent's context window.
- **Library Manager**: Asserts the creation, validation, and metadata generation of portfolio folders directly on the disk using the `/api/library/folders` endpoints.

### Running Backend Tests:
```bash
# Run pytest with a terminal coverage report
PYTHONPATH=. server/.venv/bin/pytest tests/test_backend.py --cov=server --cov-report=term-missing
```

## 3. Strict Rules
*   **Test Location**: ALL tests must be placed in the `tests/` directory at the project root.
*   **Artifacts**: Never commit test results, Playwright traces, coverage HTML, or cache files (`.pytest_cache`) to the git repository.
