import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';

import { errorMiddleware } from '../src/infrastructure/http/errorMiddleware.js';
import { HttpError } from '../src/infrastructure/http/httpError.js';

function appWith(thrower: () => never) {
  const app = express();
  app.get('/boom', () => thrower());
  app.use(errorMiddleware);
  return app;
}

describe('errorMiddleware', () => {
  it('returns generic message for unhandled errors (no info leakage)', async () => {
    const app = appWith(() => {
      throw new Error('secret SQL trace: SELECT * FROM users WHERE ...');
    });
    const res = await request(app).get('/boom');
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
    expect(res.body.error.message).toBe('An unexpected error occurred');
    expect(res.body.error.message).not.toContain('SQL');
  });

  it('returns generic message for non-Error thrown values', async () => {
    const app = appWith(() => {
      throw 'raw string error';
    });
    const res = await request(app).get('/boom');
    expect(res.status).toBe(500);
    expect(res.body.error.message).toBe('An unexpected error occurred');
  });

  it('returns validation details for ZodError', async () => {
    const app = appWith(() => {
      throw new ZodError([{ code: 'custom', message: 'bad', path: ['name'] }]);
    });
    const res = await request(app).get('/boom');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns HttpError message and code', async () => {
    const app = appWith(() => {
      throw new HttpError(404, 'NOT_FOUND', 'Thing not found');
    });
    const res = await request(app).get('/boom');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(res.body.error.message).toBe('Thing not found');
  });

  it('returns CONSTRAINT_VIOLATION for SQLite constraint errors', async () => {
    const app = appWith(() => {
      const err = new Error('UNIQUE constraint failed');
      (err as unknown as { code: string }).code = 'SQLITE_CONSTRAINT_UNIQUE';
      throw err;
    });
    const res = await request(app).get('/boom');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('CONSTRAINT_VIOLATION');
  });
});
