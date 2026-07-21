// main.js (c) 2026 Evergold <261058386+Evergold@users.noreply.github.com>
// Licensed under the MIT License (see LICENSE for details)

import * as BABYLON from "@babylonjs/core";
import { buildCartographyTools } from "./CartographyProps.js";
import { MapLayerManager } from "./MapLayers.js";
import i18next from "i18next";
import enTranslations from "./locales/en.json";

// Invalidate local storage to prevent browser crashes from old cache states
localStorage.clear();

async function saveState(key, value) {
  try {
    await fetch("http://localhost:8001/api/projects/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value })
    });
  } catch (e) {
    console.error("Failed to save state to project YAML", e);
  }
}

// Initialize i18n
async function initI18n() {
  let detectedLang = import.meta.env.VITE_LOCALE || (navigator.language || navigator.userLanguage || "en").split("-")[0].toLowerCase();
  
  let translations = enTranslations;
  
  if (detectedLang !== "en") {
    try {
      const module = await import(`./locales/${detectedLang}.json`);
      translations = module.default || module;
    } catch (e) {
      console.warn(`Locale '${detectedLang}' not supported. Falling back to 'en'.`);
      detectedLang = "en";
    }
  }

  await i18next.init({
    lng: detectedLang,
    fallbackLng: "en",
    resources: {
      [detectedLang]: {
        translation: translations
      }
    }
  });
  
  // Apply translations to the DOM
  document.querySelectorAll("[data-i18n]").forEach(el => {
    el.textContent = i18next.t(el.getAttribute("data-i18n"));
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
    el.placeholder = i18next.t(el.getAttribute("data-i18n-placeholder"));
  });
  document.querySelectorAll("[data-i18n-title]").forEach(el => {
    el.title = i18next.t(el.getAttribute("data-i18n-title"));
  });
}

let engine, scene, camera, light, baseMap, baseMat;
let pipeline = null;
let particleSystem = null;
let overlayMesh = null;
let markers = [];

