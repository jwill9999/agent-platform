import { execFileSync } from 'node:child_process';
import {
  chmodSync,
  cpSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const pathReadHook = vi.hoisted(() => {
  // API tests share a fork without module isolation; load the service after this test's mock.
  vi.resetModules();
  return { before: undefined as (() => void) | undefined };
});
vi.mock('node:fs/promises', async () => {
  const actual = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises');
  return {
    ...actual,
    realpath: async (...args: Parameters<typeof actual.realpath>) => {
      pathReadHook.before?.();
      return actual.realpath(...args);
    },
  };
});
import { createHash } from 'node:crypto';
import {
  approveApprovalRequest,
  claimApprovalRequestForResume,
  closeDatabase,
  createApprovalRequest,
  createProject,
  createSession,
  getGitDeliveryOperation,
  insertGitDeliveryOperation,
  openDatabase,
  recoverGitDeliveryOperations,
  replaceAgent,
  transitionGitDeliveryOperation,
  updateProject,
  updateSettings,
} from '@agent-platform/db';
import type { GitDeliveryAction, GitDeliveryReceipt } from '@agent-platform/contracts';
import { createGitDeliveryService } from '../src/application/gitDelivery/index.js';
import { runGitDeliveryCommand } from '../src/application/gitDelivery/process.js';

const run = (root: string, args: string[]) =>
  execFileSync('/usr/bin/git', ['-C', root, ...args], {
    encoding: 'utf8',
    env: { ...process.env, GIT_CONFIG_COUNT: '0' },
  }).trim();

describe('Git delivery shared local service', () => {
  let directory: string;
  let repo: string;
  let opened: ReturnType<typeof openDatabase>;
  let projectId: string;
  let time: number;
  let service: ReturnType<typeof createGitDeliveryService>;
  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'git-delivery-test-'));
    repo = join(directory, 'repo');
    execFileSync('/usr/bin/git', ['init', '-b', 'feature/test', repo], { stdio: 'ignore' });
    run(repo, ['config', 'user.name', 'Delivery test']);
    run(repo, ['config', 'user.email', 'delivery@example.invalid']);
    writeFileSync(join(repo, 'file.txt'), 'base\n');
    writeFileSync(join(repo, 'other.txt'), 'base\n');
    run(repo, ['add', '.']);
    run(repo, ['commit', '-m', 'initial']);
    opened = openDatabase(join(directory, 'state.sqlite'));
    projectId = createProject(opened.db, {
      name: 'Delivery',
      metadata: {
        backendProjectRoot: repo,
        repositoryRoot: repo,
        capabilityState: 'backend_accessible',
        onboardingState: 'approved',
      },
    }).id;
    time = Date.now();
    service = createGitDeliveryService(opened.db, { now: () => time });
  });
  afterEach(() => {
    pathReadHook.before = undefined;
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    closeDatabase(opened.sqlite);
    rmSync(directory, { recursive: true, force: true });
  });
  const changedFile = () => writeFileSync(join(repo, 'file.txt'), 'new content\n');
  const action = (): GitDeliveryAction => ({ kind: 'stage', mode: 'stage', paths: ['file.txt'] });
  const panel = () => service.panel(projectId);
  const stage = async () => {
    changedFile();
    const operation = await panel().prepare(action());
    return panel().execute(operation.id, { confirmed: true });
  };
  function forceUnknown(receipt: GitDeliveryReceipt) {
    const operation = getGitDeliveryOperation(opened.db, receipt.id)!;
    transitionGitDeliveryOperation(opened.db, receipt.id, operation.receipt.state, {
      ...operation.receipt,
      state: 'unknown',
    });
  }
  function chat() {
    replaceAgent(opened.db, {
      id: 'agent',
      slug: 'agent',
      name: 'Agent',
      systemPrompt: 'test',
      allowedSkillIds: [],
      allowedToolIds: [],
      allowedMcpServerIds: [],
      executionLimits: { maxSteps: 5, maxParallelTasks: 1, timeoutMs: 30000 },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const session = createSession(opened.db, { agentId: 'agent', mode: 'project', projectId });
    return { session, port: service.chat({ sessionId: session.id, agentId: 'agent' }) };
  }
  function approve(
    sessionId: string,
    receipt: GitDeliveryReceipt,
    args: GitDeliveryAction = receipt.action,
  ) {
    const id = `approval-${receipt.id}`;
    createApprovalRequest(opened.db, {
      id,
      sessionId,
      runId: 'run',
      agentId: 'agent',
      toolName: 'sys_git_stage',
      args: { review: receipt.review },
      riskTier: 'high',
      createdAtMs: time,
      expiresAtMs: receipt.expiresAtMs,
      executionPayloadJson: JSON.stringify({
        toolCallId: 'call',
        toolName: 'sys_git_stage',
        args,
        gitDeliveryBinding: { operationId: receipt.id },
      }),
    });
    approveApprovalRequest(opened.db, id, time);
    claimApprovalRequestForResume(opened.db, id, time);
    return id;
  }
  it('can inspect and deny an owned prepared receipt when its repository disappears', async () => {
    changedFile();
    const { port } = chat();
    const receipt = await port.prepare(action(), { toolCallId: 'missing-root' });
    renameSync(repo, join(directory, 'moved-repository'));
    expect((await port.get(receipt.id)).state).toBe('prepared');
    expect((await port.cancel(receipt.id, 'denied')).state).toBe('denied');
    expect((await port.cancel(receipt.id, 'cancelled')).state).toBe('denied');
  });
  it.each(['project', 'session', 'session-mode'] as const)(
    'denies receipt inspection/cancellation after changed persisted %s ownership',
    async (changed) => {
      changedFile();
      const { port, session } = chat();
      const receipt = await port.prepare(action(), { toolCallId: 'ownership' });
      if (changed === 'project')
        opened.sqlite.prepare('DELETE FROM projects WHERE id = ?').run(projectId);
      if (changed === 'session')
        opened.sqlite.prepare('DELETE FROM sessions WHERE id = ?').run(session.id);
      if (changed === 'session-mode')
        opened.sqlite.prepare("UPDATE sessions SET mode = 'chat' WHERE id = ?").run(session.id);
      await expect(port.get(receipt.id)).rejects.toBeDefined();
      await expect(port.cancel(receipt.id, 'denied')).rejects.toBeDefined();
      expect(getGitDeliveryOperation(opened.db, receipt.id)?.receipt.state).toBe('prepared');
    },
  );
  it.each(['executing', 'unknown'] as const)(
    'effect-free cancellation does not relabel %s after repository disappears',
    async (state) => {
      changedFile();
      const { port } = chat();
      const receipt = await port.prepare(action(), { toolCallId: 'no-relabel' });
      transitionGitDeliveryOperation(opened.db, receipt.id, 'prepared', { ...receipt, state });
      renameSync(repo, join(directory, 'moved-repository'));
      expect((await port.cancel(receipt.id, 'denied')).state).toBe(state);
    },
  );
  it('creates a missing configured temporary parent without changing the reviewed real index', async () => {
    changedFile();
    const temporaryParent = join(directory, 'fresh-runtime', 'tmp', 'browser');
    vi.stubEnv('TMPDIR', temporaryParent);
    vi.stubEnv('TMP', temporaryParent);
    vi.stubEnv('TEMP', temporaryParent);
    const indexBefore = readFileSync(join(repo, '.git', 'index'));
    const headBefore = run(repo, ['rev-parse', 'HEAD']);
    const receipt = await panel().prepare(action());
    expect(receipt.state).toBe('prepared');
    expect(readFileSync(join(repo, '.git', 'index'))).toEqual(indexBefore);
    expect(run(repo, ['rev-parse', 'HEAD'])).toBe(headBefore);
    expect(readdirSync(temporaryParent)).toEqual([]);
    expect(readFileSync(join(repo, 'file.txt'), 'utf8')).toBe('new content\n');
  });
  it('preparation leaves index bytes unchanged, stage/unstage preserve unrelated staged content and commit records a real SHA', async () => {
    changedFile();
    writeFileSync(join(repo, 'other.txt'), 'unrelated staged\n');
    run(repo, ['add', 'other.txt']);
    const before = createHash('sha256')
      .update(readFileSync(join(repo, '.git/index')))
      .digest('hex');
    const prepared = await panel().prepare(action());
    expect(
      createHash('sha256')
        .update(readFileSync(join(repo, '.git/index')))
        .digest('hex'),
    ).toBe(before);
    expect(JSON.stringify(prepared)).not.toContain(repo);
    expect((await panel().execute(prepared.id, { confirmed: true })).state).toBe('succeeded');
    await expect(
      panel().prepare({ kind: 'commit', message: 'selected', paths: ['file.txt'] }),
    ).rejects.toMatchObject({ code: 'GIT_DELIVERY_INDEX_SELECTION' });
    const unstage = await panel().prepare({ kind: 'stage', mode: 'unstage', paths: ['other.txt'] });
    expect((await panel().execute(unstage.id, { confirmed: true })).state).toBe('succeeded');
    const commit = await panel().prepare({
      kind: 'commit',
      message: 'selected',
      paths: ['file.txt'],
    });
    const completed = await panel().execute(commit.id, { confirmed: true });
    expect(completed.state).toBe('succeeded');
    expect(completed.result?.commitSha).toBe(run(repo, ['rev-parse', 'HEAD']));
    expect(run(repo, ['show', 'HEAD:other.txt'])).toBe('base');
    expect(readFileSync(join(repo, 'other.txt'), 'utf8')).toBe('unrelated staged\n');
    expect(await panel().execute(commit.id, { confirmed: true })).toEqual(completed);
    expect(run(repo, ['rev-list', '--count', 'HEAD'])).toBe('2');
  });
  it.each([':(glob)*', '-option.txt', 'space and\nnewline.txt'])(
    'treats %j as a literal filename',
    async (filename) => {
      writeFileSync(join(repo, filename), 'safe');
      changedFile();
      const receipt = await panel().prepare({ kind: 'stage', mode: 'stage', paths: [filename] });
      expect((await panel().execute(receipt.id, { confirmed: true })).state).toBe('succeeded');
      expect(run(repo, ['diff', '--cached', '--name-only', '-z'])).toBe(filename + '\0');
    },
  );
  it('stages deletions and renames without selecting other changes', async () => {
    rmSync(join(repo, 'file.txt'));
    writeFileSync(join(repo, 'renamed.txt'), 'base\n');
    const receipt = await panel().prepare({
      kind: 'stage',
      mode: 'stage',
      paths: ['file.txt', 'renamed.txt'],
    });
    expect((await panel().execute(receipt.id, { confirmed: true })).state).toBe('succeeded');
    expect(run(repo, ['diff', '--cached', '--name-status', '--no-renames'])).toContain(
      'D\tfile.txt',
    );
  });
  it.each(['../outside', '/absolute', '.git/config', 'sub/.GiT/config', '.'])(
    'rejects unsafe path %s',
    async (file) => {
      await expect(
        panel().prepare({ kind: 'stage', mode: 'stage', paths: [file] }),
      ).rejects.toMatchObject({ code: 'GIT_DELIVERY_PATH_INVALID' });
    },
  );
  it('rejects symlink parent escapes but permits staging a symlink itself', async () => {
    symlinkSync(directory, join(repo, 'escape'));
    await expect(
      panel().prepare({ kind: 'stage', mode: 'stage', paths: ['escape/state.sqlite'] }),
    ).rejects.toMatchObject({ code: 'GIT_DELIVERY_PATH_ESCAPE' });
    const receipt = await panel().prepare({ kind: 'stage', mode: 'stage', paths: ['escape'] });
    expect((await panel().execute(receipt.id, { confirmed: true })).state).toBe('succeeded');
  });
  it.each(['--assume-unchanged', '--skip-worktree'])(
    'rejects %s metadata without changing it',
    async (flag) => {
      run(repo, ['update-index', flag, 'other.txt']);
      changedFile();
      const before = readFileSync(join(repo, '.git/index'));
      await expect(panel().prepare(action())).rejects.toMatchObject({
        code: 'GIT_DELIVERY_INDEX_UNSUPPORTED',
      });
      expect(readFileSync(join(repo, '.git/index'))).toEqual(before);
    },
  );
  it('rejects intent-to-add without modifying index', async () => {
    writeFileSync(join(repo, 'intent.txt'), 'intent');
    run(repo, ['add', '-N', 'intent.txt']);
    await expect(panel().prepare(action())).rejects.toMatchObject({
      code: 'GIT_DELIVERY_INDEX_UNSUPPORTED',
    });
  });
  it('rejects a split index without rewriting its bytes or supporting partial layouts', async () => {
    run(repo, ['update-index', '--split-index']);
    changedFile();
    const before = readFileSync(join(repo, '.git/index'));
    await expect(panel().prepare(action())).rejects.toMatchObject({
      code: 'GIT_DELIVERY_INDEX_UNSUPPORTED',
    });
    expect(readFileSync(join(repo, '.git/index'))).toEqual(before);
  });
  it('runs clean filters only after confirmation and does not repeat them during reconciliation', async () => {
    writeFileSync(join(repo, '.gitattributes'), 'file.txt filter=record\n');
    const marker = join(directory, 'filter-count');
    run(repo, ['config', 'filter.record.clean', `printf x >> '${marker}'; cat`]);
    changedFile();
    const prepared = await panel().prepare(action());
    expect(() => readFileSync(marker)).toThrow();
    const result = await panel().execute(prepared.id, { confirmed: true });
    expect(result.state).toBe('succeeded');
    const afterAdd = readFileSync(marker, 'utf8');
    expect(afterAdd.length).toBeGreaterThan(0);
    forceUnknown(result);
    expect((await panel().reconcile(result.id)).state).toBe('succeeded');
    expect(readFileSync(marker, 'utf8')).toBe(afterAdd);
  });
  it.each(['content', 'index', 'branch'])(
    'rejects changed %s after preparation without effects',
    async (change) => {
      changedFile();
      const receipt = await panel().prepare(action());
      if (change === 'content') writeFileSync(join(repo, 'file.txt'), 'later');
      if (change === 'index') {
        writeFileSync(join(repo, 'other.txt'), 'later');
        run(repo, ['add', 'other.txt']);
      }
      if (change === 'branch') run(repo, ['checkout', '-b', 'feature/other']);
      expect((await panel().execute(receipt.id, { confirmed: true })).state).toBe('stale');
      expect(run(repo, ['diff', '--cached', '--name-only'])).not.toContain('file.txt');
    },
  );
  it.each(['workspaceWrite', 'gitMutation'] as const)(
    'block wins for %s including after review',
    async (category) => {
      changedFile();
      const receipt = await panel().prepare(action());
      updateSettings(opened.db, { executionPolicy: { [category]: 'block', network: 'auto' } });
      expect((await panel().execute(receipt.id, { confirmed: true })).state).toBe('denied');
      await expect(panel().prepare(action())).rejects.toMatchObject({
        code: 'GIT_DELIVERY_POLICY_BLOCKED',
      });
      expect(run(repo, ['diff', '--cached', '--name-only'])).toBe('');
    },
  );
  it('local mutations work when network is blocked but still require explicit confirmation', async () => {
    updateSettings(opened.db, {
      executionPolicy: { workspaceWrite: 'auto', gitMutation: 'auto', network: 'block' },
    });
    changedFile();
    const receipt = await panel().prepare(action());
    await expect(panel().execute(receipt.id, { confirmed: false as true })).rejects.toMatchObject({
      code: 'GIT_DELIVERY_CONFIRMATION_REQUIRED',
    });
    expect((await panel().execute(receipt.id, { confirmed: true })).state).toBe('succeeded');
  });
  it('read-only projects cannot prepare writes', async () => {
    updateProject(opened.db, projectId, {
      metadata: {
        backendProjectRoot: repo,
        repositoryRoot: repo,
        capabilityState: 'readonly',
        onboardingState: 'approved',
      },
    });
    await expect(panel().prepare(action())).rejects.toMatchObject({
      code: 'GIT_DELIVERY_WRITE_BLOCKED',
    });
  });
  it.each(['main', 'master', 'staging'])('blocks protected branch %s', async (branch) => {
    run(repo, ['checkout', '-b', branch]);
    await expect(panel().prepare(action())).rejects.toMatchObject({
      code: 'GIT_DELIVERY_BRANCH_PROTECTED',
    });
  });
  it('chat requires exact persisted claimed approval and cannot borrow panel confirmation', async () => {
    const { session, port } = chat();
    changedFile();
    const prepared = await port.prepare(action(), { toolCallId: 'call' });
    await expect(port.execute(prepared.id, { approvalRequestId: 'forged' })).rejects.toMatchObject({
      code: 'GIT_DELIVERY_APPROVAL_REQUIRED',
    });
    await expect(panel().execute(prepared.id, { confirmed: true })).rejects.toMatchObject({
      code: 'GIT_DELIVERY_CONFIRMATION_REQUIRED',
    });
    const approvalRequestId = approve(session.id, prepared);
    expect((await port.execute(prepared.id, { approvalRequestId })).state).toBe('succeeded');
    expect((await port.prepare(action(), { toolCallId: 'call' })).id).toBe(prepared.id);
    await expect(
      port.prepare({ ...action(), paths: ['other.txt'] } as GitDeliveryAction, {
        toolCallId: 'call',
      }),
    ).rejects.toMatchObject({ code: 'GIT_DELIVERY_CALL_MISMATCH' });
  });
  it('rejects altered approval action and wrong session without effects', async () => {
    const { session, port } = chat();
    changedFile();
    const receipt = await port.prepare(action(), { toolCallId: 'call' });
    const approvalRequestId = approve(session.id, receipt, {
      kind: 'stage',
      mode: 'stage',
      paths: ['other.txt'],
    });
    await expect(port.execute(receipt.id, { approvalRequestId })).rejects.toMatchObject({
      code: 'GIT_DELIVERY_APPROVAL_REQUIRED',
    });
    const other = createSession(opened.db, { agentId: 'agent', mode: 'project', projectId });
    await expect(
      service.chat({ sessionId: other.id, agentId: 'agent' }).get(receipt.id),
    ).rejects.toMatchObject({ code: 'GIT_DELIVERY_OPERATION_NOT_FOUND' });
    expect(run(repo, ['diff', '--cached', '--name-only'])).toBe('');
  });
  it('expires prepared work, rejects missing/pruned IDs after restart, and permits explicit closed history deletion', async () => {
    changedFile();
    const receipt = await panel().prepare(action());
    time += 15 * 60 * 1000;
    expect((await panel().get(receipt.id)).state).toBe('expired');
    expect((await panel().execute(receipt.id, { confirmed: true })).state).toBe('expired');
    await panel().deleteClosed(receipt.id, { confirmed: true });
    closeDatabase(opened.sqlite);
    opened = openDatabase(join(directory, 'state.sqlite'));
    service = createGitDeliveryService(opened.db, { now: () => time });
    await expect(panel().execute(receipt.id, { confirmed: true })).rejects.toMatchObject({
      code: 'GIT_DELIVERY_OPERATION_NOT_FOUND',
    });
    expect(run(repo, ['diff', '--cached', '--name-only'])).toBe('');
    expect((await panel().prepare(action())).id).not.toBe(receipt.id);
  });
  it('unknown acknowledgement is human-only, preserves uncertainty, blocks replay and allows new preparation', async () => {
    const receipt = await stage();
    forceUnknown(receipt);
    // Remove reconciliation evidence to represent an interrupted stage before post-state capture.
    const operation = getGitDeliveryOperation(opened.db, receipt.id)!;
    const material = JSON.parse(operation.materialJson);
    delete material.expectedIndexEntries;
    delete material.expectedIndexTree;
    transitionGitDeliveryOperation(
      opened.db,
      receipt.id,
      'unknown',
      operation.receipt,
      JSON.stringify(material),
    );
    expect((await panel().reconcile(receipt.id)).state).toBe('unknown');
    await expect(panel().prepare(action())).rejects.toMatchObject({
      code: 'GIT_DELIVERY_UNKNOWN_PENDING',
    });
    await expect(panel().deleteClosed(receipt.id, { confirmed: true })).rejects.toMatchObject({
      code: 'GIT_DELIVERY_ACTIVE_HISTORY',
    });
    const acknowledged = await panel().acknowledge(receipt.id, { confirmed: true });
    expect(acknowledged.state).toBe('unknown');
    expect((await panel().execute(receipt.id, { confirmed: true })).state).toBe('unknown');
    const fresh = await panel().prepare(action());
    expect(fresh.state).toBe('prepared');
    expect(fresh.review.warning).toContain('may duplicate an earlier effect');
  });
  it('hook timeout leaves unknown, keeps event loop responsive, and owns descendant termination', async () => {
    await stage();
    const marker = join(directory, 'late-marker');
    writeFileSync(
      join(repo, '.git/hooks/pre-commit'),
      `#!/bin/sh\n(sleep 2; printf late > '${marker}') &\nsleep 3\n`,
    );
    chmodSync(join(repo, '.git/hooks/pre-commit'), 0o755);
    const receipt = await panel().prepare({ kind: 'commit', message: 'slow', paths: ['file.txt'] });
    const short = createGitDeliveryService(opened.db, {
      commandTimeoutMs: 600,
      now: () => time,
    }).panel(projectId);
    const execution = short.execute(receipt.id, { confirmed: true });
    let tick = false;
    await new Promise<void>((resolve) =>
      setTimeout(() => {
        tick = true;
        resolve();
      }, 20),
    );
    expect(tick).toBe(true);
    await expect(panel().prepare(action())).rejects.toMatchObject({ code: 'GIT_DELIVERY_BUSY' });
    expect((await execution).state).toBe('unknown');
    await new Promise((resolve) => setTimeout(resolve, 2100));
    expect(() => readFileSync(marker)).toThrow();
    expect(run(repo, ['rev-list', '--count', 'HEAD'])).toBe('1');
  });
  it('startup converts only executing receipts to unknown and preserves completed outcomes', async () => {
    const succeeded = await stage();
    const prepared = await panel().prepare({
      kind: 'commit',
      message: 'pending',
      paths: ['file.txt'],
    });
    transitionGitDeliveryOperation(opened.db, prepared.id, 'prepared', {
      ...prepared,
      state: 'executing',
    });
    closeDatabase(opened.sqlite);
    opened = openDatabase(join(directory, 'state.sqlite'));
    recoverGitDeliveryOperations(opened.db, time);
    expect(getGitDeliveryOperation(opened.db, prepared.id)?.receipt.state).toBe('unknown');
    expect(getGitDeliveryOperation(opened.db, succeeded.id)?.receipt.state).toBe('succeeded');
    closeDatabase(opened.sqlite);
    opened = openDatabase(join(directory, 'state.sqlite'));
    recoverGitDeliveryOperations(opened.db, time);
    expect(getGitDeliveryOperation(opened.db, prepared.id)?.receipt.state).toBe('unknown');
    expect(run(repo, ['rev-list', '--count', 'HEAD'])).toBe('1');
  });
  it('receipt capacity recovers via expiry and explicit human deletion, without evicting live history', async () => {
    changedFile();
    const base = await panel().prepare(action());
    const row = getGitDeliveryOperation(opened.db, base.id)!;
    opened.db.transaction((tx) => {
      for (let i = 1; i < 1000; i++)
        insertGitDeliveryOperation(tx, { ...row, receipt: { ...base, id: crypto.randomUUID() } });
    });
    await expect(panel().prepare(action())).rejects.toMatchObject({
      code: 'GIT_DELIVERY_CAPACITY',
    });
    await expect(panel().deleteClosed(base.id, { confirmed: true })).rejects.toMatchObject({
      code: 'GIT_DELIVERY_ACTIVE_HISTORY',
    });
    time += 15 * 60 * 1000;
    await expect(panel().prepare(action())).rejects.toMatchObject({
      code: 'GIT_DELIVERY_CAPACITY',
    });
    await panel().deleteClosed(base.id, { confirmed: true });
    expect((await panel().prepare(action())).state).toBe('prepared');
  });
  it.each(['MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'BISECT_LOG'])(
    'rejects ongoing %s even with a resolved index',
    async (state) => {
      writeFileSync(join(repo, '.git', state), run(repo, ['rev-parse', 'HEAD']) + '\n');
      await expect(panel().prepare(action())).rejects.toMatchObject({
        code: 'GIT_DELIVERY_OPERATION_IN_PROGRESS',
      });
    },
  );
  it('opening another DB connection does not recover a live executing receipt', async () => {
    changedFile();
    const receipt = await panel().prepare(action());
    transitionGitDeliveryOperation(opened.db, receipt.id, 'prepared', {
      ...receipt,
      state: 'executing',
    });
    const other = openDatabase(join(directory, 'state.sqlite'));
    try {
      expect(getGitDeliveryOperation(other.db, receipt.id)?.receipt.state).toBe('executing');
    } finally {
      closeDatabase(other.sqlite);
    }
  });
  it.each(['stage-root', 'stage-policy', 'commit-root', 'commit-policy'])(
    'rechecks %s after awaited inspection and performs no effect',
    async (scenario) => {
      if (scenario.startsWith('commit')) await stage();
      else changedFile();
      const requested: GitDeliveryAction = scenario.startsWith('commit')
        ? { kind: 'commit', message: 'reviewed', paths: ['file.txt'] }
        : action();
      const prepared = await panel().prepare(requested);
      const head = run(repo, ['rev-parse', 'HEAD']);
      const index = readFileSync(join(repo, '.git/index'));
      let calls = 0;
      pathReadHook.before = () => {
        if (++calls === 5) {
          if (scenario.endsWith('policy'))
            updateSettings(opened.db, { executionPolicy: { gitMutation: 'block' } });
          else
            updateProject(opened.db, projectId, {
              metadata: {
                backendProjectRoot: directory,
                repositoryRoot: directory,
                capabilityState: 'backend_accessible',
                onboardingState: 'approved',
              },
            });
        }
      };
      const result = await panel().execute(prepared.id, { confirmed: true });
      expect(calls).toBeGreaterThanOrEqual(5);
      expect(result.state).toBe(scenario.endsWith('policy') ? 'denied' : 'stale');
      expect(run(repo, ['rev-parse', 'HEAD'])).toBe(head);
      expect(readFileSync(join(repo, '.git/index'))).toEqual(index);
    },
  );
  it('does not confuse shifted content boundaries between two selected files', async () => {
    const delimiter = ';"other.txt":file:0:';
    writeFileSync(join(repo, 'file.txt'), `left${delimiter}middle`);
    writeFileSync(join(repo, 'other.txt'), 'right');
    const prepared = await panel().prepare({
      kind: 'stage',
      mode: 'stage',
      paths: ['file.txt', 'other.txt'],
    });
    writeFileSync(join(repo, 'file.txt'), 'left');
    writeFileSync(join(repo, 'other.txt'), `middle${delimiter}right`);
    expect((await panel().execute(prepared.id, { confirmed: true })).state).toBe('stale');
    expect(run(repo, ['diff', '--cached', '--name-only'])).toBe('');
  });
  it('keeps outcome unknown when a hook replaces repository identity after a commit effect', async () => {
    await stage();
    const original = join(directory, 'post-commit-original-git');
    writeFileSync(
      join(repo, '.git/hooks/post-commit'),
      `#!/bin/sh\nmv '${repo}/.git' '${original}'\ncp -R '${original}' '${repo}/.git'\n`,
    );
    chmodSync(join(repo, '.git/hooks/post-commit'), 0o755);
    const operation = await panel().prepare({
      kind: 'commit',
      message: 'identity changed',
      paths: ['file.txt'],
    });
    expect((await panel().execute(operation.id, { confirmed: true })).state).toBe('unknown');
    expect(run(repo, ['rev-list', '--count', 'HEAD'])).toBe('2');
    expect((await panel().reconcile(operation.id)).state).toBe('unknown');
  });
  it('does not reconcile success into a replacement repository at the same path', async () => {
    const result = await stage();
    forceUnknown(result);
    const original = join(directory, 'original-git');
    renameSync(join(repo, '.git'), original);
    cpSync(original, join(repo, '.git'), { recursive: true });
    expect((await panel().reconcile(result.id)).state).toBe('unknown');
  });
  it('bounds output and never includes subprocess content in thrown errors', async () => {
    await expect(
      runGitDeliveryCommand(
        process.execPath,
        ['-e', 'process.stdout.write("SECRET".repeat(500000))'],
        directory,
        AbortSignal.timeout(3000),
      ),
    ).rejects.toMatchObject({ reason: 'output_limit' });
  });
});
