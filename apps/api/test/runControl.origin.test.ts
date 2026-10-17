import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Server } from 'node:http';
import { createSession, DEFAULT_AGENT_ID, openDatabase, runSeed } from '@agent-platform/db';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/infrastructure/http/createApp.js';
import { getRunControlService } from '../src/application/runControl/service.js';
import { closeLoopback, listenLoopback } from './support/loopbackServer.js';

let directory: string;
let context: ReturnType<typeof openDatabase>;
let app: Server;
let endpoint: string;
let sessionId: string;
let runId: string;
let origin: string;
beforeEach(async () => {
  directory = mkdtempSync(join(tmpdir(), 'stop-origin-'));
  context = openDatabase(join(directory, 'agent.sqlite'));
  runSeed(context.db);
  app = await listenLoopback(createApp({ db: context.db }));
  const address = app.address();
  if (!address || typeof address === 'string') throw new Error('Expected owned TCP listener');
  origin = `http://127.0.0.1:${address.port}`;
  const session = createSession(context.db, { agentId: DEFAULT_AGENT_ID });
  sessionId = session.id;
  runId = getRunControlService(context.db).open(session, randomUUID()).runId;
  endpoint = `/v1/sessions/${sessionId}/runs/${runId}/stop`;
});
afterEach(async () => {
  await closeLoopback(app);
  context.sqlite.close();
  rmSync(directory, { recursive: true, force: true });
});

describe('Stop mutation browser origin admission', () => {
  it.each([
    {
      label: 'hostile simple form',
      headers: {
        Origin: 'https://hostile.example',
        'Sec-Fetch-Site': 'cross-site',
        'Content-Type': 'text/plain',
      },
    },
    { label: 'opaque origin', headers: { Origin: 'null', 'Content-Type': 'application/json' } },
    {
      label: 'cross-site without Origin',
      headers: { 'Sec-Fetch-Site': 'cross-site', 'Content-Type': 'application/json' },
    },
    {
      label: 'missing Origin with browser metadata',
      headers: { 'Sec-Fetch-Site': 'same-origin', 'Content-Type': 'application/json' },
    },
    {
      label: 'another local renderer',
      headers: { Origin: 'http://127.0.0.1:1', 'Content-Type': 'application/json' },
    },
    {
      label: 'forwarded origin forgery',
      headers: {
        Origin: 'https://hostile.example',
        'X-Forwarded-Host': 'hostile.example',
        'X-Forwarded-Proto': 'https',
        'Content-Type': 'application/json',
      },
    },
    {
      label: 'DNS rebinding host',
      headers: {
        Host: 'hostile.example',
        Origin: 'http://hostile.example',
        'Sec-Fetch-Site': 'same-origin',
        'Content-Type': 'application/json',
      },
    },
  ])('rejects $label before committing a Stop fence', async ({ headers }) => {
    const service = getRunControlService(context.db);
    const before = service.require(sessionId, runId);
    const result = await request(app).post(endpoint).set(headers).send('{}').expect(403);
    expect(result.body.error.code).toBe('STOP_ORIGIN_DENIED');
    expect(service.require(sessionId, runId)).toEqual(before);
    expect(before.state).toBe('running');
  });

  it('preserves no-Origin headless voice/CLI Stop', async () => {
    const result = await request(app).post(endpoint).send({}).expect(200);
    expect(result.body.data).toMatchObject({ id: runId, state: 'cancelled', reason: 'user_stop' });
  });

  it('accepts exact same-origin JSON from the actual dynamic local API address', async () => {
    const result = await request(app)
      .post(endpoint)
      .set({ Origin: origin, Host: new URL(origin).host, 'Sec-Fetch-Site': 'same-origin' })
      .send({})
      .expect(200);
    expect(result.body.data.id).toBe(runId);
    expect(getRunControlService(context.db).require(sessionId, runId).state).toBe('cancelled');
  });

  it('rejects same-origin text/plain without applying the mutation', async () => {
    await request(app)
      .post(endpoint)
      .set({ Origin: origin, Host: new URL(origin).host, 'Content-Type': 'text/plain' })
      .send('{}')
      .expect(403);
    expect(getRunControlService(context.db).require(sessionId, runId).state).toBe('running');
  });
});
