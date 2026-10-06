import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir: './tests/browser', workers: 1, use: { channel: process.env.WSP_BROWSER_CHANNEL === 'chromium' ? undefined : (process.env.WSP_BROWSER_CHANNEL ?? 'msedge'), headless: true }, reporter: 'list' });