// Initialize Babylon.js WebGL/WebGPU Engine
async function initBabylon() {
  const canvas = document.getElementById("renderCanvas");
  
  const webGPUSupported = await BABYLON.WebGPUEngine.IsSupportedAsync;
  const urlParams = new URLSearchParams(window.location.search);
  const forceWebGL = urlParams.get("webgl") === "1";
  console.log("Renderer Toggle State -> forceWebGL:", forceWebGL);
  
  let useWebGPU = false;
  if (webGPUSupported && !forceWebGL) {
    try {
      const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || (window.matchMedia && window.matchMedia("(pointer: coarse)").matches);
      const engineOptions = { antialias: true };
      if (!isMobile) {
        engineOptions.powerPreference = "high-performance";
      }
      engine = new BABYLON.WebGPUEngine(canvas, engineOptions);
      await engine.initAsync();
      console.log("Babylon.js initialized with WebGPU");
      useWebGPU = true;
    } catch (e) {
      console.warn("WebGPU initialization failed, falling back to WebGL:", e);
    }
  }
  
  if (!useWebGPU) {
    engine = new BABYLON.Engine(canvas, true);
    console.log("Babylon.js initialized with WebGL");
  }

  const createScene = function () {
    scene = new BABYLON.Scene(engine);
    
    // Set a dark room background
    scene.clearColor = new BABYLON.Color4(0.02, 0.02, 0.03, 1);

    // Perspective Camera viewing the table (Centered on Map Canvas at z = -3)
    // Starting angle: 45 degrees from overhead to simulate working at a cartography table
    camera = new BABYLON.ArcRotateCamera("camera", -Math.PI / 2, Math.PI / 4, 35, new BABYLON.Vector3(0, 0, -3), scene);
    camera.attachControl(canvas, true);
    camera.wheelPrecision = 20;
    camera.lowerRadiusLimit = 10;
    camera.upperRadiusLimit = 40;
    camera.panningSensibility = 250; // Lower number = faster/more sensitive panning

    // Restrict camera rotation to simulate a standing workshop view
    // Pitch (beta): from directly overhead (0) to 45 degrees (Math.PI/4)
    camera.lowerBetaLimit = 0.01; // Epsilon to avoid gimbal lock
    camera.upperBetaLimit = Math.PI / 4;
    // Yaw (alpha): max 45 degrees left or right from center (-Math.PI/2)
    camera.lowerAlphaLimit = -Math.PI / 2 - Math.PI / 4;
    camera.upperAlphaLimit = -Math.PI / 2 + Math.PI / 4;

    // Create a pre-baked, heavily blurred cartography workshop background for a blazingly fast DOF effect
    const workshopDome = new BABYLON.PhotoDome(
        "workshopBackground",
        "/blurred_workshop.jpg",
        {
            resolution: 32,
            size: 1000
        },
        scene
    );
    // Align the dome so the image looks correct from the restricted camera angle
    workshopDome.rotation.y = Math.PI;

    // Custom animatable properties for safe panning without triggering ArcRotateCamera.setTarget orbital recalculations
    Object.defineProperty(camera, "targetX", {
      get: function() { return this.target.x; },
      set: function(v) { this.target.x = v; }
    });
    Object.defineProperty(camera, "targetZ", {
      get: function() { return this.target.z; },
      set: function(v) { this.target.z = v; }
    });

    // Advanced Rendering Pipeline: HDR and IBL (Baked Radiance Volumes)
    scene.environmentTexture = BABYLON.CubeTexture.CreateFromPrefilteredData("https://playground.babylonjs.com/textures/environment.dds", scene);
    scene.environmentIntensity = 0.5; // Restored for proper ambient fill and reflections

    // Enable High Dynamic Range (HDR) and Cinematic ACES Tone Mapping
    const defaultPipeline = new BABYLON.DefaultRenderingPipeline("defaultPipeline", true, scene, [camera]);
    defaultPipeline.imageProcessingEnabled = true;
    defaultPipeline.imageProcessing.toneMappingEnabled = true;
    defaultPipeline.imageProcessing.toneMappingType = BABYLON.ImageProcessingConfiguration.TONEMAPPING_ACES;
    defaultPipeline.imageProcessing.exposure = 1.2;

    // Fast, cheap anti-aliasing to fix mesh edge jaggies (FXAA only)
    // MSAA (samples) was causing lag, relying on purely post-process FXAA
    defaultPipeline.fxaaEnabled = true;

    // Removed screen-space vignette: using pure physical light falloff instead
    defaultPipeline.imageProcessing.vignetteEnabled = false;
    defaultPipeline.imageProcessing.vignetteBlendMode = BABYLON.ImageProcessingConfiguration.VIGNETTEMODE_MULTIPLY;

    // Photographic Post-Processing Filters (Disabled by default)
    defaultPipeline.depthOfFieldEnabled = false;
    defaultPipeline.depthOfField.focusDistance = 2000;
    defaultPipeline.depthOfField.focalLength = 50;
    defaultPipeline.depthOfField.fStop = 1.4;

    defaultPipeline.grainEnabled = false;
    defaultPipeline.grain.intensity = 15;
    defaultPipeline.grain.animated = true;

    defaultPipeline.chromaticAberrationEnabled = false;
    defaultPipeline.chromaticAberration.aberrationAmount = 30;
    defaultPipeline.chromaticAberration.radialIntensity = 1;

    // Ambient Room Light (Uniform default)
    const ambientLight = new BABYLON.HemisphericLight("ambientLight", new BABYLON.Vector3(0, 1, 0), scene);
    ambientLight.intensity = 0.4; // Restored to illuminate the entire workspace naturally
    ambientLight.groundColor = new BABYLON.Color3(0.2, 0.2, 0.2);

    // Main Studio Lamp (DirectionalLight for 100% uniform illumination across the entire table)
    light = new BABYLON.DirectionalLight("lampLight", new BABYLON.Vector3(-0.5, -2, -0.5), scene);
    light.position = new BABYLON.Vector3(10, 40, 10);
    light.intensity = 1.0;
    light.diffuse = new BABYLON.Color3(1, 1, 0.95);

    // Shadow Generator - Balanced PCF Soft Shadows
    const shadowGenerator = new BABYLON.ShadowGenerator(1024, light);
    shadowGenerator.usePercentageCloserFiltering = true;
    shadowGenerator.filteringQuality = BABYLON.ShadowGenerator.QUALITY_LOW;
    shadowGenerator.setDarkness(0.6); // Increased darkness so shadows aren't washed out by IBL
    shadowGenerator.bias = 0.0005; // Tiny bias to prevent acne but keep shadows grounded

    // Candle Light (Moody)
    const candleLight = new BABYLON.PointLight("candleLight", new BABYLON.Vector3(12, 1.5, 14), scene);
    candleLight.intensity = 0.0; // Off by default
    candleLight.diffuse = new BABYLON.Color3(1, 0.6, 0.2);
    
    const candleShadows = new BABYLON.ShadowGenerator(512, candleLight);
    candleShadows.usePercentageCloserFiltering = true;
    candleShadows.filteringQuality = BABYLON.ShadowGenerator.QUALITY_LOW;
    candleShadows.setDarkness(0.5);

    // Lamp Mesh (Visual Representation)
    const lampMesh = BABYLON.MeshBuilder.CreateCylinder("lampMesh", {height: 2, diameterTop: 3, diameterBottom: 4}, scene);
    lampMesh.position = new BABYLON.Vector3(0, 19, 0);
    const lampMat = new BABYLON.StandardMaterial("lampMat", scene);
    lampMat.diffuseColor = new BABYLON.Color3(0.1, 0.1, 0.1);
    lampMat.emissiveColor = new BABYLON.Color3(0.5, 0.5, 0.4);
    lampMesh.material = lampMat;

    // The Workshop Table (Thick Box for 3D realism, perfectly square)
    const table = BABYLON.MeshBuilder.CreateBox("workshopTable", {width: 32, height: 2, depth: 32}, scene);
    table.position.y = -1; // Top surface at y=0
    const tableMat = new BABYLON.StandardMaterial("tableMat", scene);
    const woodTex = new BABYLON.Texture("/wood.jpg", scene);
    woodTex.uScale = 2;
    woodTex.vScale = 2;
    tableMat.diffuseTexture = woodTex;
    tableMat.specularColor = new BABYLON.Color3(0.1, 0.05, 0.02);
    table.material = tableMat;
    table.receiveShadows = true;

    // The Map Canvas (Parchment Paper resting on table)
    // --- WebGPU Shader Math ---
    BABYLON.Effect.ShadersStore["mapVertexShader"] = `
        precision highp float;
        attribute vec3 position;
        attribute vec2 uv;
        attribute vec3 normal;
        uniform mat4 worldViewProjection;
        
        // Procedural Tool Parameters
        uniform float noiseScale;
        uniform float elevation;
        uniform int proceduralEnabled;
        
        varying vec2 vUV;
        varying vec3 vPosition;

        // Simplex/Perlin noise approximation for WebGL/WebGPU
        float rand(vec2 n) { return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453); }
        float noise(vec2 p){
            vec2 ip = floor(p);
            vec2 u = fract(p);
            u = u*u*(3.0-2.0*u);
            return mix(
                mix(rand(ip),rand(ip+vec2(1.0,0.0)),u.x),
                mix(rand(ip+vec2(0.0,1.0)),rand(ip+vec2(1.0,1.0)),u.x),u.y);
        }

        void main() {
            vec3 pos = position;
            if (proceduralEnabled == 1) {
                float n = noise(pos.xz * noiseScale);
                n += noise(pos.xz * noiseScale * 2.0) * 0.5;
                pos.y += (n * elevation);
            }
            gl_Position = worldViewProjection * vec4(pos, 1.0);
            vUV = uv;
            vPosition = pos;
        }
    `;

    BABYLON.Effect.ShadersStore["mapFragmentShader"] = `
        precision highp float;
        varying vec2 vUV;
        varying vec3 vPosition;
        
        uniform sampler2D diffuseTexture;
        uniform int proceduralEnabled;

        void main() {
            vec4 color = texture2D(diffuseTexture, vUV);
            
            // Procedural Sandbox Biomes
            if (proceduralEnabled == 1) {
                float h = vPosition.y;
                if (h < 0.5) color = mix(color, vec4(0.1, 0.3, 0.6, 1.0), 0.7); // Water
                else if (h < 1.0) color = mix(color, vec4(0.8, 0.7, 0.4, 1.0), 0.7); // Sand
                else if (h < 2.5) color = mix(color, vec4(0.2, 0.5, 0.2, 1.0), 0.7); // Grass
                else if (h < 4.0) color = mix(color, vec4(0.5, 0.5, 0.5, 1.0), 0.7); // Rock
                else color = mix(color, vec4(0.9, 0.9, 0.95, 1.0), 0.7); // Snow
            }

            gl_FragColor = color;
        }
    `;

    // High-density subdivisions required for procedural shader vertex displacement
    baseMap = BABYLON.MeshBuilder.CreateGround("baseMap", {width: 24, height: 16, subdivisions: 256}, scene);
    baseMap.position.y = 0.02; // Hover slightly above table
    baseMap.position.z = -3;   // Shift lower on the table to make room for tools at the top
    
    // Instantiate Shader Math
    const shaderMat = new BABYLON.ShaderMaterial("shaderMat", scene, {
        vertex: "map",
        fragment: "map"
    }, {
        attributes: ["position", "normal", "uv"],
        uniforms: ["worldViewProjection", "noiseScale", "elevation", "proceduralEnabled"]
    });
    
    shaderMat.setTexture("diffuseTexture", new BABYLON.Texture("/placeholder_map.jpg", scene));
    shaderMat.setInt("proceduralEnabled", 0);
    
    baseMap.material = shaderMat;
    baseMap.receiveShadows = true;

    // Initialize 3D Compositing Layer Manager
    const layerManager = new MapLayerManager(scene, baseMap);
    
    shadowGenerator.addShadowCaster(baseMap);
    candleShadows.addShadowCaster(baseMap);

    // Generate the procedural cartography tools array and add shadows
    const props = buildCartographyTools(scene, [shadowGenerator, candleShadows]);

    // Flickering animation for candle and camera checks
    let alpha = 0;
    scene.registerBeforeRender(() => {
      // Hide lamp mesh if camera is directly overhead (beta < 0.2 radians)
      if (camera.beta < 0.2) {
        lampMesh.isVisible = false;
      } else {
        lampMesh.isVisible = true;
      }

      if (candleLight.isEnabled()) {
        alpha += 0.05;
        candleLight.intensity = 0.4 + Math.random() * 0.1 + Math.sin(alpha) * 0.05;
      }
    });

    // UI Event Listeners for Lighting & Orientation
    const envSelect = document.getElementById("env-lighting-select");
    if (envSelect) {
      envSelect.addEventListener("change", (e) => {
        if (e.target.value === "uniform") {
          ambientLight.intensity = 0.5;
          light.intensity = 1.0;
          candleLight.setEnabled(false);
        } else if (e.target.value === "candle") {
          ambientLight.intensity = 0.1;
          light.intensity = 0.8;
          candleLight.setEnabled(true);
        }
      });
    }

    const tempSelect = document.getElementById("lighting-temp-select");
    if (tempSelect) {
      tempSelect.value = "studio"; // Set default in UI to match initial lighting
      tempSelect.addEventListener("change", (e) => {
        if (e.target.value === "moonlight") {
          light.diffuse = new BABYLON.Color3(0.7, 0.8, 1.0);
          ambientLight.diffuse = new BABYLON.Color3(0.4, 0.5, 0.8);
        } else if (e.target.value === "overcast") {
          light.diffuse = new BABYLON.Color3(0.9, 0.95, 1.0);
          ambientLight.diffuse = new BABYLON.Color3(0.95, 0.95, 1.0);
        } else if (e.target.value === "studio") {
          light.diffuse = new BABYLON.Color3(1, 1, 0.95);
          ambientLight.diffuse = new BABYLON.Color3(1, 1, 1);
        } else if (e.target.value === "daylight") {
          light.diffuse = new BABYLON.Color3(1.0, 0.95, 0.9);
          ambientLight.diffuse = new BABYLON.Color3(0.85, 0.9, 1.0);
        } else if (e.target.value === "golden") {
          light.diffuse = new BABYLON.Color3(1.0, 0.85, 0.6);
          ambientLight.diffuse = new BABYLON.Color3(0.9, 0.7, 0.6);
        } else if (e.target.value === "halogen") {
          light.diffuse = new BABYLON.Color3(1.0, 0.8, 0.65);
          ambientLight.diffuse = new BABYLON.Color3(1.0, 0.9, 0.8);
        } else if (e.target.value === "vintage") {
          light.diffuse = new BABYLON.Color3(1.0, 0.7, 0.4);
          ambientLight.diffuse = new BABYLON.Color3(1.0, 0.8, 0.5);
        }
      });
    }

    // Terrain Engine Toggles
    const genTerrainBtn = document.getElementById("generate-terrain-btn");
    if (genTerrainBtn) {
      genTerrainBtn.addEventListener("click", () => {
        // Apply CPU vertex displacement (simulating AI shader input)
        layerManager.applyProceduralElevation(0.8, 1.2);
      });
    }

    const flatTerrainBtn = document.getElementById("flatten-terrain-btn");
    if (flatTerrainBtn) {
      flatTerrainBtn.addEventListener("click", () => {
        layerManager.flattenTerrain();
      });
    }

    const addSettlementBtn = document.getElementById("add-settlement-btn");
    if (addSettlementBtn) {
      let settlementCount = 0;
      // Pre-create a material for markers
      const markerMat = new BABYLON.StandardMaterial("markerMat", scene);
      markerMat.diffuseColor = new BABYLON.Color3(0.8, 0.2, 0.2); // Ruby red
      markerMat.specularColor = new BABYLON.Color3(1, 0.5, 0.5);

      addSettlementBtn.addEventListener("click", () => {
        settlementCount++;
        // Drop it randomly within the center bounds of the map (-5 to 5)
        const rx = (Math.random() - 0.5) * 10;
        const rz = (Math.random() - 0.5) * 10;
        const marker = layerManager.addMarker("settlements", `city_${settlementCount}`, rx, rz, markerMat);
        shadowGenerator.addShadowCaster(marker);
        candleShadows.addShadowCaster(marker);
      });
    }

    let isLandscape = true;
    const toggleBtn = document.getElementById("toggle-orientation-btn");
    if (toggleBtn) {
      toggleBtn.addEventListener("click", () => {
        const renderWidth = canvas.clientWidth;
        const renderHeight = canvas.clientHeight;
        const isLandscape = renderWidth > renderHeight;
        toggleBtn.textContent = isLandscape ? i18next.t("canvas.orientationLandscape") : i18next.t("canvas.orientationPortrait");
        engine.resize();
        
        // Normalize current alpha to prevent 360-degree whirlwind spins
        let currentAlpha = camera.alpha;
        while (currentAlpha > Math.PI) currentAlpha -= 2 * Math.PI;
        while (currentAlpha <= -Math.PI) currentAlpha += 2 * Math.PI;
        camera.alpha = currentAlpha;
        
        const targetAlpha = -Math.PI / 2;
        
        // Smooth Animation Configuration
        const ease = new BABYLON.CubicEase();
        ease.setEasingMode(BABYLON.EasingFunction.EASINGMODE_EASEINOUT);
        
        // Stop existing animations before starting new ones
        scene.stopAnimation(camera);
        
        BABYLON.Animation.CreateAndStartAnimation("camSnapAlpha", camera, "alpha", 60, 45, currentAlpha, targetAlpha, 2, ease);
        BABYLON.Animation.CreateAndStartAnimation("camSnapTarX", camera, "targetX", 60, 45, camera.target.x, 0, 2, ease);
        BABYLON.Animation.CreateAndStartAnimation("camSnapTarZ", camera, "targetZ", 60, 45, camera.target.z, -3, 2, ease);
        
        if (isLandscape) {
          baseMap.scaling = new BABYLON.Vector3(1, 1, 1);
        } else {
          // Portrait mode: scale X down, scale Z up
          baseMap.scaling = new BABYLON.Vector3(16/24, 1, 24/16);
        }
      });
    }

    // Zoom Tool Logic
    let isZoomToolActive = false;
    const zoomToolBtn = document.getElementById("zoom-tool-btn");
    
    if (zoomToolBtn) {
      zoomToolBtn.addEventListener("click", () => {
        isZoomToolActive = !isZoomToolActive;
        zoomToolBtn.textContent = isZoomToolActive ? i18next.t("canvas.zoomToolOn") : i18next.t("canvas.zoomToolOff");
        zoomToolBtn.style.color = isZoomToolActive ? "var(--accent-color)" : "var(--text-main)";
        
        if (isZoomToolActive) {
          canvas.classList.add("cursor-zoom-in");
          // Disable left-click rotation (button 0) but keep right-click panning (button 2) active
          if (camera.inputs.attached.pointers) {
            camera.inputs.attached.pointers.buttons = [1, 2];
          }
        } else {
          canvas.classList.remove("cursor-zoom-in");
          canvas.classList.remove("cursor-zoom-out");
          // Restore all mouse buttons for native camera controls
          if (camera.inputs.attached.pointers) {
            camera.inputs.attached.pointers.buttons = [0, 1, 2];
          }
          
          // Smoothly reset view to centered map and zoomed-out radius
          const ease = new BABYLON.CubicEase();
          ease.setEasingMode(BABYLON.EasingFunction.EASINGMODE_EASEINOUT);
          
          scene.stopAnimation(camera);
          BABYLON.Animation.CreateAndStartAnimation("resetRad", camera, "radius", 60, 45, camera.radius, 35, 2, ease);
          BABYLON.Animation.CreateAndStartAnimation("resetTarX", camera, "targetX", 60, 45, camera.target.x, 0, 2, ease);
          BABYLON.Animation.CreateAndStartAnimation("resetTarZ", camera, "targetZ", 60, 45, camera.target.z, -3, 2, ease);
        }
      });
    }

    window.addEventListener("keydown", (e) => {
      if (isZoomToolActive && (e.key === "Control" || e.key === "Meta")) {
        canvas.classList.replace("cursor-zoom-in", "cursor-zoom-out");
      }
    });
    window.addEventListener("keyup", (e) => {
      if (isZoomToolActive && (e.key === "Control" || e.key === "Meta")) {
        canvas.classList.replace("cursor-zoom-out", "cursor-zoom-in");
      }
    });

    scene.onPointerObservable.add((pointerInfo) => {
      if (!isZoomToolActive) return;
      
      if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERDOWN) {
        const evt = pointerInfo.event;
        // Only trigger zoom logic on left-click (button 0)
        if (evt.button !== 0) return;
        
        const isZoomOut = evt.ctrlKey || evt.metaKey;
        
        const pickResult = scene.pick(scene.pointerX, scene.pointerY, (mesh) => mesh === baseMap);
        if (pickResult.hit) {
          const targetPoint = pickResult.pickedPoint;
          targetPoint.y = 0; // Lock to table height
          
          // Use 1/6 increments (approx 16.6% change)
          const increment = 1 / 6;
          let targetRadius = camera.radius * (isZoomOut ? (1 + increment) : (1 - increment));
          if (targetRadius < camera.lowerRadiusLimit) targetRadius = camera.lowerRadiusLimit;
          if (targetRadius > camera.upperRadiusLimit) targetRadius = camera.upperRadiusLimit;
          
          // Always center on the point clicked, but if zooming out, remain relative to the current center
          let finalTarget = isZoomOut ? camera.target.clone() : targetPoint;
          
          const ease = new BABYLON.CubicEase();
          ease.setEasingMode(BABYLON.EasingFunction.EASINGMODE_EASEOUT);
          
          scene.stopAnimation(camera); // Stop previous zoom animations to prevent jumping
          BABYLON.Animation.CreateAndStartAnimation("zoomRad", camera, "radius", 60, 20, camera.radius, targetRadius, 2, ease);
          
          if (!isZoomOut) {
            BABYLON.Animation.CreateAndStartAnimation("zoomTarX", camera, "targetX", 60, 20, camera.target.x, finalTarget.x, 2, ease);
            BABYLON.Animation.CreateAndStartAnimation("zoomTarZ", camera, "targetZ", 60, 20, camera.target.z, finalTarget.z, 2, ease);
          }
        }
      }
    });

    window.scene = scene;
    window.light = light;
    return scene;
  };

  createScene();

  engine.runRenderLoop(function () {
    scene.render();
  });

  window.addEventListener("resize", function () {
    engine.resize();
  });
  
  const rendererBtn = document.getElementById("toggle-renderer-btn");
  if (rendererBtn) {
    const params = new URLSearchParams(window.location.search);
    const isForced = params.get("webgl") === "1";
    rendererBtn.textContent = isForced ? i18next.t("canvas.restoreWebGPU") : i18next.t("canvas.forceWebGL");
    rendererBtn.addEventListener("click", () => {
      if (isForced) {
        params.delete("webgl");
      } else {
        params.set("webgl", "1");
      }
      window.location.search = params.toString();
    });
  }
}

