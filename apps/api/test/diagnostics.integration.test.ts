import { request as httpRequest } from 'node:http';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { DiagnosticReportSchema, type DiagnosticStore } from '@agent-platform/contracts';
import {
  closeDatabase,
  createDiagnosticStore,
  DEFAULT_AGENT_ID,
  openDatabase,
  runSeed,
} from '@agent-platform/db';
import type { HarnessStateType } from '@agent-platform/harness';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/infrastructure/http/createApp.js';
import { consumeDiagnosticAccess } from '../src/infrastructure/diagnostics/localAccess.js';
import type { ChatRouterOptions } from '../src/infrastructure/http/v1/chatRouter.js';

// Resolve the SDK through its owning workspace; API has no direct ai dependency.
const mockStreamText = vi.hoisted(() => vi.fn());
vi.mock('../../../packages/harness/node_modules/ai', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  streamText: (...args: unknown[]) => mockStreamText(...args),
}));

const capability = 'a'.repeat(64);
const host = '127.0.0.1:3456';
const canary = 'sk-CANARY-do-not-export /Users/private/secret prompt text';
const cleanups: Array<() => Promise<void>> = [];
beforeEach(() => {
  vi.stubEnv('LANGCHAIN_TRACING_V2', 'false');
  vi.stubEnv('LANGSMITH_TRACING', 'false');
  vi.stubEnv('LANGSMITH_TRACING_V2', 'false');
});
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

async function fixture(
  node?: ChatRouterOptions['llmReasonNode'],
  extra: Partial<ChatRouterOptions> = {},
  appVersion?: string,
  appFactory = createApp,
) {
  const dir = mkdtempSync(join(tmpdir(), 'diagnostic-api-'));
  const { db, sqlite } = openDatabase(join(dir, 'app.sqlite'));
  runSeed(db);
  let store: DiagnosticStore = createDiagnosticStore({ path: join(dir, 'diagnostics.sqlite') });
  await store.ready;
  expect(store.health().state).toBe('ready');
  const app = appFactory({
    db,
    diagnostics: { store, access: { host, capability }, appVersion },
    v1: { chat: { llmReasonNode: node, emitFinalAssistantMessage: true, ...extra } },
  });
  cleanups.push(async () => {
    await store.close();
    closeDatabase(sqlite);
    rmSync(dir, { recursive: true, force: true });
  });
  const report = (scope: unknown, cursor?: string) =>
    request(app)
      .post('/v1/diagnostics/report')
      .set('Host', host)
      .set('x-diagnostics-capability', capability)
      .send({ scope, ...(cursor ? { cursor } : {}) });
  const session = await request(app)
    .post('/v1/sessions')
    .send({ agentId: DEFAULT_AGENT_ID })
    .expect(201);
  return {
    app,
    dir,
    db,
    store,
    sessionId: session.body.data.id as string,
    report,
    async restart() {
      await store.close();
      store = createDiagnosticStore({ path: join(dir, 'diagnostics.sqlite') });
      await store.ready;
      return store;
    },
  };
}

