import { appendFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  closeDatabase,
  createProject,
  getApprovalRequest,
  listMessagesBySession,
  openDatabase,
  runSeed,
  upsertTool,
} from '@agent-platform/db';
import { RunControlRecordSchema } from '@agent-platform/contracts';
import { SYSTEM_TOOLS } from '@agent-platform/harness';
import type { ChatRouterOptions } from '../src/infrastructure/http/v1/chatRouter.js';
import { listenLoopback, closeLoopback } from './support/loopbackServer.js';

const providerModule = '../../../e2e/support/project-chat-stop/provider.mjs';
const { startStopProvider } = await import(providerModule);
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
  if (errors.length) throw new AggregateError(errors, 'Resume persistence fixture cleanup failed');
});

function barrier() {
  let resolve!: () => void;
  const promise = new Promise<void>((accept) => {
    resolve = accept;
  });
  return { promise, resolve };
}

async function fixture(
  held: boolean,
  extra: (marker: string) => Partial<ChatRouterOptions> = () => ({}),
) {
  // The API suite shares one module cache; a preceding SDK-mocking fixture must
  // not replace this fixture's real HTTP provider path through a cached app.
  vi.resetModules();
  const { createApp } = await import('../src/infrastructure/http/createApp.js');
  const directory = mkdtempSync(join(tmpdir(), 'stop-resume-persistence-'));
  const marker = join(directory, 'effect.txt');
  writeFileSync(marker, '');
  const { db, sqlite } = openDatabase(join(directory, 'app.sqlite'));
  runSeed(db);
  upsertTool(db, SYSTEM_TOOLS.find((tool) => tool.id === 'sys_append_file')!);
  const provider = await startStopProvider({ model: 'resume-persistence-fixture' });
  vi.stubEnv('OLLAMA_BASE_URL', provider.baseURL);
  const app = await listenLoopback(
    createApp({
      db,
      v1: {
        chat: { disableEvaluatorNodes: true, emitFinalAssistantMessage: true, ...extra(marker) },
      },
    }),
  );
  cleanups.push(async () => {
    provider.release(1);
    try {
      await closeLoopback(app);
      await provider.close();
    } finally {
      closeDatabase(sqlite);
      rmSync(directory, { recursive: true, force: true });
    }
  });
  const agent = (
    await request(app)
      .post('/v1/agents')
      .send({
        name: 'Resume fixture',
        systemPrompt: 'Perform the requested fixture action.',
        allowedSkillIds: [],
        allowedToolIds: ['sys_append_file'],
        allowedMcpServerIds: [],
        executionLimits: { maxSteps: 5, maxParallelTasks: 1, timeoutMs: 20_000 },
      })
      .expect(201)
  ).body.data;
  const project = createProject(db, {
    name: 'Resume fixture project',
    metadata: {
      backendProjectRoot: directory,
      repositoryRoot: directory,
      capabilityState: 'backend_accessible',
      onboardingState: 'approved',
      defaultAgentProfile: 'coding',
      instructionFiles: [],
    },
  });
  const sessionId = (
    await request(app)
      .post('/v1/sessions')
      .send({ agentId: agent.id, mode: 'project', projectId: project.id })
      .expect(201)
  ).body.data.id as string;
  await request(app)
    .post('/v1/model-configs')
    .send({ name: 'Inert SDK fixture', provider: 'ollama', model: 'resume-persistence-fixture' })
    .expect(201);
  provider.enqueue({
    kind: 'tool',
    name: 'sys_append_file',
    args: { path: '/workspace/effect.txt', content: 'approved once\n' },
  });
  provider.enqueue({
    kind: 'text',
    partial: held ? 'Completed effect retained. ' : undefined,
    text: 'Continuation completed.',
    hold: held,
  });
  const initial = await request(app)
    .post('/v1/chat')
    .send({ sessionId, message: 'Append one fixture line.' })
    .expect(200);
  const initialEvents = initial.text
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  const approval = initialEvents.find((event) => event.type === 'approval_required');
  expect(
    approval,
    JSON.stringify({
      eventTypes: initialEvents.map((event) => event.type),
      errorCodes: initialEvents
        .filter((event) => event.type === 'error')
        .map((event) => event.error?.code ?? event.code),
      providerRequests: provider.requests.length,
    }),
  ).toBeDefined();
  expect(readFileSync(marker, 'utf8')).toBe('');
  const logicalRunId = initial.headers['x-harness-run-id'] as string;
  return {
    app,
    db,
    sqlite,
    provider,
    marker,
    sessionId,
    logicalRunId,
    approvalId: approval.approvalRequestId as string,
    async approve() {
      await request(app)
        .post(`/v1/approval-requests/${approval.approvalRequestId}/approve`)
        .send({})
        .expect(200);
    },
    resume() {
      return request(app)
        .post(`/v1/sessions/${sessionId}/resume`)
        .send({ approvalRequestId: approval.approvalRequestId });
    },
    async current() {
      return RunControlRecordSchema.parse(
        (await request(app).get(`/v1/sessions/${sessionId}/active-run`).expect(200)).body.data,
      );
    },
    messages() {
      return listMessagesBySession(db, sessionId);
    },
  };
}

