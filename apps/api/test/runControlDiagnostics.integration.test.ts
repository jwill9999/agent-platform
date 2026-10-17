import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DiagnosticReportSchema,
  RunControlRecordSchema,
  type DiagnosticReport,
  type DiagnosticStore,
} from '@agent-platform/contracts';
import {
  closeDatabase,
  createDiagnosticStore,
  DEFAULT_AGENT_ID,
  openDatabase,
  runSeed,
} from '@agent-platform/db';
import type { RunExecutionControl } from '@agent-platform/harness';
import { createApp } from '../src/infrastructure/http/createApp.js';
import type { ChatRouterOptions } from '../src/infrastructure/http/v1/chatRouter.js';
import { listenLoopback, closeLoopback } from './support/loopbackServer.js';
import type { ControlledExecution } from '../src/application/runControl/service.js';

const capability = 'a'.repeat(64);
const host = '127.0.0.1:3456';
const canary = 'sk-PRIVATE-CANARY /Users/private/diagnostic-secret prompt text';
const cleanups: Array<() => Promise<void>> = [];
function barrier<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((accept) => {
    resolve = accept;
  });
  return { promise, resolve };
}

beforeEach(() => {
  vi.stubEnv('LANGCHAIN_TRACING_V2', 'false');
  vi.stubEnv('LANGSMITH_TRACING', 'false');
  vi.stubEnv('LANGSMITH_TRACING_V2', 'false');
  vi.stubEnv('AGENT_OPENAI_API_KEY', 'fixture-never-sent');
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
  if (errors.length) throw new AggregateError(errors, 'Run diagnostics fixture cleanup failed');
});

async function fixture(
  node: ChatRouterOptions['llmReasonNode'],
  extra: Partial<ChatRouterOptions> = {},
) {
  const directory = mkdtempSync(join(tmpdir(), 'run-diagnostics-'));
  const { db, sqlite } = openDatabase(join(directory, 'app.sqlite'));
  runSeed(db);
  const store: DiagnosticStore = createDiagnosticStore({
    path: join(directory, 'diagnostics.sqlite'),
  });
  await store.ready;
  const app = await listenLoopback(
    createApp({
      db,
      diagnostics: { store, access: { host, capability } },
      v1: {
        chat: {
          disableEvaluatorNodes: true,
          emitFinalAssistantMessage: true,
          llmReasonNode: node,
          ...extra,
        },
      },
    }),
  );
  cleanups.push(async () => {
    try {
      await closeLoopback(app);
    } finally {
      await store.close();
      closeDatabase(sqlite);
      rmSync(directory, { recursive: true, force: true });
    }
  });
  const created = await request(app)
    .post('/v1/sessions')
    .send({ agentId: DEFAULT_AGENT_ID })
    .expect(201);
  const sessionId = created.body.data.id as string;
  return {
    app,
    store,
    sessionId,
    chat() {
      return request(app).post('/v1/chat').send({ sessionId, message: canary });
    },
    async current() {
      return RunControlRecordSchema.parse(
        (await request(app).get(`/v1/sessions/${sessionId}/active-run`).expect(200)).body.data,
      );
    },
    async stop(runId: string) {
      return RunControlRecordSchema.parse(
        (
          await request(app)
            .post(`/v1/sessions/${sessionId}/runs/${runId}/stop`)
            .send({})
            .expect(200)
        ).body.data,
      );
    },
    async report() {
      await store.flush();
      const response = await request(app)
        .post('/v1/diagnostics/report')
        .set('Host', host)
        .set('x-diagnostics-capability', capability)
        .send({ scope: { sessionId } })
        .expect(200);
      const report = DiagnosticReportSchema.parse(response.body);
      expect(report.source).toBe('local-store');
      expect(report.coverage).toMatchObject({
        durable: true,
        verified: true,
        state: 'ready',
        dropped: 0,
        conflicts: 0,
        pending: 0,
        truncated: false,
      });
      expect(JSON.stringify(report)).not.toContain(canary);
      expect(JSON.stringify(report)).not.toContain('fixture-never-sent');
      return report;
    },
  };
}
function events(report: DiagnosticReport, phase: string) {
  return report.events.filter((row) => row.event.phase === phase).map((row) => row.event);
}

