import { randomUUID } from 'node:crypto';
import { appendFileSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Server } from 'node:http';
import {
  createApprovalRequest,
  createSession,
  DEFAULT_AGENT_ID,
  getApprovalRequest,
  openDatabase,
  runSeed,
} from '@agent-platform/db';
import type { RunExecutionControl } from '@agent-platform/harness';
import { RunControlRecordSchema } from '@agent-platform/contracts';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/infrastructure/http/createApp.js';
import { getRunControlService } from '../src/application/runControl/service.js';
import { listenLoopback, closeLoopback } from './support/loopbackServer.js';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((accept) => {
    resolve = accept;
  });
  return { promise, resolve };
}
let directory: string;
let context: ReturnType<typeof openDatabase>;
let app: Server;
function session() {
  return createSession(context.db, { agentId: DEFAULT_AGENT_ID });
}
function current(sessionId: string) {
  return `/v1/sessions/${sessionId}/active-run`;
}
function target(sessionId: string, runId: string) {
  return `/v1/sessions/${sessionId}/runs/${runId}`;
}
describe('headless shared run control HTTP API', () => {
  beforeEach(async () => {
    directory = mkdtempSync(path.join(os.tmpdir(), 'run-control-api-'));
    context = openDatabase(path.join(directory, 'db.sqlite'));
    runSeed(context.db);
    // Real application, persisted registry, HTTP router and control repository; no renderer or diagnostics required.
    app = await listenLoopback(createApp({ db: context.db }));
  });
  afterEach(async () => {
    try {
      await closeLoopback(app);
    } finally {
      context.sqlite.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });
  it('discovers scoped durable identity without a renderer and returns no cached status', async () => {
    const selected = session();
    const empty = await request(app).get(current(selected.id)).expect(200);
    expect(empty.body.data).toBeNull();
    expect(empty.headers['cache-control']).toBe('no-store');
    const service = getRunControlService(context.db);
    const execution = service.open(selected, randomUUID());
    const discovered = await request(app).get(current(selected.id)).expect(200);
    const parsed = RunControlRecordSchema.parse(discovered.body.data);
    expect(parsed).toMatchObject({
      id: execution.runId,
      sessionId: selected.id,
      state: 'running',
      inFlight: 0,
    });
    const read = await request(app).get(target(selected.id, parsed.id)).expect(200);
    expect(read.body.data).toEqual(discovered.body.data);
  });
  it('acknowledges Stop independently of an already-admitted blocked model and confirms actual settlement', async () => {
    const selected = session();
    const service = getRunControlService(context.db);
    const execution = service.open(selected, randomUUID());
    const gate = deferred<string>();
    const effects: string[] = [];
    const original = execution.invoke('model', async () => {
      effects.push('model-started');
      const result = await gate.promise;
      effects.push('model-finished');
      return result;
    });
    try {
      const started = performance.now();
      const ack = await request(app)
        .post(`${target(selected.id, execution.runId)}/stop`)
        .send({})
        .expect(200);
      expect(performance.now() - started).toBeLessThan(2000);
      expect(ack.body.data).toMatchObject({
        id: execution.runId,
        sessionId: selected.id,
        state: 'stop_requested',
        reason: 'user_stop',
        inFlight: 1,
      });
      expect(ack.body.data.stopAcknowledgedAtMs).toBeTypeOf('number');
      expect(effects).toEqual(['model-started']);
      expect(() => execution.invoke('tool', async () => effects.push('forbidden'))).toThrow();
      execution.finish('completed', 'user_stop');
      const uncertain = await request(app).get(target(selected.id, execution.runId)).expect(200);
      expect(uncertain.body.data.state).toBe('outcome_unknown');
    } finally {
      gate.resolve('late-result');
      await original;
    }
    const settled = await request(app).get(target(selected.id, execution.runId)).expect(200);
    expect(settled.body.data).toMatchObject({
      state: 'cancelled',
      inFlight: 0,
      reason: 'user_stop',
    });
    expect(effects).toEqual(['model-started', 'model-finished']);
  });
  it('stops a real headless chat stream through the shared service without waiting for a blocked model', async () => {
    await closeLoopback(app);
    const entered = deferred<void>();
    const release = deferred<string>();
    let tracked: Promise<string> | undefined;
    let actualModelCalls = 0;
    app = await listenLoopback(
      createApp({
        db: context.db,
        v1: {
          chat: {
            disableEvaluatorNodes: true,
            llmReasonNode: async (_state, config) => {
              const control = config?.configurable?.runControl as RunExecutionControl | undefined;
              if (!control) throw new Error('Chat graph lost mandatory shared run authority');
              tracked = control.invoke('model', () => {
                actualModelCalls++;
                entered.resolve();
                return release.promise;
              });
              const text = await tracked;
              return {
                llmOutput: { kind: 'text' as const, content: text },
                messages: [{ role: 'assistant' as const, content: text }],
              };
            },
          },
        },
      }),
    );
    const selected = session();
    const pending = request(app)
      .post('/v1/chat')
      .set('x-openai-key', 'fixture-no-provider-request')
      .send({ sessionId: selected.id, message: 'Run the controlled fixture' })
      .then((result) => result);
    try {
      await Promise.race([
        entered.promise,
        pending.then((response) => {
          throw new Error(
            `Chat finished before fixture admission: ${response.status} ${response.text}`,
          );
        }),
      ]);
      const currentRun = await request(app).get(current(selected.id)).expect(200);
      const runId = RunControlRecordSchema.parse(currentRun.body.data).id;
      const acknowledged = await request(app)
        .post(`${target(selected.id, runId)}/stop`)
        .send({})
        .expect(200);
      expect(acknowledged.body.data).toMatchObject({ id: runId, reason: 'user_stop', inFlight: 1 });
      const response = await pending;
      expect(response.headers['x-harness-run-id']).toBe(runId);
      expect(response.status).toBe(200);
      const events = response.text
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line));
      expect(events).toEqual(
        expect.arrayContaining([expect.objectContaining({ type: 'error', code: 'USER_STOP' })]),
      );
      const uncertain = await request(app).get(target(selected.id, runId)).expect(200);
      expect(uncertain.body.data.state).toBe('outcome_unknown');
      expect(actualModelCalls).toBe(1);
      expect(response.text).not.toContain('late provider reply');
    } finally {
      release.resolve('late provider reply');
      await tracked;
      await pending;
    }
    const settled = await request(app).get(current(selected.id)).expect(200);
    expect(settled.body.data).toMatchObject({ state: 'cancelled', inFlight: 0 });
  });
  it('publishes identity and acknowledges Stop while normal execution is waiting on its session mutex', async () => {
    await closeLoopback(app);
    const entered = deferred<void>();
    const releaseMutex = deferred<() => void>();
    const setupSettled = deferred<void>();
    let actualModelCalls = 0;
    let releases = 0;
    app = await listenLoopback(
      createApp({
        db: context.db,
        v1: {
          chat: {
            disableEvaluatorNodes: true,
            sessionLock: {
              activeCount: 1,
              acquire: async () => {
                entered.resolve();
                const release = await releaseMutex.promise;
                // Signal a microtask after the real acquisition continuation has checked cancellation.
                queueMicrotask(() => setupSettled.resolve());
                return release;
              },
            },
            llmReasonNode: async () => {
              actualModelCalls++;
              throw new Error('Provider must never be reached');
            },
          },
        },
      }),
    );
    const selected = session();
    const service = getRunControlService(context.db);
    const originalObserve = service.observe.bind(service);
    const observer = vi.spyOn(service, 'observe').mockImplementation((observation) => {
      originalObserve(observation);
      if (observation.stage === 'settled' && observation.kind === 'setup') setupSettled.resolve();
    });
    const pending = request(app)
      .post('/v1/chat')
      .set('x-openai-key', 'fixture-no-provider-request')
      .send({ sessionId: selected.id, message: 'Wait for controlled setup' })
      .then((result) => result);
    try {
      await Promise.race([
        entered.promise,
        pending.then((response) => {
          throw new Error(`Setup ended before lock barrier: ${response.status} ${response.text}`);
        }),
      ]);
      const discovered = await request(app).get(current(selected.id)).expect(200);
      const runId = RunControlRecordSchema.parse(discovered.body.data).id;
      const started = performance.now();
      const stopped = await request(app)
        .post(`${target(selected.id, runId)}/stop`)
        .send({})
        .expect(200);
      expect(performance.now() - started).toBeLessThan(2000);
      expect(stopped.body.data).toMatchObject({ id: runId, reason: 'user_stop', inFlight: 1 });
      const response = await pending;
      expect(response.text).toContain('USER_STOP');
      expect(actualModelCalls).toBe(0);
      expect(releases).toBe(0);
    } finally {
      releaseMutex.resolve(() => {
        releases++;
      });
      await setupSettled.promise;
      await pending;
      observer.mockRestore();
    }
    // HTTP status read occurs after the pending setup promise has been rejected and settled.
    const settled = await request(app).get(current(selected.id)).expect(200);
    expect(settled.body.data).toMatchObject({
      state: 'cancelled',
      inFlight: 0,
      reason: 'user_stop',
    });
    expect(releases).toBe(1);
    expect(actualModelCalls).toBe(0);
  });
  it('makes duplicate Stop idempotent and cannot cancel a newer run or another session', async () => {
    const selected = session();
    const other = session();
    const service = getRunControlService(context.db);
    const first = service.open(selected, randomUUID());
    const ack = await request(app)
      .post(`${target(selected.id, first.runId)}/stop`)
      .send({})
      .expect(200);
    const again = await request(app)
      .post(`${target(selected.id, first.runId)}/stop`)
      .send({})
      .expect(200);
    expect(again.body.data).toEqual(ack.body.data);
    const next = service.open(selected, randomUUID());
    const otherRun = service.open(other, randomUUID());
    await request(app)
      .post(`${target(other.id, next.runId)}/stop`)
      .send({})
      .expect(404);
    await request(app)
      .post(`${target(selected.id, first.runId)}/stop`)
      .send({})
      .expect(200);
    expect(next.signal.aborted).toBe(false);
    expect(otherRun.signal.aborted).toBe(false);
    const fresh = await request(app).get(current(selected.id)).expect(200);
    expect(fresh.body.data.id).toBe(next.runId);
  });
  it('preserves completed work and rejects malformed IDs, unknown sessions and caller-supplied actor fields', async () => {
    const selected = session();
    const service = getRunControlService(context.db);
    const execution = service.open(selected, randomUUID());
    await execution.invoke('tool', async () => 'completed-effect');
    execution.finish('completed');
    const response = await request(app)
      .post(`${target(selected.id, execution.runId)}/stop`)
      .send({})
      .expect(200);
    expect(response.body.data.state).toBe('completed');
    expect(response.body.data.stopAcknowledgedAtMs).toBeUndefined();
    await request(app)
      .post(`${target(selected.id, execution.runId)}/stop`)
      .send({ actorId: 'privileged' })
      .expect(400);
    await request(app)
      .post(`${target(selected.id, 'not-uuid')}/stop`)
      .send({})
      .expect(400);
    await request(app).get(current(randomUUID())).expect(404);
    await request(app).get(target(selected.id, randomUUID())).expect(404);
  });
  it('returns a retriable unavailable result for a failed mandatory commit, never a fake acknowledgement', async () => {
    const selected = session();
    const service = getRunControlService(context.db);
    const execution = service.open(selected, randomUUID());
    const writer = openDatabase(path.join(directory, 'db.sqlite')).sqlite;
    writer.exec('BEGIN IMMEDIATE');
    try {
      const started = performance.now();
      const result = await request(app)
        .post(`${target(selected.id, execution.runId)}/stop`)
        .send({})
        .expect(503);
      expect(performance.now() - started).toBeLessThan(2000);
      expect(result.body.error.code).toBe('RUN_CONTROL_UNAVAILABLE');
      expect(result.body.data).toBeUndefined();
      expect(execution.signal.aborted).toBe(false);
      expect(service.current(selected.id)?.stopAcknowledgedAtMs).toBeUndefined();
      expect(JSON.stringify(result.body)).not.toContain('SQLITE_BUSY');
    } finally {
      writer.exec('ROLLBACK');
      writer.close();
    }
    await request(app)
      .post(`${target(selected.id, execution.runId)}/stop`)
      .send({})
      .expect(200);
  });
  it('keeps stopped pending approval records but refuses later automatic continuation', async () => {
    const selected = session();
    const service = getRunControlService(context.db);
    const execution = service.open(selected, randomUUID());
    const approval = createApprovalRequest(context.db, {
      id: randomUUID(),
      sessionId: selected.id,
      runId: execution.executionId,
      agentId: DEFAULT_AGENT_ID,
      toolName: 'sys_write_file',
      args: { path: 'private-fixture', content: 'private-content' },
      riskTier: 'high',
      executionPayloadJson: JSON.stringify({
        toolCallId: 'stop-fixture-call',
        toolName: 'sys_write_file',
        args: { path: 'private-fixture', content: 'private-content' },
      }),
      createdAtMs: Date.now(),
    });
    execution.finish('waiting_for_approval');
    await request(app)
      .post(`${target(selected.id, execution.runId)}/stop`)
      .send({})
      .expect(200);
    const decision = await request(app)
      .post(`/v1/approval-requests/${approval.id}/approve`)
      .send({})
      .expect(409);
    expect(decision.body.error.code).toBe('APPROVAL_RUN_STOPPED');
    expect(getApprovalRequest(context.db, approval.id).status).toBe('pending');
    const resume = await request(app)
      .post(`/v1/sessions/${selected.id}/resume`)
      .send({ approvalRequestId: approval.id });
    expect(resume.status).toBe(409);
    expect(resume.body.error.code).toBe('APPROVAL_NOT_DECIDED');
    expect(getApprovalRequest(context.db, approval.id).runId).toBe(execution.executionId);
    expect(service.current(selected.id)?.state).toBe('cancelled');
  });
  it('refuses premature resume without changing waiting authority, then resumes one approved effect under the same logical identity', async () => {
    await closeLoopback(app);
    const marker = path.join(directory, 'approved-effects.txt');
    app = await listenLoopback(
      createApp({
        db: context.db,
        v1: {
          chat: {
            disableEvaluatorNodes: true,
            emitFinalAssistantMessage: true,
            systemToolExecutorFactory: () => async (toolId) => {
              appendFileSync(marker, `${toolId}\n`);
              return {
                type: 'tool_result' as const,
                toolId,
                data: { stdout: 'fixture-date', stderr: '', exitCode: 0 },
              };
            },
            llmReasonNode: async () => ({
              llmOutput: { kind: 'text' as const, content: 'Approved fixture completed' },
              messages: [{ role: 'assistant' as const, content: 'Approved fixture completed' }],
            }),
          },
        },
      }),
    );
    const selected = session();
    const service = getRunControlService(context.db);
    const execution = service.open(selected, randomUUID());
    const approval = createApprovalRequest(context.db, {
      id: randomUUID(),
      sessionId: selected.id,
      runId: execution.executionId,
      agentId: DEFAULT_AGENT_ID,
      toolName: 'sys_bash',
      args: { command: 'date' },
      riskTier: 'high',
      executionPayloadJson: JSON.stringify({
        toolCallId: 'approved-marker',
        toolName: 'sys_bash',
        args: { command: 'date' },
      }),
      createdAtMs: Date.now(),
    });
    execution.finish('waiting_for_approval');
    const denied = await request(app)
      .post(`/v1/sessions/${selected.id}/resume`)
      .set('x-openai-key', 'fixture-no-provider-request')
      .send({ approvalRequestId: approval.id })
      .expect(409);
    expect(denied.body.error.code).toBe('APPROVAL_NOT_DECIDED');
    expect(service.current(selected.id)).toMatchObject({
      id: execution.runId,
      state: 'waiting_for_approval',
      inFlight: 0,
    });
    expect(getApprovalRequest(context.db, approval.id).resumedAtMs).toBeUndefined();
    await request(app).post(`/v1/approval-requests/${approval.id}/approve`).send({}).expect(200);
    const resumed = await request(app)
      .post(`/v1/sessions/${selected.id}/resume`)
      .set('x-openai-key', 'fixture-no-provider-request')
      .send({ approvalRequestId: approval.id })
      .expect(200);
    expect(resumed.headers['x-harness-run-id']).toBe(execution.runId);
    expect(resumed.text).toContain('"stdout":"fixture-date"');
    expect(readFileSync(marker, 'utf8')).toBe('sys_bash\n');
    const currentRun = await request(app).get(current(selected.id)).expect(200);
    expect(currentRun.body.data).toMatchObject({
      id: execution.runId,
      state: 'completed',
      inFlight: 0,
    });
    await request(app)
      .post(`/v1/sessions/${selected.id}/resume`)
      .send({ approvalRequestId: approval.id })
      .expect(200);
    expect(readFileSync(marker, 'utf8')).toBe('sys_bash\n');
  });
  it('refuses unbound legacy approvals at the real resume endpoint without inventing control state', async () => {
    const selected = session();
    const approval = createApprovalRequest(context.db, {
      id: randomUUID(),
      sessionId: selected.id,
      runId: 'legacy-unbound-run',
      agentId: DEFAULT_AGENT_ID,
      toolName: 'sys_write_file',
      args: { path: 'fixture', content: 'fixture' },
      riskTier: 'high',
      executionPayloadJson: JSON.stringify({
        toolCallId: 'legacy-call',
        toolName: 'sys_write_file',
        args: { path: 'fixture', content: 'fixture' },
      }),
      createdAtMs: Date.now(),
    });
    await request(app).post(`/v1/approval-requests/${approval.id}/approve`).send({}).expect(200);
    const resume = await request(app)
      .post(`/v1/sessions/${selected.id}/resume`)
      .send({ approvalRequestId: approval.id });
    expect(resume.status).toBe(404);
    expect(resume.body.error.code).toBe('RUN_NOT_FOUND');
    const state = await request(app).get(current(selected.id)).expect(200);
    expect(state.body.data).toBeNull();
  });
});
