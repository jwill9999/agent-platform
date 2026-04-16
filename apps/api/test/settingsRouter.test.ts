import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import express from 'express';
import request from 'supertest';
import { openDatabase, closeDatabase } from '@agent-platform/db';

import { createSettingsRouter } from '../src/infrastructure/http/v1/settingsRouter.js';
import { errorMiddleware } from '../src/infrastructure/http/errorMiddleware.js';

function buildTestApp() {
  const tmpDir = mkdtempSync(path.join(tmpdir(), 'settings-test-'));
  const dbPath = path.join(tmpDir, 'test.sqlite');
  const { db, sqlite } = openDatabase(dbPath);

  const reconfigureCalls: Array<{ windowMs: number; max: number }> = [];
  const onRateLimitChange = (config: { windowMs: number; max: number }) => {
    reconfigureCalls.push(config);
  };

  const app = express();
  app.use(express.json());
  app.use('/v1/settings', createSettingsRouter(db, onRateLimitChange));
  app.use(errorMiddleware);

  return { app, db, sqlite, reconfigureCalls, tmpDir };
}

describe('settingsRouter', () => {
  let ctx: ReturnType<typeof buildTestApp>;

  beforeEach(() => {
    ctx = buildTestApp();
  });

  afterEach(() => {
    closeDatabase(ctx.sqlite);
    rmSync(ctx.tmpDir, { recursive: true, force: true });
  });

  it('GET /v1/settings returns defaults when no settings are stored', async () => {
    const res = await request(ctx.app).get('/v1/settings');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      rateLimits: { windowMs: 60_000, max: 100 },
      costBudget: { globalMaxCostUnits: null, warnThreshold: 0.8 },
    });
  });

  it('PUT /v1/settings updates rate limits and triggers reconfigure', async () => {
    const res = await request(ctx.app)
      .put('/v1/settings')
      .send({ rateLimits: { windowMs: 30_000, max: 50 } });

    expect(res.status).toBe(200);
    expect(res.body.data.rateLimits).toEqual({ windowMs: 30_000, max: 50 });
    expect(ctx.reconfigureCalls).toHaveLength(1);
    expect(ctx.reconfigureCalls[0]).toEqual({ windowMs: 30_000, max: 50 });
  });

  it('PUT /v1/settings updates cost budget without triggering rate limit reconfigure', async () => {
    const res = await request(ctx.app)
      .put('/v1/settings')
      .send({ costBudget: { globalMaxCostUnits: 500 } });

    expect(res.status).toBe(200);
    expect(res.body.data.costBudget.globalMaxCostUnits).toBe(500);
    expect(res.body.data.costBudget.warnThreshold).toBe(0.8);
    expect(ctx.reconfigureCalls).toHaveLength(0);
  });

  it('PUT /v1/settings with partial update preserves existing values', async () => {
    await request(ctx.app)
      .put('/v1/settings')
      .send({ rateLimits: { windowMs: 30_000, max: 50 } });

    const res = await request(ctx.app)
      .put('/v1/settings')
      .send({ rateLimits: { max: 200 } });

    expect(res.status).toBe(200);
    expect(res.body.data.rateLimits).toEqual({ windowMs: 30_000, max: 200 });
  });

  it('PUT /v1/settings rejects invalid values', async () => {
    const res = await request(ctx.app)
      .put('/v1/settings')
      .send({ rateLimits: { max: -1 } });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('DELETE /v1/settings resets to defaults and triggers reconfigure', async () => {
    await request(ctx.app)
      .put('/v1/settings')
      .send({ rateLimits: { max: 50 }, costBudget: { globalMaxCostUnits: 500 } });

    const res = await request(ctx.app).delete('/v1/settings');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      rateLimits: { windowMs: 60_000, max: 100 },
      costBudget: { globalMaxCostUnits: null, warnThreshold: 0.8 },
    });
    const lastCall = ctx.reconfigureCalls[ctx.reconfigureCalls.length - 1];
    expect(lastCall).toEqual({ windowMs: 60_000, max: 100 });
  });

  it('settings persist across reads', async () => {
    await request(ctx.app)
      .put('/v1/settings')
      .send({ costBudget: { globalMaxCostUnits: 1000, warnThreshold: 0.9 } });

    const res = await request(ctx.app).get('/v1/settings');
    expect(res.body.data.costBudget).toEqual({
      globalMaxCostUnits: 1000,
      warnThreshold: 0.9,
    });
  });
});
