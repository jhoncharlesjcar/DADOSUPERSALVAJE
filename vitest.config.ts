import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    // Project tests only; do not traverse downloaded Blender runtimes or model archives.
    include: ['tests/**/*.test.{ts,tsx,js,mjs}'],
    environment: 'jsdom',
    globals: true,
    setupFiles: './vitest.setup.ts',
  },
  resolve: {
    alias: {
      '@': new URL('./', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'),
    },
  },
})
