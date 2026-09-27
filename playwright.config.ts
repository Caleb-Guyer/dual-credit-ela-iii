import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 180000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:5173',
    headless: true,
    channel: process.platform === 'win32' ? 'msedge' : 'chromium',
    launchOptions:
      process.env.CI || process.env.PLAYWRIGHT_SOFTWARE_GPU
        ? { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }
        : {},
    viewport: { width: 1440, height: 1000 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'npm run dev -- --port 5173 --strictPort',
      url: 'http://127.0.0.1:5173',
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'node tests/serve-built.mjs',
      url: 'http://127.0.0.1:4174/dual-credit-ela-iii/',
      reuseExistingServer: !process.env.CI,
    },
  ],
});
