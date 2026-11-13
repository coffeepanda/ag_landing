import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, open: true },
  // three.js (~500 kB, ~127 kB gzip) is one shared chunk, loaded only on phenomenon pages.
  build: { chunkSizeWarningLimit: 600 }
})
