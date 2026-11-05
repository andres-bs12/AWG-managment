import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.02, animations: 'disabled' } },
  use: { baseURL: 'http://127.0.0.1:5199', screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  webServer: { command: 'VITE_DATA_SOURCE=mock npm run dev -- --host 127.0.0.1 --port 5199 --strictPort', url: 'http://127.0.0.1:5199', reuseExistingServer: false, timeout: 120_000 },
  projects: [
    { name: 'mobile', use: { viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true }, testIgnore: /reduced-motion/ },
    { name: 'tablet', use: { viewport: { width: 768, height: 1024 } }, testIgnore: /reduced-motion/ },
    { name: 'desktop', use: { viewport: { width: 1280, height: 900 } }, testIgnore: /reduced-motion/ },
    { name: 'reducedMotion', use: { viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' }, testMatch: /reduced-motion|journey-deep|form/ },
  ],
})
