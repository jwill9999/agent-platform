import { mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import {
  openDatabase,
  closeDatabase,
  getApprovalRequest,
  listApprovalRequests,
  createDiagnosticStore,
} from '@agent-platform/db';
import {
  DiagnosticReportSchema,
  type Agent,
  type McpServer,
  type DiagnosticStore,
} from '@agent-platform/contracts';
import type { TaskEndContext } from '@agent-platform/plugin-sdk';
import { createApp } from '../src/infrastructure/http/createApp.js';
import {
  createInProcessSessionLock,
  type SessionLock,
} from '../src/infrastructure/http/sessionLock.js';
import type { HarnessStateType, ToolCallIntent } from '@agent-platform/harness';
import { listenLoopback, closeLoopback, closeLoopbacks } from './support/loopbackServer.js';

const providerStream = vi.hoisted(() =>
  vi.fn<(...args: unknown[]) => never>(() => {
    throw new Error('Unexpected provider invocation in MCP budget refusal test');
  }),
);
// Preserve real admission and MCP transports; intercept only the provider boundary.
vi.mock('../../../packages/harness/node_modules/ai', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  streamText: (...args: unknown[]) => providerStream(...args),
}));

const roots: string[] = [];
const servers = new Set<Server>();
const diagnosticStores: DiagnosticStore[] = [];
const restore = { key: process.env.SECRETS_MASTER_KEY, provider: process.env.AGENT_OPENAI_API_KEY };
afterEach(async () => {
  providerStream.mockClear();
  const ownedServers = [...servers];
  servers.clear();
  try {
    await closeLoopbacks(ownedServers);
  } finally {
    for (const store of diagnosticStores.splice(0)) await store.close();
    for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
    for (const [name, value] of [
      ['SECRETS_MASTER_KEY', restore.key],
      ['AGENT_OPENAI_API_KEY', restore.provider],
    ] as const) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});

type Entry = { event: string; pid?: number; authenticated?: boolean };
async function setup(
  sessionLock?: SessionLock,
  options: {
    diagnostics?: boolean;
    beforeModel?: () => Promise<void>;
    realModelReasoning?: boolean;
  } = {},
) {
  process.env.SECRETS_MASTER_KEY = Buffer.alloc(32, 7).toString('base64');
  process.env.AGENT_OPENAI_API_KEY = 'sk-synthetic-mcp-test';
  const root = mkdtempSync(join(tmpdir(), 'mcp-chat-'));
  roots.push(root);
  const journal = join(root, 'effect journal.jsonl');
  const control = join(root, 'control.json');
  writeFileSync(control, '{}');
  const { db, sqlite } = openDatabase(join(root, 'test.sqlite'));
  const taskEndEvents: TaskEndContext[] = [];
  const diagnosticStore = options.diagnostics
    ? createDiagnosticStore({ path: join(root, 'diagnostics.sqlite') })
    : undefined;
  if (diagnosticStore) {
    diagnosticStores.push(diagnosticStore);
    await diagnosticStore.ready;
  }
  let calls = 0;
  const replies: Array<ToolCallIntent[] | string> = [];
  const definitions: string[][] = [];
  const discoveredDefinitions: string[][] = [];
  const rawApp = createApp({
    db,
    diagnostics: diagnosticStore
      ? { store: diagnosticStore, access: { host: '127.0.0.1:3456', capability: 'a'.repeat(64) } }
      : undefined,
    v1: {
      chat: {
        sessionLock,
        globalPlugins: [
          {
            id: 'mcp-outcome-regression',
            hooks: {
              onTaskStart: (event) => {
                discoveredDefinitions.push([...event.toolIds]);
              },
              onTaskEnd: (event) => {
                taskEndEvents.push(event);
              },
            },
          },
        ],
        disableEvaluatorNodes: true,
        llmReasonNode: options.realModelReasoning
          ? undefined
          : async (state: HarnessStateType) => {
              calls++;
              definitions.push(state.toolDefinitions.map((tool) => tool.name));
              await options.beforeModel?.();
              const reply = replies.shift();
              if (reply === undefined) throw new Error('Unexpected automatic model invocation');
              if (typeof reply === 'string')
                return {
                  llmOutput: { kind: 'text' as const, content: reply },
                  messages: [{ role: 'assistant' as const, content: reply }],
                };
              return {
                llmOutput: { kind: 'tool_calls' as const, calls: reply },
                messages: [{ role: 'assistant' as const, content: '', toolCalls: reply }],
              };
            },
      },
    },
  });
  const app = await listenLoopback(rawApp);
  servers.add(app);
  const body = {
    name: 'MCP chat fixture',
    transport: 'stdio',
    command: process.execPath,
    args: [resolve('test/fixtures/mcp-chat-server.mjs'), journal, control],
    credentials: { env: { FIXTURE_SECRET: 'test-value' } },
  };
  const server = (await request(app).post('/v1/mcp-servers').send(body).expect(201)).body
    .data as McpServer;
  const agentBody = {
    name: 'MCP chat agent',
    systemPrompt: 'Exercise only the disposable MCP fixture.',
    allowedSkillIds: [],
    allowedToolIds: [],
    allowedMcpServerIds: [server.id],
    executionLimits: { maxSteps: 6, maxParallelTasks: 1, timeoutMs: 10000 },
  };
  const agent = (await request(app).post('/v1/agents').send(agentBody).expect(201)).body
    .data as Agent;
  const sessionId = (
    await request(app).post('/v1/sessions').send({ agentId: agent.id }).expect(201)
  ).body.data.id as string;
  const read = (): Entry[] =>
    existsSync(journal)
      ? readFileSync(journal, 'utf8')
          .trim()
          .split('\n')
          .filter(Boolean)
          .map((line) => JSON.parse(line) as Entry)
      : [];
  const effect = () => read().filter((entry) => entry.event === 'effect');
  const call = { id: 'mcp-call-1', name: `${server.id}:fixture_effect`, args: {} };
  const ask = async (approve = true) => {
    replies.push([call]);
    const response = await request(app)
      .post('/v1/chat')
      .send({ sessionId, message: 'Record the test effect' })
      .expect(200);
    expect(response.text).toContain('approval_required');
    expect(effect()).toHaveLength(0);
    const pending = listApprovalRequests(db, {
      sessionId,
      status: 'pending',
      limit: 10,
      offset: 0,
    });
    expect(pending).toHaveLength(1);
    const approval = pending[0]!;
    expect(JSON.parse(approval.executionPayloadJson!).mcpBinding).toMatchObject({
      serverId: server.id,
      configurationRevision: server.configurationRevision,
    });
    if (approve)
      await request(app)
        .post(`/v1/approval-requests/${approval.id}/approve`)
        .send({ reason: 'fixture' })
        .expect(200);
    return approval;
  };
  const settledChildren = async () => {
    await expect
      .poll(() =>
        read()
          .filter((entry) => entry.pid)
          .every((entry) => {
            try {
              process.kill(entry.pid!, 0);
              return false;
            } catch {
              return true;
            }
          }),
      )
      .toBe(true);
  };
  return {
    app,
    db,
    sqlite,
    close: async () => {
      try {
        await closeLoopback(app);
      } finally {
        servers.delete(app);
        closeDatabase(sqlite);
      }
    },
    body,
    server,
    agentBody,
    agent,
    sessionId,
    read,
    effect,
    replies,
    call,
    ask,
    control,
    settledChildren,
    modelCalls: () => calls,
    definitions,
    discoveredDefinitions,
    taskEnds: () => taskEndEvents,
    diagnosticReport: async () =>
      DiagnosticReportSchema.parse(
        (
          await request(app)
            .post('/v1/diagnostics/report')
            .set('Host', '127.0.0.1:3456')
            .set('x-diagnostics-capability', 'a'.repeat(64))
            .send({ scope: { sessionId } })
            .expect(200)
        ).body,
      ),
  };
}

describe('real MCP chat and durable approval boundary', () => {
  it('refuses an insufficient saved budget after real MCP discovery before provider, approval or effects', async () => {
    const f = await setup(undefined, { diagnostics: true, realModelReasoning: true });
    try {
      const contextWindow = { maxInputTokens: 1, maxOutputTokens: 32, strategy: 'truncate' };
      await request(f.app)
        .put(`/v1/agents/${f.agent.id}`)
        .send({ ...f.agentBody, contextWindow })
        .expect(200);
      const saved = await request(f.app).get(`/v1/agents/${f.agent.id}`).expect(200);
      expect(saved.body.data.contextWindow).toEqual(contextWindow);
      expect(f.read()).toHaveLength(0);
      const response = await request(f.app)
        .post('/v1/chat')
        .send({ sessionId: f.sessionId, message: 'Check the bounded MCP catalog.' })
        .expect(200);
      expect(response.text).toContain('CONTEXT_BUDGET_EXCEEDED');
      expect(response.text).not.toContain('approval_required');
      // These IDs come from the real request-scoped discovery and trust filter, not a canned catalog.
      expect(f.discoveredDefinitions).toHaveLength(1);
      expect(f.discoveredDefinitions[0]).toContain(f.call.name);
      expect(f.discoveredDefinitions[0]).not.toContain(`${f.server.id}:bash`);
      expect(f.read().filter((entry) => entry.event === 'started')).toHaveLength(1);
      expect(providerStream).not.toHaveBeenCalled();
      expect(f.effect()).toHaveLength(0);
      expect(listApprovalRequests(f.db, { sessionId: f.sessionId })).toHaveLength(0);
      expect(f.taskEnds()).toEqual([
        expect.objectContaining({ ok: false, detail: 'CONTEXT_BUDGET_EXCEEDED' }),
      ]);
      const report = await f.diagnosticReport();
      const events = report.events.map((row) => row.event);
      const refusal = events.find((event) => event.phase === 'context');
      expect(refusal).toMatchObject({
        outcome: 'failed',
        errorCode: 'context_budget_exceeded',
        contextDecision: { configuredInputTokens: 1, outputCap: 32, reason: 'required_overflow' },
      });
      expect(refusal!.contextDecision!.schemaEstimate).toBeGreaterThan(1);
      expect(events.some((event) => event.phase === 'model')).toBe(false);
      expect(events.some((event) => event.phase === 'tool' || event.phase === 'approval')).toBe(
        false,
      );
      expect(
        events.some(
          (event) =>
            event.phase === 'request' &&
            event.outcome === 'failed' &&
            event.errorCode === 'context_budget_exceeded',
        ),
      ).toBe(true);
      expect(report.coverage).toMatchObject({
        durable: true,
        verified: true,
        dropped: 0,
        pending: 0,
      });
      expect(JSON.stringify(report)).not.toContain('Check the bounded MCP catalog.');
      await f.settledChildren();
    } finally {
      await f.close();
    }
  });

  it('marks initial-turn stale MCP admission as a failed task and V1 tool/request without effects', async () => {
    const f = await setup(undefined, {
      diagnostics: true,
      beforeModel: async () => {
        await request(f.app)
          .put(`/v1/mcp-servers/${f.server.id}`)
          .send({ ...f.body, credentials: { env: { FIXTURE_SECRET: 'changed-before-dispatch' } } })
          .expect(200);
      },
    });
    try {
      f.replies.push([f.call]);
      const response = await request(f.app)
        .post('/v1/chat')
        .send({ sessionId: f.sessionId, message: 'Detect stale admission before action' })
        .expect(200);
      expect(response.text).toContain('MCP_APPROVAL_STALE');
      expect(response.text).not.toContain('approval_required');
      expect(f.effect()).toHaveLength(0);
      expect(f.modelCalls()).toBe(1);
      expect(f.taskEnds()).toEqual([
        expect.objectContaining({ ok: false, detail: 'MCP_APPROVAL_STALE' }),
      ]);
      const report = await f.diagnosticReport();
      const events = report.events.map((row) => row.event);
      for (const phase of ['tool', 'request']) {
        expect(
          events.some(
            (event) =>
              event.phase === phase &&
              event.outcome === 'failed' &&
              event.errorCode === 'permission_denied',
          ),
        ).toBe(true);
        expect(events.some((event) => event.phase === phase && event.outcome === 'succeeded')).toBe(
          false,
        );
      }
      expect(JSON.stringify(report)).not.toContain('changed-before-dispatch');
      await f.settledChildren();
    } finally {
      await f.close();
    }
  });

  it('preserves Ask as a waiting diagnostic run without falsely failing task completion', async () => {
    const f = await setup(undefined, { diagnostics: true });
    try {
      await f.ask(false);
      expect(f.taskEnds()).toEqual([expect.objectContaining({ ok: true })]);
      expect(f.taskEnds()[0]?.detail).toBeUndefined();
      const events = (await f.diagnosticReport()).events.map((row) => row.event);
      expect(events.some((event) => event.phase === 'request' && event.outcome === 'waiting')).toBe(
        true,
      );
      expect(events.some((event) => event.phase === 'request' && event.outcome === 'failed')).toBe(
        false,
      );
      expect(f.effect()).toHaveLength(0);
      await f.settledChildren();
    } finally {
      await f.close();
    }
  });

  it('Test calls no tool, Ask waits, approved resume calls once and duplicate resume never replays', async () => {
    const f = await setup();
    try {
      expect(f.read()).toHaveLength(0);
      const tested = await request(f.app)
        .post(`/v1/mcp-servers/${f.server.id}/test`)
        .send({})
        .expect(200);
      expect(tested.body.data).toMatchObject({ discoveredCount: 2, eligibleCount: 1 });
      expect(f.effect()).toHaveLength(0);
      await f.settledChildren();
      const approval = await f.ask();
      f.replies.push('Completed');
      const response = await request(f.app)
        .post(`/v1/sessions/${f.sessionId}/resume`)
        .send({ approvalRequestId: approval.id })
        .expect(200);
      expect(response.text).toContain('tool_result');
      expect(f.effect()).toEqual([
        { event: 'effect', tool: 'fixture_effect', authenticated: true },
      ]);
      const count = f.modelCalls();
      await request(f.app)
        .post(`/v1/sessions/${f.sessionId}/resume`)
        .send({ approvalRequestId: approval.id })
        .expect(200);
      expect(f.effect()).toHaveLength(1);
      expect(f.modelCalls()).toBe(count);
      await f.settledChildren();
    } finally {
      await f.close();
    }
  });

  for (const change of [
    'command',
    'credential',
    'unassign',
    'delete',
    'schema',
    'legacy',
  ] as const) {
    it(`rejects a stale ${change} approval without an effect`, async () => {
      const f = await setup();
      try {
        const approval = await f.ask();
        const starts = f.read().length;
        if (change === 'command')
          await request(f.app)
            .put(`/v1/mcp-servers/${f.server.id}`)
            .send({ ...f.body, args: [...f.body.args, 'replacement'] })
            .expect(200);
        if (change === 'credential')
          await request(f.app)
            .put(`/v1/mcp-servers/${f.server.id}`)
            .send({ ...f.body, credentials: { env: { FIXTURE_SECRET: 'replacement' } } })
            .expect(200);
        if (change === 'unassign')
          await request(f.app)
            .put(`/v1/agents/${f.agent.id}`)
            .send({ ...f.agentBody, allowedMcpServerIds: [] })
            .expect(200);
        if (change === 'delete')
          await request(f.app).delete(`/v1/mcp-servers/${f.server.id}`).expect(204);
        if (change === 'schema') writeFileSync(f.control, JSON.stringify({ changedSchema: true }));
        if (change === 'legacy')
          f.sqlite
            .prepare('UPDATE approval_requests SET execution_payload_json = ? WHERE id = ?')
            .run(
              JSON.stringify({ toolCallId: f.call.id, toolName: f.call.name, args: {} }),
              approval.id,
            );
        const response = await request(f.app)
          .post(`/v1/sessions/${f.sessionId}/resume`)
          .send({ approvalRequestId: approval.id });
        expect(response.status).toBe(change === 'schema' ? 200 : 409);
        expect(response.text).toContain('MCP_APPROVAL_STALE');
        expect(f.effect()).toHaveLength(0);
        expect(f.modelCalls()).toBe(1);
        if (change !== 'schema') expect(f.read()).toHaveLength(starts);
        await f.settledChildren();
      } finally {
        await f.close();
      }
    });
  }

  it('halts after an approved action has an unknown outcome, without another model turn or effect', async () => {
    const f = await setup(undefined, { diagnostics: true });
    try {
      const approval = await f.ask();
      writeFileSync(f.control, JSON.stringify({ lostResponse: true }));
      f.replies.push([f.call]);
      const response = await request(f.app)
        .post(`/v1/sessions/${f.sessionId}/resume`)
        .send({ approvalRequestId: approval.id })
        .expect(200);
      expect(response.text).toContain('MCP_OUTCOME_UNKNOWN');
      expect(f.effect()).toHaveLength(1);
      expect(f.modelCalls()).toBe(1);
      expect(getApprovalRequest(f.db, approval.id).resumedAtMs).toBeTruthy();
      expect(f.taskEnds()).toContainEqual(
        expect.objectContaining({ ok: false, detail: 'MCP_OUTCOME_UNKNOWN' }),
      );
      const events = (await f.diagnosticReport()).events.map((row) => row.event);
      expect(
        events.some(
          (event) =>
            event.phase === 'request' &&
            event.outcome === 'failed' &&
            event.errorCode === 'tool_error',
        ),
      ).toBe(true);
      expect(
        events.some((event) => event.phase === 'request' && event.outcome === 'succeeded'),
      ).toBe(false);
      await f.settledChildren();
    } finally {
      await f.close();
    }
  });

  it('rejecting an Ask approval leaves the real effect journal empty', async () => {
    const f = await setup();
    try {
      const approval = await f.ask(false);
      await request(f.app)
        .post(`/v1/approval-requests/${approval.id}/reject`)
        .send({ reason: 'Denied by test owner' })
        .expect(200);
      f.replies.push('The action was denied.');
      const resumed = await request(f.app)
        .post(`/v1/sessions/${f.sessionId}/resume`)
        .send({ approvalRequestId: approval.id })
        .expect(200);
      expect(resumed.text).toContain('APPROVAL_REJECTED');
      expect(f.modelCalls()).toBe(2); // One deterministic denial explanation; no second tool request.
      expect(f.effect()).toHaveLength(0);
      await f.settledChildren();
    } finally {
      await f.close();
    }
  });

  it('Block refuses an unclassified MCP call without a pending approval or effect', async () => {
    const f = await setup();
    try {
      await request(f.app)
        .put('/v1/settings')
        .send({ executionPolicy: { unknownToolPolicy: 'block' } })
        .expect(200);
      f.replies.push([f.call], 'The action is blocked.');
      const response = await request(f.app)
        .post('/v1/chat')
        .send({ sessionId: f.sessionId, message: 'Attempt fixture effect' })
        .expect(200);
      expect(response.text).toContain('blocked');
      expect(response.text).not.toContain('approval_required');
      expect(
        listApprovalRequests(f.db, {
          sessionId: f.sessionId,
          status: 'pending',
          limit: 10,
          offset: 0,
        }),
      ).toHaveLength(0);
      expect(f.effect()).toHaveLength(0);
      await f.settledChildren();
    } finally {
      await f.close();
    }
  });

  it('unassigned and trust-rejected tools stay outside model definitions and cannot execute', async () => {
    const f = await setup();
    try {
      f.replies.push([{ ...f.call, name: `${f.server.id}:bash` }]);
      await request(f.app)
        .post('/v1/chat')
        .send({ sessionId: f.sessionId, message: 'Try rejected tool' })
        .expect(200);
      expect(f.definitions[0]).toContain(f.call.name);
      expect(f.definitions[0]).not.toContain(`${f.server.id}:bash`);
      expect(f.effect()).toHaveLength(0);
      await request(f.app)
        .put(`/v1/agents/${f.agent.id}`)
        .send({ ...f.agentBody, allowedMcpServerIds: [] })
        .expect(200);
      const starts = f.read().length;
      f.replies.push([f.call]);
      await request(f.app)
        .post('/v1/chat')
        .send({ sessionId: f.sessionId, message: 'Try unassigned tool' })
        .expect(200);
      expect(f.definitions[1]).not.toContain(f.call.name);
      expect(f.read()).toHaveLength(starts);
      expect(f.effect()).toHaveLength(0);
      await f.settledChildren();
    } finally {
      await f.close();
    }
  });

  it('closes MCP children if a real busy session mutex rejects before streaming', async () => {
    const mutex = createInProcessSessionLock();
    const bounded: SessionLock = {
      acquire: (id) => mutex.acquire(id, 30),
      get activeCount() {
        return mutex.activeCount;
      },
    };
    const f = await setup(bounded);
    const release = await mutex.acquire(f.sessionId);
    try {
      const response = await request(f.app)
        .post('/v1/chat')
        .send({ sessionId: f.sessionId, message: 'busy request' })
        .expect(409);
      expect(response.body.error.code).toBe('SESSION_BUSY');
      expect(f.read().some((entry) => entry.event === 'started')).toBe(true);
      expect(f.effect()).toHaveLength(0);
      expect(f.modelCalls()).toBe(0);
      await f.settledChildren();
    } finally {
      release();
      await f.close();
    }
  });

  it('closes MCP children when model configuration fails before streaming starts', async () => {
    const f = await setup();
    try {
      await request(f.app)
        .post('/v1/chat')
        .set('x-model-config-id', randomUUID())
        .send({ sessionId: f.sessionId, message: 'should not execute' })
        .expect(404);
      expect(f.read().some((entry) => entry.event === 'started')).toBe(true);
      expect(f.effect()).toHaveLength(0);
      await f.settledChildren();
    } finally {
      await f.close();
    }
  });
});
