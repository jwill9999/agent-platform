import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../src/infrastructure/http/createApp.js';

describe('GET /health', () => {
  it('returns JSON ok from contracts', async () => {
    const app = createApp({ db: null });
    const res = await request(app).get('/health').expect(200).expect('Content-Type', /json/);
    expect(res.body).toEqual({ ok: true });
  });
});
