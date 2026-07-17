# Testing Documentation

Verdant Beech enforces a strict testing methodology to ensure absolute reliability across the codebase.

## 1. End-to-End (E2E) Frontend Testing
We utilize **Playwright** (or Puppeteer) to automate all frontend testing. This includes:
- Interactions with the Babylon.js Canvas (verifying WebGL rendering is intact).
- Chat interactions in the Sidecar Panel.
- Ensuring the `i18next` localized strings update properly.

## 2. Backend & Agent Logic
We mandate a strict **100% test coverage** target for all backend services, API routes, and agent cartography logic.

## 3. Strict Rules
*   **Test Location**: ALL tests must be placed in the `tests/` directory at the project root.
*   **Artifacts**: Never commit test results, coverage HTML, or cache files (`.pytest_cache`) to the git repository.
