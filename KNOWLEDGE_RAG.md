# Verdant Beech: RAG & Prompt Engineering Architecture

This document outlines the design, implementation, and strategic advantages of the Retrieval-Augmented Generation (RAG) and Dynamic Prompt Interceptor pipeline used within the Verdant Beech Cartography Assistant.

## 1. System Overview

The core image generation feature of Verdant Beech relies on a highly specialized Prompt Engineering pipeline. Instead of passing raw user prompts directly to the image diffusion models (via LiteLLM), the application employs a **Backend RAG Interceptor**. This interceptor dynamically analyzes, structures, and augments the user's prompt based on the active project phase, selected model tier, and desired aesthetic tokens.

This architecture governs the entire generation lifecycle through the following mechanisms:
*   **[2] Prompt Engineering Architecture:** How the Interceptor dynamically routes and structures prompts across four distinct developmental phases (from validation to high-fidelity baking).
*   **[3] Domain-Specific Expertise:** How the RAG injects specialized, highly technical lexicons (Cartography, Photography, UI/UX) to elevate natural language inputs.
*   **[4] Dynamic Prompt Assembly Logic:** The strict mathematical gating of tokens (max 3-4) to prevent prompt dilution and preserve the diffusion model's attention mechanism.
*   **[5] Memory Architecture & Subconscious State:** How context windows and geometric seeds are meticulously segregated and persisted across different reasoning tiers.
*   **[6] Expected Advantages & Capabilities:** The strategic benefits this architecture unlocks, including zero-shot mastery and compute efficiency.

## 2. Prompt Engineering Architecture

The RAG pipeline organizes prompt processing into distinct, rigid phases to maximize the efficiency and accuracy of the underlying AI models.

### Phase -1: The Validator (Fail-Fast Mechanism)
- **Implementation:** Located in `server/main.py` (`/api/generate_asset`).
- **Functionality:** Before any LLM processing occurs, the interceptor analyzes the token length and clarity of the raw prompt.
- **Outcome:** If the prompt is too vague (e.g., under 3 words), the backend instantly aborts and returns a `status: "clarification"`. The frontend silently intercepts this status and injects a conversational chat message asking the user for more details, ensuring compute resources are not wasted on generic or muddy generations.

### Phase 0: Exploratory Design
- **Trigger:** Active when the user toggles "Exploratory Mode" ON.
- **Target Models:** Optimized for Tier 0 (e.g., `gemini/nano-banana-2`) which possess `Iterative` and `Rapid` capabilities.
- **Functionality:** 
  - Allows highly conversational and unstructured prompting.
  - Negative constraints are kept minimal (`low quality, blurry, text`) to allow the model freedom to invent and inpaint.
  - Dynamically injects specialized vocabularies (e.g., Cartography tokens like `bathymetric rendering` or `isoline topography`) if contextual keywords ("map", "terrain") are detected.
  - The Verdant Brand Identity is actively suppressed by default to allow the user to discover entirely bespoke styles, but it will still be injected if explicitly requested in the prompt.

### Phase 1: Asset Assembly
- **Trigger:** Active when the user shifts from broad brainstorming to generating specific set-pieces, sprite sheets, or individual structural components.
- **Target Models:** Utilizes Tier 2 (`One-Shot` / `Photorealism`) for static assets, or Tier-0/1 (`Iterative` + `Consistency`/`Rapid`) for evolving pieces.
- **Functionality:**
  - *With Tier-2 Models:* The interceptor enforces rigid negative constraints and absolute specificity, abandoning implied context.
  - *With Iterative Models:* The interceptor facilitates conversational composition, allowing the user to construct the asset progressively using reference images and strict geometrical constraints.

### Phase 2: Baking & Stitching (High-Fidelity Lockdown)
- **Trigger:** Active when "Exploratory Mode" is OFF.
- **Target Models:** Requires `Iterative` + `Consistency` or `Rapid` capabilities. The highest tier model available is always preferential, with `Consistency` being the priority for flawless stitching. Lower-tier models are acceptable provided they have `Iterative` capabilities to allow manual seamline correction.
- **Functionality:**
  - Imposes an absolute, rigid structure to prevent the model from hallucinating complex elements.
  - A massive wall of negative constraints is injected (`device frames, laptops, phones, UI overlays, gradients on text, cartoonish, watermark`).
  - Injects high-end Photography/Cinematography tokens (`cinematic lighting, f/1.4 aperture, Octane render, 8k resolution`).
  - *Optional:* The Verdant Brand Identity (`dark mode, neon green accents, rich polished mahogany wood`) can be explicitly invoked if the user wishes to conform the asset strictly to the application's native aesthetic.

## 3. Domain-Specific Expertise (Lexicons)

To bridge the gap between a user's natural language and the highly technical jargon required by diffusion models, the RAG Interceptor is equipped with domain-specific lexicons. These are dynamically parsed and injected based on contextual triggers.

*   **A. Lighting & Render Engines:** Controls the mood and 3D dimensionality.
    *   *Tokens:* `volumetric lighting`, `ambient occlusion`, `rim lighting`, `specular highlights`, `bioluminescent accents`, `studio lighting setup`, `Unreal Engine 5 render`, `Octane render`.
*   **B. Camera & Composition:** Critical for ensuring assets fit correctly into the UI or map grid.
    *   *Tokens:* `isometric projection`, `true orthographic view`, `top-down down-facing camera`, `macro photography`, `shallow depth of field`, `tilt-shift effect`, `centered composition`, `isolated on solid background`.
