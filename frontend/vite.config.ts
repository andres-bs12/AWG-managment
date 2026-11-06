import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const http = env.VITE_DATA_SOURCE === 'http'
  if (command === 'build' && mode === 'production' && !http && env.VITE_ALLOW_MOCK_BUILD !== '1') {
    throw new Error('Production builds require VITE_DATA_SOURCE=http. For local preview/e2e only, explicitly set VITE_ALLOW_MOCK_BUILD=1 (npm run build:mock).')
  }
  return {
    resolve: { alias: {
      'data-source': fileURLToPath(new URL(http ? './src/api/http/entry.ts' : './src/api/mock/entry.ts', import.meta.url)),
      'demo-source': fileURLToPath(new URL(http ? './src/api/http/demo.ts' : './src/api/mock/demo.ts', import.meta.url)),
    } },
    plugins: [react()],
    server: {
      proxy: {
        '/api': { target: 'http://localhost:8080', changeOrigin: true },
      },
    },
  }
})
