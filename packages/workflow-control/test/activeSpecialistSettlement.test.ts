import {
  WorkflowCancellationCoordinator,
  OfficialCancellationCleanupPort,
} from '../src/cancellation.js';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  DockerIsolatedSpecialistLauncher,
  RevocableSpecialistCredentialBroker,
  type SpecialistProcessExecutor,
} from '../src/specialistLauncher.js';
import { WorkflowStore, workflowContainerJournalCapability } from '../src/storage.js';
import type { TaskPacket } from '../src/contracts.js';
import { continuationFixture } from './continuationFixture.js';

const executionId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const containerId = 'c'.repeat(64);
const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  vi.restoreAllMocks();
  for (const cleanup of cleanups.splice(0)) await cleanup();
});

async function setup(
  deadlineMs = 301000,
  hooks: { conformance?: () => Promise<void>; issued?: () => Promise<void> } = {},
) {
  const fixture = await continuationFixture(1000);
  let now = 1000;
  const sourceRoot = join(fixture.root, 'source');
  await mkdir(sourceRoot, { recursive: true });
  await writeFile(join(sourceRoot, 'safe.txt'), 'original');
  const original = fixture.store.getSchedulerExecution('child')!;
  const documentBinding = fixture.store.verifyPlanningDocuments({
    runId: 'run',
    taskId: 'task',
    ownerId: 'owner',
    runLeaseEpoch: 1,
    boundary: 'fixture.packet',
    nowMs: now,
  });
  const packet: TaskPacket = {
    documentBinding,
    runId: 'run',
    taskId: 'task',
    contractVersion: 1,
    policyDigest: `sha256:${'a'.repeat(64)}`,
    assignedRole: 'code_reviewer',
    objective: 'offline fixture',
    acceptanceCriteria: ['settled'],
    allowedPaths: ['safe.txt'],
    allowedOperations: ['workspace.read'],
    retryBudget: {
      implementationAttempts: 1,
      findingAttempts: 1,
      infrastructureAttempts: 1,
      waitDeadlineSeconds: 60,
    },
    evidence: [],
  };
  const execution = fixture.store.createSchedulerExecution({
    ...original,
    packet,
    id: executionId,
    processIdentity: `docker:workflow-specialist-${executionId}`,
    credentialLeaseId: `specialist:${executionId}`,
    deadlineMs,
    nowMs: now,
  });
  const reservation = { id: executionId, role: 'code_reviewer', deadlineMs: execution.deadlineMs };
  let staged: string | undefined;
  let present = false;
  let revoked = false;
  let revokeFails = false;
  let revokeHook: (() => void) | undefined;
  const calls: string[][] = [];
  const timeouts: number[] = [];
  let intercept:
    | ((args: readonly string[]) => Promise<{ stdout: string; stderr: string } | undefined>)
    | undefined;
  const broker = RevocableSpecialistCredentialBroker.createForTest({
    store: fixture.store,
    issue: async (root, _id, leaseId, generation) => {
      staged = root;
      const authFile = join(root, 'auth.json');
      await writeFile(authFile, '{}');
      await hooks.issued?.();
      return { authFile, leaseId, generation };
    },
    revoke: async () => {
      revokeHook?.();
      if (revokeFails) throw new Error('revocation offline');
      revoked = true;
    },
    observe: async () => (revoked ? 'revoked' : 'active'),
    conformance: async () => {
      await hooks.conformance?.();
      return 'fixture-generation';
    },
  });
  const owned = () =>
    JSON.stringify({
      id: containerId,
      name: `/workflow-specialist-${executionId}`,
      owner: executionId,
      status: 'exited',
      running: false,
      exitCode: 0,
    });
  const absent = (id: string) =>
    Object.assign(new Error('fixture absence'), {
      code: 1,
      stderr: `Error response from daemon: No such container: ${id}`,
    });
  const executor: SpecialistProcessExecutor = async (_binary, args, options) => {
    calls.push([...args]);
    timeouts.push(options.timeout);
    const overridden = await intercept?.(args);
    if (overridden !== undefined) return overridden;
    if (args[0] === 'create') {
      present = true;
      return { stdout: containerId, stderr: '' };
    }
    if (args[0] === 'inspect') {
      if (!present) throw absent(args.at(-1)!);
      return { stdout: owned(), stderr: '' };
    }
    if (args[0] === 'rm') {
      present = false;
      return { stdout: containerId, stderr: '' };
    }
    return { stdout: '{"type":"result"}\n', stderr: '' };
  };
  const makeLauncher = (ownerId = 'owner', store = fixture.store) =>
    DockerIsolatedSpecialistLauncher.createForTest({
      store,
      ownerId,
      sourceRoot,
      image: 'offline-fixture',
      credentialBroker: broker,
      egressNetwork: 'none',
      containerUser: '1000:1000',
      executor,
      clock: () => now,
    });
  const launcher = makeLauncher();
  cleanups.push(async () => {
    fixture.store.close();
    await rm(fixture.root, { recursive: true, force: true });
    if (staged !== undefined) await rm(staged, { recursive: true, force: true });
  });
  return {
    ...fixture,
    execution,
    packet,
    reservation,
    launcher,
    makeLauncher,
    broker,
    calls,
    timeouts,
    owned,
    absent,
    get staged() {
      return staged;
    },
    get revoked() {
      return revoked;
    },
    setNow(value: number) {
      now = value;
    },
    setPresent(value: boolean) {
      present = value;
    },
    setRevokeFails(value: boolean) {
      revokeFails = value;
    },
    onRevoke(callback: () => void) {
      revokeHook = callback;
    },
    intercept(callback: NonNullable<typeof intercept>) {
      intercept = callback;
    },
    advance(
      from: 'not_dispatched' | 'create_pending' | 'acknowledged',
      to: 'create_pending' | 'acknowledged' | 'removal_confirmed',
      id?: string,
    ) {
      return fixture.store.advanceSchedulerContainer(
        { execution, from, to, containerId: id, nowMs: now },
        workflowContainerJournalCapability,
      );
    },
    finish(status: 'completed' | 'cancelled' | 'escalated') {
      return fixture.store.finishSchedulerExecution({
        ...execution,
        status,
        result: null,
        nowMs: now,
      });
    },
  };
}