describe('safe durable Stop diagnostic exports', () => {
  it('distinguishes logical run identity from execution identity in a completed real chat report', async () => {
    const f = await fixture(async () => ({
      llmOutput: { kind: 'text', content: canary },
      messages: [{ role: 'assistant', content: canary }],
      trace: [{ type: 'llm_call', step: 0 }],
    }));
    const response = await f.chat().expect(200);
    const current = await f.current();
    const report = await f.report();
    expect(current.state).toBe('completed');
    expect(response.headers['x-harness-run-id']).toBe(current.id);
    const controls = events(report, 'control');
    expect(controls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          outcome: 'succeeded',
          control: expect.objectContaining({
            logicalRunId: current.id,
            state: 'completed',
            reason: 'none',
          }),
        }),
      ]),
    );
    const executionIds = new Set(controls.map((event) => event.runId).filter(Boolean));
    expect(executionIds.size).toBe(1);
    expect(executionIds.has(current.id)).toBe(false);
    expect(events(report, 'request').at(-1)?.outcome).toBe('succeeded');
    expect(
      report.events.every(
        (row) => !row.event.control || row.event.control.logicalRunId === current.id,
      ),
    ).toBe(true);
  });

  it('exports approval waiting then a real scoped Stop acknowledgement without executing the effect', async () => {
    const execute = vi.fn();
    const call = { id: randomUUID(), name: 'sys_bash', args: { command: 'date' } };
    const f = await fixture(
      async () => ({
        llmOutput: { kind: 'tool_calls', calls: [call] },
        messages: [{ role: 'assistant', content: '', toolCalls: [call] }],
      }),
      { systemToolExecutorFactory: () => execute },
    );
    await f.chat().expect(200);
    const current = await f.current();
    expect(current.state).toBe('waiting_for_approval');
    const waiting = await f.report();
    expect(events(waiting, 'request').at(-1)?.outcome).toBe('waiting');
    expect(events(waiting, 'control')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          outcome: 'waiting',
          control: expect.objectContaining({
            logicalRunId: current.id,
            state: 'waiting_for_approval',
            reason: 'none',
          }),
        }),
      ]),
    );
    const stopped = await f.stop(current.id);
    expect(stopped.state).toBe('cancelled');
    const report = await f.report();
    const acknowledged = events(report, 'control').find(
      (event) => event.control?.stage === 'acknowledged',
    );
    expect(acknowledged).toMatchObject({
      control: { logicalRunId: current.id, reason: 'user_stop' },
      durationMs: expect.any(Number),
    });
    expect(acknowledged?.durationMs).toBeLessThan(2000);
    expect(events(report, 'control').at(-1)).toMatchObject({
      outcome: 'cancelled',
      control: { logicalRunId: current.id, state: 'cancelled', reason: 'user_stop' },
    });
    expect(execute).not.toHaveBeenCalled();
  });

  it('retains true unknown tool settlement after Stop rather than exporting completed success', async () => {
    const entered = barrier<void>();
    const release = barrier<{ type: 'error'; code: string; message: string }>();
    let tracked: Promise<unknown> | undefined;
    let effects = 0;
    const f = await fixture(async (_state, config) => {
      const control = config?.configurable?.runControl as RunExecutionControl;
      tracked = control.invoke('tool', async () => {
        entered.resolve();
        const result = await release.promise;
        effects++;
        return result;
      });
      await tracked;
      return {
        halted: true,
        llmOutput: null,
        trace: [{ type: 'stream_aborted', reason: 'user_stop' }],
      };
    });
    const pending = f.chat().then((response) => response);
    try {
      await Promise.race([
        entered.promise,
        pending.then((response) => {
          throw new Error(`Fixture ended before admission: ${response.status}`);
        }),
      ]);
      const run = await f.current();
      await f.stop(run.id);
      await pending;
      expect((await f.current()).state).toBe('outcome_unknown');
      expect(effects).toBe(0);
      release.resolve({ type: 'error', code: 'COMMAND_OUTCOME_UNKNOWN', message: canary });
      await tracked;
      const current = await f.current();
      // Promise settlement is not proof that the admitted remote effect terminated.
      expect(current).toMatchObject({ state: 'outcome_unknown', reason: 'user_stop', inFlight: 1 });
      const report = await f.report();
      expect(events(report, 'control')).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            outcome: 'unknown',
            control: expect.objectContaining({
              logicalRunId: run.id,
              state: 'outcome_unknown',
              reason: 'user_stop',
            }),
          }),
        ]),
      );
      expect(
        events(report, 'request').filter((event) => event.outcome === 'succeeded'),
      ).toHaveLength(0);
      expect(events(report, 'model').filter((event) => event.outcome === 'succeeded')).toHaveLength(
        0,
      );
      expect(effects).toBe(1);
    } finally {
      release.resolve({ type: 'error', code: 'COMMAND_OUTCOME_UNKNOWN', message: canary });
      await tracked;
      await pending;
    }
  });

  it.each(['client_disconnect', 'timeout'] as const)(
    'keeps %s distinct from user Stop in control and request metadata',
    async (reason) => {
      const f = await fixture(async (_state, config) => {
        const execution = config?.configurable?.runControl as ControlledExecution;
        execution.controller.abort(reason);
        return { halted: true, llmOutput: null, trace: [{ type: 'stream_aborted', reason }] };
      });
      await f.chat().expect(200);
      const current = await f.current();
      const report = await f.report();
      expect(current.reason).toBe(reason);
      expect(current.state).toBe('interrupted');
      const expectedCode = reason === 'timeout' ? 'timeout' : 'connection_lost';
      expect(events(report, 'request').at(-1)).toMatchObject({ errorCode: expectedCode });
      expect(events(report, 'request').some((event) => event.outcome === 'succeeded')).toBe(false);
      expect(events(report, 'control')).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            control: expect.objectContaining({
              logicalRunId: current.id,
              reason,
              state: 'interrupted',
            }),
          }),
        ]),
      );
      expect(events(report, 'control').some((event) => event.control?.reason === 'user_stop')).toBe(
        false,
      );
    },
  );

  it('preserves genuine provider failure instead of reporting Stop or successful completion', async () => {
    const f = await fixture(async () => {
      throw new Error(canary);
    });
    await f.chat().expect(200);
    const current = await f.current();
    const report = await f.report();
    expect(current).toMatchObject({ state: 'failed', reason: 'execution_failed' });
    expect(events(report, 'request').at(-1)?.outcome).toBe('failed');
    expect(events(report, 'model').filter((event) => event.outcome === 'succeeded')).toHaveLength(
      0,
    );
    expect(events(report, 'control')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          outcome: 'failed',
          control: expect.objectContaining({ state: 'failed', reason: 'execution_failed' }),
        }),
      ]),
    );
  });
});