describe('local diagnostic API with real SQLite', () => {
  it('records malformed and pre-run failures with unique trusted request-only identities', async () => {
    const f = await fixture();
    const responses = await Promise.all([
      request(f.app).post('/v1/chat').set('x-correlation-id', 'same').send({}),
      request(f.app)
        .post('/v1/chat')
        .set('x-correlation-id', 'same')
        .set('Content-Type', 'application/json')
        .send('{broken'),
    ]);
    expect(responses.map((r) => r.status)).toEqual([400, 400]);
    const ids = responses.map((r) => r.headers['x-request-id'] as string);
    expect(new Set(ids).size).toBe(2);
    for (const requestId of ids) {
      const res = await f.report({ requestId }).expect(200);
      const report = DiagnosticReportSchema.parse(res.body);
      expect(report.events.some((row) => row.event.outcome === 'failed')).toBe(true);
      expect(report.events.every((row) => !row.event.runId && !row.event.sessionId)).toBe(true);
    }
    expect((await f.report({ requestId: randomUUID() })).status).toBe(404);
  });

  it('accepts BFF linkage only from the authenticated local forwarder', async () => {
    const f = await fixture();
    const forwarded = randomUUID();
    const spoofed = await request(f.app)
      .post('/v1/chat')
      .set('x-bff-request-id', forwarded)
      .send({})
      .expect(400);
    const local = await request(f.app)
      .post('/v1/chat')
      .set('Host', host)
      .set('x-diagnostics-capability', capability)
      .set('x-bff-request-id', forwarded)
      .send({})
      .expect(400);
    const untrusted = DiagnosticReportSchema.parse(
      (await f.report({ requestId: spoofed.headers['x-request-id'] }).expect(200)).body,
    );
    const trusted = DiagnosticReportSchema.parse(
      (await f.report({ requestId: local.headers['x-request-id'] }).expect(200)).body,
    );
    expect(untrusted.events.every((row) => !row.event.bffRequestId)).toBe(true);
    expect(trusted.events.every((row) => row.event.bffRequestId === forwarded)).toBe(true);
    expect(trusted.events.every((row) => row.event.requestId !== forwarded)).toBe(true);
  });

  it('denies missing capability and foreign host before accessing the store', async () => {
    const f = await fixture();
    const query = vi.spyOn(f.store, 'query');
    const body = { scope: { requestId: randomUUID() } };
    await request(f.app).post('/v1/diagnostics/report').set('Host', host).send(body).expect(403);
    await request(f.app)
      .post('/v1/diagnostics/report')
      .set('Host', 'evil.example')
      .set('x-forwarded-host', host)
      .set('x-diagnostics-capability', capability)
      .send(body)
      .expect(403);
    expect(query).not.toHaveBeenCalled();
  });

  it('rejects invalid report/list inputs without reflecting secret keys or payloads', async () => {
    const f = await fixture();
    for (const endpoint of ['report', 'list']) {
      const response = await request(f.app)
        .post(`/v1/diagnostics/${endpoint}`)
        .set('Host', host)
        .set('x-diagnostics-capability', capability)
        .send({ [canary]: canary })
        .expect(400);
      expect(response.body.error.code).toBe('INVALID_SCOPE');
      expect(JSON.stringify(response.body)).not.toContain(canary);
    }
  });

  it('paginates a stable protected snapshot and rejects cross-scope cursors', async () => {
    const f = await fixture();
    const requestId = randomUUID();
    const processInstanceId = f.store.health().processInstanceId;
    const eventIds: string[] = [];
    async function append(count: number) {
      for (let index = 0; index < count; index++) {
        const eventId = randomUUID();
        eventIds.push(eventId);
        expect(
          f.store.record({
            schemaVersion: 1,
            eventId,
            processInstanceId,
            requestId,
            sessionId: f.sessionId,
            phase: 'model',
            outcome: 'succeeded',
            observedAtMs: Date.now(),
          }),
        ).toBe(true);
        if (index % 100 === 99) await f.store.flush();
      }
      await f.store.flush();
    }
    await append(1005);
    const firstResponse = await f.report({ sessionId: f.sessionId }).expect(200);
    const first = DiagnosticReportSchema.parse(firstResponse.body);
    const cursor = firstResponse.headers['x-diagnostics-next-cursor'] as string;
    expect(cursor).toBeTruthy();
    expect(first.events).toHaveLength(1000);
    expect(first.coverage.truncated).toBe(true);
    expect(firstResponse.headers['cache-control']).toBe('no-store');
    await append(1);
    const secondResponse = await f.report({ sessionId: f.sessionId }, cursor).expect(200);
    const second = DiagnosticReportSchema.parse(secondResponse.body);
    expect(second.events).toHaveLength(5);
    expect(second.coverage.snapshotSequence).toBe(first.coverage.snapshotSequence);
    expect(second.coverage.truncated).toBe(false);
    expect(secondResponse.headers['x-diagnostics-next-cursor']).toBeUndefined();
    expect([...first.events, ...second.events].map(({ event }) => event.eventId)).toEqual(
      eventIds.slice(0, 1005),
    );
    expect(second.events.some(({ event }) => event.eventId === eventIds.at(-1))).toBe(false);
    const mismatch = await f.report({ requestId }, cursor).expect(400);
    expect(mismatch.body.error.code).toBe('INVALID_CURSOR');
    expect(mismatch.headers['x-diagnostics-next-cursor']).toBeUndefined();
    await request(f.app)
      .post('/v1/diagnostics/report')
      .set('Host', host)
      .send({ scope: { sessionId: f.sessionId }, cursor })
      .expect(403);
  });

  it('exports only validated application version metadata', async () => {
    for (const [version, expected] of [
      ['1.2.3-beta.1', '1.2.3-beta.1'],
      [canary, undefined],
    ] as const) {
      const f = await fixture(undefined, {}, version);
      const res = await request(f.app).post('/v1/chat').send({}).expect(400);
      const report = await f.report({ requestId: res.headers['x-request-id'] }).expect(200);
      expect(report.body.appVersion).toBe(expected);
      expect(JSON.stringify(report.body)).not.toContain(canary);
    }
  });

  it('joins actual chat/model/tool timing into a safe durable report and preserves scope', async () => {
    vi.stubEnv('AGENT_OPENAI_API_KEY', 'sk-local-provider-fixture');
    const logs = vi.spyOn(console, 'log').mockImplementation(() => {});
    const f = await fixture(async (state: HarnessStateType) => {
      await delay(15);
      if (!state.messages.some((message) => message.role === 'tool'))
        return {
          llmOutput: {
            kind: 'tool_calls',
            calls: [
              {
                id: 'untrusted-tool-call-label',
                name: 'sys_file_info',
                args: { path: '/workspace/no-such-diagnostic-file' },
              },
            ],
          },
          messages: [
            {
              role: 'assistant',
              content: '',
              toolCalls: [
                {
                  id: 'untrusted-tool-call-label',
                  name: 'sys_file_info',
                  args: { path: '/workspace/no-such-diagnostic-file' },
                },
              ],
            },
          ],
          trace: [
            { type: 'llm_call', step: 0, tokenUsage: { promptTokens: 7, completionTokens: 2 } },
          ],
        };
      return {
        llmOutput: { kind: 'text', content: canary },
        messages: [{ role: 'assistant', content: canary }],
        trace: [{ type: 'llm_call', step: 1 }],
      };
    });
    const response = await request(f.app)
      .post('/v1/chat')
      .set('x-bff-request-id', randomUUID())
      .send({ sessionId: f.sessionId, message: canary })
      .expect(200);
    const result = await f.report({ sessionId: f.sessionId }).expect(200);
    const report = DiagnosticReportSchema.parse(result.body);
    expect(
      report.events.some((row) => row.event.phase === 'model' && (row.event.durationMs ?? 0) >= 10),
    ).toBe(true);
    expect(
      report.events.some((row) => row.event.phase === 'tool' && row.event.outcome === 'failed'),
    ).toBe(true);
    expect(report.events.some((row) => row.event.toolExecutionId)).toBe(true);
    expect(report.events.some((row) => row.event.inputTokens === 7)).toBe(true);
    expect(
      report.events
        .filter((row) => row.event.runId)
        .every((row) => row.event.requestId === response.headers['x-request-id']),
    ).toBe(true);
    const encoded = JSON.stringify(report);
    for (const secret of [
      canary,
      'untrusted-tool-call-label',
      '/workspace/no-such-diagnostic-file',
      'sk-local-provider-fixture',
    ])
      expect(encoded).not.toContain(secret);
    const diagnosticLogs = logs.mock.calls
      .map((call) => String(call[0]))
      .filter((line) => line.includes('diagnostic.event'));
    expect(diagnosticLogs.length).toBeGreaterThan(0);
    expect(diagnosticLogs.join('\n')).not.toContain(canary);
    expect(logs.mock.calls.map((call) => String(call[0])).join('\n')).not.toContain(canary);
    const runId = report.events.find((row) => row.event.runId)!.event.runId;
    const other = await request(f.app)
      .post('/v1/sessions')
      .send({ agentId: DEFAULT_AGENT_ID })
      .expect(201);
    await f.report({ sessionId: other.body.data.id, runId }).expect(404);
    const reopened = await f.restart();
    const page = await reopened.query({ sessionId: f.sessionId });
    expect(page.events.map((row) => row.event.eventId)).toEqual(
      report.events.map((row) => row.event.eventId),
    );
  });

  it('keeps exhausted retry identity and failure safe when a provider node throws', async () => {
    vi.stubEnv('AGENT_OPENAI_API_KEY', 'sk-local-provider-fixture');
    vi.spyOn(console, 'log').mockImplementation(() => {});
    mockStreamText.mockReset();
    mockStreamText.mockImplementation(() => {
      throw Object.assign(new Error(canary), { status: 503 });
    });
    // The API suite intentionally shares a fork/module cache. Re-import this fixture's
    // application after resetting modules so a prior test cannot retain an unmocked SDK.
    vi.resetModules();
    const { createApp: createRetryApp } = await import('../src/infrastructure/http/createApp.js');
    const f = await fixture(undefined, { disableEvaluatorNodes: true }, undefined, createRetryApp);
    // This test qualifies retries, not the default agent's independent context-admission limit.
    // Keep its full tool inventory and admit it through the existing persisted configuration API.
    const agent = (await request(f.app).get(`/v1/agents/${DEFAULT_AGENT_ID}`).expect(200)).body
      .data;
    await request(f.app)
      .put(`/v1/agents/${DEFAULT_AGENT_ID}`)
      .send({
        ...agent,
        contextWindow: { ...agent.contextWindow, maxInputTokens: 100000 },
      })
      .expect(200);
    await request(f.app)
      .post('/v1/chat')
      .send({ sessionId: f.sessionId, message: canary })
      .expect(200);
    const res = await f.report({ sessionId: f.sessionId }).expect(200);
    const report = DiagnosticReportSchema.parse(res.body);
    const models = report.events.map((row) => row.event).filter((event) => event.phase === 'model');
    expect(
      report.events.find(({ event }) => event.phase === 'context')?.event.contextDecision,
    ).toMatchObject({ reason: 'unchanged' });
    expect(mockStreamText).toHaveBeenCalledTimes(3);
    expect(models.map((event) => event.outcome)).toEqual([
      'started',
      'retrying',
      'started',
      'retrying',
      'started',
      'failed',
    ]);
    expect(new Set(models.map((event) => event.operationId)).size).toBe(1);
    expect(models.map((event) => event.attempt)).toEqual([1, 1, 2, 2, 3, 3]);
    expect(
      report.events.some((row) => row.event.phase === 'request' && row.event.outcome === 'failed'),
    ).toBe(true);
    expect(JSON.stringify(report)).not.toContain(canary);
  }, 10000);

  it('reports approval waiting honestly and repeated resume never re-executes the tool', async () => {
    vi.stubEnv('AGENT_OPENAI_API_KEY', 'sk-local-provider-fixture');
    vi.stubEnv('AGENT_PLATFORM_COMMAND_RUNNER', 'host');
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const execute = vi.fn(async () => ({
      type: 'tool_result' as const,
      toolName: 'sys_bash',
      data: 'safe fixture result',
    }));
    const call = { id: 'provider-call', name: 'sys_bash', args: { command: 'date' } };
    const f = await fixture(
      async (state) =>
        state.messages.some((message) => message.role === 'tool')
          ? {
              llmOutput: { kind: 'text', content: 'Complete' },
              messages: [{ role: 'assistant', content: 'Complete' }],
            }
          : {
              llmOutput: { kind: 'tool_calls', calls: [call] },
              messages: [{ role: 'assistant', content: '', toolCalls: [call] }],
            },
      {
        systemToolExecutorFactory: () => async () => {
          await delay(40);
          return execute();
        },
      },
    );
    const initial = await request(f.app)
      .post('/v1/chat')
      .send({ sessionId: f.sessionId, message: 'date' })
      .expect(200);
    const approval = initial.text
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line))
      .find((event) => event.type === 'approval_required');
    expect(approval).toBeDefined();
    expect(execute).not.toHaveBeenCalled();
    const waiting = DiagnosticReportSchema.parse(
      (await f.report({ sessionId: f.sessionId }).expect(200)).body,
    );
    expect(
      waiting.events.filter(
        (row) => row.event.phase === 'approval' && row.event.outcome === 'waiting',
      ),
    ).toHaveLength(1);
    expect(
      waiting.events
        .filter((row) => row.event.outcome === 'waiting')
        .every((row) => row.event.errorCode === undefined),
    ).toBe(true);
    expect(
      waiting.events
        .filter((row) => row.event.toolExecutionId)
        .every((row) => row.event.toolId === 'command'),
    ).toBe(true);
    expect(
      waiting.events.filter((row) => row.event.phase === 'request').at(-1)?.event.outcome,
    ).toBe('waiting');
    expect(
      waiting.events.some((row) => row.event.approvalRequestId === approval.approvalRequestId),
    ).toBe(true);
    await request(f.app)
      .post(`/v1/approval-requests/${approval.approvalRequestId}/approve`)
      .send({})
      .expect(200);
    const [resume, duplicate] = await Promise.all([
      request(f.app)
        .post(`/v1/sessions/${f.sessionId}/resume`)
        .send({ approvalRequestId: approval.approvalRequestId }),
      request(f.app)
        .post(`/v1/sessions/${f.sessionId}/resume`)
        .send({ approvalRequestId: approval.approvalRequestId }),
    ]);
    expect(resume!.status).toBe(200);
    expect([200, 409]).toContain(duplicate!.status);
    expect(execute).toHaveBeenCalledTimes(1);
    expect(
      new Set([initial, resume, duplicate].map((res) => res.headers['x-request-id'])).size,
    ).toBe(3);
    const report = DiagnosticReportSchema.parse(
      (await f.report({ sessionId: f.sessionId }).expect(200)).body,
    );
    expect(
      new Set(report.events.filter((row) => row.event.runId).map((row) => row.event.runId)).size,
    ).toBe(2);
    const repeated = DiagnosticReportSchema.parse(
      (await f.report({ requestId: duplicate.headers['x-request-id'] }).expect(200)).body,
    );
    expect(repeated.events.every((row) => !row.event.runId)).toBe(true);
    const originalRun = waiting.events.find((row) => row.event.phase === 'request')!.event.runId;
    expect(
      report.events.some(
        (row) =>
          row.event.approvalRequestId === approval.approvalRequestId &&
          row.event.linkedRunId === originalRun,
      ),
    ).toBe(true);
  });

  it('keeps the report capability out of an actual approved host-tool child', async () => {
    vi.stubEnv('HOST', '127.0.0.1');
    vi.stubEnv('PORT', '3456');
    vi.stubEnv('DIAGNOSTICS_HOST', host);
    vi.stubEnv('DIAGNOSTICS_LOCAL_CAPABILITY', capability);
    vi.stubEnv('AGENT_OPENAI_API_KEY', 'sk-local-provider-fixture');
    vi.stubEnv('AGENT_PLATFORM_COMMAND_RUNNER', 'host');
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const privateAccess = consumeDiagnosticAccess(process.env);
    expect(privateAccess).toEqual({ capability, host });
    const call = {
      id: 'env-check',
      name: 'sys_bash',
      args: {
        command: `"${process.execPath}" -e "process.stdout.write(process.env.DIAGNOSTICS_LOCAL_CAPABILITY?'capability-present':'capability-absent')"`,
      },
    };
    const f = await fixture(async (state) =>
      state.messages.some((message) => message.role === 'tool')
        ? {
            llmOutput: { kind: 'text', content: 'done' },
            messages: [{ role: 'assistant', content: 'done' }],
          }
        : {
            llmOutput: { kind: 'tool_calls', calls: [call] },
            messages: [{ role: 'assistant', content: '', toolCalls: [call] }],
          },
    );
    const initial = await request(f.app)
      .post('/v1/chat')
      .send({ sessionId: f.sessionId, message: 'inspect capability inheritance' })
      .expect(200);
    const approval = initial.text
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line))
      .find((event) => event.type === 'approval_required');
    expect(approval).toBeDefined();
    await request(f.app)
      .post(`/v1/approval-requests/${approval.approvalRequestId}/approve`)
      .send({})
      .expect(200);
    const resumed = await request(f.app)
      .post(`/v1/sessions/${f.sessionId}/resume`)
      .send({ approvalRequestId: approval.approvalRequestId })
      .expect(200);
    const outputs = resumed.text
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line))
      .filter((event) => event.type === 'tool_result');
    expect(outputs.length).toBeGreaterThan(0);
    expect(JSON.stringify(outputs)).toContain('capability-absent');
    expect(JSON.stringify(outputs)).not.toContain('capability-present');
    const report = await f.report({ sessionId: f.sessionId }).expect(200);
    expect(JSON.stringify(report.body)).not.toContain(capability);
  });

  it('executes one real approved filesystem effect, then denies and rejects repeat execution', async () => {
    vi.stubEnv('AGENT_OPENAI_API_KEY', 'sk-local-provider-fixture');
    vi.stubEnv('AGENT_PLATFORM_COMMAND_RUNNER', 'host');
    vi.spyOn(console, 'log').mockImplementation(() => {});
    let command = '';
    const f = await fixture(async (state) => {
      if (state.messages.some((message) => message.role === 'tool'))
        return {
          llmOutput: { kind: 'text', content: 'done' },
          messages: [{ role: 'assistant', content: 'done' }],
        };
      const call = { id: 'effect-call', name: 'sys_bash', args: { command } };
      return {
        llmOutput: { kind: 'tool_calls', calls: [call] },
        messages: [{ role: 'assistant', content: '', toolCalls: [call] }],
      };
    });
    const target = join(f.dir, 'effect.txt');
    command = `"${process.execPath}" -e "require('node:fs').appendFileSync('${target}', '1')"`;
    async function pending(sessionId: string) {
      const response = await request(f.app)
        .post('/v1/chat')
        .send({ sessionId, message: 'perform local fixture effect' })
        .expect(200);
      return response.text
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line))
        .find((event) => event.type === 'approval_required').approvalRequestId as string;
    }
    const approved = await pending(f.sessionId);
    await request(f.app).post(`/v1/approval-requests/${approved}/approve`).send({}).expect(200);
    await request(f.app)
      .post(`/v1/sessions/${f.sessionId}/resume`)
      .send({ approvalRequestId: approved })
      .expect(200);
    await request(f.app)
      .post(`/v1/sessions/${f.sessionId}/resume`)
      .send({ approvalRequestId: approved })
      .expect(200);
    expect(readFileSync(target, 'utf8')).toBe('1');
    const second = await request(f.app)
      .post('/v1/sessions')
      .send({ agentId: DEFAULT_AGENT_ID })
      .expect(201);
    const rejected = await pending(second.body.data.id);
    await request(f.app).post(`/v1/approval-requests/${rejected}/reject`).send({}).expect(200);
    await request(f.app)
      .post(`/v1/sessions/${second.body.data.id}/resume`)
      .send({ approvalRequestId: rejected })
      .expect(200);
    expect(readFileSync(target, 'utf8')).toBe('1');
    const report = DiagnosticReportSchema.parse(
      (await f.report({ sessionId: second.body.data.id }).expect(200)).body,
    );
    expect(
      report.events.some(
        (row) =>
          row.event.approvalRequestId === rejected &&
          row.event.outcome === 'failed' &&
          row.event.errorCode === 'permission_denied',
      ),
    ).toBe(true);
    expect(JSON.stringify(report)).not.toContain(target);
  });

  it('records an actual client disconnect during a tool without inventing completion or replay', async () => {
    vi.stubEnv('AGENT_OPENAI_API_KEY', 'sk-local-provider-fixture');
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const entered = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    const execute = vi.fn(async () => {
      entered.resolve();
      await release.promise;
      return { type: 'tool_result' as const, toolName: 'sys_file_info', data: {} };
    });
    const f = await fixture(
      async (state) => {
        if (state.messages.some((message) => message.role === 'tool'))
          return {
            llmOutput: { kind: 'text', content: 'done' },
            messages: [{ role: 'assistant', content: 'done' }],
          };
        const call = {
          id: 'disconnect-tool',
          name: 'sys_file_info',
          args: { path: '/workspace/fixture' },
        };
        return {
          llmOutput: { kind: 'tool_calls', calls: [call] },
          messages: [{ role: 'assistant', content: '', toolCalls: [call] }],
        };
      },
      { systemToolExecutorFactory: () => execute },
    );
    const server = f.app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('expected TCP socket');
    const client = httpRequest(
      {
        host: '127.0.0.1',
        port: address.port,
        path: '/v1/chat',
        method: 'POST',
        headers: { 'content-type': 'application/json' },
      },
      (stream) => stream.destroy(),
    );
    client.on('error', () => {});
    try {
      client.end(JSON.stringify({ sessionId: f.sessionId, message: 'test interruption' }));
      await entered.promise;
      client.destroy();
      let report;
      for (let attempt = 0; attempt < 50; attempt++) {
        report = DiagnosticReportSchema.parse(
          (await f.report({ sessionId: f.sessionId }).expect(200)).body,
        );
        if (report.events.some((row) => row.event.outcome === 'disconnected')) break;
        await delay(10);
      }
      expect(
        report!.events.some(
          (row) => row.event.phase === 'connection' && row.event.outcome === 'disconnected',
        ),
      ).toBe(true);
      expect(
        report!.events.some(
          (row) =>
            ['tool', 'request'].includes(row.event.phase) && row.event.outcome === 'succeeded',
        ),
      ).toBe(false);
      expect(execute).toHaveBeenCalledTimes(1);
      release.resolve();
      await delay(100);
      const after = DiagnosticReportSchema.parse(
        (await f.report({ sessionId: f.sessionId }).expect(200)).body,
      );
      expect(
        after.events.some(
          (row) => row.event.phase === 'ingress' && row.event.outcome === 'succeeded',
        ),
      ).toBe(false);
      expect(execute).toHaveBeenCalledTimes(1);
    } finally {
      release.resolve();
      client.destroy();
      server.closeAllConnections();
      await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
    }
  });

  it('does not label a halted graph as completed success', async () => {
    vi.stubEnv('AGENT_OPENAI_API_KEY', 'sk-local-provider-fixture');
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const f = await fixture(async () => ({
      halted: true,
      llmOutput: null,
      trace: [{ type: 'limit_hit', kind: 'max_tokens' }],
    }));
    await request(f.app)
      .post('/v1/chat')
      .send({ sessionId: f.sessionId, message: 'hello' })
      .expect(200);
    const report = DiagnosticReportSchema.parse(
      (await f.report({ sessionId: f.sessionId }).expect(200)).body,
    );
    expect(report.events.filter((row) => row.event.phase === 'request').at(-1)?.event.outcome).toBe(
      'failed',
    );
    expect(
      report.events.filter((row) => row.event.phase === 'ingress').at(-1)?.event.operationId,
    ).toBeUndefined();
  });

  it('does not let a throwing optional collector block chat execution', async () => {
    vi.stubEnv('AGENT_OPENAI_API_KEY', 'sk-local-provider-fixture');
    const f = await fixture(async () => ({
      llmOutput: { kind: 'text', content: 'Still works' },
      messages: [{ role: 'assistant', content: 'Still works' }],
    }));
    vi.spyOn(f.store, 'record').mockImplementation(() => {
      throw new Error('store unavailable');
    });
    const res = await request(f.app)
      .post('/v1/chat')
      .send({ sessionId: f.sessionId, message: 'hello' })
      .expect(200);
    expect(res.text).toContain('Still works');
  });
});
