# Verdant Beech: RAG & Prompt Engineering Architecture

This document outlines the design, implementation, and strategic advantages of the Retrieval-Augmented Generation (RAG) and Dynamic Prompt Interceptor pipeline used within the Verdant Beech Cartography Assistant.

## 1. System Overview

The core image generation feature of Verdant Beech relies on a highly specialized Prompt Engineering pipeline. Instead of passing raw user prompts directly to the image diffusion models (via LiteLLM), the application employs a **Backend RAG Interceptor**. This interceptor dynamically analyzes, structures, and augments the user's prompt based on the active project phase, selected model tier, and desired aesthetic tokens.

## 2. Pipeline Organization (The Three Phases)

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
  - The Verdant Brand Identity is actively suppressed, allowing the user to discover entirely bespoke, project-unique styles.

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

## 5. Memory Tiering & Subconscious State

Verdant Beech employs an advanced memory architecture to manage context windows efficiently across different reasoning levels and tasks.

*   **Subconscious State (`subconscious_state`):** The backend maintains an asynchronous, non-blocking state dictionary for each project (`gathering_thoughts`, `lost_in_revery`). This allows the agent to run background tasks (like pre-warming heavy Tier-2 models or generating embeddings) without locking the UI or main reasoning thread.
*   **Context Window Segregation:** The memory pipeline strictly segregates context based on the Reasoning Tier (LOW, MED, HIGH). Exploratory (Phase 0) chatter is kept isolated from High-Fidelity (Phase 2) generation context, ensuring that iterative failures or dead-end brainstorms do not pollute the final prompt sent to the One-Shot models.
*   **Seed Persistence:** The geometric and stylistic memory of an image is preserved not via text, but mathematically via the `Seed`. This represents the ultimate form of aesthetic memory tiering, allowing exact structural persistence across different generation phases.

## 6. Expected Advantages & Capabilities

1. **Zero-Shot Mastery:** By injecting deep domain lexicons (Cartography, Graphic Design, Photography) into the prompt dynamically, the LLM generates expert-level art without requiring the user to be a prompt engineer.
2. **Deterministic Iteration:** The frontend actively captures the exact `Seed` value and transmits it to the backend. This allows a user to discover a compelling composition in Phase 0 (Exploratory), lock the seed, and carry that exact geometric baseline into a Phase 2 (High-Fidelity) render.
3. **Compute Efficiency:** The Phase -1 Validator prevents expensive Tier-2 models from wasting time generating unusable mud from vague prompts.
4. **Creative Freedom vs. Stylistic Cohesion:** By decoupling the Verdant Brand Identity from the mandatory pipeline and making it optional, the system achieves the perfect balance. Users can enforce a strict, cohesive aesthetic when needed, or branch out into completely novel art styles during exploration.
