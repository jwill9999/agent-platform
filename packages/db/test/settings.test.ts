import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import * as schema from '../src/schema.js';
import {
  loadSettings,
  updateSettings,
  resetSettings,
  deleteSetting,
} from '../src/repositories/settings.js';

const pkgRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const DEFAULTS = {
  rateLimits: { windowMs: 60_000, max: 100 },
  costBudget: { globalMaxCostUnits: null, warnThreshold: 0.8 },
};

function openTestDb() {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: path.join(pkgRoot, 'drizzle') });
  return { db, sqlite };
}

describe('settings repository', () => {
  let ctx: ReturnType<typeof openTestDb>;

  beforeEach(() => {
    ctx = openTestDb();
  });

  afterEach(() => {
    ctx.sqlite.close();
  });

  it('loadSettings returns defaults on empty table', () => {
    expect(loadSettings(ctx.db)).toEqual(DEFAULTS);
  });

  it('updateSettings persists and returns merged values', () => {
    const result = updateSettings(ctx.db, { rateLimits: { max: 50 } });
    expect(result.rateLimits.max).toBe(50);
    expect(result.rateLimits.windowMs).toBe(DEFAULTS.rateLimits.windowMs);
  });

  it('updateSettings handles multiple nested keys', () => {
    updateSettings(ctx.db, {
      rateLimits: { windowMs: 30_000, max: 200 },
      costBudget: { globalMaxCostUnits: 1000 },
    });
    const result = loadSettings(ctx.db);
    expect(result.rateLimits).toEqual({ windowMs: 30_000, max: 200 });
    expect(result.costBudget.globalMaxCostUnits).toBe(1000);
    expect(result.costBudget.warnThreshold).toBe(DEFAULTS.costBudget.warnThreshold);
  });

  it('updateSettings overwrites previous values', () => {
    updateSettings(ctx.db, { rateLimits: { max: 50 } });
    updateSettings(ctx.db, { rateLimits: { max: 200 } });
    expect(loadSettings(ctx.db).rateLimits.max).toBe(200);
  });

  it('resetSettings clears all and returns defaults', () => {
    updateSettings(ctx.db, { rateLimits: { max: 50 }, costBudget: { globalMaxCostUnits: 500 } });
    const result = resetSettings(ctx.db);
    expect(result).toEqual(DEFAULTS);
    expect(loadSettings(ctx.db)).toEqual(result);
  });

  it('deleteSetting removes one key and returns true', () => {
    updateSettings(ctx.db, { rateLimits: { max: 50, windowMs: 30_000 } });
    expect(deleteSetting(ctx.db, 'rateLimits.max')).toBe(true);
    const result = loadSettings(ctx.db);
    expect(result.rateLimits.max).toBe(DEFAULTS.rateLimits.max);
    expect(result.rateLimits.windowMs).toBe(30_000);
  });

  it('deleteSetting returns false for non-existent key', () => {
    expect(deleteSetting(ctx.db, 'no.such.key')).toBe(false);
  });
});
