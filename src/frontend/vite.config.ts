import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // Em desenvolvimento a API roda em http://localhost:3000; o proxy mantém a mesma origem.
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: false },
    },
  },
  build: {
    sourcemap: false,
  },
})
