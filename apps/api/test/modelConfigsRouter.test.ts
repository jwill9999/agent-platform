import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { closeDatabase, openDatabase, resolveModelConfigKey } from '@agent-platform/db';
import { PROVIDER_CATALOGUE, testModelConnection } from '@agent-platform/model-router';
import express from 'express';
import request from 'supertest';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { errorMiddleware } from '../src/infrastructure/http/errorMiddleware.js';
import { createModelConfigsRouter } from '../src/infrastructure/http/v1/modelConfigsRouter.js';
import { closeLoopback, listenLoopback } from './support/loopbackServer.js';

// The API suite shares its module cache (isolate:false). Reload the router after
// this file's mock is registered, rather than retaining another file's real probe.
const { probeMock } = vi.hoisted(() => {
  vi.resetModules();
  return { probeMock: vi.fn() };
});
vi.mock('@agent-platform/model-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@agent-platform/model-router')>()),
  testModelConnection: probeMock,
}));
let directory: string;
let opened: ReturnType<typeof openDatabase>;
let server: Awaited<ReturnType<typeof listenLoopback>>;
const key = randomBytes(32);
let originalMasterKey: string | undefined;
let originalFetch: typeof fetch;
const blockedFetch = vi.fn<typeof fetch>(() =>
  Promise.reject(new Error('Unit probe must not dispatch network requests')),
);
beforeEach(async () => {
  originalFetch = globalThis.fetch;
  blockedFetch.mockClear();
  globalThis.fetch = blockedFetch;
  originalMasterKey = process.env['SECRETS_MASTER_KEY'];
  process.env['SECRETS_MASTER_KEY'] = key.toString('base64');
  directory = mkdtempSync(path.join(tmpdir(), 'model-config-api-'));
  opened = openDatabase(path.join(directory, 'profile.sqlite'));
  const app = express();
  app.use(express.json());
  app.use('/v1/model-configs', createModelConfigsRouter(opened.db));
  app.use(errorMiddleware);
  server = await listenLoopback(app);
  vi.mocked(testModelConnection).mockReset();
});
afterEach(async () => {
  try {
    await closeLoopback(server);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalMasterKey === undefined) delete process.env['SECRETS_MASTER_KEY'];
    else process.env['SECRETS_MASTER_KEY'] = originalMasterKey;
    closeDatabase(opened.sqlite);
    rmSync(directory, { recursive: true, force: true });
    expect(blockedFetch).not.toHaveBeenCalled();
  }
});
afterAll(() => {
  // Do not leave this unit's mocked router closure cached for later real-SDK suites.
  vi.doUnmock('@agent-platform/model-router');
  vi.resetModules();
});
async function create() {
  const response = await request(server).post('/v1/model-configs').send({
    name: 'User model',
    provider: 'openai-compatible',
    model: '  ExactCase/Model  ',
    apiKey: 'synthetic-credential',
    baseURL: 'https://gateway.example/v1',
  });
  expect(response.status).toBe(201);
  return response.body.data as { id: string; model: string; baseURL: string; hasApiKey: boolean };
}
describe('saved provider API', () => {
  it('lists the shared provider catalogue without interpreting providers as a model config ID', async () => {
    const response = await request(server).get('/v1/model-configs/providers');
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual(PROVIDER_CATALOGUE);
    expect(response.body.data.map((entry: { id: string }) => entry.id)).toEqual(
      expect.arrayContaining(['openai', 'anthropic', 'google', 'deepseek', 'xai', 'openrouter']),
    );
  });
  it('preserves exact model ID, encrypted credential and endpoint through CRUD and passes the endpoint to the SDK', async () => {
    const config = await create();
    expect(config.model).toBe('ExactCase/Model');
    expect(config.baseURL).toBe('https://gateway.example/v1');
    expect(JSON.stringify(config)).not.toContain('synthetic-credential');
    expect(resolveModelConfigKey(opened.db, config.id, key)).toBe('synthetic-credential');
    vi.mocked(testModelConnection).mockResolvedValue({
      ok: false,
      latencyMs: 1,
      category: 'request',
      error: 'Provider rejected the request',
      retryable: false,
    });
    const response = await request(server).post(`/v1/model-configs/${config.id}/test`);
    expect(response.status).toBe(200);
    expect(response.body.data.ok).toBe(false);
    expect(vi.mocked(testModelConnection)).toHaveBeenCalledExactlyOnceWith({
      provider: 'openai-compatible',
      model: 'ExactCase/Model',
      apiKey: 'synthetic-credential',
      baseURL: 'https://gateway.example/v1',
    });
  });
  it('clears old provider credential/endpoint while preserving ID and supports a new explicit credential/endpoint', async () => {
    const config = await create();
    const switched = await request(server)
      .put(`/v1/model-configs/${config.id}`)
      .send({ provider: 'anthropic', model: 'ClaudeExactCase' });
    expect(switched.status).toBe(200);
    expect(switched.body.data).toMatchObject({
      id: config.id,
      provider: 'anthropic',
      model: 'ClaudeExactCase',
      baseURL: null,
      hasApiKey: false,
    });
    const replaced = await request(server).put(`/v1/model-configs/${config.id}`).send({
      provider: 'google',
      apiKey: 'synthetic-second',
      baseURL: 'https://google.example/v1',
    });
    expect(replaced.status).toBe(200);
    expect(replaced.body.data).toMatchObject({
      id: config.id,
      hasApiKey: true,
      baseURL: 'https://google.example/v1',
    });
    expect(resolveModelConfigKey(opened.db, config.id, key)).toBe('synthetic-second');
    const cleared = await request(server)
      .put(`/v1/model-configs/${config.id}`)
      .send({ baseURL: null });
    expect(cleared.body.data.baseURL).toBeNull();
    expect(cleared.body.data.hasApiKey).toBe(true);
  });
  it('fails safely when stored credentials cannot decrypt without invoking a provider', async () => {
    const config = await create();
    process.env['SECRETS_MASTER_KEY'] = randomBytes(32).toString('base64');
    const response = await request(server).post(`/v1/model-configs/${config.id}/test`);
    expect(response.status).toBe(503);
    expect(response.body.error).toEqual({
      code: 'MODEL_CONNECTION_UNAVAILABLE',
      message: 'Stored model credential is unavailable',
    });
    expect(testModelConnection).not.toHaveBeenCalled();
    expect(JSON.stringify(response.body)).not.toMatch(
      /synthetic-credential|ciphertext|decrypt|master|PRIVATE/,
    );
  });
  it('does not expose raw thrown provider bodies through failed connection probes', async () => {
    const config = await create();
    vi.mocked(testModelConnection).mockRejectedValue(new Error('PRIVATE_PROVIDER_BODY_SENTINEL'));
    const response = await request(server).post(`/v1/model-configs/${config.id}/test`);
    expect(response.status).toBe(503);
    expect(response.body.error).toEqual({
      code: 'MODEL_CONNECTION_UNAVAILABLE',
      message: 'Model connection could not be tested',
    });
    expect(JSON.stringify(response.body)).not.toMatch(/SENTINEL|PRIVATE/);
  });
  it.each([
    { provider: 'not-supported' },
    { baseURL: 'http://remote.example/v1' },
    { baseURL: 'https://credential:secret@example.test' },
  ])(
    'rejects invalid provider/endpoint without SDK calls or storing records %j',
    async (invalid) => {
      const response = await request(server)
        .post('/v1/model-configs')
        .send({ name: 'one', provider: 'openai', model: 'model', ...invalid });
      expect(response.status).toBe(400);
      expect(testModelConnection).not.toHaveBeenCalled();
      expect(opened.sqlite.prepare('SELECT * FROM model_configs').all()).toHaveLength(0);
    },
  );
});
