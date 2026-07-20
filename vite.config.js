// vite.config.js (c) 2026 Evergold <261058386+Evergold@users.noreply.github.com>
// Licensed under the MIT License (see LICENSE for details)

import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    watch: {
      ignored: ['**/server/**', '**/tests/**', '**/.git/**']
    }
  }
});