async function prewarmModel(modelId) {
  const sendBtn = document.getElementById("send-btn");
  if (sendBtn) {
    sendBtn.disabled = true;
    sendBtn.classList.add("disabled");
  }
  
  let persistentToast = null;
  
  try {
    persistentToast = showToast(i18next.t('toasts.prewarmingPersistent', "Please wait, prewarming is in progress..."), "info", true);
    
    if (window.unloadPromise) {
      showToast(i18next.t('toasts.waitingUnload', "Waiting for safely unloading to complete before prewarming..."), "warning");
      await window.unloadPromise;
      window.unloadPromise = null;
      showToast(i18next.t('toasts.deferredPrewarm', "Activating deferred pre-warming..."), "info");
    }

    showToast(i18next.t('toasts.prewarming', { model: modelId.split("/")[1] }), "info");
    const res = await fetch("http://localhost:8001/api/ollama/prewarm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: modelId })
    });
    const data = await res.json();
    
    if (data.status === "missing") {
      showToast(i18next.t('toasts.modelMissingDownloadLater'), "warning");
      return;
    } else if (data.status === "offline") {
      showToast(i18next.t('toasts.ollamaNotRunning'), "error");
    }

    if (modelId.includes("gemma4") && data.status !== "offline") {
      showToast(i18next.t('toasts.prewarming_e2b', { model: "gemma4:e2b (subconscious)" }), "info");
      await fetch("http://localhost:8001/api/ollama/prewarm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "gemma4:e2b" })
      });
    }

    if (data.status === "error" || data.status === "offline") {
      throw new Error(data.error);
    }
    showToast(i18next.t('toasts.prewarmComplete', "Pre-warming complete! Models are resident in VRAM."), "success");
    startOllamaPoll();
  } catch (e) {
    showToast(i18next.t('toasts.fallbackGemini', { modelId, error: e.message }), "error");
    const modelSelect = document.getElementById("model-select");
    modelSelect.value = "gemini/gemini-3.5-flash";
    // Deliberately NOT saving state to projects.yaml so fallback is temporary
    renderReasoningTabs(modelSelect.value);
    document.getElementById("hardware-monitor").classList.add("hidden");
    if (ollamaStatusInterval) clearInterval(ollamaStatusInterval);
  } finally {
    if (persistentToast) persistentToast.remove();
    if (sendBtn) {
      sendBtn.disabled = false;
      sendBtn.classList.remove("disabled");
    }
  }
}

