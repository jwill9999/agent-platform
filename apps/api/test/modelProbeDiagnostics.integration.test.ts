import { createServer, type Server } from 'node:http';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDiagnosticStore, openDatabase, runSeed } from '@agent-platform/db';
import { DiagnosticReportSchema } from '@agent-platform/contracts';
import { createApp } from '../src/infrastructure/http/createApp.js';

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  const settled = await Promise.allSettled(
    cleanups
      .splice(0)
      .reverse()
      .map((fn) => fn()),
  );
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  const errors = settled.flatMap((r) => (r.status === 'rejected' ? [r.reason] : []));
  if (errors.length) throw new AggregateError(errors, 'Probe fixture cleanup failed');
});
function listen(server: Server): Promise<void> {
  return new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
}
function stop(server: Server): Promise<void> {
  server.closeAllConnections();
  return new Promise((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));
}
const privateMarker = 'PRIVATE_PROVIDER_BODY_AND_SECRET_SENTINEL';
const capability = 'b'.repeat(64);
const host = '127.0.0.1:3456';

async function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'provider-probe-diagnostics-'));
  const opened = openDatabase(join(dir, 'app.sqlite'));
  runSeed(opened.db);
  let store = createDiagnosticStore({ path: join(dir, 'diagnostics.sqlite') });
  await store.ready;
  let status = 400;
  let calls = 0;
  const service = createServer((req, res) => {
    calls++;
    req.resume();
    res.setHeader('content-type', 'application/json');
    res.statusCode = status;
    res.end(
      JSON.stringify(
        status !== 200
          ? {
              error: {
                message: `Unsupported parameter max_tokens ${privateMarker}`,
                type: 'invalid_request_error',
                code: 'unsupported_parameter',
              },
            }
          : {
              id: 'resp_probe',
              object: 'response',
              created_at: 1,
              model: 'gpt-6.1-sol',
              status: 'completed',
              output: [
                {
                  id: 'msg_probe',
                  type: 'message',
                  role: 'assistant',
                  content: [{ type: 'output_text', text: 'OK', annotations: [] }],
                },
              ],
              usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
            },
      ),
    );
  });
  await listen(service);
  const address = service.address();
  if (!address || typeof address === 'string') throw new Error('Missing fixture address');
  vi.stubEnv('SECRETS_MASTER_KEY', randomBytes(32).toString('base64'));
  const app = () =>
    createApp({ db: opened.db, diagnostics: { store, access: { host, capability } } });
  let application = app();
  cleanups.push(async () => {
    await stop(service);
    await store.close();
    opened.sqlite.close();
    rmSync(dir, { recursive: true, force: true });
  });
  const saved = await request(application)
    .post('/v1/model-configs')
    .send({
      name: 'Probe fixture',
      provider: 'openai',
      model: 'gpt-6.1-sol',
      baseURL: `http://127.0.0.1:${address.port}/v1`,
      apiKey: 'fixture-secret-private',
    })
    .expect(201);
  const configId = saved.body.data.id as string;
  const probe = () => request(application).post(`/v1/model-configs/${configId}/test`).send({});
  const report = (requestId: string) =>
    request(application)
      .post('/v1/diagnostics/report')
      .set('Host', host)
      .set('x-diagnostics-capability', capability)
      .send({ scope: { requestId } });
  return {
    configId,
    probe,
    report,
    calls: () => calls,
    succeed: () => {
      status = 200;
    },
    restart: async () => {
      await store.close();
      store = createDiagnosticStore({ path: join(dir, 'diagnostics.sqlite') });
      await store.ready;
      application = app();
    },
    breakRecorder: () =>
      vi.spyOn(store, 'record').mockImplementation(() => {
        throw new Error(privateMarker);
      }),
  };
}

describe('real SDK settings probes in durable local diagnostics', () => {
  it('retains failed unsupported-parameter and successful outcomes across recorder restart without raw data', async () => {
    const f = await fixture();
    const failed = await f.probe().expect(200);
    expect(failed.body.data).toMatchObject({ ok: false, category: 'request' });
    expect(f.calls()).toBe(1);
    const first = DiagnosticReportSchema.parse(
      (await f.report(failed.headers['x-request-id']).expect(200)).body,
    );
    const probe = first.events.filter(({ event }) => event.phase === 'connection');
    expect(probe.map(({ event }) => event.outcome)).toEqual(['started', 'failed']);
    expect(probe[1]?.event).toMatchObject({
      providerFailure: 'request',
      modelConfigId: f.configId,
      attempt: 1,
    });
    expect(probe[1]?.event.durationMs).toBeGreaterThanOrEqual(0);
    expect(probe[0]?.event.operationId).toBe(probe[1]?.event.operationId);
    expect(JSON.stringify(first)).not.toMatch(
      /PRIVATE_PROVIDER|fixture-secret|unsupported_parameter|max_tokens/,
    );
    await f.restart();
    const restored = DiagnosticReportSchema.parse(
      (await f.report(failed.headers['x-request-id']).expect(200)).body,
    );
    expect(restored.events.map(({ event }) => event.eventId)).toEqual(
      first.events.map(({ event }) => event.eventId),
    );
    f.succeed();
    const success = await f.probe().expect(200);
    expect(success.body.data.ok).toBe(true);
    expect(f.calls()).toBe(2);
    const successful = DiagnosticReportSchema.parse(
      (await f.report(success.headers['x-request-id']).expect(200)).body,
    );
    expect(
      successful.events
        .filter(({ event }) => event.phase === 'connection')
        .map(({ event }) => event.outcome),
    ).toEqual(['started', 'succeeded']);
  });
  it('preserves an actual SDK failed result when durable observation throws', async () => {
    const f = await fixture();
    f.breakRecorder();
    const response = await f.probe().expect(200);
    expect(response.body.data).toMatchObject({ ok: false, category: 'request' });
    expect(f.calls()).toBe(1);
    expect(JSON.stringify(response.body)).not.toContain(privateMarker);
  });
});
