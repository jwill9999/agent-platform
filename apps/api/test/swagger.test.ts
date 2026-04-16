import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../src/infrastructure/http/createApp.js';

describe('GET /api-docs', () => {
  const app = createApp({ db: null });

  it('serves Swagger UI HTML', async () => {
    const res = await request(app).get('/api-docs/').redirects(1);
    expect(res.status).toBe(200);
    expect(res.text).toContain('swagger-ui');
  });

  it('returns the OpenAPI spec JSON', async () => {
    const res = await request(app).get('/api-docs/swagger-ui-init.js').expect(200);
    expect(res.text).toContain('Agent Platform API');
  });
});