async function loadModels() {
  try {
    const res = await fetch("http://localhost:8001/api/models");
    const data = await res.json();
    const select = document.getElementById("model-select");
    select.innerHTML = "";
    
    if (data.assistant_models) {
      data.assistant_models.forEach(model => {
        const opt = document.createElement("option");
        opt.value = model.id;
        opt.textContent = model.label;
        select.appendChild(opt);
      });
      // Fetch persisted state from YAML backend
      let savedModel = "ollama_chat/gemma4:e4b";
      try {
          const stateRes = await fetch("http://localhost:8001/api/projects");
          if (stateRes.ok) {
              const data = await stateRes.json();
              const activeId = data.active_project;
              if (activeId && data.projects[activeId]) {
                  savedModel = data.projects[activeId].selectedModel || savedModel;
              }
          }
      } catch (e) {
          console.error("Failed to load project state", e);
      }
      
      if ([...select.options].some(o => o.value === savedModel)) {
        select.value = savedModel;
      } else {
        select.value = "ollama_chat/gemma4:e4b";
      }
      
      select.dataset.old = select.value;
      renderReasoningTabs(select.value);
      
      if (select.value.includes("ollama_chat")) {
        prewarmModel(select.value);
      }
    }
    
    // Load Image Models
    if (data.image_models) {
      const imgSelectContainer = document.getElementById("image-model-select");
      const selectedBox = imgSelectContainer.querySelector(".select-selected");
      const itemsContainer = imgSelectContainer.querySelector(".select-items");
      
      itemsContainer.innerHTML = "";
      
      let currentValue = data.image_models[0]?.id || "";
      let currentShortText = "";
      
      data.image_models.forEach(model => {
        let shortText = model.label;
        
        let longText = shortText;
        if (model.capabilities && model.capabilities.length > 0) {
          longText += ` | ${model.capabilities.join(', ')}`;
        }
        
        if (model.id === currentValue) {
          currentShortText = shortText;
        }
        
        const div = document.createElement("div");
        div.textContent = longText;
        div.dataset.value = model.id;
        
        div.addEventListener("click", (e) => {
          e.stopPropagation();
          currentValue = model.id;
          imgSelectContainer.dataset.value = model.id; // Expose globally for API payload
          selectedBox.textContent = shortText;
          itemsContainer.classList.add("select-hide");
          renderImageModelControls(currentValue);
        });
        
        itemsContainer.appendChild(div);
      });
      
      selectedBox.textContent = currentShortText;
      imgSelectContainer.dataset.value = currentValue; // Set initial value globally
      
      selectedBox.addEventListener("click", (e) => {
        e.stopPropagation();
        itemsContainer.classList.toggle("select-hide");
      });
      
      if (!window.__imgSelectListenerAdded) {
        document.addEventListener("click", (e) => {
          const container = document.getElementById("image-model-select");
          if (container && !container.contains(e.target)) {
            const items = container.querySelector(".select-items");
            if (items) items.classList.add("select-hide");
          }
        });
        window.__imgSelectListenerAdded = true;
      }
      
      // Initial render
      renderImageModelControls(currentValue);
    }
  } catch (e) {
    console.error("Failed to load models.yaml", e);
  }
}

