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

// Initialize Babylon.js WebGL Engine
function initBabylon() {
  const canvas = document.getElementById("renderCanvas");
  const engine = new BABYLON.Engine(canvas, true);

  const createScene = function () {
    const scene = new BABYLON.Scene(engine);
    
    // Set a dark space/cartography void background
    scene.clearColor = new BABYLON.Color4(0.05, 0.05, 0.07, 1);

    // This creates and positions a free camera (non-mesh)
    const camera = new BABYLON.FreeCamera("camera1", new BABYLON.Vector3(0, 50, 0), scene);
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
    const light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);
    light.intensity = 0.7;

    // Base Map Plane (where the stitched 4K textures will go)
    const baseMap = BABYLON.MeshBuilder.CreateGround("baseMap", {width: 40, height: 40}, scene);
    const baseMat = new BABYLON.StandardMaterial("baseMat", scene);
    baseMat.diffuseColor = new BABYLON.Color3(0.2, 0.2, 0.2); // Placeholder
    baseMap.material = baseMat;

    return scene;
  };

  const scene = createScene();

  engine.runRenderLoop(function () {
    scene.render();
  });

  window.addEventListener("resize", function () {
    engine.resize();
    // Update orthographic camera ratio
    const camera = scene.getCameraByName("camera1");
    if (camera && camera.mode === BABYLON.Camera.ORTHOGRAPHIC_CAMERA) {
      const orthoSize = camera.orthoTop;
      camera.orthoLeft = -orthoSize * (canvas.width / canvas.height);
      camera.orthoRight = orthoSize * (canvas.width / canvas.height);
    }
  });
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
      renderReasoningTabs(select.value);
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

let messages = [];
let activeTasks = 0;
let currentReasoning = "high";

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
    if (levels.includes("high")) currentReasoning = "high";
    else if (levels.includes("low")) currentReasoning = "low";
    
    tabs.forEach(tab => {
      if (tab.dataset.level === currentReasoning && !tab.disabled) tab.classList.add("active");
    });
  }
}

modelSelect.addEventListener("change", () => renderReasoningTabs(modelSelect.value));

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

main();
