# ⚡ Browser WebGPU Configuration Guide

Verdant Beech is heavily optimized to use the bleeding-edge WebGPU rendering API via Babylon.js for massively improved multi-threaded performance and zero-overhead compute. While an optimized WebGL2 fallback is provided natively, enabling WebGPU will dramatically improve your supported features while editing maps.

Here are the platform and browser-specific steps to ensure WebGPU is running smoothly on your device.

## 🦊 Firefox (Nightly or Developer Edition)
**Status:** Highly Recommended (especially on Linux)

Currently, stable Firefox releases do not have WebGPU fully enabled by default. To experience buttery-smooth performance natively to the metal, we strongly recommend using **Firefox Nightly** or **Developer Edition**.

1. Open `about:config` in your address bar.
2. Search for `dom.webgpu.enabled` and set it to **true**.
3. Search for `gfx.webrender.all` and set it to **true** to force dedicated hardware acceleration.

> **Note on Firefox Warnings:** 
> You may see validation warnings in the console during startup (e.g., `Shader module creation failed: Shader validation error for CopyVideoToTexture`). These are harmless browser-level compilation errors originating from Firefox's ongoing `wgpu/naga` integration. Because our application does not use video textures, these shaders are never executed, and they have zero impact on rendering stability or performance.

## 🔵 Google Chrome & Microsoft Edge
**Status:** Supported natively on most modern desktop OSs (Windows/macOS)

WebGPU is enabled by default in Chrome and Edge version 113+. 
* **Linux Users:** Chromium hardware acceleration is often sandboxed. You may need to launch Chrome with the `--enable-features=Vulkan` flag to bypass software rendering.
* **If WebGPU is disabled:** Go to `chrome://flags` (or `edge://flags`), search for `#enable-unsafe-webgpu`, and enable it.

## 🦁 Brave Browser
**Status:** Requires adjustment

Brave's strict anti-fingerprinting Shields can aggressively throttle WebGPU or randomly sandbox it to your integrated low-power GPU, causing severe lag despite the hardware being capable.
1. Click the **Lion icon** in the URL bar when visiting the Verdant Beech `localhost`.
2. Disable Shields for the site to restore unthrottled hardware acceleration.
3. If issues persist, utilize the **Force WebGL** toggle in our Canvas UI, or ensure `#enable-unsafe-webgpu` is explicitly activated in `brave://flags`.

## 🧭 Safari (macOS & iOS)
**Status:** Experimental

Apple is actively integrating WebGPU into WebKit. It is currently available in the Safari Technology Preview.
1. Open the Safari menu > **Settings** > **Advanced** and check "Show features for web developers".
2. In the menu bar, go to **Develop** > **Feature Flags**.
3. Check the box for **WebGPU**.

## 📱 Mobile Devices (Android & iOS)
**Status:** Dynamically Optimized

Because mobile devices typically utilize a single integrated System-on-a-Chip (SoC) GPU, Verdant Beech's engine dynamically recognizes mobile user-agents and avoids battery-draining "high-performance" clock locks, letting the OS manage a balanced thermal profile natively. 
* Chrome on Android supports WebGPU natively in recent versions. 
* Safari on iOS requires enabling the experimental WebGPU feature flag (see above).
* If your mobile browser does not yet support WebGPU, Verdant Beech will seamlessly and silently fall back to its optimized WebGL2 engine.