function renderImageModelControls(modelId) {
  const container = document.getElementById("image-model-controls");
  container.innerHTML = "";
  
  if (modelId.includes("imagen-4.0")) {
    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 4px;">
        <label for="img-aspect-ratio" style="font-size: 0.85rem; color: var(--text-muted);">Aspect Ratio (One-Shot)</label>
        <select id="img-aspect-ratio" class="dropdown">
          <option value="1:1">1:1 (Square)</option>
          <option value="16:9">16:9 (Landscape)</option>
          <option value="9:16">9:16 (Portrait)</option>
        </select>
      </div>
      <div style="display: flex; flex-direction: column; gap: 4px;">
        <label for="img-seed" style="font-size: 0.85rem; color: var(--text-muted);" title="Set a specific seed for deterministic reproduction">Determinism (Seed)</label>
        <input type="number" id="img-seed" placeholder="Random" oninput="if(this.value !== '' && this.value < 0) this.value = '';" style="background: var(--bg-color); color: var(--text-main); border: 1px solid var(--border-color); padding: 10px 14px; font-size: 1rem; border-radius: 4px; font-family: inherit; width: 140px; box-sizing: border-box;" />
      </div>
      <div style="display: flex; flex-direction: column; gap: 4px;">
        <label for="img-cfg" style="font-size: 0.85rem; color: var(--text-muted);" title="${i18next.t('asset.guidanceScaleTitle')}" data-i18n="asset.guidanceScale" data-i18n-title="asset.guidanceScaleTitle">${i18next.t('asset.guidanceScale')}</label>
        <input type="range" id="img-cfg" min="1" max="20" step="0.5" value="7.5" />
      </div>
    `;
  } else if (modelId.includes("nano-banana")) {
    container.innerHTML = `
      <label class="toggle-container" title="Toggle between generating a new image vs conversational editing">
        <input type="checkbox" id="nano-edit-mode">
        <span class="toggle-slider"></span>
        <span>Edit Mode (Reference Image)</span>
      </label>
      <div id="nano-edit-container" class="hidden" style="margin-top: 4px; display: flex; flex-direction: column; gap: 4px;">
        <input type="file" id="nano-ref-image" accept="image/*" style="font-size: 0.8rem;" />
      </div>
      <div style="display: flex; flex-direction: column; gap: 4px; margin-top: 4px;">
        <label for="nano-consistency" style="font-size: 0.85rem; color: var(--text-muted);" title="0 = Creative, 100 = Strict Consistency">Consistency Strength</label>
        <input type="range" id="nano-consistency" min="0" max="100" value="80" />
      </div>
      <div style="display: flex; flex-direction: column; gap: 4px; margin-top: 4px;">
        <label for="nano-cfg" style="font-size: 0.85rem; color: var(--text-muted);" title="${i18next.t('asset.guidanceScaleTitle')}" data-i18n="asset.guidanceScale" data-i18n-title="asset.guidanceScaleTitle">${i18next.t('asset.guidanceScale')}</label>
        <input type="range" id="nano-cfg" min="1" max="20" step="0.5" value="7.5" />
      </div>
    `;
    
    document.getElementById("nano-edit-mode").addEventListener("change", (e) => {
      const editContainer = document.getElementById("nano-edit-container");
      if (e.target.checked) {
        editContainer.classList.remove("hidden");
      } else {
        editContainer.classList.add("hidden");
      }
    });
  }
}

// App Entry Point
async function main() {
  await initI18n();
  await loadProjects();
  await loadModels();
  await loadLibraryFolders();
  await initBabylon();
  console.log("Verdant Beech initialized successfully.");
}

// --- Chat Logic ---
const chatHistory = document.getElementById("chat-history");
const chatInput = document.getElementById("chat-input");
const sendBtn = document.getElementById("send-btn");
const modelSelect = document.getElementById("model-select");
const taskCountSpan = document.getElementById("task-count");
const reasoningTabs = document.getElementById("reasoning-tabs");
const tabLow = document.getElementById("tab-low");
const tabMed = document.getElementById("tab-med");
const tabHigh = document.getElementById("tab-high");
const tabs = [tabLow, tabMed, tabHigh];
const hwMonitor = document.getElementById("hardware-monitor");
const ramUse = document.getElementById("ram-use");
const vramUse = document.getElementById("vram-use");
const toastContainer = document.getElementById("toast-container");
const downloadUI = document.getElementById("download-ui");
const downloadPercent = document.getElementById("download-percent");
const downloadProgress = document.getElementById("download-progress");
const downloadPauseBtn = document.getElementById("download-pause-btn");

let messages = [];
let activeTasks = 0;
let currentReasoning = "low";

let ollamaStatusInterval = null;
let downloadController = null;
let isDownloading = false;
let isDownloadPaused = false;
let currentDownloadModel = "";

function showToast(msg, type = "info", persistent = false) {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = msg;
  toastContainer.appendChild(toast);
  if (!persistent) {
    setTimeout(() => toast.remove(), 5000);
  }
  return toast;
}

let setupInProgress = true;
let setupToastShown = false;

async function updateOllamaStatus() {
  if (!modelSelect.value.includes("ollama_chat")) return;
  try {
    const res = await fetch("http://localhost:8001/api/ollama/status");
    const status = await res.json();
    if (status.online) {
      hwMonitor.classList.remove("hidden");
      ramUse.textContent = status.ram_gb.toFixed(1);
      vramUse.textContent = status.vram_gb.toFixed(1);
    } else {
      hwMonitor.classList.add("hidden");
    }
    
    // Check auto-setup status
    if (setupInProgress) {
        const setupRes = await fetch("http://localhost:8001/api/setup/status");
        const setupData = await setupRes.json();
        setupInProgress = setupData.in_progress;
        
        if (!setupInProgress && setupData.updated && !setupToastShown) {
            showToast(i18next.t('toasts.modelsUpdated'), "info");
            setupToastShown = true;
        }
    }
  } catch (e) {
    hwMonitor.classList.add("hidden");
  }
}

function startOllamaPoll() {
  if (ollamaStatusInterval) clearInterval(ollamaStatusInterval);
  updateOllamaStatus();
  ollamaStatusInterval = setInterval(updateOllamaStatus, 3000);
}

async function unloadOllama() {
  sendBtn.disabled = true;
  try {
    showToast(i18next.t('toasts.unloadingModels', "Waiting for active tasks to complete before safely unloading VRAM..."), "warning");
    await fetch("http://localhost:8001/api/ollama/unload", { method: "POST" });
  } catch(e) {}
  sendBtn.disabled = false;
}

async function streamDownload(tag) {
  downloadUI.classList.remove("hidden");
  sendBtn.disabled = true;
  modelSelect.disabled = true;
  isDownloading = true;
  isDownloadPaused = false;
  currentDownloadModel = tag;
  downloadPauseBtn.textContent = i18next.t("chat.pause");
  
  downloadController = new AbortController();
  
  try {
    const res = await fetch("http://localhost:8001/api/ollama/pull", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: tag }),
      signal: downloadController.signal
    });
    
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const lines = decoder.decode(value).split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const data = JSON.parse(line);
          if (data.total && data.completed) {
            const pct = Math.floor((data.completed / data.total) * 100);
            downloadProgress.value = pct;
            downloadPercent.textContent = pct + "%";
          }
          if (data.status === "paused") {
            downloadPauseBtn.textContent = i18next.t("chat.resume");
          } else {
            downloadPauseBtn.textContent = i18next.t("chat.pause");
          }
          if (data.status === "success") {
            downloadProgress.value = 100;
            downloadPercent.textContent = "100%";
            setTimeout(() => downloadUI.classList.add("hidden"), 1000);
            sendBtn.disabled = false;
            modelSelect.disabled = false;
            isDownloading = false;
            showToast(i18next.t('toasts.downloadComplete'), "info");
            return true;
          }
        } catch(e) {}
      }
    }
  } catch (e) {
    if (e.name === "AbortError") {
      showToast(i18next.t('toasts.downloadPaused'), "warning");
      isDownloadPaused = true;
      downloadPauseBtn.textContent = i18next.t("chat.resume");
      sendBtn.disabled = false;
    } else {
      showToast(i18next.t('toasts.downloadFailed'), "error");
      downloadUI.classList.add("hidden");
      sendBtn.disabled = false;
      modelSelect.disabled = false;
      isDownloading = false;
    }
    return false;
  }
  return false;
}

downloadPauseBtn.addEventListener("click", () => {
  if (!isDownloadPaused && isDownloading) {
    downloadController.abort();
  } else if (isDownloadPaused) {
    streamDownload(currentDownloadModel);
  }
});

async function checkAndDownloadOllamaModel(modelId) {
  const tag = modelId.split("/")[1];
  try {
    const res = await fetch("http://localhost:8001/api/ollama/status");
    const status = await res.json();
    if (!status.online) {
      showToast(i18next.t('toasts.ollamaNotRunning'), "error");
      return false;
    }
    if (status.models.includes(tag)) {
      return true; // Installed
    }
    
    showToast(i18next.t('toasts.modelMissingStartingDownload', { tag }), "info");
    return await streamDownload(tag);
  } catch (e) {
    showToast(i18next.t('toasts.backendConnectionFailed'), "error");
    return false;
  }
}

function levelsSupport(modelId) {
  return modelId.includes("gemini-3.5-flash") || modelId.includes("gemini-3.1-pro");
}

function renderReasoningTabs(modelId) {
  let levels = [];
  
  if (modelId.includes("gemini-3.5-flash")) {
    levels = ["low", "med", "high"];
  } else if (modelId.includes("gemini-3.1-pro")) {
    levels = ["low", "high"];
  }

  tabs.forEach(tab => {
    const lvl = tab.dataset.level;
    tab.disabled = !levels.includes(lvl);
    
    if (lvl === currentReasoning && !tab.disabled) {
      tab.classList.add("active");
    } else {
      tab.classList.remove("active");
    }
  });

  const activeTab = tabs.find(t => t.dataset.level === currentReasoning);
  if (activeTab && activeTab.disabled) {
    if (levels.includes("low")) currentReasoning = "low";
    else if (levels.includes("high")) currentReasoning = "high";
    
    tabs.forEach(tab => {
      if (tab.dataset.level === currentReasoning && !tab.disabled) tab.classList.add("active");
    });
  }
}

modelSelect.addEventListener("change", async (e) => {
  const oldModel = modelSelect.dataset.old || "ollama_chat/gemma4:e4b";
  const newModel = e.target.value;
  modelSelect.dataset.old = newModel;
  saveState("selectedModel", newModel);
  
  if (oldModel.includes("ollama_chat") && !newModel.includes("ollama_chat")) {
    const hwMonitor = document.getElementById("hardware-monitor");
    if (hwMonitor) hwMonitor.classList.add("hidden");
    if (ollamaStatusInterval) clearInterval(ollamaStatusInterval);
    window.unloadPromise = unloadOllama();
  }
  
  if (newModel.includes("ollama_chat")) {
    const tag = newModel.split("/")[1];
    try {
      const res = await fetch("http://localhost:8001/api/ollama/status");
      const status = await res.json();
      if (status.online && !status.models.includes(tag)) {
        showToast(i18next.t('toasts.warningNotInstalledLocally', { tag }), "warning");
        // Still try to prewarm, which will fail and fallback, or we can just let it download on send
      } else if (!status.online) {
        showToast(i18next.t('toasts.ollamaNotRunning'), "error");
      }
    } catch(err){}
    prewarmModel(newModel);
  }
  
  renderReasoningTabs(newModel);
});

tabs.forEach(tab => {
  tab.onclick = () => {
    if (tab.disabled) return;
    currentReasoning = tab.dataset.level;
    renderReasoningTabs(modelSelect.value);
  };
});

function updateTaskCount(delta) {
  activeTasks += delta;
  taskCountSpan.textContent = activeTasks;
}

function appendMessage(role, content) {
  const msgDiv = document.createElement("div");
  msgDiv.className = `chat-message message-${role}`;
  msgDiv.textContent = content; // Safely add text
  chatHistory.appendChild(msgDiv);
  chatHistory.scrollTop = chatHistory.scrollHeight;

  // Show notification badge if the assistant panel isn't active and this is from the assistant
  if (role === "assistant") {
    const assistantBtn = document.getElementById("nav-assistant");
    if (assistantBtn && !assistantBtn.classList.contains("active")) {
      const badge = document.getElementById("assistant-badge");
      if (badge) badge.classList.remove("hidden");
    }
  }

  if (role !== "system" && role !== "thinking") {
    messages.push({ role, content });
  }
}

async function handleSend() {
  if (isDownloading && !isDownloadPaused) return; // Block while downloading
  
  if (modelSelect.value.includes("ollama_chat")) {
    const isReady = await checkAndDownloadOllamaModel(modelSelect.value);
    if (!isReady) return; // Wait for download to finish, or fail
  }

  const messageText = chatInput.value.trim();
  if (!messageText) return;

  if (setupInProgress && modelSelect.value.includes("ollama")) {
      showToast(i18next.t('toasts.backgroundModelSetupInProgress'), "info");
      
      const thinkingId = "thinking-setup-" + Date.now();
      const thinkingDiv = document.createElement("div");
      thinkingDiv.id = thinkingId;
      thinkingDiv.className = `chat-message message-assistant thinking`;
      thinkingDiv.innerHTML = "<span class='typing-dot'>.</span><span class='typing-dot'>.</span><span class='typing-dot'>.</span>";
      chatHistory.appendChild(thinkingDiv);
      chatHistory.scrollTop = chatHistory.scrollHeight;
      
      setTimeout(() => {
          thinkingDiv.remove();
      }, 3000);
      return;
  }

  appendMessage("user", messageText);
  chatInput.value = "";
  
  // Temporary "thinking" message with Subconscious UI Tracker
  const thinkingId = "thinking-" + Date.now();
  const thinkingDiv = document.createElement("div");
  thinkingDiv.id = thinkingId;
  thinkingDiv.className = `chat-message message-assistant thinking`;
  thinkingDiv.innerHTML = "<div style='display: flex; gap: 4px; align-items: center;'><span class='typing-dot'>.</span><span class='typing-dot'>.</span><span class='typing-dot'>.</span></div><div class='subconscious-tags' id='tags-" + thinkingId + "'></div>";
  chatHistory.appendChild(thinkingDiv);
  chatHistory.scrollTop = chatHistory.scrollHeight;
  
  const pollInterval = setInterval(async () => {
    if (!document.getElementById(thinkingId)) {
        clearInterval(pollInterval);
        return;
    }
    try {
        const res = await fetch(`http://localhost:8001/api/status/${activeProjectId}`);
        if (!res.ok) return;
        const status = await res.json();
        const tagsContainer = document.getElementById(`tags-${thinkingId}`);
        if (tagsContainer) {
            tagsContainer.innerHTML = "";
            if (status.gathering_thoughts) {
                tagsContainer.innerHTML += `<span class="subconscious-tag tag-gather">Gathering thoughts...</span>`;
            }
            if (status.lost_in_revery) {
                tagsContainer.innerHTML += `<span class="subconscious-tag tag-revery">Lost in revery...</span>`;
            }
        }
    } catch(e) {}
  }, 1000);

  updateTaskCount(1);
  try {
    const res = await fetch("http://localhost:8001/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        messages: messages,
        model_name: modelSelect.value,
        reasoning: levelsSupport(modelSelect.value) ? currentReasoning : null,
        project_id: activeProjectId
      })
    });
    const data = await res.json();
    
    if (data.reply && data.reply.startsWith("Error:")) {
       if (modelSelect.value.includes("ollama_chat")) {
           showToast(i18next.t('toasts.localModelErrorFallbackGemini'), "error");
           modelSelect.value = "gemini/gemini-3.5-flash";
           // Deliberately NOT saving state to projects.yaml so fallback is temporary
           renderReasoningTabs(modelSelect.value);
           document.getElementById("hardware-monitor").classList.add("hidden");
           if (ollamaStatusInterval) clearInterval(ollamaStatusInterval);
           
           // Retry with the fallback model
           const fallbackRes = await fetch("http://localhost:8001/api/chat", {
               method: "POST",
               headers: { "Content-Type": "application/json" },
               body: JSON.stringify({ 
                   messages: messages,
                   model_name: modelSelect.value,
                   reasoning: levelsSupport(modelSelect.value) ? currentReasoning : null,
                   project_id: activeProjectId
               })
           });
           const fallbackData = await fallbackRes.json();
           document.getElementById(thinkingId).remove();
           appendMessage("assistant", fallbackData.reply);
           return;
       }
    }
    
    if (data.tool_calls && data.tool_calls.length > 0) {
      executeCanvasTools(data.tool_calls);
    }
    
    document.getElementById(thinkingId).remove();
    appendMessage("assistant", data.reply);
  } catch (err) {
    document.getElementById(thinkingId).remove();
    appendMessage("assistant", "Connection error. Make sure the backend is running on port 8001.");
  } finally {
    updateTaskCount(-1);
  }
}

