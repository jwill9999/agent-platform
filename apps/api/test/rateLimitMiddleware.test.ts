import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';

import { createDynamicRateLimiter } from '../src/infrastructure/http/dynamicRateLimiter.js';

function buildApp(max = 3) {
  const limiter = createDynamicRateLimiter();
  limiter.reconfigure({ windowMs: 60_000, max });
  const app = express();
  app.use(limiter.middleware);
  app.get('/test', (_req, res) => res.json({ ok: true }));
  return { app, limiter };
}

describe('dynamicRateLimiter', () => {
  it('allows requests under the limit', async () => {
    const { app } = buildApp();
    const res = await request(app).get('/test');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('includes standard rate-limit headers', async () => {
    const { app } = buildApp();
    const res = await request(app).get('/test');
    const headerKeys = Object.keys(res.headers).map((k) => k.toLowerCase());
    const hasRateHeaders = headerKeys.some((k) => k.startsWith('ratelimit'));
    const hasXRateHeaders = headerKeys.some((k) => k.startsWith('x-ratelimit'));
    expect(hasRateHeaders || hasXRateHeaders).toBe(true);
  });

  it('returns 429 with standard error shape when limit is exceeded', async () => {
    const { app } = buildApp(3);
    await request(app).get('/test');
    await request(app).get('/test');
    await request(app).get('/test');
    const res = await request(app).get('/test');

    expect(res.status).toBe(429);
    expect(res.body).toEqual({
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many requests — please try again later',
      },
    });
  });

  it('reconfigure changes the active limit', async () => {
    const { app, limiter } = buildApp(2);
    // Use 2 of 2 allowed
    await request(app).get('/test');
    await request(app).get('/test');
    const blocked = await request(app).get('/test');
    expect(blocked.status).toBe(429);

    // Reconfigure to allow 100 — new limiter, fresh counters
    limiter.reconfigure({ windowMs: 60_000, max: 100 });
    const allowed = await request(app).get('/test');
    expect(allowed.status).toBe(200);
  });

  it('getConfig returns current configuration', async () => {
    const { limiter } = buildApp(5);
    expect(limiter.getConfig()).toEqual({ windowMs: 60_000, max: 5 });

    limiter.reconfigure({ windowMs: 30_000, max: 50 });
    expect(limiter.getConfig()).toEqual({ windowMs: 30_000, max: 50 });
  });
});