function paired(f: Awaited<ReturnType<typeof fixture>>) {
  const rows = f.messages();
  const assistantCalls = rows.flatMap((row) => row.toolCalls ?? []);
  const tools = rows.filter((row) => row.role === 'tool');
  expect(tools).toHaveLength(1);
  expect(assistantCalls).toHaveLength(1);
  expect(tools[0]?.toolCallId).toBe(assistantCalls[0]?.id);
  expect(tools[0]?.content).toContain('appended');
  expect(readFileSync(f.marker, 'utf8')).toBe('approved once\n');
}

function interruptedPair(f: Awaited<ReturnType<typeof fixture>>) {
  const rows = f.messages();
  const calls = rows.flatMap((row) => row.toolCalls ?? []);
  const tools = rows.filter((row) => row.role === 'tool');
  expect(calls).toHaveLength(1);
  expect(tools).toHaveLength(1);
  expect(tools[0]?.toolCallId).toBe(calls[0]?.id);
  expect(JSON.parse(tools[0]!.content)).toMatchObject({ error: 'RUN_INTERRUPTED_OUTCOME_UNKNOWN' });
  expect(tools[0]?.content).not.toContain('"appended":true');
}

describe('approved effect persistence before a following model continuation', () => {
  it('retains the completed real append and paired history when Stop interrupts the next model, then accepts a fresh run', async () => {
    const f = await fixture(true);
    await f.approve();
    const pending = f.resume().then((result) => result);
    try {
      await vi.waitFor(() => expect(f.provider.ledger[1]?.partialSent).toBe(true), {
        timeout: 5000,
      });
      // Independent SQLite and file assertions: the effect must be durable before awaiting the next provider.
      paired(f);
      expect((await f.current()).id).toBe(f.logicalRunId);
      const acknowledged = await request(f.app)
        .post(`/v1/sessions/${f.sessionId}/runs/${f.logicalRunId}/stop`)
        .send({})
        .expect(200);
      expect(acknowledged.body.data.reason).toBe('user_stop');
      const stopped = await pending;
      expect(stopped.status).toBe(200);
      await vi.waitFor(async () => expect((await f.current()).state).toBe('cancelled'));
      paired(f);
      const restored = await request(f.app).get(`/v1/sessions/${f.sessionId}/messages`).expect(200);
      expect(
        restored.body.data.flatMap((row: { toolCalls?: unknown[] }) => row.toolCalls ?? []),
      ).toHaveLength(1);
      expect(f.messages().some((row) => row.content === 'Completed effect retained. ')).toBe(true);
      f.provider.enqueue({ kind: 'text', text: 'Fresh independent run completed.' });
      const fresh = await request(f.app)
        .post('/v1/chat')
        .send({ sessionId: f.sessionId, message: 'Continue with a new independent request.' })
        .expect(200);
      expect(fresh.text).toContain('Fresh independent run completed.');
      expect(fresh.text).not.toContain('CONTEXT_INVALID_HISTORY');
      const next = await f.current();
      expect(next.state).toBe('completed');
      expect(next.id).not.toBe(f.logicalRunId);
      expect(f.provider.requests).toHaveLength(3);
      paired(f);
      expect(getApprovalRequest(f.db, f.approvalId).resumedAtMs).toBeTypeOf('number');
    } finally {
      f.provider.release(1);
      await pending;
    }
  });

  it('persists an honest tool marker when Stop returns before an admitted executor settles, without replay', async () => {
    const entered = barrier();
    const release = barrier();
    const settled = barrier();
    let effects = 0;
    const f = await fixture(false, (marker) => ({
      systemToolExecutorFactory: () => async (toolId) => {
        appendFileSync(marker, 'held effect\n');
        effects++;
        entered.resolve();
        await release.promise;
        settled.resolve();
        return { type: 'tool_result', toolId, data: { appended: true } };
      },
    }));
    await f.approve();
    const pending = f.resume().then((result) => result);
    try {
      await entered.promise;
      expect(readFileSync(f.marker, 'utf8')).toBe('held effect\n');
      const acknowledged = await request(f.app)
        .post(`/v1/sessions/${f.sessionId}/runs/${f.logicalRunId}/stop`)
        .send({})
        .expect(200);
      expect(acknowledged.body.data.reason).toBe('user_stop');
      expect((await pending).status).toBe(200);
      expect(await f.current()).toMatchObject({ state: 'outcome_unknown', inFlight: 1 });
      interruptedPair(f);
      expect(f.provider.requests).toHaveLength(1);
      release.resolve();
      await vi.waitFor(async () => expect((await f.current()).state).toBe('cancelled'));
      interruptedPair(f);
      expect(effects).toBe(1);
      const fresh = await request(f.app)
        .post('/v1/chat')
        .send({ sessionId: f.sessionId, message: 'New request after the admitted effect settled.' })
        .expect(200);
      expect(fresh.text).toContain('Continuation completed.');
      expect(fresh.text).not.toContain('CONTEXT_INVALID_HISTORY');
      expect((await f.current()).id).not.toBe(f.logicalRunId);
      expect(f.provider.requests).toHaveLength(2);
      expect(effects).toBe(1);
      expect(readFileSync(f.marker, 'utf8')).toBe('held effect\n');
      interruptedPair(f);
    } finally {
      release.resolve();
      await settled.promise;
      await pending;
    }
  });

  it('fences Stop after approval claim during an uncooperative TaskStart hook and frees the session while it remains unresolved', async () => {
    const entered = barrier();
    const release = barrier();
    const settled = barrier();
    let starts = 0;
    const f = await fixture(false, () => ({
      globalPlugins: [
        {
          id: 'held-resume-start',
          hooks: {
            onTaskStart: async () => {
              if (++starts === 2) {
                entered.resolve();
                await release.promise;
                settled.resolve();
              }
            },
          },
        },
      ],
    }));
    await f.approve();
    const pending = f.resume().then((result) => result);
    try {
      await entered.promise;
      expect(getApprovalRequest(f.db, f.approvalId).resumedAtMs).toBeTypeOf('number');
      const begun = performance.now();
      await request(f.app)
        .post(`/v1/sessions/${f.sessionId}/runs/${f.logicalRunId}/stop`)
        .send({})
        .expect(200);
      expect((await pending).status).toBe(200);
      expect(performance.now() - begun).toBeLessThan(2000);
      expect(await f.current()).toMatchObject({ state: 'outcome_unknown', inFlight: 1 });
      interruptedPair(f);
      expect(readFileSync(f.marker, 'utf8')).toBe('');
      expect(f.provider.requests).toHaveLength(1);
      // A fresh request proves the old HTTP owner released the real session mutex before hook settlement.
      const fresh = await request(f.app)
        .post('/v1/chat')
        .send({
          sessionId: f.sessionId,
          message: 'New independent request while the prior setup is unresolved.',
        })
        .expect(200);
      expect(fresh.text).toContain('Continuation completed.');
      expect(fresh.text).not.toContain('CONTEXT_INVALID_HISTORY');
      const next = await f.current();
      expect(next.id).not.toBe(f.logicalRunId);
      expect(next.state).toBe('completed');
      release.resolve();
      await vi.waitFor(async () => {
        const prior = await request(f.app)
          .get(`/v1/sessions/${f.sessionId}/runs/${f.logicalRunId}`)
          .expect(200);
        expect(prior.body.data).toMatchObject({ state: 'cancelled', inFlight: 0 });
      });
      expect((await f.current()).id).toBe(next.id);
      expect((await f.current()).state).toBe('completed');
      await f.resume().expect(200);
      expect(f.provider.requests).toHaveLength(2);
      expect(readFileSync(f.marker, 'utf8')).toBe('');
      interruptedPair(f);
    } finally {
      release.resolve();
      await settled.promise;
      await pending;
    }
  });

  it.each([false, true])(
    'persists an ordinary resumed tool pair exactly once (reconstruct missing assistant: %s)',
    async (reconstruct) => {
      const f = await fixture(false);
      if (reconstruct) {
        // Legacy incomplete history still has the exact durable approval; resume reconstructs its assistant call.
        f.sqlite
          .prepare(
            "DELETE FROM messages WHERE session_id = ? AND role = 'assistant' AND tool_calls_json IS NOT NULL",
          )
          .run(f.sessionId);
      }
      await f.approve();
      const response = await f.resume().expect(200);
      expect(response.text).toContain('Continuation completed.');
      paired(f);
      expect((await f.current()).state).toBe('completed');
      expect(
        f
          .messages()
          .filter((row) => row.role === 'assistant' && row.content === 'Continuation completed.'),
      ).toHaveLength(1);
      await f.resume().expect(200);
      paired(f);
      expect(f.provider.requests).toHaveLength(2);
    },
  );
});
