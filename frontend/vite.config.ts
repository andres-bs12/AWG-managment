import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  resolve: { alias: { 'data-source': fileURLToPath(new URL(loadEnv(mode, process.cwd(), '').VITE_DATA_SOURCE === 'http' ? './src/api/http/entry.ts' : './src/api/mock/entry.ts', import.meta.url)), 'demo-source': fileURLToPath(new URL(loadEnv(mode, process.cwd(), '').VITE_DATA_SOURCE === 'http' ? './src/api/http/demo.ts' : './src/api/mock/demo.ts', import.meta.url)) } },
  plugins: [react()],
  server: {
    proxy: {
      '/api': { target: 'http://localhost:8080', changeOrigin: true },
    },
  },
}))
