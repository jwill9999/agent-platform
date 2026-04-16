import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import express from 'express';
import request from 'supertest';
import { openDatabase, closeDatabase } from '@agent-platform/db';

import { createSettingsRouter } from '../src/infrastructure/http/v1/settingsRouter.js';
import { errorMiddleware } from '../src/infrastructure/http/errorMiddleware.js';

const DEFAULTS = {
  rateLimits: { windowMs: 60_000, max: 100 },
  costBudget: { globalMaxCostUnits: null, warnThreshold: 0.8 },
};

function buildTestApp() {
  const tmpDir = mkdtempSync(path.join(tmpdir(), 'settings-test-'));
  const dbPath = path.join(tmpDir, 'test.sqlite');
  const { db, sqlite } = openDatabase(dbPath);

  const reconfigureCalls: Array<{ windowMs: number; max: number }> = [];

  const app = express();
  app.use(express.json());
  app.use(
    '/v1/settings',
    createSettingsRouter(db, (c) => reconfigureCalls.push(c)),
  );
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

  it('GET returns defaults when empty', async () => {
    const res = await request(ctx.app).get('/v1/settings');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(DEFAULTS);
  });

  it('PUT updates rate limits and triggers reconfigure', async () => {
    const res = await request(ctx.app)
      .put('/v1/settings')
      .send({ rateLimits: { windowMs: 30_000, max: 50 } });

    expect(res.status).toBe(200);
    expect(res.body.data.rateLimits).toEqual({ windowMs: 30_000, max: 50 });
    expect(ctx.reconfigureCalls).toEqual([{ windowMs: 30_000, max: 50 }]);
  });

  it('PUT updates cost budget without triggering rate limit reconfigure', async () => {
    const res = await request(ctx.app)
      .put('/v1/settings')
      .send({ costBudget: { globalMaxCostUnits: 500 } });

    expect(res.status).toBe(200);
    expect(res.body.data.costBudget.globalMaxCostUnits).toBe(500);
    expect(ctx.reconfigureCalls).toHaveLength(0);
  });

  it('PUT with partial update preserves existing values', async () => {
    await request(ctx.app)
      .put('/v1/settings')
      .send({ rateLimits: { windowMs: 30_000, max: 50 } });

    const res = await request(ctx.app)
      .put('/v1/settings')
      .send({ rateLimits: { max: 200 } });

    expect(res.body.data.rateLimits).toEqual({ windowMs: 30_000, max: 200 });
  });

  it('PUT rejects invalid values', async () => {
    const res = await request(ctx.app)
      .put('/v1/settings')
      .send({ rateLimits: { max: -1 } });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('DELETE resets to defaults and triggers reconfigure', async () => {
    await request(ctx.app)
      .put('/v1/settings')
      .send({ rateLimits: { max: 50 }, costBudget: { globalMaxCostUnits: 500 } });

    const res = await request(ctx.app).delete('/v1/settings');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(DEFAULTS);
    expect(ctx.reconfigureCalls.at(-1)).toEqual(DEFAULTS.rateLimits);
  });

  it('settings persist across reads', async () => {
    await request(ctx.app)
      .put('/v1/settings')
      .send({ costBudget: { globalMaxCostUnits: 1000, warnThreshold: 0.9 } });

    const res = await request(ctx.app).get('/v1/settings');
    expect(res.body.data.costBudget).toEqual({ globalMaxCostUnits: 1000, warnThreshold: 0.9 });
  });
});
