import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    // Run API tests in one fork to prevent Supertest listener interference when
    // many test files open ephemeral HTTP servers simultaneously (e.g. pre-push hook).
    pool: 'forks',
    fileParallelism: false,
    maxWorkers: 1,
    isolate: false,
  },
});
