import { test as base, expect } from '@playwright/test';

// The dedicated MCP project runs after ordinary browser tests with one worker.
// Raise only its disposable runtime's supported request capacity, then restore it.
// This does not modify application defaults or execution/approval policy.
export const test = base.extend<{ mcpRateCapacity: void }>({
  mcpRateCapacity: [
    async ({ request }, use) => {
      const api = process.env.API_URL ?? 'http://127.0.0.1:3000';
      const previous = await request.get(`${api}/v1/settings`);
      expect(previous.ok(), 'Read disposable rate capacity').toBe(true);
      const rateLimits = (await previous.json()).data.rateLimits;
      const configured = await request.put(`${api}/v1/settings`, {
        data: { rateLimits: { windowMs: 60_000, max: 10_000 } },
      });
      expect(configured.ok(), 'Configure disposable browser test capacity').toBe(true);
      try {
        await use();
      } finally {
        const restored = await request.put(`${api}/v1/settings`, { data: { rateLimits } });
        expect(restored.ok(), 'Restore disposable rate capacity').toBe(true);
      }
    },
    { auto: true },
  ],
});
