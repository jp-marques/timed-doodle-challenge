import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Dedicated Vitest config to avoid Vite/Vitest type conflicts.
// Keeps `vite.config.ts` focused on app build/serve settings.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    globals: true,
    css: true,
  },
})

