import { defineConfig } from '@playwright/test';
const devPort = process.env.ELA_DEV_PORT ?? '5173';
const builtPort = process.env.ELA_BUILT_PORT ?? '4174';
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 180000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: `http://127.0.0.1:${devPort}`,
    headless: true,
    channel: process.platform === 'win32' ? 'msedge' : undefined,
    viewport: { width: 1440, height: 1000 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'standard',
      testIgnore: ['**/douglass-next.spec.ts', '**/douglass-final.spec.ts', '**/concord.spec.ts'],
    },
    {
      name: 'concord',
      testMatch: '**/concord.spec.ts',
      use: {
        channel: process.platform === 'win32' ? 'msedge' : 'chromium',
        launchOptions:
          process.env.CI || process.env.PLAYWRIGHT_SOFTWARE_GPU
            ? { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }
            : {},
      },
    },
    {
      name: '3d',
      testMatch: '**/douglass-next.spec.ts',
      use: {
        channel: process.platform === 'win32' ? 'msedge' : 'chromium',
        launchOptions:
          process.env.CI || process.env.PLAYWRIGHT_SOFTWARE_GPU
            ? { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }
            : {},
      },
    },
    {
      name: 'final3d',
      testMatch: '**/douglass-final.spec.ts',
      use: {
        channel: process.platform === 'win32' ? 'msedge' : 'chromium',
        launchOptions:
          process.env.CI || process.env.PLAYWRIGHT_SOFTWARE_GPU
            ? { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }
            : {},
      },
    },
  ],
  webServer: [
    {
      command: `npm run dev -- --port ${devPort} --strictPort`,
      url: `http://127.0.0.1:${devPort}`,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'node tests/serve-built.mjs',
      url: `http://127.0.0.1:${builtPort}/dual-credit-ela-iii/`,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
