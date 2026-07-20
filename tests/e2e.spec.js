// e2e.spec.js (c) 2026 Evergold <261058386+Evergold@users.noreply.github.com>
// Licensed under the MIT License (see LICENSE for details)

import { test, expect } from '@playwright/test';

test.describe('Verdant Beech Frontend E2E', () => {

  test.beforeEach(async ({ page }) => {
    // Mock API requests
    await page.route('**/api/health', route => route.fulfill({ json: { status: 'ok' } }));
    await page.route('**/api/models', route => route.fulfill({
      json: {
        assistant_models: [
          { id: 'ollama_chat/gemma-4', label: 'Gemma 4' },
          { id: 'gemini/gemini-3.5-flash', label: 'Gemini 3.5' }
        ]
      }
    }));
    await page.route('**/api/ollama/status', route => route.fulfill({
      json: { online: false, error: 'Ollama is not running' }
    }));
    await page.route('**/api/ollama/prewarm', route => route.fulfill({
      json: { status: 'offline' }
    }));

    await page.goto('/');
  });

  test('should render the Babylon.js canvas successfully', async ({ page }) => {
    const canvas = page.locator('#renderCanvas');
    await expect(canvas).toBeVisible();
    
    // Verify babylon.js context was initialized
    // We wait for window.scene to exist and be ready
    await page.waitForFunction(() => window.scene && window.scene.isReady(), { timeout: 10000 });
    const isEngineRunning = await page.evaluate(() => window.scene.isReady());
    expect(isEngineRunning).toBeTruthy();
  });

  test('should verify i18next localized strings update properly', async ({ page }) => {
    const title = page.locator('h2[data-i18n="chat.title"]');
    await expect(title).toHaveText('Assistant Tool');
    
    const sendBtn = page.locator('#send-btn');
    await expect(sendBtn).toHaveText('Send');
  });

  test('should allow chat interactions and display toasts', async ({ page }) => {
    // Mock chat response with tool calls
    await page.route('**/api/chat', route => route.fulfill({
      json: {
        reply: "I shall adjust the lighting, master.",
        tool_calls: [{
          name: "set_lighting",
          arguments: '{"time_of_day": "night", "intensity": 0.3}'
        }]
      }
    }));

    const chatInput = page.locator('#chat-input');
    await chatInput.fill('Make it night time.');
    await page.locator('#send-btn').click();

    // Verify chat history updates
    const chatHistory = page.locator('#chat-history');
    await expect(chatHistory).toContainText('Make it night time.');
    await expect(chatHistory).toContainText('I shall adjust the lighting');

    // Verify toast notification appears
    const toastContainer = page.locator('#toast-container');
    await expect(toastContainer).toContainText('Green is adjusting: set lighting');
    
    // Wait for the Babylon.js scene to process the night mode
    await page.waitForFunction(() => window.light && window.light.intensity === 0.3, { timeout: 5000 });
    const isNight = await page.evaluate(() => window.light.intensity === 0.3);
    expect(isNight).toBeTruthy();
  });

  test('should persist model selection in localStorage', async ({ page }) => {
    const modelSelect = page.locator('#model-select');
    
    // Select second option
    await modelSelect.selectOption('gemini/gemini-3.5-flash');
    
    // Reload page
    await page.goto('/');
    
    // Verify it stuck
    await expect(modelSelect).toHaveValue('gemini/gemini-3.5-flash');
  });
});
