import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: 'workspace-menu.spec.mjs',
  workers: 1,
  retries: 0,
  timeout: 10_000,
  expect: { timeout: 700 },
  reporter: 'list',
  use: { channel: 'msedge', headless: true, viewport: { width: 640, height: 480 } },
});
