import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // In development the browser calls /api/* on this same server, which forwards to the Flask
    // AI server. One origin means no CORS or private-network issues in any browser.
    proxy: {
      '/api': { target: 'http://127.0.0.1:5001', changeOrigin: true, rewrite: (p) => p.replace(/^\/api/, '') },
    },
  },
  test: { environment: 'node' },
})
