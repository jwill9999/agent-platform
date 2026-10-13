import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../src/infrastructure/http/createApp.js';
import { closeLoopback, listenLoopback } from './support/loopbackServer.js';

describe('GET /health', () => {
  it('returns JSON ok from contracts', async () => {
    const app = createApp({ db: null });
    const server = await listenLoopback(app);
    try {
      const res = await request(server).get('/health').expect(200).expect('Content-Type', /json/);
      expect(res.body).toEqual({ ok: true });
    } finally {
      await closeLoopback(server);
    }
  });
});
