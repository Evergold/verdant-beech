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

// Initialize Babylon.js WebGL Engine
function initBabylon() {
  const canvas = document.getElementById("renderCanvas");
  engine = new BABYLON.Engine(canvas, true);

  const createScene = function () {
    scene = new BABYLON.Scene(engine);
    
    // Set a dark space/cartography void background
    scene.clearColor = new BABYLON.Color4(0.05, 0.05, 0.07, 1);

    // This creates and positions a free camera (non-mesh)
    camera = new BABYLON.FreeCamera("camera1", new BABYLON.Vector3(0, 50, 0), scene);
    camera.setTarget(BABYLON.Vector3.Zero());
    camera.attachControl(canvas, true);
    
    // For a 2D Map editing feel, orthographic or heavily constrained perspective is best.
    camera.mode = BABYLON.Camera.ORTHOGRAPHIC_CAMERA;
    const orthoSize = 20;
    camera.orthoTop = orthoSize;
    camera.orthoBottom = -orthoSize;
    camera.orthoLeft = -orthoSize * (canvas.width / canvas.height);
    camera.orthoRight = orthoSize * (canvas.width / canvas.height);

    // This creates a light, aiming 0,1,0 - to the sky (non-mesh)
    light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);
    light.intensity = 0.7;

    // Base Map Plane (where the stitched 4K textures will go)
    baseMap = BABYLON.MeshBuilder.CreateGround("baseMap", {width: 40, height: 40}, scene);
    baseMat = new BABYLON.StandardMaterial("baseMat", scene);
    baseMat.diffuseColor = new BABYLON.Color3(0.2, 0.2, 0.2); // Placeholder
    baseMap.material = baseMat;

    return scene;
  };

  createScene();

  engine.runRenderLoop(function () {
    scene.render();
  });

  window.addEventListener("resize", function () {
    engine.resize();
    // Update orthographic camera ratio
    if (camera && camera.mode === BABYLON.Camera.ORTHOGRAPHIC_CAMERA) {
      const orthoSize = camera.orthoTop;
      camera.orthoLeft = -orthoSize * (canvas.width / canvas.height);
      camera.orthoRight = orthoSize * (canvas.width / canvas.height);
    }
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
    if (window.ollamaStatusInterval) clearInterval(window.ollamaStatusInterval);
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
  initBabylon();
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

main();
