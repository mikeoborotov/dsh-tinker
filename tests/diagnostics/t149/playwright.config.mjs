import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: 'hover-geometry.spec.mjs',
  outputDir: '../../../test-results/t149',
  workers: 1,
  retries: 0,
  timeout: 15_000,
  reporter: 'list',
  use: { channel: 'msedge', headless: true, viewport: { width: 523, height: 208 }, deviceScaleFactor: 1 },
});