sendBtn.addEventListener("click", handleSend);
chatInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
});

function executeCanvasTools(toolCalls) {
  toolCalls.forEach(tc => {
    let args;
    try {
      args = JSON.parse(tc.arguments);
    } catch(e) { return; }
    
    console.log(`Executing tool: ${tc.name}`, args);
    showToast(i18next.t('toasts.greenAdjusting', { name: tc.name.replace(/_/g, " ") }), "info");
    
    if (!scene) return;
    
    switch(tc.name) {
      case "set_lighting":
        if (args.time_of_day === "morning") light.diffuse = new BABYLON.Color3(1, 0.9, 0.8);
        else if (args.time_of_day === "noon") light.diffuse = new BABYLON.Color3(1, 1, 1);
        else if (args.time_of_day === "evening") light.diffuse = new BABYLON.Color3(1, 0.5, 0.2);
        else if (args.time_of_day === "night") light.diffuse = new BABYLON.Color3(0.1, 0.2, 0.5);
        if (args.intensity !== undefined) light.intensity = args.intensity;
        break;
        
      case "apply_filter":
        if (!pipeline) {
          pipeline = new BABYLON.DefaultRenderingPipeline("defaultPipeline", true, scene, [camera]);
        }
        pipeline.imageProcessingEnabled = false;
        pipeline.bloomEnabled = false;
        
        if (args.filter_type === "sepia") {
          pipeline.imageProcessingEnabled = true;
          pipeline.imageProcessing.contrast = 1.2;
          pipeline.imageProcessing.exposure = 1.1;
        } else if (args.filter_type === "vignette") {
          pipeline.imageProcessingEnabled = true;
          pipeline.imageProcessing.vignetteEnabled = true;
          pipeline.imageProcessing.vignetteWeight = 5;
        } else if (args.filter_type === "bloom") {
          pipeline.bloomEnabled = true;
          pipeline.bloomThreshold = 0.5;
          pipeline.bloomWeight = 0.5;
        }
        break;
        
      case "set_map_tint":
        if (args.hex_color) {
          baseMat.diffuseColor = BABYLON.Color3.FromHexString(args.hex_color);
        }
        break;
        
      case "move_camera":
        if (camera.mode === BABYLON.Camera.ORTHOGRAPHIC_CAMERA) {
           if (args.zoom) {
              const canvas = document.getElementById("renderCanvas");
              camera.orthoTop = args.zoom;
              camera.orthoBottom = -args.zoom;
              camera.orthoLeft = -args.zoom * (canvas.width / canvas.height);
              camera.orthoRight = args.zoom * (canvas.width / canvas.height);
           }
           if (args.x !== undefined && args.y !== undefined) {
              camera.position.x = args.x;
              camera.position.z = args.y;
           }
        }
        break;
        
      case "toggle_overlay":
        if (overlayMesh) {
          overlayMesh.dispose();
          overlayMesh = null;
        }
        if (args.enabled) {
          overlayMesh = BABYLON.MeshBuilder.CreateGround("overlay", {width: 40, height: 40}, scene);
          overlayMesh.position.y = 0.1;
          const gridMat = new BABYLON.StandardMaterial("gridMat", scene);
          gridMat.wireframe = true;
          gridMat.diffuseColor = new BABYLON.Color3(1, 1, 1);
          gridMat.alpha = 0.3;
          overlayMesh.material = gridMat;
        }
        break;
        
      case "add_map_marker":
        const marker = BABYLON.MeshBuilder.CreateCylinder("marker", {diameterTop: 0, diameterBottom: 1, height: 2, tessellation: 4}, scene);
        marker.position = new BABYLON.Vector3(args.x, 1, args.y);
        const markerMat = new BABYLON.StandardMaterial("markerMat", scene);
        markerMat.diffuseColor = BABYLON.Color3.Red();
        marker.material = markerMat;
        markers.push(marker);
        break;
        
      case "toggle_weather":
        if (particleSystem) {
          particleSystem.stop();
          particleSystem.dispose();
          particleSystem = null;
        }
        if (args.weather_type && args.weather_type !== "clear") {
          particleSystem = new BABYLON.ParticleSystem("weather", 2000, scene);
          particleSystem.particleTexture = new BABYLON.Texture("https://raw.githubusercontent.com/BabylonJS/Babylon.js/master/packages/tools/playground/public/textures/flare.png", scene);
          particleSystem.emitter = new BABYLON.Vector3(0, 20, 0); 
          particleSystem.minEmitBox = new BABYLON.Vector3(-20, 0, -20);
          particleSystem.maxEmitBox = new BABYLON.Vector3(20, 0, 20);
          particleSystem.direction1 = new BABYLON.Vector3(-1, -10, -1);
          particleSystem.direction2 = new BABYLON.Vector3(1, -10, 1);
          particleSystem.minLifeTime = 1.0;
          particleSystem.maxLifeTime = 2.0;
          
          if (args.weather_type === "snow") {
             particleSystem.color1 = new BABYLON.Color4(1,1,1,1);
             particleSystem.color2 = new BABYLON.Color4(1,1,1,0.5);
          } else if (args.weather_type === "rain") {
             particleSystem.color1 = new BABYLON.Color4(0.5,0.5,1,1);
             particleSystem.colorDead = new BABYLON.Color4(0,0,0.2,0);
             particleSystem.emitRate = 1000;
          }
          particleSystem.start();
        }
        break;
        
      case "generate_procedural_land":
        if (baseMap && baseMap.material && baseMap.material.getClassName() === "ShaderMaterial") {
            baseMap.material.setInt("proceduralEnabled", 1);
            baseMap.material.setFloat("noiseScale", args.noise_scale || 2.0);
            baseMap.material.setFloat("elevation", args.elevation || 3.0);
        }
        break;

      case "add_text_label":
        const labelPlane = BABYLON.MeshBuilder.CreatePlane("label", {width: 10, height: 2}, scene);
        labelPlane.position = new BABYLON.Vector3(args.x, 0.2, args.y);
        labelPlane.rotation.x = Math.PI / 2;
        
        const dt = new BABYLON.DynamicTexture("dt", {width: 1024, height: 256}, scene, false);
        dt.hasAlpha = true;
        dt.drawText(args.text, null, null, "bold 60px Arial", "white", "transparent", true);
        
        const mat = new BABYLON.StandardMaterial("mat", scene);
        mat.diffuseTexture = dt;
        mat.emissiveColor = BABYLON.Color3.White();
        mat.backFaceCulling = false;
        labelPlane.material = mat;
        break;
    }
  });
}

