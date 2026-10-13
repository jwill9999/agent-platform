import type { Server } from 'node:http';

import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../src/infrastructure/http/createApp.js';
import { closeLoopback, listenLoopback } from './support/loopbackServer.js';

describe('GET /api-docs', () => {
  let server: Server;

  beforeAll(async () => {
    server = await listenLoopback(createApp({ db: null }));
  });

  afterAll(async () => {
    if (server) await closeLoopback(server);
  });

  it('serves Swagger UI HTML', async () => {
    const res = await request(server).get('/api-docs/').redirects(1);
    expect(res.status).toBe(200);
    expect(res.text).toContain('swagger-ui');
  });

  it('returns the OpenAPI spec JSON', async () => {
    const res = await request(server).get('/api-docs/swagger-ui-init.js').expect(200);
    expect(res.text).toContain('Agent Platform API');
  });
});
