import type { DrizzleDb } from '@agent-platform/db';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { createApp } from '../src/infrastructure/http/createApp.js';
import {
  checkDatabase,
  checkDisk,
  runReadinessCheck,
} from '../src/application/health/readinessCheck.js';

function mockDb(overrides: Partial<DrizzleDb> = {}): DrizzleDb {
  return { run: vi.fn(), ...overrides } as unknown as DrizzleDb;
}

// ---------------------------------------------------------------------------
// Unit: checkDatabase
// ---------------------------------------------------------------------------

describe('checkDatabase', () => {
  it('returns healthy when db.run succeeds', async () => {
    const result = await checkDatabase(mockDb());
    expect(result.status).toBe('healthy');
    expect(result.latencyMs).toBeTypeOf('number');
    expect(result.error).toBeUndefined();
  });

  it('returns unhealthy when db.run throws', async () => {
    const db = mockDb({
      run: vi.fn(() => {
        throw new Error('disk I/O error');
      }) as DrizzleDb['run'],
    });
    const result = await checkDatabase(db);
    expect(result.status).toBe('unhealthy');
    expect(result.error).toBe('disk I/O error');
  });
});

// ---------------------------------------------------------------------------
// Unit: checkDisk
// ---------------------------------------------------------------------------

describe('checkDisk', () => {
  it('returns degraded when sqlitePath is undefined', () => {
    const result = checkDisk(undefined);
    expect(result.status).toBe('degraded');
    expect(result.error).toContain('SQLITE_PATH');
  });

  it('returns unhealthy when file does not exist', () => {
    const result = checkDisk('/nonexistent/path/to/db.sqlite');
    expect(result.status).toBe('unhealthy');
    expect(result.error).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Unit: runReadinessCheck
// ---------------------------------------------------------------------------

describe('runReadinessCheck', () => {
  it('returns unhealthy when db is null', async () => {
    const result = await runReadinessCheck({ db: null, sqlitePath: undefined });
    expect(result.status).toBe('unhealthy');
    expect(result.checks['database']?.status).toBe('unhealthy');
    expect(result.checks['database']?.error).toBe('No database connection');
    expect(result.timestamp).toBeTruthy();
  });

  it('returns healthy when db and disk both pass', async () => {
    const result = await runReadinessCheck({ db: mockDb(), sqlitePath: import.meta.filename });
    expect(result.status).toBe('healthy');
    expect(result.checks['database']?.status).toBe('healthy');
    expect(result.checks['disk']?.status).toBe('healthy');
  });

  it('overall status is degraded when one check is degraded', async () => {
    const result = await runReadinessCheck({ db: mockDb(), sqlitePath: undefined });
    // db healthy + disk degraded → overall degraded
    expect(result.status).toBe('degraded');
  });

  it('overall status is unhealthy when any check is unhealthy', async () => {
    const db = mockDb({
      run: vi.fn(() => {
        throw new Error('fail');
      }) as DrizzleDb['run'],
    });
    const result = await runReadinessCheck({ db, sqlitePath: import.meta.filename });
    expect(result.status).toBe('unhealthy');
  });

  it('timestamp is valid ISO-8601', async () => {
    const result = await runReadinessCheck({ db: null, sqlitePath: undefined });
    expect(() => new Date(result.timestamp).toISOString()).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Integration: GET /health (regression) and GET /health/ready
// ---------------------------------------------------------------------------

describe('GET /health (regression)', () => {
  it('still returns { ok: true }', async () => {
    const app = createApp({ db: null });
    const res = await request(app).get('/health').expect(200).expect('Content-Type', /json/);
    expect(res.body).toEqual({ ok: true });
  });
});

describe('GET /health/ready', () => {
  it('returns 503 when db is null', async () => {
    const app = createApp({ db: null });
    const res = await request(app).get('/health/ready').expect(503).expect('Content-Type', /json/);
    expect(res.body.status).toBe('unhealthy');
    expect(res.body.checks).toBeDefined();
    expect(res.body.checks.database.status).toBe('unhealthy');
    expect(res.body.timestamp).toBeTruthy();
  });

  it('response conforms to ReadinessResponse schema', async () => {
    const app = createApp({ db: null });
    const res = await request(app).get('/health/ready').expect(503);

    // Validate shape
    expect(res.body).toHaveProperty('status');
    expect(res.body).toHaveProperty('checks');
    expect(res.body).toHaveProperty('timestamp');
    expect(['healthy', 'degraded', 'unhealthy']).toContain(res.body.status);
  });
});