// Navigation Logic
const navBtns = document.querySelectorAll(".nav-btn");
const panels = document.querySelectorAll(".panel");
const assistantBadge = document.getElementById("assistant-badge");

navBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    // Hide all panels and deactivate buttons
    navBtns.forEach(b => b.classList.remove("active"));
    panels.forEach(p => p.classList.remove("active"));
    
    // Activate clicked
    btn.classList.add("active");
    const panelId = btn.id.replace("nav-", "") + "-panel";
    const targetPanel = document.getElementById(panelId);
    if (targetPanel) {
      targetPanel.classList.add("active");
    }
    
    // Clear badge if assistant clicked
    if (btn.id === "nav-assistant" && assistantBadge) {
      assistantBadge.classList.add("hidden");
    }
  });
});

// --- Project Management ---
const projectDropdownBtn = document.getElementById("project-dropdown-btn");
const projectSelectItems = document.getElementById("project-select-items");
const projectNameInput = document.getElementById("project-name-input");
const deleteProjectBtn = document.getElementById("delete-project-btn");

let activeProjectId;
async function loadProjects() {
  if (!projectSelectItems || !projectNameInput) return;
  try {
    const res = await fetch("http://localhost:8001/api/projects");
    const data = await res.json();
    
    projectSelectItems.innerHTML = "";
    
    const newOpt = document.createElement("div");
    newOpt.textContent = i18next.t("projects.newProject");
    newOpt.style.fontWeight = "bold";
    newOpt.addEventListener("click", () => handleProjectChange("_new_"));
    projectSelectItems.appendChild(newOpt);
    
    Object.keys(data.projects).forEach(id => {
      const opt = document.createElement("div");
      opt.textContent = data.projects[id].name;
      opt.addEventListener("click", () => handleProjectChange(id));
      projectSelectItems.appendChild(opt);
    });
    
    activeProjectId = data.active_project;
    
    if (activeProjectId && data.projects[activeProjectId]) {
      projectNameInput.value = data.projects[activeProjectId].name;
    } else {
      projectNameInput.value = "";
    }
  } catch(e) {
    console.error("Failed to load projects", e);
  }
}

