import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Re-create the limiter with a very small window so tests are fast
vi.stubEnv('RATE_LIMIT_WINDOW_MS', '60000');
vi.stubEnv('RATE_LIMIT_MAX', '3');

// Must import AFTER env stubs so the module reads the overridden values
const { apiRateLimiter } = await import('../src/infrastructure/http/rateLimitMiddleware.js');

function buildApp() {
  const app = express();
  app.use(apiRateLimiter);
  app.get('/test', (_req, res) => res.json({ ok: true }));
  return app;
}

describe('apiRateLimiter', () => {
  let app: express.Express;

  beforeEach(() => {
    app = buildApp();
  });

  it('allows requests under the limit', async () => {
    const res = await request(app).get('/test');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('includes standard rate-limit headers', async () => {
    const res = await request(app).get('/test');
    const headerKeys = Object.keys(res.headers).map((k) => k.toLowerCase());
    // express-rate-limit with draft-7 uses ratelimit-* headers
    const hasRateHeaders = headerKeys.some((k) => k.startsWith('ratelimit'));
    // fallback: may use x-ratelimit-* headers depending on version
    const hasXRateHeaders = headerKeys.some((k) => k.startsWith('x-ratelimit'));
    expect(hasRateHeaders || hasXRateHeaders).toBe(true);
  });

  it('returns 429 with standard error shape when limit is exceeded', async () => {
    // 3 allowed, 4th should fail
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
});
