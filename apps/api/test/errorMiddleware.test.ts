import type { Server } from 'node:http';
import { listenLoopback, closeLoopbacks } from './support/loopbackServer.js';
import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';

import { errorMiddleware } from '../src/infrastructure/http/errorMiddleware.js';
import { HttpError } from '../src/infrastructure/http/httpError.js';

const servers = new Set<Server>();

afterEach(async () => {
  await closeLoopbacks(servers);
  servers.clear();
});

async function appWith(thrower: () => never) {
  const app = express();
  app.get('/boom', () => thrower());
  app.use(errorMiddleware);
  const server = await listenLoopback(app);
  servers.add(server);
  return server;
}

describe('errorMiddleware', () => {
  it('sends the request to the owned IPv4 listener and intended handler', async () => {
    const thrower = vi.fn(() => {
      throw new HttpError(404, 'NOT_FOUND', 'Owned fixture');
    });
    const app = await appWith(thrower);
    expect(app.address()).toMatchObject({ address: '127.0.0.1', family: 'IPv4' });
    await request(app)
      .get('/boom')
      .expect(404)
      .expect({ error: { code: 'NOT_FOUND', message: 'Owned fixture' } });
    expect(thrower).toHaveBeenCalledTimes(1);
  });
  it('returns generic message for unhandled errors (no info leakage)', async () => {
    const app = await appWith(() => {
      throw new Error('secret SQL trace: SELECT * FROM users WHERE ...');
    });
    const res = await request(app).get('/boom');
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
    expect(res.body.error.message).toBe('An unexpected error occurred');
    expect(res.body.error.message).not.toContain('SQL');
  });

  it('returns generic message for non-Error thrown values', async () => {
    const app = await appWith(() => {
      throw 'raw string error'; // NOSONAR: intentionally testing non-Error throw handling
    });
    const res = await request(app).get('/boom');
    expect(res.status).toBe(500);
    expect(res.body.error.message).toBe('An unexpected error occurred');
  });

  it('returns validation details for ZodError', async () => {
    const app = await appWith(() => {
      throw new ZodError([{ code: 'custom', message: 'bad', path: ['name'] }]);
    });
    const res = await request(app).get('/boom');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns HttpError message and code', async () => {
    const app = await appWith(() => {
      throw new HttpError(404, 'NOT_FOUND', 'Thing not found');
    });
    const res = await request(app).get('/boom');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(res.body.error.message).toBe('Thing not found');
  });

  it('returns CONSTRAINT_VIOLATION for SQLite constraint errors', async () => {
    const app = await appWith(() => {
      const err = new Error('UNIQUE constraint failed');
      (err as unknown as { code: string }).code = 'SQLITE_CONSTRAINT_UNIQUE';
      throw err;
    });
    const res = await request(app).get('/boom');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('CONSTRAINT_VIOLATION');
  });
});
