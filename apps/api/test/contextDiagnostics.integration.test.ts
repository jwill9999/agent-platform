import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { once } from 'node:events';
import express from 'express';
import request from 'supertest';
import { afterEach, expect, it, vi } from 'vitest';
import { createDiagnosticStore } from '@agent-platform/db';
import {
  buildDiagnosticReport,
  projectDiagnosticReport,
  type ContextDecisionMetadata,
  type DiagnosticStore,
} from '@agent-platform/contracts';
import type { HarnessStateType } from '@agent-platform/harness';
import { correlationMiddleware } from '../src/infrastructure/http/correlationMiddleware.js';
import {
  beginDiagnosticRun,
  diagnosticIngress,
  diagnosticRetry,
  observeDiagnosticContextDecision,
  observeDiagnosticModelAttempt,
  observeDiagnosticNode,
} from '../src/infrastructure/diagnostics/observations.js';

const decision: ContextDecisionMetadata = {
  estimatorVersion: 'serialized_request_chars_v1',
  effectivePolicy: 'group_window_working_memory_v1',
  requestedStrategy: 'truncate',
  configuredInputTokens: 8000,
  effectiveInputTokens: 7200,
  estimatedInputBefore: 10000,
  estimatedInputAfter: 7000,
  schemaEstimate: 200,
  includedGroups: 2,
  omittedGroups: 1,
  outputCap: 2048,
  reason: 'windowed',
};
const state = { modelConfig: { provider: 'openai' } } as HarnessStateType;
const canary = 'PROMPT-MEMORY-ARGS-RESULT-sk-private-/Users/private-SECRET';
afterEach(() => vi.restoreAllMocks());

async function exercise(
  options: {
    reject?: boolean;
    disabled?: boolean;
    degraded?: boolean;
    dropped?: boolean;
    invalidMetadata?: boolean;
    incomplete?: boolean;
    retry?: boolean;
  } = {},
) {
  const dir = mkdtempSync(join(tmpdir(), 'context-diagnostics-'));
  const store = createDiagnosticStore({ path: join(dir, 'history.sqlite') });
  await store.ready;
  const logs = vi.spyOn(console, 'log').mockImplementation(() => {});
  let providerCalls = 0;
  const observed: DiagnosticStore = {
    ...store,
    record: options.degraded
      ? () => {
          throw new Error(canary);
        }
      : options.dropped
        ? () => false
        : store.record,
    health: options.dropped
      ? () => ({ ...store.health(), state: 'degraded', reason: 'queue_full', dropped: 1 })
      : store.health,
  };
  const app = express();
  app.use(correlationMiddleware);
  if (!options.disabled)
    app.use(diagnosticIngress(observed, { host: '127.0.0.1:3456', capability: 'a'.repeat(64) }));
  app.post('/v1/chat', async (_req, res) => {
    const complete = beginDiagnosticRun(randomUUID(), randomUUID());
    const node = observeDiagnosticNode(
      'model',
      async () => {
        observeDiagnosticContextDecision({
          ...decision,
          ...(options.reject ? { reason: 'required_overflow' } : {}),
          ...(options.invalidMetadata ? { prompt: canary } : {}),
        });
        if (options.reject)
          return {
            halted: true,
            contextHalt: { code: 'CONTEXT_BUDGET_EXCEEDED' },
          } as Partial<HarnessStateType>;
        observeDiagnosticModelAttempt();
        providerCalls++;
        if (options.retry) {
          diagnosticRetry(1, 'model');
          observeDiagnosticModelAttempt();
          providerCalls++;
        }
        if (options.incomplete)
          return {
            halted: true,
            contextHalt: { code: 'MODEL_OUTPUT_INCOMPLETE' },
          } as Partial<HarnessStateType>;
        return {
          trace: [
            { type: 'llm_call', step: 0, tokenUsage: { promptTokens: 123, completionTokens: 4 } },
          ],
          llmOutput: { kind: 'text', content: canary },
        } as Partial<HarnessStateType>;
      },
      { deferModelStart: true },
    );
    const result = await node(state);
    complete();
    res.json({ halted: result.halted ?? false });
  });
  const server = createServer(app);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const response = await request(server).post('/v1/chat').expect(200);
    await store.flush();
    const page = await store.query({ requestId: response.headers['x-request-id'] });
    if (options.dropped) page.health = observed.health();
    const report = projectDiagnosticReport(buildDiagnosticReport(page));
    return {
      providerCalls,
      response: response.body,
      report,
      logs: JSON.stringify(logs.mock.calls),
    };
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await store.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

it('round-trips strict context metadata through actual SQLite and report projection without contents', async () => {
  const result = await exercise();
  const events = result.report.events.map((row) => row.event);
  expect(events.find((event) => event.phase === 'context')?.contextDecision).toEqual(decision);
  expect(events.filter((event) => event.phase === 'model').map((event) => event.outcome)).toEqual([
    'started',
    'succeeded',
  ]);
  expect(events.find((event) => event.phase === 'context')?.operationId).toEqual(
    events.find((event) => event.phase === 'model')?.operationId,
  );
  expect(result.report.summary).toContain('estimated input 10000 -> 7000');
  expect(result.report.summary).toContain('provider-reported input/output 123/4');
  expect(JSON.stringify(result.report) + result.logs).not.toContain(canary);
});

it('records admission rejection and failed request without inventing any provider attempt', async () => {
  const result = await exercise({ reject: true });
  expect(result.providerCalls).toBe(0);
  expect(result.response.halted).toBe(true);
  const events = result.report.events.map((row) => row.event);
  expect(events.filter((event) => event.phase === 'model')).toEqual([]);
  expect(events.find((event) => event.phase === 'context')).toMatchObject({
    outcome: 'failed',
    errorCode: 'context_budget_exceeded',
  });
  expect(events.filter((event) => event.phase === 'request').at(-1)).toMatchObject({
    outcome: 'failed',
    errorCode: 'context_budget_exceeded',
  });
});

it('records actual retry attempts after admission and incomplete output without claiming success', async () => {
  const result = await exercise({ retry: true, incomplete: true });
  const models = result.report.events
    .map((row) => row.event)
    .filter((event) => event.phase === 'model');
  expect(result.providerCalls).toBe(2);
  expect(models.map((event) => [event.outcome, event.attempt])).toEqual([
    ['started', 1],
    ['retrying', 1],
    ['started', 2],
    ['failed', 2],
  ]);
  expect(models.at(-1)?.errorCode).toBe('model_output_incomplete');
  expect(
    result.report.events
      .map((row) => row.event)
      .filter((event) => event.phase === 'request')
      .at(-1)?.outcome,
  ).toBe('failed');
});

it.each(['disabled', 'degraded', 'dropped'] as const)(
  'keeps admission unchanged when diagnostics are %s',
  async (mode) => {
    for (const reject of [false, true]) {
      const result = await exercise({ [mode]: true, reject });
      expect(result.providerCalls).toBe(reject ? 0 : 1);
      expect(result.response.halted).toBe(reject);
      expect(result.report.events).toEqual([]);
      if (mode === 'dropped') {
        expect(result.report.coverage).toMatchObject({
          state: 'degraded',
          reason: 'queue_full',
          dropped: 1,
        });
        expect(result.report.summary).toContain('1 dropped');
      }
    }
  },
);

it('rejects arbitrary context content before either sink without altering the observed operation', async () => {
  const result = await exercise({ invalidMetadata: true });
  expect(result.providerCalls).toBe(1);
  expect(result.report.events.some((row) => row.event.phase === 'context')).toBe(false);
  expect(JSON.stringify(result.report) + result.logs).not.toContain(canary);
});