describe('durable active specialist settlement', () => {
  it.each(['conformance', 'issued', 'inspect'] as const)(
    'honors durable cancellation during awaited %s before the next effect',
    async (boundary) => {
      const f = await setup(301000, {
        conformance: boundary === 'conformance' ? () => cancel() : undefined,
        issued: boundary === 'issued' ? () => cancel() : undefined,
      });
      const coordinator = WorkflowCancellationCoordinator.createForTest({
        store: f.store,
        contract: f.contract,
        clock: () => 1000,
        port: OfficialCancellationCleanupPort.createForTest({
          stopOwnedWork: async () => ({ stopped: false, incomplete: ['active specialist'] }),
          cleanupPreparedEffects: async () => ({ incomplete: [] }),
        }),
        fault: (point) => {
          if (point === 'after_request_commit') throw new Error('durable stop recorded');
        },
      });
      const cancel = async () => {
        await expect(
          coordinator.cancel({
            id: 'durable-stop',
            runId: 'run',
            requestedBy: 'owner',
            reason: 'stop during launch',
            stopDeadlineMs: 2000,
            retainedEvidence: [],
            ownerId: 'owner',
            workspaceLeaseEpoch: f.execution.workspaceLeaseEpoch,
            runLeaseEpoch: f.execution.runLeaseEpoch,
          }),
        ).rejects.toThrow('durable stop recorded');
      };
      let stopped = false;
      f.intercept(async (args) => {
        if (boundary === 'inspect' && args[0] === 'inspect' && !stopped) {
          stopped = true;
          await cancel();
        }
        return undefined;
      });
      await expect(f.launcher.launch(f.packet, f.reservation)).rejects.toThrow(/cancelled|closed/);
      expect(f.store.getWorkflowCancellation('run')?.status).toBe('requested');
      expect(f.calls.some((call) => call[0] === 'start')).toBe(false);
      if (boundary !== 'inspect') expect(f.calls.some((call) => call[0] === 'create')).toBe(false);
      if (boundary === 'conformance') expect(f.staged).toBeUndefined();
      else expect(f.revoked).toBe(true);
    },
  );

  it.each(['invalidated', 'pending'])(
    'denies credential issuance after snapshot authority becomes %s',
    async (state) => {
      const f = await setup();
      const issue = vi.spyOn(f.broker, 'issue');
      const stage = f.store.stageApprovedDocuments.bind(f.store);
      vi.spyOn(f.store, 'stageApprovedDocuments').mockImplementation((input) => {
        stage(input);
        const db = new Database(f.database);
        if (state === 'invalidated')
          db.prepare("UPDATE plan_approvals SET status='invalidated'").run();
        else
          db.exec(`INSERT INTO planning_document_attempts
        (id,run_id,task_id,approval_id,material_digest,manifest_digest,boundary,owner_id,run_lease_epoch,status,created_at_ms,deadline_ms)
        SELECT 'peer-pending',run_id,task_id,approval_id,material_digest,manifest_digest,'peer','peer',NULL,'pending',1000,31000
        FROM planning_document_attempts WHERE approval_id NOT LIKE 'candidate:%' LIMIT 1`);
        db.close();
      });
      await expect(f.launcher.launch(f.packet, f.reservation)).rejects.toThrow(
        state === 'invalidated' ? 'document_approval_required' : 'document_verification_unresolved',
      );
      // Entry was reached, but the effect provider never received an issue request.
      expect(issue).toHaveBeenCalledOnce();
      expect(f.staged).toBeUndefined();
      expect(f.calls.some((call) => ['create', 'start'].includes(call[0]!))).toBe(false);
    },
  );

  it('pins identity, confirms removal/revocation and returns staged source with an unrestricted reservation deadline', async () => {
    const f = await setup();
    const result = (await f.launcher.launch(f.packet, f.reservation)) as {
      retainedWorkspaceRoot: string;
    };
    expect(await readFile(join(result.retainedWorkspaceRoot, 'safe.txt'), 'utf8')).toBe('original');
    expect(f.calls.find((c) => c[0] === 'start')).toEqual(['start', '--attach', containerId]);
    expect(f.timeouts[f.calls.findIndex((c) => c[0] === 'start')]).toBe(300000);
    expect(f.calls[0]).toContain(`io.agent-platform.specialist-execution=${executionId}`);
    expect(f.store.getSchedulerContainer(executionId)?.status).toBe('removal_confirmed');
    expect(f.revoked).toBe(true);
    expect(await f.launcher.waitForSettlement(f.reservation)).toBe(true);
    expect(f.finish('completed').status).toBe('completed');
  });

  it.each(['malformed', 'extra', 'lost'])(
    'keeps %s acknowledgement unresolved when absent, then positively reconciles late create after restart',
    async (fault) => {
      const f = await setup();
      f.intercept(async (args) => {
        if (args[0] !== 'create') return undefined;
        if (fault === 'lost') throw new Error('lost acknowledgement');
        return { stdout: fault === 'extra' ? `${containerId}\nextra` : 'invalid', stderr: '' };
      });
      await expect(f.launcher.launch(f.packet, f.reservation)).rejects.toThrow(
        'settlement unconfirmed',
      );
      expect(f.calls.some((c) => c[0] === 'start')).toBe(false);
      expect(f.store.getSchedulerContainer(executionId)?.status).toBe('create_pending');
      expect(await stat(f.staged!)).toBeDefined();
      expect(f.revoked).toBe(true);
      expect(await f.launcher.waitForSettlement(f.reservation)).toBe(false);
      const restart = new WorkflowStore(f.database);
      try {
        const recovered = f.makeLauncher('owner', restart);
        expect(await recovered.waitForSettlement(f.reservation)).toBe(false);
        await expect(recovered.cancelProcessIdentity(f.execution.processIdentity)).rejects.toThrow(
          'ambiguous',
        );
        f.setPresent(true);
        await recovered.cancelProcessIdentity(f.execution.processIdentity);
        expect(await recovered.waitForSettlement(f.reservation)).toBe(true);
        expect(f.calls.filter((c) => c[0] === 'create')).toHaveLength(1);
      } finally {
        restart.close();
      }
    },
  );

  it.each(['id', 'name', 'owner'])(
    'never starts/removes a container with substituted %s',
    async (field) => {
      const f = await setup();
      f.intercept(async (args) =>
        args[0] === 'inspect'
          ? {
              stdout: JSON.stringify({
                ...JSON.parse(f.owned()),
                [field]: field === 'id' ? 'd'.repeat(64) : 'foreign',
              }),
              stderr: '',
            }
          : undefined,
      );
      await expect(f.launcher.launch(f.packet, f.reservation)).rejects.toThrow('unconfirmed');
      expect(f.calls.some((c) => c[0] === 'rm' || c[0] === 'start')).toBe(false);
      expect(f.revoked).toBe(true);
      expect(await stat(f.staged!)).toBeDefined();
    },
  );

  it.each(['exact', 'wrong_id', 'wrong_code', 'extra_diagnostic'])(
    'accepts Docker 29 absence only with exact identity and status: %s',
    async (fault) => {
      const f = await setup();
      let removing = false;
      f.intercept(async (args) => {
        if (args[0] === 'rm') removing = true;
        if (args[0] === 'inspect' && removing)
          throw Object.assign(new Error('Docker 29 absence'), {
            code: fault === 'wrong_code' ? 2 : 1,
            stderr: `error: no such object: ${fault === 'wrong_id' ? 'foreign' : containerId}\n${fault === 'extra_diagnostic' ? 'daemon unavailable\n' : ''}`,
          });
        return undefined;
      });
      if (fault === 'exact') {
        await expect(f.launcher.launch(f.packet, f.reservation)).resolves.toBeDefined();
        expect(f.store.getSchedulerContainer(executionId)?.status).toBe('removal_confirmed');
        expect(await f.launcher.waitForSettlement(f.reservation)).toBe(true);
      } else {
        await expect(f.launcher.launch(f.packet, f.reservation)).rejects.toThrow('unconfirmed');
        expect(f.store.getSchedulerContainer(executionId)?.status).toBe('acknowledged');
        expect(await f.launcher.waitForSettlement(f.reservation)).toBe(false);
        expect(await stat(f.staged!)).toBeDefined();
      }
      expect(f.revoked).toBe(true);
    },
  );

  it.each(['remove', 'inspect', 'wrong_absence'])(
    'retains staging and capacity after %s uncertainty',
    async (fault) => {
      const f = await setup();
      let removing = false;
      f.intercept(async (args) => {
        if (args[0] === 'rm') {
          removing = true;
          if (fault === 'remove') throw new Error('remove failed');
        }
        if (args[0] === 'inspect' && removing && fault !== 'remove')
          throw fault === 'wrong_absence' ? f.absent('foreign') : new Error('daemon down');
        return undefined;
      });
      await expect(f.launcher.launch(f.packet, f.reservation)).rejects.toThrow('unconfirmed');
      expect(f.revoked).toBe(true);
      expect(await stat(f.staged!)).toBeDefined();
      expect(await f.launcher.waitForSettlement(f.reservation)).toBe(false);
      for (const status of ['completed', 'cancelled', 'escalated'] as const)
        expect(() => f.finish(status)).toThrow('container settlement');
      expect(f.store.getSchedulerExecution(executionId)?.status).toBe('active');
    },
  );

  it('attempts cleanup independently when revocation fails and exposes no workspace', async () => {
    const f = await setup();
    f.setRevokeFails(true);
    await expect(f.launcher.launch(f.packet, f.reservation)).rejects.toThrow('unconfirmed');
    expect(f.store.getSchedulerContainer(executionId)?.status).toBe('removal_confirmed');
    expect(await f.launcher.waitForSettlement(f.reservation)).toBe(false);
    expect(await stat(f.staged!)).toBeDefined();
    expect(() => f.finish('cancelled')).toThrow('credential revocation');
  });

  it('settles never-dispatched cancellation without inventing a container ID', async () => {
    const f = await setup();
    await f.launcher.cancel(f.reservation);
    await expect(f.launcher.launch(f.packet, f.reservation)).rejects.toThrow('cancelled');
    expect(f.calls).toHaveLength(0);
    expect(f.store.getSchedulerContainer(executionId)).toMatchObject({
      status: 'not_dispatched',
      containerId: null,
    });
    expect(await f.launcher.waitForSettlement(f.reservation)).toBe(true);
    expect(f.finish('cancelled').status).toBe('cancelled');
  });

  it('fails closed on legacy unknown state after reconstruction', async () => {
    const f = await setup();
    const db = new Database(f.database);
    db.prepare('DELETE FROM scheduler_containers WHERE execution_id = ?').run(executionId);
    db.close();
    await f.launcher.revokeCredential(executionId);
    expect(await f.makeLauncher().waitForSettlement(f.reservation)).toBe(false);
    await expect(f.launcher.cancel(f.reservation)).rejects.toThrow('unknown');
    expect(() => f.finish('cancelled')).toThrow('container settlement');
    expect(f.calls).toHaveLength(0);
  });

  it('rejects capability forgery, replay, identity substitution and stale fences', async () => {
    const f = await setup();
    expect(() =>
      f.store.advanceSchedulerContainer({
        execution: f.execution,
        from: 'not_dispatched',
        to: 'create_pending',
        nowMs: 1000,
      }),
    ).toThrow('capability');
    f.advance('not_dispatched', 'create_pending');
    expect(() => f.advance('not_dispatched', 'create_pending')).toThrow('replayed');
    expect(() => f.advance('create_pending', 'acknowledged', 'bad')).toThrow('invalid');
    f.advance('create_pending', 'acknowledged', containerId);
    expect(() => f.advance('acknowledged', 'removal_confirmed', 'd'.repeat(64))).toThrow('changed');
    f.setNow(122000);
    expect(() => f.advance('acknowledged', 'removal_confirmed')).toThrow('expired');
  });

  it.each(['inspect', 'rm', 'revoke'])(
    'rejects expired authority during %s and reconciles as a newly adopted owner',
    async (boundary) => {
      const f = await setup();
      let expired = false;
      const expire = () => {
        if (!expired) {
          expired = true;
          f.setNow(122000);
        }
      };
      if (boundary === 'revoke') f.onRevoke(expire);
      else
        f.intercept(async (args) => {
          if (args[0] === boundary) expire();
          return undefined;
        });
      await expect(f.launcher.launch(f.packet, f.reservation)).rejects.toThrow();
      expect(f.store.getSchedulerExecution(executionId)?.status).toBe('active');
      expect(f.revoked).toBe(true);
      const workspace = f.store.acquireLease(
        'workspace',
        f.execution.workspaceId,
        'successor',
        120000,
        122000,
      );
      const adopted = f.store.adoptSchedulerExecution({
        id: executionId,
        ownerId: 'successor',
        workspaceLeaseEpoch: workspace.epoch,
        runLeaseTtlMs: 120000,
        taskLeaseTtlMs: 120000,
        nowMs: 122000,
      })!;
      await expect(f.launcher.cancel(f.reservation)).rejects.toThrow('owner changed');
      const successor = f.makeLauncher('successor');
      await successor.cancelProcessIdentity(adopted.processIdentity);
      expect(await successor.waitForSettlement(f.reservation)).toBe(true);
      expect(f.calls.filter((c) => c[0] === 'create')).toHaveLength(1);
      expect(
        f.store.finishSchedulerExecution({
          ...adopted,
          status: 'cancelled',
          result: null,
          nowMs: 122000,
        }).status,
      ).toBe('cancelled');
    },
  );

  it('rejects a takeover during removal before recording stale-owner settlement', async () => {
    const f = await setup();
    let adopted: ReturnType<typeof f.store.adoptSchedulerExecution>;
    f.intercept(async (args) => {
      if (args[0] === 'rm' && adopted === undefined) {
        f.setNow(122000);
        const workspace = f.store.acquireLease(
          'workspace',
          f.execution.workspaceId,
          'successor',
          120000,
          122000,
        );
        adopted = f.store.adoptSchedulerExecution({
          id: executionId,
          ownerId: 'successor',
          workspaceLeaseEpoch: workspace.epoch,
          runLeaseTtlMs: 120000,
          taskLeaseTtlMs: 120000,
          nowMs: 122000,
        });
      }
      return undefined;
    });
    await expect(f.launcher.launch(f.packet, f.reservation)).rejects.toThrow('unconfirmed');
    expect(f.store.getSchedulerContainer(executionId)?.status).toBe('acknowledged');
    expect(await stat(f.staged!)).toBeDefined();
    await f.makeLauncher('successor').cancelProcessIdentity(adopted!.processIdentity);
    expect(f.store.getSchedulerContainer(executionId)?.status).toBe('removal_confirmed');
  });

  it('reconciles confirmed external removal after its journal write loses acknowledgement', async () => {
    const f = await setup();
    const advance = f.store.advanceSchedulerContainer.bind(f.store);
    let dropped = false;
    vi.spyOn(f.store, 'advanceSchedulerContainer').mockImplementation(
      (input, capability, clock) => {
        if (input.to === 'removal_confirmed' && !dropped) {
          dropped = true;
          advance(input, capability, clock);
          throw new Error('lost journal acknowledgement');
        }
        return advance(input, capability, clock);
      },
    );
    await expect(f.launcher.launch(f.packet, f.reservation)).rejects.toThrow(
      'lost journal acknowledgement',
    );
    expect(f.revoked).toBe(true);
    expect(await f.makeLauncher().waitForSettlement(f.reservation)).toBe(true);
    expect(f.calls.filter((c) => c[0] === 'create')).toHaveLength(1);
    expect(f.calls.filter((c) => c[0] === 'rm')).toHaveLength(1);
  });

  it.each(['create', 'start', 'rm'])(
    'withholds success when cancelled at %s boundary',
    async (boundary) => {
      const f = await setup();
      let cancellation: Promise<void> | undefined;
      f.intercept(async (args) => {
        if (args[0] === boundary && cancellation === undefined) {
          cancellation = f.launcher.cancel(f.reservation);
          void cancellation.catch(() => undefined);
        }
        return undefined;
      });
      await expect(f.launcher.launch(f.packet, f.reservation)).rejects.toThrow();
      await cancellation?.catch(() => undefined);
      expect(f.revoked).toBe(true);
      expect(await f.launcher.waitForSettlement(f.reservation)).toBe(true);
      if (boundary === 'create') expect(f.calls.some((c) => c[0] === 'start')).toBe(false);
    },
  );

  it('checks deadline again after create without starting an expired reservation', async () => {
    const f = await setup(1100);
    f.intercept(async (args) => {
      if (args[0] === 'create') f.setNow(1100);
      return undefined;
    });
    await expect(f.launcher.launch(f.packet, f.reservation)).rejects.toThrow('timed out');
    expect(f.calls.some((c) => c[0] === 'start')).toBe(false);
    expect(await f.launcher.waitForSettlement(f.reservation)).toBe(true);
  });

  it('obtains the immediate writer reservation before sampling default transition time', async () => {
    const f = await setup();
    const peer = new Database(f.database, { timeout: 0 });
    let peerCode: unknown;
    vi.spyOn(Date, 'now').mockImplementationOnce(() => {
      try {
        peer.prepare('UPDATE schema_migrations SET applied_at_ms = 0 WHERE version = 16').run();
      } catch (error) {
        peerCode = (error as { code: string }).code;
      }
      return 122000;
    });
    try {
      expect(() =>
        f.store.advanceSchedulerContainer(
          { execution: f.execution, from: 'not_dispatched', to: 'create_pending' },
          workflowContainerJournalCapability,
        ),
      ).toThrow('expired');
      expect(peerCode).toBe('SQLITE_BUSY');
      expect(f.store.getSchedulerContainer(executionId)?.status).toBe('not_dispatched');
    } finally {
      peer.close();
    }
  });

  it('passes a deferred launcher clock so expiry at writer acquisition prevents create', async () => {
    const f = await setup();
    const peer = new Database(f.database, { timeout: 0 });
    const advance = f.store.advanceSchedulerContainer.bind(f.store);
    let peerCode: unknown;
    vi.spyOn(f.store, 'advanceSchedulerContainer').mockImplementation(
      (input, capability, clock) => {
        expect(input.nowMs).toBeUndefined();
        expect(clock).toBeTypeOf('function');
        return advance(input, capability, () => {
          try {
            peer.prepare('UPDATE schema_migrations SET applied_at_ms = 0 WHERE version = 16').run();
          } catch (error) {
            peerCode = (error as { code: string }).code;
          }
          f.setNow(122000);
          return clock!();
        });
      },
    );
    try {
      await expect(f.launcher.launch(f.packet, f.reservation)).rejects.toThrow('expired');
      expect(peerCode).toBe('SQLITE_BUSY');
      expect(f.calls).toHaveLength(0);
      expect(f.store.getSchedulerContainer(executionId)?.status).toBe('not_dispatched');
      expect(f.revoked).toBe(true);
    } finally {
      peer.close();
    }
  });

  it('rejects dispatch when its deadline expires under the writer lock with leases still valid', async () => {
    const f = await setup(1100);
    const peer = new Database(f.database, { timeout: 0 });
    const advance = f.store.advanceSchedulerContainer.bind(f.store);
    let peerCode: unknown;
    vi.spyOn(f.store, 'advanceSchedulerContainer').mockImplementation((input, capability, clock) =>
      advance(input, capability, () => {
        try {
          peer.prepare('UPDATE schema_migrations SET applied_at_ms = 0 WHERE version = 16').run();
        } catch (error) {
          peerCode = (error as { code: string }).code;
        }
        f.setNow(1100);
        return clock!();
      }),
    );
    try {
      await expect(f.launcher.launch(f.packet, f.reservation)).rejects.toThrow('timed out');
      expect(peerCode).toBe('SQLITE_BUSY');
      expect(f.calls).toHaveLength(0);
      expect(f.store.getSchedulerContainer(executionId)?.status).toBe('not_dispatched');
      expect(f.revoked).toBe(true);
      expect(await f.launcher.waitForSettlement(f.reservation)).toBe(true);
    } finally {
      peer.close();
    }
  });
});
