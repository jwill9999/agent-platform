import { execFileSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtempSync, writeFileSync, rmSync, renameSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Server } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import {
  insertGitDeliveryOperation,
  createApprovalRequest,
  updateSettings,
  updateProject,
  transitionGitDeliveryOperation,
  openDatabase,
  closeDatabase,
  createProject,
  listApprovalRequests,
  getGitDeliveryOperation,
  getApprovalRequest,
} from '@agent-platform/db';
import type { ApprovalRequest } from '@agent-platform/contracts';
import { createApp } from '../src/infrastructure/http/createApp.js';
import { listenLoopback, closeLoopback } from './support/loopbackServer.js';

const providerModule = new URL(
  '../../../e2e/support/git-delivery/model-provider.mjs',
  import.meta.url,
).href;
const { startGitDeliveryProvider } = await import(providerModule);
const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});
const stage = { kind: 'stage', mode: 'stage', paths: ['file.txt'] };
function git(repo: string, args: string[]) {
  return execFileSync('/usr/bin/git', ['-C', repo, ...args], { encoding: 'utf8' }).trim();
}
async function setup(replies: unknown[], allowed = true) {
  const directory = mkdtempSync(join(tmpdir(), 'git-chat-sdk-'));
  const repo = join(directory, 'repo');
  execFileSync('/usr/bin/git', ['init', '-b', 'feature/chat', repo], { stdio: 'ignore' });
  git(repo, ['config', 'user.name', 'Chat fixture']);
  git(repo, ['config', 'user.email', 'chat@example.invalid']);
  writeFileSync(join(repo, 'file.txt'), 'initial');
  git(repo, ['add', '.']);
  git(repo, ['commit', '-m', 'initial']);
  writeFileSync(join(repo, 'file.txt'), 'changed');
  const opened = openDatabase(join(directory, 'test.sqlite'));
  const provider = await startGitDeliveryProvider({ model: 'git-delivery-chat', replies });
  const oldEnvironment = {
    SECRETS_MASTER_KEY: process.env.SECRETS_MASTER_KEY,
    LANGSMITH_TRACING: process.env.LANGSMITH_TRACING,
    LANGCHAIN_TRACING_V2: process.env.LANGCHAIN_TRACING_V2,
    LANGSMITH_TRACING_V2: process.env.LANGSMITH_TRACING_V2,
  };
  // Durable tool/approval bindings use only this fixture's disposable encryption key.
  process.env.SECRETS_MASTER_KEY = randomBytes(32).toString('base64');
  process.env.LANGSMITH_TRACING = 'false';
  process.env.LANGSMITH_TRACING_V2 = 'false';
  process.env.LANGCHAIN_TRACING_V2 = 'false';
  const oldBase = process.env.OLLAMA_BASE_URL;
  process.env.OLLAMA_BASE_URL = provider.baseURL;
  const listener: { server?: Server } = {};
  let beforeStart: (() => Promise<void>) | undefined;
  cleanups.push(async () => {
    try {
      try {
        if (listener.server) await closeLoopback(listener.server);
      } finally {
        await provider.close();
      }
    } finally {
      for (const [key, value] of Object.entries(oldEnvironment)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
      if (oldBase === undefined) delete process.env.OLLAMA_BASE_URL;
      else process.env.OLLAMA_BASE_URL = oldBase;
      try {
        closeDatabase(opened.sqlite);
      } finally {
        rmSync(directory, { recursive: true, force: true });
      }
    }
  });
  const server = await listenLoopback(
    createApp({
      db: opened.db,
      v1: {
        chat: {
          disableEvaluatorNodes: true,
          globalPlugins: [
            {
              id: 'git-fixture-start',
              hooks: {
                onTaskStart: async () => {
                  await beforeStart?.();
                },
              },
            },
          ],
        },
      },
    }),
  );
  listener.server = server;
  const agent = (
    await request(server)
      .post('/v1/agents')
      .send({
        name: 'Git fixture',
        systemPrompt: 'Use the requested Git delivery tool.',
        allowedSkillIds: [],
        allowedToolIds: allowed
          ? ['sys_git_stage', 'sys_git_commit', 'sys_git_push', 'sys_git_create_pull_request']
          : [],
        allowedMcpServerIds: [],
        executionLimits: { maxSteps: 6, maxParallelTasks: 1, timeoutMs: 20000 },
      })
      .expect((r) => {
        if (r.status !== 201) throw new Error(JSON.stringify(r.body));
      })
  ).body.data;
  const project = createProject(opened.db, {
    name: 'Git project',
    metadata: {
      backendProjectRoot: repo,
      repositoryRoot: repo,
      capabilityState: 'backend_accessible',
      onboardingState: 'approved',
      defaultAgentProfile: 'coding',
      instructionFiles: [],
    },
  });
  const sessionId = (
    await request(server)
      .post('/v1/sessions')
      .send({ agentId: agent.id, mode: 'project', projectId: project.id })
      .expect(201)
  ).body.data.id as string;
  await (
    await request(server)
      .post('/v1/model-configs')
      .send({ name: 'Local inert SDK fixture', provider: 'ollama', model: 'git-delivery-chat' })
      .expect((r) => {
        if (r.status !== 201) throw new Error(JSON.stringify(r.body));
      })
  ).body.data;
  async function ask() {
    return request(server!)
      .post('/v1/chat')
      .send({ sessionId, message: 'Perform the requested Git action' })
      .expect((r) => {
        if (r.status !== 200) throw new Error(JSON.stringify(r.body));
      });
  }
  function pending() {
    const rows = listApprovalRequests(opened.db, {
      sessionId,
      status: 'pending',
      limit: 10,
      offset: 0,
    });
    expect(rows).toHaveLength(1);
    return rows[0]!;
  }
  function operation(a: ApprovalRequest) {
    return getGitDeliveryOperation(
      opened.db,
      JSON.parse(a.executionPayloadJson!).gitDeliveryBinding.operationId,
    )!;
  }
  async function resume(a: ApprovalRequest) {
    return request(server!)
      .post(`/v1/sessions/${sessionId}/resume`)
      .send({ approvalRequestId: a.id })
      .expect(200);
  }
  async function approve(a: ApprovalRequest) {
    await request(server!).post(`/v1/approval-requests/${a.id}/approve`).send({}).expect(200);
  }
  return {
    project,
    agent,
    setBeforeStart: (hook: () => Promise<void>) => {
      beforeStart = hook;
    },
    directory,
    repo,
    server,
    provider,
    ...opened,
    sessionId,
    ask,
    pending,
    operation,
    resume,
    approve,
  };
}
const tool = (id = 'stage-1', args = stage) => ({ kind: 'tool', id, name: 'sys_git_stage', args });
const done = (id = 'stage-1') => ({
  kind: 'text',
  text: 'The reviewed operation completed.',
  requiredToolResults: [id],
});

describe('Git delivery through real SDK, HTTP approvals, SQLite and Git', () => {
  it.each([true, false])(
    'prepares before review, executes once and continues safely (allowlisted=%s)',
    async (allowed) => {
      const f = await setup([tool(), done()], allowed);
      const before = git(f.repo, ['rev-parse', 'HEAD']);
      const asked = await f.ask();
      expect(asked.text).toContain('approval_required');
      const a = f.pending();
      expect(git(f.repo, ['diff', '--cached', '--name-only'])).toBe('');
      expect(f.operation(a).receipt.state).toBe('prepared');
      expect(JSON.parse(a.argsJson)).toHaveProperty('gitDeliveryReceipt');
      expect(a.expiresAtMs).toBe(f.operation(a).receipt.expiresAtMs);
      await f.approve(a);
      const resumed = await f.resume(a);
      expect(resumed.text).toContain('succeeded');
      expect(git(f.repo, ['diff', '--cached', '--name-only'])).toBe('file.txt');
      expect(git(f.repo, ['rev-parse', 'HEAD'])).toBe(before);
      expect(f.operation(a).receipt.state).toBe('succeeded');
      expect(f.provider.requests, resumed.text + JSON.stringify(f.provider.errors)).toHaveLength(2);
      expect(f.provider.errors).toEqual([]);
      await f.resume(a);
      expect(f.provider.requests).toHaveLength(2);
      expect(f.operation(a).receipt.state).toBe('succeeded');
    },
    30000,
  );
  it('rejects immediately without resume, including a missing workspace, and rejection is idempotent', async () => {
    const f = await setup([tool()]);
    await f.ask();
    const a = f.pending();
    renameSync(f.repo, `${f.repo}-moved`);
    for (let i = 0; i < 2; i++)
      await request(f.server).post(`/v1/approval-requests/${a.id}/reject`).send({}).expect(200);
    expect(f.operation(a).receipt.state).toBe('denied');
    expect(getApprovalRequest(f.db, a.id).status).toBe('rejected');
    expect(f.provider.requests).toHaveLength(1);
    expect(git(`${f.repo}-moved`, ['diff', '--cached', '--name-only'])).toBe('');
  }, 30000);
  it('stale reviewed content produces no index effect and does not call the model again', async () => {
    const f = await setup([tool()]);
    await f.ask();
    const a = f.pending();
    writeFileSync(join(f.repo, 'file.txt'), 'changed after review');
    await f.approve(a);
    await f.resume(a);
    expect(f.operation(a).receipt.state).toBe('stale');
    expect(git(f.repo, ['diff', '--cached', '--name-only'])).toBe('');
    expect(f.provider.requests).toHaveLength(1);
    expect(f.provider.errors).toEqual([]);
  }, 30000);
  it('requires a separate prepared review for commit after an approved stage', async () => {
    const commit = {
      kind: 'tool',
      id: 'commit-1',
      name: 'sys_git_commit',
      args: { kind: 'commit', message: 'Reviewed chat commit', paths: ['file.txt'] },
      requiredToolResults: ['stage-1'],
    };
    const f = await setup([tool(), commit, done('commit-1')]);
    const before = git(f.repo, ['rev-parse', 'HEAD']);
    await f.ask();
    const staging = f.pending();
    await f.approve(staging);
    await f.resume(staging);
    const committing = f.pending();
    expect(committing.id).not.toBe(staging.id);
    expect(git(f.repo, ['rev-parse', 'HEAD'])).toBe(before);
    await f.approve(committing);
    await f.resume(committing);
    expect(git(f.repo, ['log', '-1', '--format=%s'])).toBe('Reviewed chat commit');
    expect(git(f.repo, ['rev-list', '--count', `${before}..HEAD`])).toBe('1');
    expect(f.operation(committing).receipt.state).toBe('succeeded');
    expect(f.provider.requests).toHaveLength(3);
    expect(f.provider.errors).toEqual([]);
  }, 30000);
  it('does not reuse approval authority when the continuing model reuses a call ID', async () => {
    const f = await setup([tool(), { ...tool(), requiredToolResults: ['stage-1'] }]);
    await f.ask();
    const a = f.pending();
    await f.approve(a);
    await f.resume(a);
    expect(f.operation(a).receipt.state).toBe('succeeded');
    expect(f.provider.requests).toHaveLength(2);
    expect(f.provider.errors).toEqual([]);
    expect(
      listApprovalRequests(f.db, { sessionId: f.sessionId, limit: 20, offset: 0 }),
    ).toHaveLength(1);
    expect(git(f.repo, ['diff', '--cached', '--name-only'])).toBe('file.txt');
  }, 30000);
  it('approval persistence failure cancels preparation and never mutates Git', async () => {
    const f = await setup([tool()]);
    f.sqlite.exec(
      "CREATE TRIGGER refuse_approval BEFORE INSERT ON approval_requests BEGIN SELECT RAISE(ABORT, 'fixture persistence failure'); END",
    );
    const result = await f.ask();
    expect(result.text).toContain('GIT_DELIVERY_PREPARATION_DENIED');
    expect(git(f.repo, ['diff', '--cached', '--name-only'])).toBe('');
    expect(f.sqlite.prepare('SELECT state FROM git_delivery_operations').all()).toEqual([
      { state: 'cancelled' },
    ]);
    expect(f.provider.requests).toHaveLength(1);
  }, 30000);
  it('retries immediate cancellation after rejection persisted but receipt storage failed', async () => {
    const f = await setup([tool()]);
    await f.ask();
    const a = f.pending();
    f.sqlite.exec(
      "CREATE TRIGGER refuse_cancel BEFORE UPDATE ON git_delivery_operations WHEN NEW.state='denied' BEGIN SELECT RAISE(ABORT, 'fixture cancellation failure'); END",
    );
    await request(f.server).post(`/v1/approval-requests/${a.id}/reject`).send({}).expect(500);
    expect(getApprovalRequest(f.db, a.id).status).toBe('rejected');
    expect(f.operation(a).receipt.state).toBe('prepared');
    f.sqlite.exec('DROP TRIGGER refuse_cancel');
    await request(f.server).post(`/v1/approval-requests/${a.id}/reject`).send({}).expect(200);
    expect(f.operation(a).receipt.state).toBe('denied');
    expect(git(f.repo, ['diff', '--cached', '--name-only'])).toBe('');
  }, 30000);
  it.each(['extra-field', 'different-operation', 'expired'])(
    'refuses changed durable approval binding: %s',
    async (change) => {
      const f = await setup([tool()]);
      await f.ask();
      const a = f.pending();
      await f.approve(a);
      const payload = JSON.parse(a.executionPayloadJson!);
      if (change === 'extra-field') payload.approved = true;
      if (change === 'different-operation')
        payload.gitDeliveryBinding.operationId = '00000000-0000-4000-8000-000000000000';
      if (change === 'expired')
        f.sqlite
          .prepare('UPDATE approval_requests SET expires_at_ms=? WHERE id=?')
          .run(Date.now() - 1, a.id);
      else
        f.sqlite
          .prepare('UPDATE approval_requests SET execution_payload_json=? WHERE id=?')
          .run(JSON.stringify(payload), a.id);
      const result = await request(f.server)
        .post(`/v1/sessions/${f.sessionId}/resume`)
        .send({ approvalRequestId: a.id });
      expect(result.status).toBe(409);
      expect(result.text).toContain(
        change === 'extra-field'
          ? 'APPROVAL_RESUME_STATE_INVALID'
          : change === 'expired'
            ? 'APPROVAL_EXPIRED'
            : 'GIT_DELIVERY_APPROVAL_INVALID',
      );
      expect(git(f.repo, ['diff', '--cached', '--name-only'])).toBe('');
      expect(f.provider.requests).toHaveLength(1);
      expect(f.provider.errors).toEqual([]);
    },
    30000,
  );
  it.each(['gitMutation', 'workspaceWrite'] as const)(
    'reloads persisted %s policy before approved execution',
    async (category) => {
      const f = await setup([tool()]);
      await f.ask();
      const a = f.pending();
      await f.approve(a);
      updateSettings(f.db, { executionPolicy: { [category]: 'block' } });
      await f.resume(a);
      expect(f.operation(a).receipt.state).toBe('denied');
      expect(git(f.repo, ['diff', '--cached', '--name-only'])).toBe('');
      expect(f.provider.requests).toHaveLength(1);
      expect(f.provider.errors).toEqual([]);
    },
    30000,
  );
  it('rejects changed Project ownership rather than closing another receipt', async () => {
    const f = await setup([tool()]);
    await f.ask();
    const a = f.pending();
    updateProject(f.db, f.project.id, { archivedAtMs: Date.now() });
    await request(f.server).post(`/v1/approval-requests/${a.id}/reject`).send({}).expect(409);
    expect(f.operation(a).receipt.state).toBe('prepared');
    expect(getApprovalRequest(f.db, a.id).status).toBe('pending');
  }, 30000);
  it.each(['executing', 'unknown'] as const)(
    'rejection never reclassifies retained %s effects',
    async (state) => {
      const f = await setup([tool()]);
      await f.ask();
      const a = f.pending();
      const op = f.operation(a);
      transitionGitDeliveryOperation(f.db, op.receipt.id, 'prepared', { ...op.receipt, state });
      await request(f.server).post(`/v1/approval-requests/${a.id}/reject`).send({}).expect(200);
      expect(f.operation(a).receipt.state).toBe(state);
      expect(git(f.repo, ['diff', '--cached', '--name-only'])).toBe('');
    },
    30000,
  );
  it('unknown operation halts resumed model continuation without retry', async () => {
    const f = await setup([tool()]);
    await f.ask();
    const a = f.pending();
    const op = f.operation(a);
    transitionGitDeliveryOperation(f.db, op.receipt.id, 'prepared', {
      ...op.receipt,
      state: 'unknown',
    });
    await f.approve(a);
    await f.resume(a);
    expect(f.operation(a).receipt.state).toBe('unknown');
    expect(f.provider.requests).toHaveLength(1);
    expect(f.provider.errors).toEqual([]);
    expect(git(f.repo, ['diff', '--cached', '--name-only'])).toBe('');
  }, 30000);
  it.each(['changed-agent', 'deleted-session', 'deleted-project'])(
    'cannot cancel after actor ownership changes: %s',
    async (change) => {
      const f = await setup([tool()]);
      await f.ask();
      const a = f.pending();
      if (change === 'changed-agent') {
        const other = (
          await request(f.server)
            .post('/v1/agents')
            .send({
              name: 'Other actor',
              systemPrompt: 'Other',
              allowedSkillIds: [],
              allowedToolIds: [],
              allowedMcpServerIds: [],
              executionLimits: { maxSteps: 2, maxParallelTasks: 1, timeoutMs: 20000 },
            })
            .expect(201)
        ).body.data;
        f.sqlite.prepare('UPDATE sessions SET agent_id=? WHERE id=?').run(other.id, f.sessionId);
      }
      if (change === 'deleted-session')
        f.sqlite.prepare('DELETE FROM sessions WHERE id=?').run(f.sessionId);
      if (change === 'deleted-project')
        f.sqlite.prepare('DELETE FROM projects WHERE id=?').run(f.project.id);
      await request(f.server).post(`/v1/approval-requests/${a.id}/reject`).send({}).expect(409);
      expect(f.operation(a).receipt.state).toBe('prepared');
      expect(getApprovalRequest(f.db, a.id).status).toBe('pending');
    },
    30000,
  );
  it.each([false, true])(
    'composes stage, commit, publish and PR with known success (enrichment failure=%s)',
    async (enrichmentFailure) => {
      const replies = [
        tool(),
        {
          kind: 'tool',
          id: 'commit-1',
          name: 'sys_git_commit',
          args: { kind: 'commit', message: 'Chat delivery', paths: ['file.txt'] },
          requiredToolResults: ['stage-1'],
        },
        {
          kind: 'tool',
          id: 'push-1',
          name: 'sys_git_push',
          args: { kind: 'push', mode: 'publish' },
          requiredToolResults: ['commit-1'],
        },
        {
          kind: 'tool',
          id: 'pr-1',
          name: 'sys_git_create_pull_request',
          args: {
            kind: 'pull_request',
            baseBranch: 'main',
            title: 'Chat delivery',
            body: 'Reviewed body',
            draft: true,
          },
          requiredToolResults: ['push-1'],
        },
        done('pr-1'),
      ];
      const f = await setup(replies);
      const bare = join(f.directory, 'remote.git');
      execFileSync('/usr/bin/git', ['init', '--bare', bare], { stdio: 'ignore' });
      const transportModule = new URL(
        '../../../e2e/support/git-delivery/git-transport.mjs',
        import.meta.url,
      ).href;
      const ghModule = new URL('../../../e2e/support/git-delivery/gh-ledger.mjs', import.meta.url)
        .href;
      const { createGitTransportFixture } = await import(transportModule);
      const { createGhLedgerFixture } = await import(ghModule);
      const transport = await createGitTransportFixture({ bareRoot: bare });
      const gh = await createGhLedgerFixture();
      await gh.setFailureModes({ enrichmentFailure });
      const values: Record<string, string> = { ...gh.env, AGENT_PLATFORM_GH_BINARY: gh.executable };
      const prior = new Map(Object.keys(values).map((key) => [key, process.env[key]]));
      for (const [key, value] of Object.entries(values)) process.env[key] = value;
      cleanups.push(async () => {
        await gh.close();
        await transport.close();
        for (const [key, value] of prior) {
          if (value === undefined) delete process.env[key];
          else process.env[key] = value;
        }
      });
      git(f.repo, ['remote', 'add', 'origin', transport.remoteUrl]);
      git(f.repo, ['config', 'core.sshCommand', transport.sshCommand]);
      git(f.repo, ['push', 'origin', 'HEAD:refs/heads/main']);
      const base = git(f.repo, ['rev-parse', 'HEAD']);
      await f.ask();
      for (const name of [
        'sys_git_stage',
        'sys_git_commit',
        'sys_git_push',
        'sys_git_create_pull_request',
      ]) {
        const a = f.pending();
        expect(a.toolName).toBe(name);
        if (name === 'sys_git_push')
          expect(
            git(bare, ['for-each-ref', '--format=%(refname)', 'refs/heads/feature/chat']),
          ).toBe('');
        if (name === 'sys_git_create_pull_request')
          expect((await gh.readLedger()).pullRequests).toHaveLength(0);
        await f.approve(a);
        const response = await f.resume(a);
        expect(f.operation(a).receipt.state, response.text).toBe('succeeded');
        if (name === 'sys_git_create_pull_request' && enrichmentFailure) {
          expect(f.operation(a).receipt.result?.warning).toBeTruthy();
          expect(response.text).toContain('warning');
        }
      }
      const tip = git(f.repo, ['rev-parse', 'HEAD']);
      expect(git(bare, ['rev-parse', 'refs/heads/feature/chat'])).toBe(tip);
      expect(git(bare, ['rev-parse', 'refs/heads/main'])).toBe(base);
      expect(git(f.repo, ['rev-list', '--count', `${base}..HEAD`])).toBe('1');
      const ledger = await gh.readLedger();
      expect(ledger.pullRequests).toHaveLength(1);
      expect(
        ledger.calls.filter(
          (entry: { args: string[] }) => entry.args[0] === 'pr' && entry.args[1] === 'create',
        ),
      ).toHaveLength(1);
      expect(f.provider.requests).toHaveLength(5);
      expect(f.provider.errors).toEqual([]);
    },
    30000,
  );
  it.each(['workspaceWrite', 'gitMutation'] as const)(
    'persisted %s block wins before unallowlisted approval creation',
    async (category) => {
      const f = await setup([tool()], false);
      updateSettings(f.db, { executionPolicy: { [category]: 'block' } });
      const response = await f.ask();
      expect(response.text).toContain('GIT_DELIVERY_PREPARATION_DENIED');
      expect(
        listApprovalRequests(f.db, { sessionId: f.sessionId, limit: 10, offset: 0 }),
      ).toHaveLength(0);
      expect(f.sqlite.prepare('SELECT id FROM git_delivery_operations').all()).toHaveLength(0);
      expect(git(f.repo, ['diff', '--cached', '--name-only'])).toBe('');
    },
    30000,
  );
  it('read-only Project denies preparation before offering an unallowlisted review', async () => {
    const f = await setup([tool()], false);
    updateProject(f.db, f.project.id, {
      metadata: { ...f.project.metadata, capabilityState: 'readonly' },
    });
    const response = await f.ask();
    expect(response.text).toContain('GIT_DELIVERY_PREPARATION_DENIED');
    expect(
      listApprovalRequests(f.db, { sessionId: f.sessionId, limit: 10, offset: 0 }),
    ).toHaveLength(0);
    expect(git(f.repo, ['diff', '--cached', '--name-only'])).toBe('');
  }, 30000);
  it('Personal mode cannot prepare Git mutation or obtain approval authority', async () => {
    const f = await setup([tool()], false);
    f.sqlite.prepare("UPDATE sessions SET mode='chat',project_id=NULL WHERE id=?").run(f.sessionId);
    const response = await f.ask();
    expect(response.text).toContain('GIT_DELIVERY_PREPARATION_DENIED');
    expect(
      listApprovalRequests(f.db, { sessionId: f.sessionId, limit: 10, offset: 0 }),
    ).toHaveLength(0);
    expect(git(f.repo, ['diff', '--cached', '--name-only'])).toBe('');
  }, 30000);
  it('onboarding permission changed after approval produces a durable denied receipt', async () => {
    const f = await setup([tool()]);
    await f.ask();
    const a = f.pending();
    await f.approve(a);
    updateProject(f.db, f.project.id, {
      metadata: { ...f.project.metadata, onboardingState: 'missing' },
    });
    await f.resume(a);
    expect(f.operation(a).receipt.state).toBe('denied');
    expect(git(f.repo, ['diff', '--cached', '--name-only'])).toBe('');
    expect(f.provider.requests).toHaveLength(1);
  }, 30000);
  it('forged binding to a different same-action operation cannot cancel that receipt', async () => {
    const f = await setup([tool()]);
    await f.ask();
    const a = f.pending();
    const { createGitDeliveryService } = await import('../src/application/gitDelivery/index.js');
    const other = await createGitDeliveryService(f.db)
      .chat({ sessionId: f.sessionId, agentId: f.agent.id })
      .prepare(stage as { kind: 'stage'; mode: 'stage'; paths: string[] }, {
        toolCallId: 'other-call',
      });
    const payload = JSON.parse(a.executionPayloadJson!);
    payload.gitDeliveryBinding.operationId = other.id;
    f.sqlite
      .prepare('UPDATE approval_requests SET execution_payload_json=? WHERE id=?')
      .run(JSON.stringify(payload), a.id);
    await f.approve(a);
    await request(f.server)
      .post(`/v1/sessions/${f.sessionId}/resume`)
      .send({ approvalRequestId: a.id })
      .expect(409);
    expect(getGitDeliveryOperation(f.db, other.id)?.receipt.state).toBe('prepared');
    expect(git(f.repo, ['diff', '--cached', '--name-only'])).toBe('');
  }, 30000);
  it.each(['user_stop', 'client_disconnect'] as const)(
    '%s after approval claim but before dispatch cancels the unexecuted owned receipt',
    async (reason) => {
      const f = await setup([tool()]);
      await f.ask();
      const a = f.pending();
      await f.approve(a);
      let release!: () => void;
      let entered!: () => void;
      let settled!: () => void;
      const started = new Promise<void>((resolve) => {
        entered = resolve;
      });
      const wait = new Promise<void>((resolve) => {
        release = resolve;
      });
      const finished = new Promise<void>((resolve) => {
        settled = resolve;
      });
      f.setBeforeStart(async () => {
        entered();
        await wait;
        settled();
      });
      const address = f.server.address();
      if (!address || typeof address === 'string') throw new Error('Missing address');
      const abort = new AbortController();
      const pending = fetch(`http://127.0.0.1:${address.port}/v1/sessions/${f.sessionId}/resume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvalRequestId: a.id }),
        signal: abort.signal,
      })
        .then(async (response) => ({ status: response.status, text: await response.text() }))
        .catch(() => undefined);
      try {
        await started;
        expect(getApprovalRequest(f.db, a.id).resumedAtMs).toBeTypeOf('number');
        const current = await request(f.server)
          .get(`/v1/sessions/${f.sessionId}/active-run`)
          .expect(200);
        const logicalRunId = current.body.data.id as string;
        if (reason === 'user_stop') {
          await request(f.server)
            .post(`/v1/sessions/${f.sessionId}/runs/${logicalRunId}/stop`)
            .send({})
            .expect(200);
          expect((await pending)?.status).toBe(200);
        } else {
          abort.abort();
          await pending;
        }
        // Cancellation must be durable while the original setup hook is still held.
        await expect.poll(() => f.operation(a).receipt.state, { timeout: 3000 }).toBe('cancelled');
        const cancelled = f.operation(a).receipt;
        expect(git(f.repo, ['diff', '--cached', '--name-only'])).toBe('');
        expect(f.provider.requests).toHaveLength(1);
        const interrupted = await request(f.server)
          .get(`/v1/sessions/${f.sessionId}/runs/${logicalRunId}`)
          .expect(200);
        expect(interrupted.body.data).toMatchObject({
          state: 'outcome_unknown',
          reason,
          inFlight: 1,
        });
        release();
        await finished;
        await expect
          .poll(async () => {
            const result = await request(f.server)
              .get(`/v1/sessions/${f.sessionId}/runs/${logicalRunId}`)
              .expect(200);
            return result.body.data.inFlight;
          })
          .toBe(0);
        if (reason === 'user_stop') {
          const result = await request(f.server)
            .get(`/v1/sessions/${f.sessionId}/runs/${logicalRunId}`)
            .expect(200);
          expect(result.body.data.state).toBe('cancelled');
        }
        expect(f.operation(a).receipt).toEqual(cancelled);
        expect(git(f.repo, ['diff', '--cached', '--name-only'])).toBe('');
        expect(f.provider.requests).toHaveLength(1);
      } finally {
        release();
        await finished;
        await pending;
      }
    },
    30000,
  );
  it.each(['changed-actor', 'executing', 'unknown'] as const)(
    'Stop during claimed setup cannot relabel a %s Git receipt',
    async (change) => {
      const f = await setup([tool()]);
      await f.ask();
      const a = f.pending();
      await f.approve(a);
      let enter!: () => void;
      let release!: () => void;
      let settle!: () => void;
      const entered = new Promise<void>((resolve) => {
        enter = resolve;
      });
      const held = new Promise<void>((resolve) => {
        release = resolve;
      });
      const settled = new Promise<void>((resolve) => {
        settle = resolve;
      });
      f.setBeforeStart(async () => {
        enter();
        await held;
        settle();
      });
      const pending = f.resume(a);
      try {
        await entered;
        expect(getApprovalRequest(f.db, a.id).resumedAtMs).toBeTypeOf('number');
        const current = await request(f.server)
          .get(`/v1/sessions/${f.sessionId}/active-run`)
          .expect(200);
        const logicalRunId = current.body.data.id as string;
        if (change === 'changed-actor') {
          const other = (
            await request(f.server)
              .post('/v1/agents')
              .send({
                name: 'Replacement actor after claim',
                systemPrompt: 'Other actor',
                allowedSkillIds: [],
                allowedToolIds: [],
                allowedMcpServerIds: [],
                executionLimits: { maxSteps: 2, maxParallelTasks: 1, timeoutMs: 20000 },
              })
              .expect(201)
          ).body.data;
          f.sqlite.prepare('UPDATE sessions SET agent_id=? WHERE id=?').run(other.id, f.sessionId);
        } else {
          // Metadata-only competing-state fixture; no Git effect is claimed or executed.
          const op = f.operation(a);
          expect(
            transitionGitDeliveryOperation(f.db, op.receipt.id, 'prepared', {
              ...op.receipt,
              state: change,
            }),
          ).toBe(true);
        }
        const protectedReceipt = f.operation(a).receipt;
        await request(f.server)
          .post(`/v1/sessions/${f.sessionId}/runs/${logicalRunId}/stop`)
          .send({})
          .expect(200);
        await pending;
        expect(f.operation(a).receipt).toEqual(protectedReceipt);
        expect(git(f.repo, ['diff', '--cached', '--name-only'])).toBe('');
        expect(f.provider.requests).toHaveLength(1);
        release();
        await settled;
        await expect
          .poll(
            async () =>
              (
                await request(f.server)
                  .get(`/v1/sessions/${f.sessionId}/runs/${logicalRunId}`)
                  .expect(200)
              ).body.data.inFlight,
          )
          .toBe(0);
        expect(f.operation(a).receipt).toEqual(protectedReceipt);
        expect(git(f.repo, ['diff', '--cached', '--name-only'])).toBe('');
        expect(f.provider.requests).toHaveLength(1);
      } finally {
        release();
        await settled;
        await pending;
      }
    },
    30000,
  );
  it.each([false, true])(
    'accounts for abandoned siblings after a multi-tool SDK response (stale=%s)',
    async (stale) => {
      const sibling = {
        id: 'abandoned-commit',
        name: 'sys_git_commit',
        args: { kind: 'commit', message: 'Must not execute', paths: ['file.txt'] },
      };
      const completed = {
        kind: 'text',
        text: 'The batch has explicit outcomes.',
        requiredToolResults: ['stage-1', sibling.id],
      };
      const f = await setup([{ kind: 'tools', calls: [tool(), sibling] }, completed, completed]);
      const before = git(f.repo, ['rev-parse', 'HEAD']);
      const response = await f.ask();
      expect(response.text).toContain('GIT_DELIVERY_NOT_EXECUTED');
      const a = f.pending();
      if (stale) writeFileSync(join(f.repo, 'file.txt'), 'changed after prepared batch');
      await f.approve(a);
      const resumed = await f.resume(a);
      expect(resumed.text).not.toContain('CONTEXT_INVALID_HISTORY');
      expect(f.operation(a).receipt.state).toBe(stale ? 'stale' : 'succeeded');
      expect(git(f.repo, ['rev-parse', 'HEAD'])).toBe(before);
      const next = await f.ask();
      expect(next.text).toContain('The batch has explicit outcomes.');
      expect(next.text).not.toContain('CONTEXT_INVALID_HISTORY');
      expect(f.provider.requests).toHaveLength(stale ? 2 : 3);
      expect(f.provider.errors).toEqual([]);
      expect(
        listApprovalRequests(f.db, { sessionId: f.sessionId, limit: 20, offset: 0 }),
      ).toHaveLength(1);
      const history = f.provider.requests.at(-1).messages;
      expect(
        history.find(
          (item: { role: string; tool_call_id: string }) =>
            item.role === 'tool' && item.tool_call_id === sibling.id,
        ).content,
      ).toContain('GIT_DELIVERY_NOT_EXECUTED');
    },
    30000,
  );
});

describe('retained chat Git recovery inventory', () => {
  async function history(f: Awaited<ReturnType<typeof setup>>) {
    return (
      await request(f.server)
        .get('/v1/approval-requests/git-delivery')
        .query({ sessionId: f.sessionId })
        .expect((response) => {
          if (response.status !== 200) throw new Error(JSON.stringify(response.body));
        })
    ).body.data;
  }
  it('returns actual completed approval status with no private payload or material, and excludes deleted ghosts', async () => {
    const f = await setup([tool(), done()]);
    await f.ask();
    const a = f.pending();
    await f.approve(a);
    await f.resume(a);
    const result = await history(f);
    expect(result.approvals).toHaveLength(1);
    expect(result.approvals[0]).toMatchObject({
      id: a.id,
      status: 'approved',
      executionPayloadJson: null,
    });
    expect(result.approvals[0].resumedAtMs).toBeTypeOf('number');
    expect(result.recoveryReceipts).toEqual([]);
    expect(JSON.stringify(result)).not.toContain(f.repo);
    expect(JSON.stringify(result)).not.toContain('materialJson');
    f.sqlite
      .prepare('DELETE FROM git_delivery_operations WHERE id=?')
      .run(f.operation(a).receipt.id);
    expect(await history(f)).toEqual({ approvals: [], recoveryReceipts: [] });
  });
  it.each(['malformed', 'action', 'preview', 'agent', 'duplicate'])(
    'invalid %s approval gives owned recovery only, never approval authority',
    async (change) => {
      const f = await setup([tool()]);
      await f.ask();
      const a = f.pending();
      const op = f.operation(a);
      transitionGitDeliveryOperation(f.db, op.receipt.id, 'prepared', {
        ...op.receipt,
        state: 'unknown',
      });
      if (change === 'malformed')
        f.sqlite
          .prepare('UPDATE approval_requests SET execution_payload_json=? WHERE id=?')
          .run('{', a.id);
      if (change === 'action') {
        const p = JSON.parse(a.executionPayloadJson!);
        p.args.paths = ['different'];
        f.sqlite
          .prepare('UPDATE approval_requests SET execution_payload_json=? WHERE id=?')
          .run(JSON.stringify(p), a.id);
      }
      if (change === 'preview') {
        const p = JSON.parse(a.argsJson);
        p.gitDeliveryReceipt.review.branch = 'main';
        f.sqlite
          .prepare('UPDATE approval_requests SET args_json=? WHERE id=?')
          .run(JSON.stringify(p), a.id);
      }
      if (change === 'agent')
        f.sqlite
          .prepare('UPDATE approval_requests SET agent_id=? WHERE id=?')
          .run('other-agent', a.id);
      if (change === 'duplicate')
        createApprovalRequest(f.db, {
          ...a,
          id: randomUUID(),
          args: JSON.parse(a.argsJson),
          executionPayloadJson: a.executionPayloadJson!,
          riskTier: 'high',
        });
      const result = await history(f);
      expect(result.approvals).toEqual([]);
      expect(result.recoveryReceipts).toEqual([
        expect.objectContaining({ id: op.receipt.id, state: 'unknown' }),
      ]);
      await request(f.server)
        .delete(`/v1/projects/${f.project.id}/git/delivery/${op.receipt.id}`)
        .send({ confirmed: true })
        .expect(409);
      expect(git(f.repo, ['diff', '--cached', '--name-only'])).toBe('');
    },
  );
  it('retains all 1000 operations behind more than 1000 deleted approval histories, and explicit closed deletion restores capacity', async () => {
    const f = await setup([tool()]);
    await f.ask();
    const a = f.pending();
    const original = f.operation(a);
    const ids = [original.receipt.id];
    f.sqlite.transaction(() => {
      for (let i = 1; i < 1000; i++) {
        const receipt = {
          ...original.receipt,
          id: randomUUID(),
          state: 'cancelled' as const,
          createdAtMs: original.receipt.createdAtMs + i,
          updatedAtMs: original.receipt.updatedAtMs + i,
        };
        ids.push(receipt.id);
        insertGitDeliveryOperation(f.db, { ...original, receipt, toolCallId: `retained-${i}` });
        const payload = {
          ...JSON.parse(a.executionPayloadJson!),
          toolCallId: `retained-${i}`,
          gitDeliveryBinding: { operationId: receipt.id },
        };
        createApprovalRequest(f.db, {
          id: randomUUID(),
          sessionId: f.sessionId,
          agentId: f.agent.id,
          runId: a.runId,
          toolName: a.toolName,
          args: { gitDeliveryReceipt: receipt },
          executionPayloadJson: JSON.stringify(payload),
          riskTier: 'high',
          createdAtMs: receipt.createdAtMs,
        });
      }
      for (let i = 0; i < 1001; i++)
        createApprovalRequest(f.db, {
          id: randomUUID(),
          sessionId: f.sessionId,
          agentId: f.agent.id,
          runId: a.runId,
          toolName: a.toolName,
          args: JSON.parse(a.argsJson),
          executionPayloadJson: JSON.stringify({
            ...JSON.parse(a.executionPayloadJson!),
            gitDeliveryBinding: { operationId: randomUUID() },
          }),
          riskTier: 'high',
          createdAtMs: Date.now() + i,
        });
    })();
    const result = await history(f);
    expect(result.approvals).toHaveLength(1000);
    expect(result.recoveryReceipts).toEqual([]);
    expect(result.approvals.some((x: ApprovalRequest) => x.id === a.id)).toBe(true);
    await request(f.server)
      .post(`/v1/projects/${f.project.id}/git/delivery`)
      .send({ action: stage })
      .expect(409);
    await request(f.server)
      .delete(`/v1/projects/${f.project.id}/git/delivery/${ids[1]}`)
      .send({ confirmed: true })
      .expect(200);
    await request(f.server)
      .post(`/v1/projects/${f.project.id}/git/delivery`)
      .send({ action: stage })
      .expect(200);
    expect((await history(f)).approvals).toHaveLength(999);
  }, 30000);
  it.each([false, true])(
    'actual approval persistence failure exposes recovery (cancel also fails: %s)',
    async (cancelFails) => {
      const f = await setup([tool()]);
      f.sqlite.exec(
        "CREATE TRIGGER refuse_approval BEFORE INSERT ON approval_requests BEGIN SELECT RAISE(ABORT,'fixture'); END",
      );
      if (cancelFails)
        f.sqlite.exec(
          "CREATE TRIGGER refuse_cancel BEFORE UPDATE ON git_delivery_operations BEGIN SELECT RAISE(ABORT,'fixture'); END",
        );
      await f.ask();
      const result = await history(f);
      expect(result.approvals).toEqual([]);
      expect(result.recoveryReceipts).toHaveLength(1);
      const r = result.recoveryReceipts[0];
      expect(r.state).toBe(cancelFails ? 'prepared' : 'cancelled');
      if (cancelFails) {
        f.sqlite.exec('DROP TRIGGER refuse_cancel');
        await request(f.server)
          .post(`/v1/projects/${f.project.id}/git/delivery/${r.id}/cancel`)
          .send({})
          .expect(200);
      }
      await request(f.server)
        .delete(`/v1/projects/${f.project.id}/git/delivery/${r.id}`)
        .send({ confirmed: true })
        .expect(200);
      expect(await history(f)).toEqual({ approvals: [], recoveryReceipts: [] });
    },
  );
  it('cannot expose foreign Project/session/agent rows; Personal restore is empty', async () => {
    const f = await setup([tool()]);
    await f.ask();
    const a = f.pending();
    const op = f.operation(a);
    for (const field of ['project_id', 'session_id', 'agent_id']) {
      const prior =
        field === 'project_id' ? f.project.id : field === 'session_id' ? f.sessionId : f.agent.id;
      f.sqlite
        .prepare(`UPDATE git_delivery_operations SET ${field}=? WHERE id=?`)
        .run('foreign', op.receipt.id);
      expect(await history(f)).toEqual({ approvals: [], recoveryReceipts: [] });
      f.sqlite
        .prepare(`UPDATE git_delivery_operations SET ${field}=? WHERE id=?`)
        .run(prior, op.receipt.id);
    }
    f.sqlite.prepare("UPDATE sessions SET mode='chat',project_id=NULL WHERE id=?").run(f.sessionId);
    expect(await history(f)).toEqual({ approvals: [], recoveryReceipts: [] });
  });

  it('returns current cancelled receipt with the genuinely pending approval after panel cancellation', async () => {
    const f = await setup([tool()]);
    await f.ask();
    const a = f.pending();
    const id = f.operation(a).receipt.id;
    await request(f.server)
      .post(`/v1/projects/${f.project.id}/git/delivery/${id}/cancel`)
      .send({})
      .expect(200);
    const result = await history(f);
    expect(result.approvals[0].status).toBe('pending');
    expect(JSON.parse(result.approvals[0].argsJson).gitDeliveryReceipt.state).toBe('cancelled');
    expect(getApprovalRequest(f.db, a.id).status).toBe('pending');
    expect(git(f.repo, ['diff', '--cached', '--name-only'])).toBe('');
  });
  it('keeps every retained receipt state visible without synthesising approval status', async () => {
    const f = await setup([tool()]);
    await f.ask();
    const a = f.pending();
    const op = f.operation(a);
    for (const state of [
      'prepared',
      'executing',
      'succeeded',
      'failed',
      'unknown',
      'cancelled',
      'denied',
      'stale',
      'expired',
    ]) {
      f.sqlite
        .prepare('UPDATE git_delivery_operations SET state=? WHERE id=?')
        .run(state, op.receipt.id);
      const result = await history(f);
      expect(result.approvals).toHaveLength(1);
      expect(result.approvals[0].status).toBe('pending');
      expect(JSON.parse(result.approvals[0].argsJson).gitDeliveryReceipt.state).toBe(state);
      f.sqlite
        .prepare('UPDATE approval_requests SET execution_payload_json=? WHERE id=?')
        .run('{', a.id);
      expect((await history(f)).recoveryReceipts[0].state).toBe(state);
      f.sqlite
        .prepare('UPDATE approval_requests SET execution_payload_json=? WHERE id=?')
        .run(a.executionPayloadJson, a.id);
    }
  });
  it('prepared recovery can expire and then be explicitly deleted without Git effects', async () => {
    const f = await setup([tool()]);
    await f.ask();
    const a = f.pending();
    const op = f.operation(a);
    f.sqlite.prepare('DELETE FROM approval_requests WHERE id=?').run(a.id);
    f.sqlite
      .prepare('UPDATE git_delivery_operations SET expires_at_ms=? WHERE id=?')
      .run(Date.now() - 1, op.receipt.id);
    expect((await history(f)).recoveryReceipts[0].state).toBe('prepared');
    const read = await request(f.server)
      .get(`/v1/projects/${f.project.id}/git/delivery/${op.receipt.id}`)
      .expect(200);
    expect(read.body.data.state).toBe('expired');
    await request(f.server)
      .delete(`/v1/projects/${f.project.id}/git/delivery/${op.receipt.id}`)
      .send({ confirmed: true })
      .expect(200);
    expect(await history(f)).toEqual({ approvals: [], recoveryReceipts: [] });
    expect(git(f.repo, ['diff', '--cached', '--name-only'])).toBe('');
  });
  it('assigns canonical Git tools on agent create and replace without fixture registry seeding', async () => {
    const f = await setup([], false);
    const updated = await request(f.server)
      .put(`/v1/agents/${f.agent.id}`)
      .send({ ...f.agent, allowedToolIds: ['sys_git_push', 'sys_git_create_pull_request'] })
      .expect(200);
    expect(updated.body.data.allowedToolIds).toEqual(
      expect.arrayContaining(['sys_git_push', 'sys_git_create_pull_request']),
    );
    expect(
      f.sqlite
        .prepare("SELECT risk_tier,requires_approval FROM tools WHERE id='sys_git_push'")
        .get(),
    ).toMatchObject({ risk_tier: 'high', requires_approval: 1 });
    await request(f.server)
      .put(`/v1/agents/${f.agent.id}`)
      .send({ ...f.agent, allowedToolIds: ['invented-system-tool'] })
      .expect(500);
    expect(
      f.sqlite.prepare("SELECT id FROM tools WHERE id='invented-system-tool'").get(),
    ).toBeUndefined();
  });
});
