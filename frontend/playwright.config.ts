import { defineConfig } from '@playwright/test'

// PW_PORT lets two agents run suites side by side; PW_WORKERS defaults to all cores but one.
const port = Number(process.env.PW_PORT ?? 5199)
const workers = process.env.PW_WORKERS ? Number(process.env.PW_WORKERS) : process.env.CI ? 2 : 7

export default defineConfig({
  workers,
  // Tests inside one file run side by side too; each test gets its own page and mock storage.
  fullyParallel: true,
  // CI retries once; a test that only passes on retry is listed as flaky in the report, not hidden.
  retries: process.env.CI ? 1 : 0,
  testDir: './e2e',
  timeout: 30_000,
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.02, animations: 'disabled' } },
  use: { baseURL: `http://127.0.0.1:${port}`, screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  webServer: { command: `VITE_DATA_SOURCE=mock npm run dev -- --host 127.0.0.1 --port ${port} --strictPort`, url: `http://127.0.0.1:${port}`, reuseExistingServer: false, timeout: 120_000 },
  projects: [
    ...[[320, 480], [360, 640], [375, 553], [390, 664], [393, 659], [412, 780], [430, 739], [440, 741], [375, 667], [393, 852], [440, 956]].map(([width, height]) => ({
      name: `phone-${width}x${height}`,
      testMatch: /public-mobile\.spec\.ts/,
      use: { browserName: width === 412 ? 'chromium' as const : 'webkit' as const, viewport: { width, height }, isMobile: true, hasTouch: true },
    })),
    ...[[360, 640], [440, 741]].map(([width, height]) => ({
      name: `staff-phone-${width}x${height}`,
      testMatch: /staff-mobile\.spec\.ts/,
      use: { browserName: 'chromium' as const, viewport: { width, height }, isMobile: true, hasTouch: true },
    })),
    { name: 'mobile', use: { viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true }, testIgnore: /reduced-motion|staff-review|public-mobile|staff-mobile/ },
    { name: 'tablet', use: { viewport: { width: 768, height: 1024 } }, testIgnore: /reduced-motion|staff-review|public-mobile|staff-mobile/ },
    { name: 'desktop', use: { viewport: { width: 1280, height: 900 } }, testIgnore: /reduced-motion|public-mobile|staff-mobile/ },
    // The stall iPad Air 11" (QR form and the shop journeys), portrait and landscape.
    { name: 'ipadPortrait', use: { viewport: { width: 820, height: 1180 }, hasTouch: true }, testMatch: /form|pickup|journey\.spec|layout|staff-review/ },
    { name: 'ipadLandscape', use: { viewport: { width: 1180, height: 820 }, hasTouch: true }, testMatch: /form|pickup|journey\.spec|layout|staff-review/ },
    { name: 'reducedMotion', use: { viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true, contextOptions: { reducedMotion: 'reduce' } }, testMatch: /reduced-motion|journey-deep|form/ },
  ],
})
