import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    // Cap concurrent forks to prevent ephemeral-port exhaustion when many
    // test files open supertest HTTP servers simultaneously (e.g. pre-push hook).
    pool: 'forks',
    poolOptions: {
      forks: { minForks: 1, maxForks: 4 },
    },
  },
});
