import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '.', testMatch: '*.spec.mjs', workers: 1, retries: 0,
  timeout: 15000, expect: { timeout: 1800 }, reporter: 'list',
  use: { channel: 'msedge', headless: true, viewport: { width: 800, height: 600 } },
});
