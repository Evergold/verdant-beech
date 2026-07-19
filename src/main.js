import * as BABYLON from "@babylonjs/core";
import i18next from "i18next";
import enTranslations from "./locales/en.json";

// Initialize i18n
async function initI18n() {
  await i18next.init({
    lng: "en",
    resources: {
      en: {
        translation: enTranslations
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
  let useWebGPU = false;
  if (webGPUSupported) {
    try {
      engine = new BABYLON.WebGPUEngine(canvas);
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

    // Perspective Camera viewing the table
    camera = new BABYLON.ArcRotateCamera("camera", -Math.PI / 2, Math.PI / 3, 35, BABYLON.Vector3.Zero(), scene);
    camera.attachControl(canvas, true);
    camera.wheelPrecision = 20;
    camera.lowerRadiusLimit = 10;
    camera.upperRadiusLimit = 40;

    // Ambient Room Light (Uniform default)
    const ambientLight = new BABYLON.HemisphericLight("ambientLight", new BABYLON.Vector3(0, 1, 0), scene);
    ambientLight.intensity = 0.5;
    ambientLight.groundColor = new BABYLON.Color3(0.2, 0.2, 0.2);

    // Main Studio Lamp (SpotLight centered over the map)
    light = new BABYLON.SpotLight("lampLight", new BABYLON.Vector3(0, 18, 0), new BABYLON.Vector3(0, -1, 0), Math.PI / 2, 2, scene);
    light.intensity = 1.0;
    light.diffuse = new BABYLON.Color3(1, 1, 0.95);

    // Lamp Mesh (Visual Representation)
    const lampMesh = BABYLON.MeshBuilder.CreateCylinder("lampMesh", {height: 2, diameterTop: 3, diameterBottom: 4}, scene);
    lampMesh.position = new BABYLON.Vector3(0, 19, 0);
    const lampMat = new BABYLON.StandardMaterial("lampMat", scene);
    lampMat.diffuseColor = new BABYLON.Color3(0.1, 0.1, 0.1);
    lampMat.emissiveColor = new BABYLON.Color3(0.5, 0.5, 0.4);
    lampMesh.material = lampMat;

    // Candle Light (PointLight, flickering - disabled by default)
    const candleLight = new BABYLON.PointLight("candleLight", new BABYLON.Vector3(14, 1.5, 10), scene);
    candleLight.diffuse = new BABYLON.Color3(1, 0.6, 0.2);
    candleLight.intensity = 0;
    candleLight.setEnabled(false);

    // Shadows
    const shadowGenerator = new BABYLON.ShadowGenerator(1024, light);
    shadowGenerator.useBlurExponentialShadowMap = true;
    shadowGenerator.blurKernel = 32;

    const candleShadows = new BABYLON.ShadowGenerator(512, candleLight);
    candleShadows.usePercentageCloserFiltering = true;

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
    baseMap = BABYLON.MeshBuilder.CreateGround("baseMap", {width: 24, height: 16, subdivisions: 128}, scene);
    baseMap.position.y = 0.02; // Hover slightly above table
    baseMat = new BABYLON.StandardMaterial("baseMat", scene);
    baseMat.diffuseColor = new BABYLON.Color3(0.94, 0.9, 0.82); // Parchment
    baseMat.specularColor = new BABYLON.Color3(0.05, 0.05, 0.05);
    baseMap.material = baseMat;
    baseMap.receiveShadows = true;
    
    shadowGenerator.addShadowCaster(baseMap);
    candleShadows.addShadowCaster(baseMap);

    // Cartography Props around the perimeter (adjusted for smaller table)
    const inkwell = BABYLON.MeshBuilder.CreateCylinder("inkwell", {height: 1.5, diameter: 1.0}, scene);
    inkwell.position = new BABYLON.Vector3(14, 0.75, 8);
    const inkMat = new BABYLON.StandardMaterial("inkMat", scene);
    inkMat.diffuseColor = new BABYLON.Color3(0.1, 0.1, 0.15);
    inkMat.specularColor = new BABYLON.Color3(0.8, 0.8, 0.8);
    inkwell.material = inkMat;

    const ruler = BABYLON.MeshBuilder.CreateBox("ruler", {width: 10, height: 0.05, depth: 1}, scene);
    ruler.position = new BABYLON.Vector3(-13, 0.025, -9);
    ruler.rotation.y = Math.PI / 6;
    const rulerMat = new BABYLON.StandardMaterial("rulerMat", scene);
    rulerMat.diffuseColor = new BABYLON.Color3(0.6, 0.5, 0.3); // Wood/brass
    ruler.material = rulerMat;

    const compass = BABYLON.MeshBuilder.CreateTorus("compass", {diameter: 2, thickness: 0.2}, scene);
    compass.position = new BABYLON.Vector3(-14, 0.1, 7);
    const compassMat = new BABYLON.StandardMaterial("compMat", scene);
    compassMat.diffuseColor = new BABYLON.Color3(0.8, 0.7, 0.2); // Brass
    compassMat.specularColor = new BABYLON.Color3(1, 1, 0.8);
    compass.material = compassMat;

    shadowGenerator.addShadowCaster(inkwell);
    shadowGenerator.addShadowCaster(ruler);
    shadowGenerator.addShadowCaster(compass);
    candleShadows.addShadowCaster(inkwell);
    candleShadows.addShadowCaster(ruler);
    candleShadows.addShadowCaster(compass);

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

    let isLandscape = true;
    const toggleBtn = document.getElementById("toggle-orientation-btn");
    if (toggleBtn) {
      toggleBtn.addEventListener("click", () => {
        isLandscape = !isLandscape;
        
        // Reset and snap camera to perfectly frame the map
        camera.setTarget(BABYLON.Vector3.Zero());
        
        if (isLandscape) {
          baseMap.scaling = new BABYLON.Vector3(1, 1, 1);
          camera.alpha -= Math.PI / 2;
        } else {
          // Portrait mode: scale X down, scale Z up
          baseMap.scaling = new BABYLON.Vector3(16/24, 1, 24/16);
          // Rotate camera alpha so we remain facing the bottom edge of the map
          camera.alpha += Math.PI / 2;
        }
      });
    }

    window.scene = scene;
    return scene;
  };

  createScene();

  engine.runRenderLoop(function () {
    scene.render();
  });

  window.addEventListener("resize", function () {
    engine.resize();
  });
}

async function prewarmModel(modelId) {
  try {
    showToast(`Pre-warming ${modelId.split("/")[1]}...`, "info");
    const res = await fetch("http://localhost:8001/api/ollama/prewarm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: modelId })
    });
    const data = await res.json();
    
    if (data.status === "missing") {
      showToast(`Model missing. Will download when you send a message.`, "warning");
      return;
    }
    
    if (data.status === "error" || data.status === "offline") {
      throw new Error(data.error);
    }
    startOllamaPoll();
  } catch (e) {
    showToast(`Failed to load ${modelId}: ${e.message}. Falling back to Gemini.`, "error");
    const modelSelect = document.getElementById("model-select");
    modelSelect.value = "gemini/gemini-3.5-flash";
    localStorage.setItem("selectedModel", modelSelect.value);
    renderReasoningTabs(modelSelect.value);
    document.getElementById("hardware-monitor").classList.add("hidden");
    if (ollamaStatusInterval) clearInterval(ollamaStatusInterval);
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
      
      const savedModel = localStorage.getItem("selectedModel") || "ollama_chat/gemma4:e4b";
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
  } catch (e) {
    console.error("Failed to load models.yaml", e);
  }
}

// App Entry Point
async function main() {
  await initI18n();
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

function showToast(msg, type = "info") {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = msg;
  toastContainer.appendChild(toast);
  setTimeout(() => toast.remove(), 5000);
}

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
  try {
    await fetch("http://localhost:8001/api/ollama/unload", { method: "POST" });
  } catch(e) {}
}

async function streamDownload(tag) {
  downloadUI.classList.remove("hidden");
  sendBtn.disabled = true;
  modelSelect.disabled = true;
  isDownloading = true;
  isDownloadPaused = false;
  currentDownloadModel = tag;
  downloadPauseBtn.textContent = "Pause";
  
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
      
      const lines = decoder.decode(value).split('\\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const data = JSON.parse(line);
          if (data.total && data.completed) {
            const pct = Math.floor((data.completed / data.total) * 100);
            downloadProgress.value = pct;
            downloadPercent.textContent = pct + "%";
          }
          if (data.status === "success") {
            downloadProgress.value = 100;
            downloadPercent.textContent = "100%";
            setTimeout(() => downloadUI.classList.add("hidden"), 1000);
            sendBtn.disabled = false;
            modelSelect.disabled = false;
            isDownloading = false;
            showToast("Download complete!", "info");
            return true;
          }
        } catch(e) {}
      }
    }
  } catch (e) {
    if (e.name === "AbortError") {
      showToast("Download paused", "warning");
      isDownloadPaused = true;
      downloadPauseBtn.textContent = "Resume";
      sendBtn.disabled = false;
    } else {
      showToast("Download failed", "error");
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
      showToast("Error: Ollama is not running!", "error");
      return false;
    }
    if (status.models.includes(tag)) {
      return true; // Installed
    }
    
    showToast(`Model ${tag} is missing. Starting download...`, "info");
    return await streamDownload(tag);
  } catch (e) {
    showToast("Connection to backend failed", "error");
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
  localStorage.setItem("selectedModel", newModel);
  
  if (oldModel.includes("ollama_chat") && !newModel.includes("ollama_chat")) {
    hwMonitor.classList.add("hidden");
    if (ollamaStatusInterval) clearInterval(ollamaStatusInterval);
    await unloadOllama();
  }
  
  if (newModel.includes("ollama_chat")) {
    const tag = newModel.split("/")[1];
    try {
      const res = await fetch("http://localhost:8001/api/ollama/status");
      const status = await res.json();
      if (status.online && !status.models.includes(tag)) {
        showToast(`Warning: ${tag} is not installed locally.`, "warning");
        // Still try to prewarm, which will fail and fallback, or we can just let it download on send
      } else if (!status.online) {
        showToast("Error: Ollama is not running.", "error");
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

  const text = chatInput.value.trim();
  if (!text) return;
  
  appendMessage("user", text);
  chatInput.value = "";
  
  // Temporary "thinking" message
  const thinkingId = "thinking-" + Date.now();
  const thinkingDiv = document.createElement("div");
  thinkingDiv.id = thinkingId;
  thinkingDiv.className = `chat-message message-assistant`;
  thinkingDiv.textContent = "...";
  chatHistory.appendChild(thinkingDiv);
  chatHistory.scrollTop = chatHistory.scrollHeight;

  updateTaskCount(1);
  try {
    const res = await fetch("http://localhost:8001/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        messages: messages,
        model_name: modelSelect.value,
        reasoning: levelsSupport(modelSelect.value) ? currentReasoning : null
      })
    });
    const data = await res.json();
    
    if (data.reply && data.reply.startsWith("Error:")) {
       if (modelSelect.value.includes("ollama_chat")) {
           showToast("Local model error during chat. Falling back to Gemini Flash.", "error");
           modelSelect.value = "gemini/gemini-3.5-flash";
           localStorage.setItem("selectedModel", modelSelect.value);
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
                   reasoning: levelsSupport(modelSelect.value) ? currentReasoning : null
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
    showToast(`Green is adjusting: ${tc.name.replace(/_/g, " ")}`, "info");
    
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
        showToast(data.error || "Failed to create folder", "error");
      }
    } catch(e) {
      showToast("Connection error", "error");
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
    if (!prompt) return showToast("Please describe the asset first.", "warning");
    
    const exploratory = exploratoryToggle.checked;
    
    try {
      showToast("Generating asset...", "info");
      const res = await fetch("http://localhost:8001/api/generate_asset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, exploratory })
      });
      const data = await res.json();
      
      if (data.status === "success") {
        assetPreviewImg.src = data.image_url;
        assetPreviewContainer.classList.remove("hidden");
        showToast(data.message, "success");
      } else {
        showToast("Generation failed: " + data.error, "error");
      }
    } catch(e) {
      showToast("Connection error while generating asset.", "error");
    }
  });
}

if (saveAssetBtn) {
  saveAssetBtn.addEventListener("click", () => {
    const name = assetSaveName.value.trim();
    if (!name) return showToast("Please provide a name to save the asset.", "warning");
    // TODO: Send to Library Manager endpoint
    showToast(`Saved asset '${name}' to library!`, "success");
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
