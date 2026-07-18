import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    watch: {
      ignored: ['**/server/**', '**/tests/**', '**/.git/**']
    }
  }
});
