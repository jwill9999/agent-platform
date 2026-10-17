import { createServer, type RequestListener } from 'node:http';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  closeDatabase,
  createSession,
  DEFAULT_AGENT_ID,
  openDatabase,
  runSeed,
} from '@agent-platform/db';
import {
  createLlmReasonNode,
  type HarnessStateType,
  type RunExecutionControl,
} from '@agent-platform/harness';
import { createApp } from '../src/infrastructure/http/createApp.js';
import { getRunControlService } from '../src/application/runControl/service.js';
import { listenLoopback, closeLoopback } from './support/loopbackServer.js';

const cleanups: Array<() => Promise<void>> = [];
beforeEach(() => {
  for (const name of ['LANGCHAIN_TRACING_V2', 'LANGSMITH_TRACING', 'LANGSMITH_TRACING_V2'])
    vi.stubEnv(name, 'false');
  vi.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(async () => {
  const results = await Promise.allSettled(
    cleanups
      .splice(0)
      .reverse()
      .map((cleanup) => cleanup()),
  );
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  const errors = results.flatMap((result) => (result.status === 'rejected' ? [result.reason] : []));
  if (errors.length) throw new AggregateError(errors, 'Provider Stop fixture cleanup failed');
});
async function fixture(provider: RequestListener) {
  const directory = mkdtempSync(join(tmpdir(), 'provider-stop-authority-'));
  const { db, sqlite } = openDatabase(join(directory, 'app.sqlite'));
  runSeed(db);
  const service = getRunControlService(db);
  const session = createSession(db, { agentId: DEFAULT_AGENT_ID });
  const executionId = randomUUID();
  const execution = service.open(session, executionId);
  const app = await listenLoopback(createApp({ db }));
  const server = createServer(provider);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Provider fixture unavailable');
  vi.stubEnv('OLLAMA_BASE_URL', `http://127.0.0.1:${address.port}/v1`);
  cleanups.push(async () => {
    server.closeAllConnections();
    try {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await closeLoopback(app);
    } finally {
      closeDatabase(sqlite);
      rmSync(directory, { recursive: true, force: true });
    }
  });
  return {
    execution,
    service,
    session,
    state: {
      messages: [{ role: 'user', content: 'fixture' }],
      modelConfig: { provider: 'ollama', model: 'fixture' },
      toolDefinitions: [],
      trace: [],
      halted: false,
      totalTokensUsed: 0,
      limits: { maxSteps: 5, timeoutMs: 10_000 },
      runId: executionId,
      sessionId: session.id,
    } as HarnessStateType,
    async stop() {
      return request(app)
        .post(`/v1/sessions/${session.id}/runs/${execution.runId}/stop`)
        .send({})
        .expect(200);
    },
    async current() {
      return (
        await request(app).get(`/v1/sessions/${session.id}/runs/${execution.runId}`).expect(200)
      ).body.data;
    },
  };
}

describe('actual AI SDK abort identity at durable model settlement', () => {
  it('settles a genuinely stopped partial HTTP stream as cancelled rather than provider failure', async () => {
    let received = 0;
    let disconnected = false;
    const f = await fixture((req, res) => {
      req.resume();
      received++;
      res.once('close', () => {
        disconnected = true;
      });
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      res.write(
        'data: ' +
          JSON.stringify({
            id: 'fixture',
            object: 'chat.completion.chunk',
            created: 1,
            model: 'fixture',
            choices: [
              { index: 0, delta: { content: 'Retained partial response.' }, finish_reason: null },
            ],
          }) +
          '\n\n',
      );
    });
    let stopped = false;
    const result = await createLlmReasonNode({
      emitter: {
        async emit(event) {
          if (event.type === 'text' && !stopped) {
            stopped = true;
            await f.stop();
          }
        },
        end() {},
      },
    })(f.state, { configurable: { signal: f.execution.signal, runControl: f.execution } });
    f.execution.finish('completed', 'user_stop');
    expect(result).toMatchObject({
      halted: true,
      llmOutput: null,
      messages: [{ role: 'assistant', content: 'Retained partial response.' }],
    });
    expect(result.trace).toContainEqual({ type: 'stream_aborted', reason: 'user_stop' });
    expect(await f.current()).toMatchObject({
      state: 'cancelled',
      reason: 'user_stop',
      inFlight: 0,
    });
    await vi.waitFor(() => expect(disconnected).toBe(true));
    expect(received).toBe(1);
  });

  it('preserves a genuine HTTP500 observed before a competing Stop instead of matching its message to user_stop', async () => {
    let received = 0;
    const f = await fixture((req, res) => {
      req.resume();
      received++;
      res.writeHead(500, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: { message: 'user_stop' } }));
    });
    let observed: unknown;
    // Hold the observed real SDK rejection at the application-settlement boundary, then acknowledge Stop.
    // The failure object must retain its identity despite the concurrent user-stop signal.
    const control: RunExecutionControl = {
      assertActive() {
        f.execution.assertActive();
      },
      invoke(kind, action) {
        return f.execution.invoke(kind, async () => {
          try {
            return await action();
          } catch (error) {
            observed = error;
            await f.stop();
            throw error;
          }
        });
      },
    };
    await createLlmReasonNode()(f.state, {
      configurable: { signal: f.execution.signal, runControl: control },
    });
    f.execution.finish('failed', 'execution_failed');
    expect(observed).toMatchObject({ statusCode: 500 });
    expect(await f.current()).toMatchObject({
      state: 'failed',
      reason: 'execution_failed',
      inFlight: 0,
    });
    expect(received).toBe(1);
  });
});