*   **C. Advanced Material Properties:** Defines physical rendering characteristics.
    *   *Tokens:* `subsurface scattering`, `refractive index`, `matte finish`, `anodized metal`, `iridescent film`, `polished mahogany`, `brushed steel`.
*   **D. UI/UX Paradigm Lexicon:** Used when conceptualizing frontend layouts or icons.
    *   *Tokens:* `Glassmorphism`, `Neumorphism`, `Flat UI`, `Skeuomorphic detailing`, `translucent frosted layers`, `micro-interaction state`.
*   **E. Verdant Brand Identity Lexicon (Core Aesthetic):** Only injected if explicitly requested.
    *   *Tokens:* `dark mode`, `deep charcoal background`, `neon green accents`, `verdant green glow`, `rich polished mahogany wood`, `premium high-end`, `sleek minimalist`.
*   **F. Cartography & Topology Lexicon:** Crucial for the exploratory/assembly phase when building maps.
    *   *Tokens:* `bathymetric rendering`, `hypsometric tinting`, `hillshade analysis`, `contour lines`, `rhumb lines`, `isoline topography`, `satellite imagery scale`, `fantasy parchment texture`.
*   **G. Graphic Design & Composition Lexicon:** Forces structured balance and modern aesthetics.
    *   *Tokens:* `Swiss design`, `golden ratio composition`, `negative space`, `Bauhaus aesthetic`, `typographic hierarchy`, `monochromatic color scheme`.
*   **H. Photography & Cinematography Lexicon:** Elevates Tier-2 one-shot set pieces with photorealism.
    *   *Tokens:* `cinematic lighting`, `chiaroscuro`, `f/1.4 aperture`, `bokeh`, `lens flare`, `drone photography angle`, `long exposure`, `polarizing filter`, `rule of thirds`, `volumetric fog`, `8k resolution`.

## 4. Dynamic Prompt Assembly Logic

To prevent "Prompt Stuffing" or "Keyword Salad" (which severely dilutes a diffusion model's attention mechanism), the interceptor strictly limits injected tokens. It only appends 3 to 4 context-aware tokens at a time, ensuring the mathematical weight of the user's core subject remains the primary focus of the generation.

When assembling the final string passed to the diffusion model, the interceptor enforces the following strict order, as diffusion models heavily weight the beginning of a prompt:
1. **Subject & Medium:** (e.g., `A true orthographic view of a single oak tree...`)
2. **Core Material:** (e.g., `...with subsurface scattering on the leaves and a matte bark finish...`)
3. **Environment & Lighting:** (e.g., `...studio lighting setup, soft ambient occlusion...`)
4. **Aesthetic Polish:** (e.g., `...premium 8k quality, Octane render...`)
5. **Negative Constraints:** Passed discretely via kwargs (e.g., `...isolated on solid background, no cast shadow on floor, no text, no UI elements.`)

## 5. Memory Architecture & Subconscious State

Verdant Beech employs an advanced cognitive memory architecture to maintain deep project alignment while preserving computational focus:

*   **Working Memory:** Kept tight (last 10 messages) to maintain immediate contextual focus on the active task without hallucinating from past interactions.
*   **Episodic Memory:** Older conversation context is continuously compacted and summarized in the background by the agent, embedded into ChromaDB, and retrieved dynamically as needed.
*   **Semantic Memory:** Generalized facts learned over time, specifically storing overarching project preferences, stylistic choices, and creative goals. These are embedded alongside expert cartography rules to ensure the agent remains permanently aligned with the user's vision.
*   **Subconscious State (`subconscious_state`):** A non-blocking state dictionary that facilitates the overall design of memory. It allows the agent to run background tasks (like compacting episodic memory, generating embeddings, or pre-warming models) without locking the UI or interrupting the user's workflow.

## 6. Expected Advantages & Capabilities

1. **Zero-Shot Mastery:** By injecting deep domain lexicons (Cartography, Graphic Design, Photography) into the prompt dynamically, the LLM generates expert-level art without requiring the user to be a prompt engineer.
2. **Deterministic Iteration:** The frontend actively captures the exact `Seed` value and transmits it to the backend. This allows a user to discover a compelling composition in Phase 0 (Exploratory), lock the seed, and carry that exact geometric baseline into a Phase 2 (High-Fidelity) render.
3. **Compute Efficiency:** The Phase -1 Validator prevents expensive Tier-2 models from wasting time generating unusable mud from vague prompts.
4. **Creative Freedom vs. Stylistic Cohesion:** By decoupling the Verdant Brand Identity from the mandatory pipeline and making it optional, the system achieves the perfect balance. Users can enforce a strict, cohesive aesthetic when needed, or branch out into completely novel art styles during exploration.
5. **Cognitive Persistence without Hallucination:** By segregating memory into Working, Episodic, and Semantic tiers, the agent maintains a virtually infinite historical understanding of the project without the prompt-bloat and hallucination risks caused by dumping massive, unmanaged context windows into the LLM.
6. **Non-Blocking Fluidity (Zero-Latency UX):** The Subconscious State enables the agent to continuously compact memories, generate vector embeddings, and pre-warm heavy Tier-2 diffusion models entirely in the background, ensuring the user interface never locks up or stutters during complex cognitive tasks.
