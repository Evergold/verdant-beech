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

// App Entry Point
async function main() {
  await initI18n();
  initBabylon();
  console.log("Verdant Beech initialized successfully.");
}

main();
