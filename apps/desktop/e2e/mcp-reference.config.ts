import { defineConfig } from '@playwright/test';

// Explicit reference qualification: requires the reviewed preinstalled upstream package.
// No default-CI skip or implicit network install. Missing pin configuration fails the run.
export default defineConfig({
  testDir: '.',
  testMatch: 'mcp-upstream.integration.ts',
  workers: 1,
  retries: 0,
  forbidOnly: true,
  timeout: 120_000,
  outputDir: '../test-results/mcp-reference',
  reporter: 'list',
});