async function renameProject(newName) {
  if (!newName || !activeProjectId) return;
  try {
    const res = await fetch("http://localhost:8001/api/projects/rename", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName })
    });
    const data = await res.json();
    if (data.status === "success") {
      await loadProjects();
      showToast(i18next.t('toasts.projectRenamed'), "success");
    } else {
      showToast(data.error, "error");
      await loadProjects(); // Reset input to current name
    }
  } catch(e) {
    showToast(i18next.t('toasts.errorRenamingProject'), "error");
  }
}

if (projectNameInput) {
  projectNameInput.addEventListener("blur", () => {
    renameProject(projectNameInput.value.trim());
  });
  projectNameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      projectNameInput.blur();
    }
  });
}

async function handleProjectChange(val) {
  if (projectSelectItems) projectSelectItems.classList.add("select-hide");
  if (val === "_new_") {
    // Create new project
    try {
      const res = await fetch("http://localhost:8001/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: i18next.t("projects.untitledProject") })
      });
      const data = await res.json();
      if (data.status === "success") {
        await loadProjects();
        await loadModels(); // Reload model config
        projectNameInput.focus();
        projectNameInput.select(); // Prompt to rename immediately
        showToast(i18next.t('toasts.newProjectCreated'), "success");
      }
    } catch(e) {
      showToast(i18next.t('toasts.errorCreatingProject'), "error");
    }
  } else {
    // Switch active project
    try {
      await fetch("http://localhost:8001/api/projects/active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: val })
      });
      await loadProjects();
      await loadModels(); // Reload model config
      showToast(i18next.t('toasts.projectSwitched'), "info");
    } catch(e) {
      showToast(i18next.t('toasts.errorSwitchingProject'), "error");
    }
  }
}

if (projectDropdownBtn && projectSelectItems) {
  if (!window.__projListenerAdded) {
    projectDropdownBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      projectSelectItems.classList.toggle("select-hide");
    });
    document.addEventListener("click", (e) => {
      if (!projectSelectItems.contains(e.target) && !projectDropdownBtn.contains(e.target)) {
        projectSelectItems.classList.add("select-hide");
      }
    });
    window.__projListenerAdded = true;
  }
}

if (deleteProjectBtn) {
  const deletePopover = document.getElementById("delete-popover");
  const popoverCancel = document.getElementById("popover-cancel");
  const popoverConfirm = document.getElementById("popover-confirm");

  deleteProjectBtn.addEventListener("click", (e) => {
    if (!activeProjectId) return;
    e.stopPropagation();
    deletePopover.classList.remove("hidden");
  });

  document.addEventListener("click", (e) => {
    if (deletePopover && !deletePopover.contains(e.target) && !deleteProjectBtn.contains(e.target)) {
      deletePopover.classList.add("hidden");
    }
  });

  if (popoverCancel) {
    popoverCancel.addEventListener("click", (e) => {
      e.stopPropagation();
      deletePopover.classList.add("hidden");
    });
  }

  if (popoverConfirm) {
    popoverConfirm.addEventListener("click", async (e) => {
      e.stopPropagation();
      deletePopover.classList.add("hidden");
      try {
        const res = await fetch(`http://localhost:8001/api/projects/${activeProjectId}`, {
          method: "DELETE"
        });
        const data = await res.json();
        if (data.status === "success") {
          await loadProjects();
          await loadModels();
          showToast(i18next.t('toasts.projectDeleted'), "success");
        } else {
          showToast(data.error, "error");
        }
      } catch(e) {
        showToast(i18next.t('toasts.errorDeletingProject'), "error");
      }
    });
  }
}

// --- Library Management ---
async function loadLibraryFolders() {
  const listEl = document.getElementById("library-folders-list");
  if (!listEl) return;
  
  try {
    const res = await fetch("http://localhost:8001/api/library/folders");
    const data = await res.json();
    if (data.folders) {
      listEl.innerHTML = "";
      data.folders.forEach(folder => {
        const div = document.createElement("div");
        div.className = "folder-item";
        div.innerHTML = `<span class="folder-icon">📁</span><span>${folder}</span>`;
        listEl.appendChild(div);
      });
    }
  } catch(e) {
    console.error("Failed to load library folders", e);
  }
}

const createFolderBtn = document.getElementById("create-folder-btn");
if (createFolderBtn) {
  createFolderBtn.addEventListener("click", async () => {
    const input = document.getElementById("new-folder-input");
    const name = input.value.trim();
    if (!name) return;
    
    try {
      const res = await fetch("http://localhost:8001/api/library/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name })
      });
      const data = await res.json();
      if (data.status === "success") {
        input.value = "";
        loadLibraryFolders();
      } else {
        showToast(data.error || i18next.t('toasts.failedToCreateFolder'), "error");
      }
    } catch(e) {
      showToast(i18next.t('toasts.connectionError'), "error");
    }
  });
}

// --- Asset Generator ---
const generateAssetBtn = document.getElementById("generate-asset-btn");
const assetPromptInput = document.getElementById("asset-prompt-input");
const exploratoryToggle = document.getElementById("exploratory-mode-toggle");
const assetPreviewContainer = document.getElementById("asset-preview-container");
const assetPreviewImg = document.getElementById("asset-preview-img");
const saveAssetBtn = document.getElementById("save-asset-btn");
const assetSaveName = document.getElementById("asset-save-name");

if (generateAssetBtn) {
  generateAssetBtn.addEventListener("click", async () => {
    const prompt = assetPromptInput.value.trim();
    if (!prompt) return showToast(i18next.t('toasts.pleaseDescribeAssetFirst'), "warning");
    
    const exploratory = exploratoryToggle.checked;
    const model = document.getElementById("image-model-select").dataset.value;
    
    // Retrieve dynamic inputs if they exist (they depend on the selected model)
    const seedInput = document.getElementById("img-seed");
    const cfgInput = document.getElementById("img-cfg");
    const aspectRatioInput = document.getElementById("img-aspect-ratio");
    
    const seed = seedInput && seedInput.value ? parseInt(seedInput.value) : null;
    const guidance_scale = cfgInput ? parseFloat(cfgInput.value) : 7.5;
    const aspect_ratio = aspectRatioInput ? aspectRatioInput.value : "1:1";
    
    try {
      showToast(i18next.t('toasts.generatingAsset'), "info");
      const res = await fetch("http://localhost:8001/api/generate_asset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, exploratory, model, seed, guidance_scale, aspect_ratio })
      });
      const data = await res.json();
      
      if (data.status === "success") {
        assetPreviewImg.src = data.image_url;
        assetPreviewContainer.classList.remove("hidden");
        showToast(data.message, "success");
      } else if (data.status === "clarification") {
        appendMessage("assistant", data.message);
        document.getElementById("nav-assistant").click();
      } else {
        showToast(i18next.t('toasts.generationFailed', { error: data.error }), "error");
      }
    } catch(e) {
      showToast(i18next.t('toasts.connectionErrorWhileGeneratingAsset'), "error");
    }
  });
}

if (saveAssetBtn) {
  saveAssetBtn.addEventListener("click", () => {
    const name = assetSaveName.value.trim();
    if (!name) return showToast(i18next.t('toasts.pleaseProvideNameToSaveAsset'), "warning");
    // TODO: Send to Library Manager endpoint
    showToast(i18next.t('toasts.savedAssetToLibrary', { name }), "success");
    assetSaveName.value = "";
    assetPreviewContainer.classList.add("hidden");
  });
}

main();

// Handle Vite HMR to prevent Babylon.js WebGPU context leaks causing browser crashes
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    if (engine) {
      engine.dispose();
    }
    if (ollamaStatusInterval) {
      clearInterval(ollamaStatusInterval);
    }
  });
}
