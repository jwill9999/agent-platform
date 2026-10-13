import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '.',
  testMatch: 'chat-reply-reliability.baseline.ts',
  workers: 1,
  retries: 0,
  timeout: 120_000,
  reporter: 'list',
  use: { trace: 'off', screenshot: 'off', video: 'off' },
});
