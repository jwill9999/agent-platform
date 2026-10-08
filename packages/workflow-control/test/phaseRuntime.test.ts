import { LocalGitDeliveryPort } from '../src/gitDeliveryPort.js';
import { TrustedSourceGit } from '../src/sourceGit.js';
import { execFile } from 'node:child_process';
import { mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import Database from 'better-sqlite3';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { InterruptionCleanupJournal } from '../src/executionInterruptions.js';
import { SecureEvidenceVault } from '../src/secureEvidence.js';
import { ContinuationJournal } from '../src/continuationJournal.js';
import { runParentContinuation } from '../src/continuationProcess.js';
import { executionContractSchema, type ExecutionContract } from '../src/contracts.js';
import { digestGovernedValue } from '../src/governedOperations.js';
import { deriveContractMaterialDigest } from '../src/planning.js';
import { assertContractRevisionIsNotAuthorityExpansion } from '../src/lifecycle.js';
import { PhaseJobJournal, phaseActionForCallback } from '../src/phaseJobs.js';
import { StandalonePhaseRuntime, readPhaseRuntimeConfig } from '../src/phaseRuntime.js';
import {
  DockerIsolatedSpecialistLauncher,
  RevocableSpecialistCredentialBroker,
} from '../src/specialistLauncher.js';
import { continuationFixture, terminalResult } from './continuationFixture.js';
import {
  WorkflowStore,
  workflowContainerJournalCapability,
  workflowGovernedPersistenceCapability,
} from '../src/storage.js';
import { schedulerDockerFixture } from './schedulerDockerFixture.js';
import {
  specialistInputEnvelopeSchema,
  type SpecialistInputEnvelope,
} from '../src/specialistInput.js';

const execute = promisify(execFile);
const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
});

async function setup(
  options: {
    roles?: boolean;
    implementation?: boolean;
    implementationContent?: string;
    delayMs?: number;
    result?: unknown;
    sourceFailure?: boolean;
    review?: boolean;
    healthFailure?: boolean;
    revokeFailure?: boolean;
    removeFailure?: boolean;
    issueFailure?: boolean;
    issueDelayMs?: number;
    createDelayMs?: number;
    revokeDelayMs?: number;
    admission?: () => Promise<void>;
    assertAdmission?: () => void;
    onFatal?: () => void;
    verifySource?: () => Promise<void>;
    executionLimits?: ExecutionContract['executionLimits'];
  } = {},
) {
  const f = await continuationFixture(
    Date.now(),
    options.implementation ? 'feature_planner' : 'implementation_worker',
    terminalResult,
    options.implementation,
  );
  const db = new Database(f.database);
  const row = db.prepare('SELECT body_json FROM contracts').get() as { body_json: string };
  const contract: ExecutionContract = executionContractSchema.parse(JSON.parse(row.body_json));
  if (options.executionLimits) contract.executionLimits = options.executionLimits;
  contract.authority.allowedActions.push('artifact.write', 'workspace.read', 'process.test');
  contract.tasks[0]!.allowedOperations.push('artifact.write', 'workspace.read', 'process.test');
  if (options.implementation) {
    contract.tasks[0]!.assignedRole = 'implementation_worker';
    contract.authority.allowedActions.push('workspace.patch', 'git.commit');
    contract.tasks[0]!.allowedOperations.push('workspace.patch', 'git.commit');
  }
  if (options.roles !== false)
    contract.tasks[0]!.phaseRoles = {
      task_verification: 'test_runner',
      task_review: 'code_reviewer',
    };
  db.prepare('UPDATE contracts SET body_json = ?').run(
    JSON.stringify(executionContractSchema.parse(contract)),
  );
  const materialDigest = deriveContractMaterialDigest(contract);
  db.prepare('UPDATE plan_approvals SET material_digest = ?').run(materialDigest);
  const initialState = options.implementation
    ? 'repair_planning'
    : options.review
      ? 'task_verification'
      : 'implementing';
  db.prepare('UPDATE runs SET state = ?').run(initialState);
  const { callbackId, approvalIntent, ...original } = f.callback;
  void callbackId;
  void approvalIntent;
  const identity = {
    ...original,
    materialDigest,
    parentState: initialState,
    terminalStatus: 'continue' as const,
  };
  const callback = { ...identity, callbackId: digestGovernedValue(identity) };
  f.store.seedApprovedTaskHeadForTest({
    workspaceId: contract.workspaceId,
    runId: 'run',
    taskId: 'task',
    headSha: callback.headSha,
  });
  f.store.finishSchedulerExecution({
    id: 'child',
    status: 'completed',
    ownerId: 'owner',
    workspaceLeaseEpoch: 1,
    runLeaseEpoch: 1,
    taskLeaseEpoch: 1,
    result: terminalResult,
    callback,
  });
  const continuation = new ContinuationJournal(f.database);
  const parent = continuation.claim('host', 60_000, Date.now())!;
  continuation.start(parent.id, parent.host_execution_id!, parent.lease_epoch, Date.now());
  continuation.consume(
    parent.id,
    parent.host_execution_id!,
    parent.lease_epoch,
    phaseActionForCallback(callback),
    Date.now(),
  );
  const journal = new PhaseJobJournal(f.database);
  const sourceRoot = await realpath(join(f.root, 'source'));
  const sourceFile = join(sourceRoot, 'packages/workflow-control/example.txt');
  await mkdir(dirname(sourceFile), { recursive: true });
  if (!options.implementation) await writeFile(sourceFile, 'source');
  const credentials = new Map<string, 'active' | 'revoked'>();
  const revocationSawInterruption: boolean[] = [];
  const brokerState = {
    healthFailure: options.healthFailure ?? false,
    revokeFailure: options.revokeFailure ?? false,
  };
  const credentialBroker = (store: WorkflowStore) =>
    RevocableSpecialistCredentialBroker.createForTest({
      store,
      conformance: async () => 'generation-one',
      health: async () => {
        if (brokerState.healthFailure) throw new Error('offline');
        return 'generation-one';
      },
      issue: async (root, _executionId, leaseId, generation) => {
        const authFile = join(root, 'codex-auth.json');
        credentials.set(leaseId, 'active');
        if (options.issueDelayMs)
          await new Promise((resolve) => setTimeout(resolve, options.issueDelayMs));
        await writeFile(authFile, '{}', { flag: 'wx' });
        if (options.issueFailure) throw new Error('lost_issuance_reply');
        return { authFile, leaseId, generation };
      },
      revoke: async (leaseId) => {
        revocationSawInterruption.push(
          (
            db
              .prepare("SELECT COUNT(*) AS n FROM execution_interruptions WHERE run_id='run'")
              .get() as { n: number }
          ).n > 0,
        );
        if (brokerState.revokeFailure) throw new Error('offline');
        if (options.revokeDelayMs)
          await new Promise((resolve) => setTimeout(resolve, options.revokeDelayMs));
        credentials.set(leaseId, 'revoked');
      },
      observe: async (leaseId) => credentials.get(leaseId) ?? 'revoked',
    });
  const launches: string[][] = [];
  const prompts: SpecialistInputEnvelope[] = [];
  const staging: string[] = [];
  const transports: ReturnType<typeof schedulerDockerFixture>[] = [];
  const makeLauncher = (store: WorkflowStore, ownerId = 'owner') =>
    DockerIsolatedSpecialistLauncher.createForTest({
      store,
      ownerId,
      sourceRoot,
      executionSourceRoot: (runId) => store.getImplementationWorkspace(runId, sourceRoot),
      image: 'fixture@sha256:' + 'a'.repeat(64),
      credentialBroker: credentialBroker(store),
      egressNetwork: 'fixture-egress',
      containerUser: `${process.getuid!()}:${process.getgid!()}`,
      executor: (() => {
        const transport = schedulerDockerFixture(async (_binary, args, settings) => {
          expect(settings.env).toEqual({});
          launches.push([...args]);
          if (args[0] === 'rm' && options.removeFailure)
            throw new Error('fixture_removal_unavailable');
          if (args[0] === 'create') {
            if (options.createDelayMs)
              await new Promise((resolve) => setTimeout(resolve, options.createDelayMs));
            const mount = args.find((arg) => /:\/workspace:(?:ro|rw)$/u.test(arg))!;
            staging.push(dirname(mount.slice(0, -':/workspace:rw'.length)));
            const promptMount = args.find((arg) => arg.endsWith(':/run/specialist/prompt.txt:ro'))!;
            prompts.push(
              specialistInputEnvelopeSchema.parse(
                JSON.parse(
                  await readFile(
                    promptMount.slice(0, -':/run/specialist/prompt.txt:ro'.length),
                    'utf8',
                  ),
                ).input,
              ),
            );
            return { stdout: 'fixture-container', stderr: '' };
          }
          if (args[0] === 'start') {
            if (options.implementation)
              await writeFile(
                join(staging.at(-1)!, 'workspace/packages/workflow-control/example.txt'),
                options.implementationContent ?? 'verified worker change',
              );
            // Real child transport, with fixture terminal data; this is NOT real Docker/Codex conformance.
            return execute(
              process.execPath,
              [
                '-e',
                'setTimeout(() => process.stdout.write(process.argv[1]), Number(process.argv[2]))',
                JSON.stringify({
                  type: 'item.completed',
                  item: {
                    type: 'agent_message',
                    text: JSON.stringify(
                      options.result ?? {
                        ...terminalResult,
                        changedFiles: options.implementation
                          ? ['packages/workflow-control/example.txt']
                          : [],
                        recommendedTransition:
                          prompts.at(-1)?.task.assignedRole === 'code_reviewer'
                            ? 'integrate'
                            : 'continue',
                      },
                    ),
                  },
                }),
                String(options.delayMs ?? 0),
              ],
              { env: {}, timeout: 15000, signal: settings.signal },
            );
          }
          return { stdout: 'false', stderr: '' };
        });
        transports.push(transport);
        return transport.executor;
      })(),
    });
  const launcher = makeLauncher(f.store);
  const config = readPhaseRuntimeConfig({
    runId: 'run',
    sourceRoot,
    gitBinary: process.env.WORKFLOW_GIT_BINARY ?? '/usr/bin/git',
    image: 'fixture@sha256:' + 'a'.repeat(64),
    credentialBrokerBinary: '/fixture/credentials',
    egressNetwork: 'fixture-egress',
    containerUser: `${process.getuid!()}:${process.getgid!()}`,
    leaseTtlMs: options.implementation ? 60000 : 5000,
  });
  const runtime = StandalonePhaseRuntime.createForTest({
    store: f.store,
    journal,
    launcher,
    config,
    owner: 'owner',
    process: {
      pid: process.pid,
      startTimeMs: 1,
      executableDigest: digestGovernedValue('fixture-process'),
    },
    admission: options.admission,
    assertAdmission: options.assertAdmission,
    onFatal: options.onFatal,
    verifySource: async () => {
      await options.verifySource?.();
      if (options.sourceFailure) throw new Error('source changed');
    },
  });
  cleanups.push(async () => {
    await runtime.close();
    continuation.close();
    for (const row of db.prepare('SELECT workspace_root FROM implementation_workspaces').all() as {
      workspace_root: string;
    }[])
      await rm(dirname(row.workspace_root), { recursive: true, force: true });
    db.close();
    await Promise.all(staging.map((root) => rm(root, { recursive: true, force: true })));
    await rm(f.root, { recursive: true, force: true });
  });
  return {
    ...f,
    callback,
    db,
    continuation,
    journal,
    runtime,
    launches,
    credentials,
    revocationSawInterruption,
    brokerState,
    config,
    launcher,
    prompts,
    makeLauncher,
    transports,
  };
}

describe('standalone phase runtime production orchestration with fixture launcher transport', () => {
  it('charges governed child execution and reports settlement separately from reserved allowance', async () => {
    const f = await setup({
      executionLimits: { aggregateActiveSeconds: 3600, attemptSeconds: 5, cleanupSeconds: 15 },
    });
    expect(await f.runtime.runOnce()).toBe(true);
    expect(f.store.getRunExecutionBudget('run')).toMatchObject({
      charged_ms: 20000,
      status: 'active',
    });
    const rows = f.db.prepare('SELECT * FROM run_execution_reservations').all() as Array<{
      work_deadline_ms: number;
      reserved_at_ms: number;
      settled_at_ms: number;
      measured_elapsed_ms: number;
    }>;
    expect(rows).toHaveLength(1);
    expect(rows[0]!.work_deadline_ms - rows[0]!.reserved_at_ms).toBe(5000);
    expect(rows[0]!.settled_at_ms).toBeGreaterThanOrEqual(rows[0]!.reserved_at_ms);
    expect(rows[0]!.measured_elapsed_ms).toBeLessThan(20000);
    expect(f.launches.some((args) => args[0] === 'start')).toBe(true);
  });

  it('consumes startup allowance without creating a container after delayed credential issue', async () => {
    const f = await setup({
      issueDelayMs: 1400,
      executionLimits: { aggregateActiveSeconds: 3600, attemptSeconds: 1, cleanupSeconds: 15 },
    });
    expect(await f.runtime.runOnce()).toBe(false);
    expect(f.launches.some((args) => args[0] === 'create')).toBe(false);
    expect(f.store.getRunExecutionBudget('run')?.charged_ms).toBe(16000);
    expect([...f.credentials.values()].every((status) => status === 'revoked')).toBe(true);
  });

  it('interrupts the actual child transport at its persisted work deadline and rejects late results', async () => {
    const f = await setup({
      delayMs: 4000,
      executionLimits: { aggregateActiveSeconds: 3600, attemptSeconds: 1, cleanupSeconds: 15 },
    });
    expect(await f.runtime.runOnce()).toBe(false);
    expect(f.revocationSawInterruption).toContain(true);
    const child = f.db
      .prepare("SELECT status,credential_status FROM scheduler_executions WHERE role='test_runner'")
      .get();
    expect(child).toMatchObject({ credential_status: 'revoked' });
    expect(f.store.getRunExecutionBudget('run')?.charged_ms).toBe(16000);
    expect(
      f.journal
        .interruptions()
        .list('run')
        .every((row) => row.state === 'settled'),
    ).toBe(true);
  });

  it('persists an exhaustion fence before a second governed phase can launch', async () => {
    const f = await setup({
      executionLimits: { aggregateActiveSeconds: 16, attemptSeconds: 1, cleanupSeconds: 15 },
    });
    expect(await f.runtime.runOnce()).toBe(true);
    const nextParent = f.continuation.claim('host', 60000, Date.now())!;
    runParentContinuation([
      f.database,
      nextParent.id,
      nextParent.host_execution_id!,
      String(nextParent.lease_epoch),
    ]);
    const before = f.launches.filter((args) => args[0] === 'create').length;
    await f.runtime.runOnce();
    expect(f.launches.filter((args) => args[0] === 'create')).toHaveLength(before);
    expect(f.store.getRunExecutionBudget('run')).toMatchObject({
      charged_ms: 16000,
      status: 'exhausted',
    });
  });
  it.each(['resume', 'expired'] as const)(
    'reconciles retained import %s under a new owner without relaunching the worker',
    async (mode) => {
      const f = await setup({ implementation: true });
      const original = SecureEvidenceVault.prototype.recordSpecialistResult;
      let held = false;
      let release!: () => void;
      let reached!: () => void;
      const barrier = new Promise<void>((resolve) => {
        release = resolve;
      });
      const ready = new Promise<void>((resolve) => {
        reached = resolve;
      });
      const spy = vi
        .spyOn(SecureEvidenceVault.prototype, 'recordSpecialistResult')
        .mockImplementation(async function (this: SecureEvidenceVault, input) {
          const parsed = JSON.parse(Buffer.from(input.content).toString('utf8'));
          if (parsed.terminal && !parsed.kind && !held) {
            held = true;
            reached();
            await barrier;
          }
          return original.call(this, input);
        });
      const running = f.runtime.runOnce();
      await ready;
      f.db.prepare("UPDATE phase_jobs SET lease_until_ms=0 WHERE status='started'").run();
      const replacement = StandalonePhaseRuntime.createForTest({
        store: f.store,
        journal: f.journal,
        launcher: f.makeLauncher(f.store, 'replacement'),
        config: f.config,
        owner: 'replacement',
        process: {
          pid: process.pid,
          startTimeMs: 2,
          executableDigest: digestGovernedValue('replacement'),
        },
        verifySource: async (action) => {
          const head = await execute(f.config.gitBinary, [
            '-C',
            f.store.getImplementationWorkspace('run', f.config.sourceRoot),
            'rev-parse',
            'HEAD',
          ]);
          expect(head.stdout.trim()).toBe(action.headSha);
        },
      });
      try {
        await replacement.runOnce();
        expect(f.journal.list()[0]).toMatchObject({
          status: 'started',
          failure_code: 'phase_coordinator_waiting_for_owner',
        });
        expect(
          f.db.prepare('SELECT COUNT(*) AS n FROM coordinator_recovery_attempts').get(),
        ).toEqual({ n: 0 });
        expect(f.launches.filter((args) => args[0] === 'start')).toHaveLength(1);
        f.db.prepare('UPDATE leases SET expires_at_ms=0').run();
        f.db.prepare("UPDATE phase_jobs SET lease_until_ms=0 WHERE status='started'").run();
        if (mode === 'expired')
          f.db
            .prepare(
              "UPDATE scheduler_executions SET deadline_ms=0 WHERE role='implementation_worker'",
            )
            .run();
        await replacement.runOnce();
        if (mode === 'expired') {
          expect(f.journal.list()[0]?.status).toBe('blocked');
          expect(
            f.db
              .prepare("SELECT COUNT(*) AS n FROM scheduler_executions WHERE status='active'")
              .get(),
          ).toEqual({ n: 0 });
          expect(f.db.prepare('SELECT status FROM implementation_imports').get()).toEqual({
            status: 'verified',
          });
          expect(f.db.prepare('SELECT state FROM execution_interruptions').get()).toEqual({
            state: 'settled',
          });
          expect(f.launches.filter((args) => args[0] === 'start')).toHaveLength(1);
          return;
        }
        expect(f.store.getRun('run')?.state).toBe('task_verification');
        expect(f.journal.list()[0]?.status).toBe('completed');
        expect(f.launches.filter((args) => args[0] === 'start')).toHaveLength(1);
        expect(f.db.prepare('SELECT owner_id FROM implementation_import_recoveries').get()).toEqual(
          {
            owner_id: 'replacement',
          },
        );
      } finally {
        release();
        await running;
        spy.mockRestore();
        await replacement.close();
      }
    },
    15000,
  );
  it.each(['admission', 'sync-admission', 'cleanup-only'])(
    'does not resume import or commit callbacks when recovery is denied: %s',
    async (denial) => {
      const f = await setup({ implementation: true });
      const original = SecureEvidenceVault.prototype.recordSpecialistResult;
      let held = false;
      let release!: () => void;
      let reached!: () => void;
      const barrier = new Promise<void>((resolve) => {
        release = resolve;
      });
      const ready = new Promise<void>((resolve) => {
        reached = resolve;
      });
      const spy = vi
        .spyOn(SecureEvidenceVault.prototype, 'recordSpecialistResult')
        .mockImplementation(async function (this: SecureEvidenceVault, input) {
          const parsed = JSON.parse(Buffer.from(input.content).toString('utf8'));
          if (parsed.terminal && !parsed.kind && !held) {
            held = true;
            reached();
            await barrier;
          }
          return original.call(this, input);
        });
      const running = f.runtime.runOnce();
      await ready;
      f.db.prepare('UPDATE leases SET expires_at_ms=0').run();
      f.db.prepare("UPDATE phase_jobs SET lease_until_ms=0 WHERE status='started'").run();
      const replacement = StandalonePhaseRuntime.createForTest({
        store: f.store,
        journal: f.journal,
        launcher: f.makeLauncher(f.store, 'replacement'),
        config: f.config,
        owner: 'replacement',
        cleanupOnly: denial === 'cleanup-only',
        admission: async () => {
          if (denial === 'admission') throw new Error('not_ready');
        },
        assertAdmission: () => {
          if (denial === 'sync-admission') throw new Error('not_ready');
        },
        process: {
          pid: process.pid,
          startTimeMs: 2,
          executableDigest: digestGovernedValue('replacement'),
        },
        verifySource: async (action) => {
          const head = await execute(f.config.gitBinary, [
            '-C',
            f.config.sourceRoot,
            'rev-parse',
            'HEAD',
          ]);
          expect(head.stdout.trim()).toBe(action.headSha);
        },
      });
      try {
        await replacement.runOnce();
        expect(f.store.getRun('run')?.state).toBe('implementing');
        expect(f.journal.list()[0]?.status).toBe('blocked');
        expect(f.launches.filter((args) => args[0] === 'start')).toHaveLength(1);
        expect(
          f.db.prepare('SELECT COUNT(*) AS n FROM implementation_import_recoveries').get(),
        ).toEqual({ n: 0 });
        expect(f.db.prepare('SELECT COUNT(*) AS n FROM delegate_callbacks').get()).toEqual({
          n: 1,
        });
      } finally {
        release();
        await running;
        spy.mockRestore();
        await replacement.close();
      }
    },
  );
  it('renews live import fences across synchronous work longer than the initial lease without extending execution deadline', async () => {
    const f = await setup({ implementation: true });
    const originalImport = WorkflowStore.prototype.importImplementation;
    const originalGit = TrustedSourceGit.prototype.run;
    let elapsed = 0;
    const spy = vi
      .spyOn(WorkflowStore.prototype, 'importImplementation')
      .mockImplementation(function (this: WorkflowStore, input) {
        const began = Date.now();
        const deadline = this.getSchedulerExecution(input.authority.id)!.deadlineMs;
        f.db.prepare('UPDATE leases SET expires_at_ms=?').run(began + 1000);
        f.db
          .prepare("UPDATE phase_jobs SET lease_until_ms=? WHERE status='started'")
          .run(began + 1000);
        const now = vi.spyOn(Date, 'now').mockImplementation(() => began + elapsed);
        const git = vi.spyOn(TrustedSourceGit.prototype, 'run').mockImplementation(function (
          this: TrustedSourceGit,
          args,
          bytes,
          index,
        ) {
          elapsed += 80;
          return originalGit.call(this, args, bytes, index);
        });
        try {
          const receipt = originalImport.call(this, { ...input, renewLeaseTtlMs: 1000 });
          expect(elapsed).toBeGreaterThan(1000);
          expect(this.getSchedulerExecution(input.authority.id)!.deadlineMs).toBe(deadline);
          return receipt;
        } finally {
          now.mockRestore();
          git.mockRestore();
        }
      });
    try {
      const progressed = await f.runtime.runOnce();
      expect(progressed, JSON.stringify(f.journal.list())).toBe(true);
    } finally {
      spy.mockRestore();
    }
  });
  it.each(['before-files', 'before-ref'])(
    'rechecks production import authority at mutation boundaries: %s',
    async (boundary) => {
      const f = await setup({ implementation: true });
      const base = (
        await execute(f.config.gitBinary, ['-C', f.config.sourceRoot, 'rev-parse', 'HEAD'])
      ).stdout.trim();
      const originalImport = WorkflowStore.prototype.importImplementation;
      const originalGit = TrustedSourceGit.prototype.run;
      const originalClean = TrustedSourceGit.prototype.assertClean;
      let cleanCount = 0;
      const importSpy = vi
        .spyOn(WorkflowStore.prototype, 'importImplementation')
        .mockImplementation(function (this: WorkflowStore, input) {
          const deadline = this.getSchedulerExecution(input.authority.id)!.deadlineMs;
          let expired = false;
          const realNow = Date.now.bind(Date);
          const now = vi
            .spyOn(Date, 'now')
            .mockImplementation(() => (expired ? deadline + 1 : realNow()));
          const clean = vi
            .spyOn(TrustedSourceGit.prototype, 'assertClean')
            .mockImplementation(function (this: TrustedSourceGit, paths) {
              originalClean.call(this, paths);
              if (
                boundary === 'before-files' &&
                this.root !== input.sourceRoot &&
                ++cleanCount === 2
              )
                expired = true;
            });
          const git = vi.spyOn(TrustedSourceGit.prototype, 'run').mockImplementation(function (
            this: TrustedSourceGit,
            args,
            bytes,
            index,
          ) {
            const result = originalGit.call(this, args, bytes, index);
            if (boundary === 'before-ref' && args[0] === 'read-tree' && index === undefined)
              expired = true;
            return result;
          });
          try {
            return originalImport.call(this, input);
          } finally {
            now.mockRestore();
            git.mockRestore();
            clean.mockRestore();
          }
        });
      try {
        expect(await f.runtime.runOnce()).toBe(false);
        expect(
          (
            await execute(f.config.gitBinary, ['-C', f.config.sourceRoot, 'rev-parse', 'HEAD'])
          ).stdout.trim(),
        ).toBe(base);
        expect(f.db.prepare('SELECT current_sha FROM delivery_approved_heads').get()).toEqual({
          current_sha: base,
        });
        expect(f.db.prepare('SELECT COUNT(*) AS n FROM delegate_callbacks').get()).toEqual({
          n: 1,
        });
        expect(f.db.prepare('SELECT status FROM implementation_imports').get()).toEqual({
          status: 'prepared',
        });
        if (boundary === 'before-files')
          expect(
            await readFile(
              join(f.config.sourceRoot, 'packages/workflow-control/example.txt'),
              'utf8',
            ),
          ).not.toBe('verified worker change');
      } finally {
        importSpy.mockRestore();
      }
    },
  );
  it('retains ordinary long code identifiers and string literals without entropy false positives', async () => {
    const content =
      'export const abcdefghijklmnopqrstuvwxyz = "https://example.test/abcdefghijklmnopqrstuvwxyz";';
    const f = await setup({ implementation: true, implementationContent: content });
    expect(await f.runtime.runOnce()).toBe(true);
    expect(
      await readFile(
        join(
          f.store.getImplementationWorkspace('run', f.config.sourceRoot),
          'packages/workflow-control/example.txt',
        ),
        'utf8',
      ),
    ).toBe(content);
  }, 15000);
  it('rejects source containing a secret assignment before importing', async () => {
    const f = await setup({
      implementation: true,
      implementationContent: 'const api_key = "abcdef1234567890secretvalue";',
    });
    expect(await f.runtime.runOnce()).toBe(false);
    expect(
      await readFile(join(f.config.sourceRoot, 'packages/workflow-control/example.txt'), 'utf8'),
    ).toBe('fixture source');
    expect(f.db.prepare('SELECT COUNT(*) AS count FROM implementation_imports').get()).toEqual({
      count: 0,
    });
  }, 15000);
  it('imports actual worker bytes and commits a changed-head callback before verification', async () => {
    const f = await setup({ implementation: true });
    const previous = f.db.prepare('SELECT current_sha FROM delivery_approved_heads').get() as {
      current_sha: string;
    };
    f.db.prepare('UPDATE delivery_approved_heads SET published_sha=current_sha').run();
    expect(await f.runtime.runOnce()).toBe(true);
    expect(f.store.getRun('run')?.state).toBe('task_verification');
    expect(
      await readFile(
        join(
          f.store.getImplementationWorkspace('run', f.config.sourceRoot),
          'packages/workflow-control/example.txt',
        ),
        'utf8',
      ),
    ).toBe('verified worker change');
    expect(
      await readFile(join(f.config.sourceRoot, 'packages/workflow-control/example.txt'), 'utf8'),
    ).toBe('fixture source');
    const imported = f.db
      .prepare('SELECT base_head,result_head,status FROM implementation_imports')
      .get() as { base_head: string; result_head: string; status: string };
    expect(imported.status).toBe('verified');
    expect(f.db.prepare('SELECT published_sha FROM delivery_approved_heads').get()).toEqual({
      published_sha: previous.current_sha,
    });
    expect(imported.result_head).not.toBe(imported.base_head);
    expect(
      f.db.prepare('SELECT current_sha,import_execution_id FROM delivery_approved_heads').get(),
    ).toEqual({ current_sha: imported.result_head, import_execution_id: expect.any(String) });
  });
  it('publishes private-only objects with remote CAS and reconciles a lost acknowledgement', async () => {
    const f = await setup({ implementation: true });
    expect(await f.runtime.runOnce()).toBe(true);
    const owned = f.store.getImplementationWorkspace('run', f.config.sourceRoot);
    const local = new TrustedSourceGit(owned, f.config.gitBinary);
    const source = new TrustedSourceGit(f.config.sourceRoot, f.config.gitBinary);
    const base = source.run(['rev-parse', 'HEAD']).toString().trim();
    const head = local.run(['rev-parse', 'HEAD']).toString().trim();
    expect(() => source.run(['cat-file', '-e', head])).toThrow();
    const remote = join(f.root, 'disposable-remote.git');
    source.run(['init', '--bare', '--quiet', remote]);
    source.run(['push', '--quiet', remote, `HEAD:refs/heads/task/task`]);
    const remoteGit = new TrustedSourceGit(await realpath(remote), f.config.gitBinary);
    let pushes = 0;
    const port = LocalGitDeliveryPort.createForWorkflow({
      store: f.store,
      runId: 'run',
      workspaceRoot: f.config.sourceRoot,
      gitPin: local.pin,
      remoteName: 'origin',
      remote: {
        observeRef: async (input) => remoteGit.run(['rev-parse', input.ref]).toString().trim(),
        pushCas: async (input) => {
          expect(input.objectSourceRoot).toBe(owned);
          local.run([
            'push',
            '--quiet',
            `--force-with-lease=${input.ref}:${input.expectedOldSha ?? ''}`,
            remote,
            `${input.newSha}:${input.ref}`,
          ]);
          if (++pushes === 1) throw new Error('lost acknowledgement');
        },
      },
    });
    const request = {
      kind: 'git.push' as const,
      workspaceId: f.callback.workspaceId,
      runId: 'run',
      taskId: 'task',
      repository: 'o/r',
      actorRole: 'workflow_orchestrator' as const,
      contractVersion: 1 as const,
      policyDigest: f.callback.policyDigest,
      ref: 'refs/heads/task/task',
      expectedRemoteSha: base,
      newSha: head,
    };
    await expect(port.mutate(request)).rejects.toThrow('lost acknowledgement');
    expect(await port.observe(request)).toMatchObject({ kind: 'expected', result: { sha: head } });
    expect(pushes).toBe(1);
    expect(source.run(['rev-parse', 'HEAD']).toString().trim()).toBe(base);
    expect(
      await readFile(join(f.config.sourceRoot, 'packages/workflow-control/example.txt'), 'utf8'),
    ).toBe('fixture source');
    const tree = local
      .run(['rev-parse', `${base}^{tree}`])
      .toString()
      .trim();
    const competing = local
      .run(['commit-tree', tree, '-p', base, '-m', 'competing remote change'])
      .toString()
      .trim();
    local.run(['push', '--quiet', remote, `${competing}:refs/heads/task/other`]);
    remoteGit.run(['update-ref', request.ref, competing, head]);
    await expect(port.mutate(request)).rejects.toThrow();
    expect(remoteGit.run(['rev-parse', request.ref]).toString().trim()).toBe(competing);
  }, 15000);
  it.each([
    [
      'failed criterion',
      { acceptanceCriteria: { passed: ['durable'], failed: ['durable'] } },
      'escalated',
    ],
    ['omitted criterion', { acceptanceCriteria: { passed: [], failed: [] } }, 'escalated'],
    [
      'unapproved criterion',
      { acceptanceCriteria: { passed: ['durable', 'extra'], failed: [] } },
      'escalated',
    ],
    [
      'unresolved finding',
      {
        findings: [
          {
            id: 'finding',
            severity: 'low',
            summary: 'unresolved',
            evidence: [
              {
                digest: `sha256:${'a'.repeat(64)}`,
                mediaType: 'text/plain',
                sizeBytes: 1,
                kind: 'review',
              },
            ],
          },
        ],
      },
      'escalated',
    ],
    ['remaining risk', { remainingRisks: ['unresolved risk'] }, 'escalated'],
    ['repair status with integrate intent', { status: 'needs_repair' }, 'escalated'],
    ['blocked status with integrate intent', { status: 'blocked' }, 'escalated'],
    [
      'passed status with continue review intent',
      { recommendedTransition: 'continue' },
      'escalated',
    ],
    ['passed status with repair intent', { recommendedTransition: 'repair' }, 'escalated'],
    ['passed status with escalation intent', { recommendedTransition: 'escalate' }, 'escalated'],
  ] as const)('never accepts review with %s', async (_name, override, expected) => {
    const f = await setup({
      review: true,
      result: { ...terminalResult, recommendedTransition: 'integrate', ...override },
    });
    expect(await f.runtime.runOnce()).toBe(true);
    expect(f.store.getRun('run')?.state).toBe(expected);
    expect(f.store.getRun('run')?.state).not.toBe('task_accepted');
    expect(f.journal.list()[0]?.status).toBe('completed');
  });

  it.each([
    ['changed head', 'b'.repeat(40), 'owner'],
    ['replacement owner', 'a'.repeat(40), 'replacement'],
    ['changed head and replacement owner', 'b'.repeat(40), 'replacement'],
  ])(
    'binds repeated verification input to %s without reusing evidence',
    async (_name, headSha, owner) => {
      const f = await setup();
      expect(await f.runtime.runOnce()).toBe(true);
      const firstJob = f.journal.list()[0]!;
      const firstPrompt = f.prompts[0]!;
      await f.runtime.close();
      const store = new WorkflowStore(f.database);
      const journal = new PhaseJobJournal(f.database);
      // Seed a completed, separately-authorized repair as a test fixture; its callback is committed normally.
      f.db.prepare('UPDATE leases SET expires_at_ms = 0').run();
      const workspaceEpoch = store.acquireLease(
        'workspace',
        f.callback.workspaceId,
        owner,
        60_000,
      ).epoch;
      const runEpoch = store.acquireLease('run', 'run', owner, 60_000).epoch;
      const taskEpoch = store.acquireLease('task', 'task', owner, 60_000).epoch;
      f.db.prepare("UPDATE runs SET state = 'implementing', version = 3").run();
      store.seedApprovedTaskHeadForTest({
        workspaceId: f.callback.workspaceId,
        runId: 'run',
        taskId: 'task',
        headSha,
      });
      const repairResult = { ...terminalResult, summary: 'repair completed at next approved head' };
      const artifacts = store.seedDelegateCallbackAuthorizationForTest({
        workspaceId: f.callback.workspaceId,
        runId: 'run',
        taskId: 'task',
        delegationId: 'repair-child',
        delegateAgentId: 'repair-process',
        delegateRole: 'implementation_worker',
        ownerId: owner,
        workspaceLeaseEpoch: workspaceEpoch,
        runLeaseEpoch: runEpoch,
        taskLeaseEpoch: taskEpoch,
        materialDigest: f.callback.materialDigest,
        headSha,
        inputProducerIdentity: 'orchestrator',
        input: { repair: true },
        result: repairResult,
        nowMs: Date.now(),
      });
      const { callbackId, ...prior } = f.callback;
      void callbackId;
      const identity = {
        ...prior,
        parentState: 'implementing',
        parentRunVersion: 3,
        delegationId: 'repair-child',
        delegateAgentId: 'repair-process',
        resultProducerIdentity: 'repair-process',
        headSha,
        workspaceLeaseEpoch: workspaceEpoch,
        parentRunLeaseEpoch: runEpoch,
        taskLeaseEpoch: taskEpoch,
        ...artifacts,
      };
      store.finishSchedulerExecution({
        id: 'repair-child',
        status: 'completed',
        ownerId: owner,
        workspaceLeaseEpoch: workspaceEpoch,
        runLeaseEpoch: runEpoch,
        taskLeaseEpoch: taskEpoch,
        result: repairResult,
        callback: { ...identity, callbackId: digestGovernedValue(identity) },
      });
      for (let count = 0; count < 3; count += 1) {
        const parent = f.continuation.claim('host', 60_000, Date.now());
        if (parent === undefined) break;
        runParentContinuation([
          f.database,
          parent.id,
          parent.host_execution_id!,
          String(parent.lease_epoch),
        ]);
      }
      const replacement = StandalonePhaseRuntime.createForTest({
        store,
        journal,
        launcher: f.makeLauncher(store, owner),
        config: f.config,
        owner,
        process: {
          pid: process.pid,
          startTimeMs: 2,
          executableDigest: digestGovernedValue('replacement-process'),
        },
        verifySource: async () => undefined,
      });
      try {
        expect(await replacement.runOnce()).toBe(true);
        expect(await replacement.runOnce()).toBe(false);
        const secondPrompt = f.prompts[1]!;
        expect(secondPrompt.task).toEqual({
          ...firstPrompt.task,
          documentBinding: {
            ...firstPrompt.task.documentBinding,
            approvalId: 'fixture:repair-child',
          },
        });
        expect(secondPrompt.binding.headSha).toBe(headSha);
        expect(secondPrompt.binding.ownerDigest).toBe(digestGovernedValue(owner));
        expect(digestGovernedValue(secondPrompt)).not.toBe(digestGovernedValue(firstPrompt));
        expect(f.launches.filter((args) => args[0] === 'start')).toHaveLength(2);
        const completed = journal.list().filter((job) => job.status === 'completed');
        expect(completed).toHaveLength(2);
        expect(new Set(completed.map((job) => job.execution_id)).size).toBe(2);
        for (const [job, prompt] of [
          [firstJob, firstPrompt],
          [completed.find((job) => job.id !== firstJob.id)!, secondPrompt],
        ] as const) {
          expect(store.getSchedulerExecution(job.execution_id!)?.packet).toEqual(prompt);
          const evidence = store.getSecureEvidence(digestGovernedValue(prompt), 'run', 'task');
          expect(evidence?.headSha).toBe(prompt.binding.headSha);
          expect(digestGovernedValue(evidence?.producer)).toBe(prompt.binding.ownerDigest);
          const callback = f.db
            .prepare(
              "SELECT callback_json FROM delegate_callbacks WHERE json_extract(callback_json, '$.delegationId') = ?",
            )
            .get(job.execution_id!) as { callback_json: string };
          expect(JSON.parse(callback.callback_json).inputArtifactDigest).toBe(
            digestGovernedValue(prompt),
          );
        }
      } finally {
        await replacement.close();
      }
    },
  );

  it('executes verification then independent review through durable callbacks and exact evidence', async () => {
    const f = await setup();
    const completed = await f.runtime.runOnce();
    expect(completed, JSON.stringify(f.journal.list())).toBe(true);
    expect(f.store.getRun('run')?.state).toBe('task_review');
    const nextParent = f.continuation.claim('host', 60_000, Date.now())!;
    runParentContinuation([
      f.database,
      nextParent.id,
      nextParent.host_execution_id!,
      String(nextParent.lease_epoch),
    ]);
    expect(await f.runtime.runOnce()).toBe(true);
    expect(f.store.getRun('run')?.state).toBe('task_accepted');
    expect(f.journal.list().map((job) => job.status)).toEqual(['completed', 'completed']);
    expect(f.launches.filter((args) => args[0] === 'start')).toHaveLength(2);
    expect([...f.credentials.values()]).toEqual(['revoked', 'revoked']);
    const evidence = f.db
      .prepare(
        "SELECT producer, producer_role, head_sha FROM secure_evidence WHERE producer_role IN ('test_runner', 'code_reviewer')",
      )
      .all();
    expect(evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ producer_role: 'test_runner', head_sha: 'a'.repeat(40) }),
        expect.objectContaining({ producer_role: 'code_reviewer', head_sha: 'a'.repeat(40) }),
      ]),
    );
    for (const job of f.journal.list()) expect(job.execution_id).toMatch(/^[a-f0-9-]{36}$/u);
  });

  it('renews phase and resource leases across a specialist exceeding the initial TTL', async () => {
    const f = await setup({ delayMs: 6500 });
    expect(await f.runtime.runOnce()).toBe(true);
    expect(f.journal.list()[0]?.status).toBe('completed');
  }, 15000);

  it.each([{ roles: false }, { sourceFailure: true }])(
    'fails missing role or source authority before launch: %j',
    async (options) => {
      const f = await setup(options);
      expect(await f.runtime.runOnce()).toBe(false);
      expect(f.journal.list()[0]?.status).toBe('blocked');
      expect(f.launches).toEqual([]);
    },
  );

  it('persists repair callback and queues no fake passing result', async () => {
    const f = await setup({
      result: {
        ...terminalResult,
        status: 'needs_repair',
        recommendedTransition: 'repair',
        findings: [
          {
            id: 'fixture-repair',
            severity: 'high',
            summary: 'verification failed',
            evidence: [
              {
                digest: 'sha256:' + 'a'.repeat(64),
                mediaType: 'text/plain',
                sizeBytes: 1,
                kind: 'test',
              },
            ],
            repairHypothesis: 'Correct the failing bounded implementation',
          },
        ],
      },
    });
    expect(await f.runtime.runOnce()).toBe(true);
    expect(f.store.getRun('run')?.state).toBe('repair');
  });

  it('blocks a non-actionable repair result before queuing an infrastructure retry', async () => {
    const f = await setup({
      result: { ...terminalResult, status: 'needs_repair', recommendedTransition: 'repair' },
    });
    expect(await f.runtime.runOnce()).toBe(true);
    expect(f.store.getRun('run')?.state).toBe('escalated');
    expect(f.db.prepare('SELECT COUNT(*) AS n FROM repair_dispatches').get()).toEqual({ n: 0 });
  });

  it('persists broker interruption even while credential revocation is unavailable', async () => {
    const f = await setup({ delayMs: 2500 });
    const work = f.runtime.runOnce();
    while (!f.launches.some((args) => args[0] === 'start'))
      await new Promise((resolve) => setTimeout(resolve, 10));
    f.brokerState.healthFailure = true;
    f.brokerState.revokeFailure = true;
    await new Promise((resolve) => setTimeout(resolve, 2200));
    expect(f.journal.interruptions().list('run')[0]).toMatchObject({
      reason: 'control_unavailable',
      state: 'pending',
      revoke: 0,
    });
    expect(await work).toBe(false);
    expect(f.journal.list()[0]?.status).toBe('started');
    expect(f.store.getRun('run')?.state).toBe('task_verification');
    f.brokerState.healthFailure = false;
    f.brokerState.revokeFailure = false;
    f.db
      .prepare("UPDATE leases SET owner_id='competing-owner',expires_at_ms=?")
      .run(Date.now() + 60000);
    await new Promise((resolve) => setTimeout(resolve, 2100));
    expect(await f.runtime.runOnce()).toBe(false);
    expect(f.journal.list()[0]?.status).toBe('blocked');
    expect(f.journal.interruptions().list('run')[0]).toMatchObject({
      state: 'settled',
      reason: 'control_unavailable',
    });
    expect(f.launches.filter((args) => args[0] === 'start')).toHaveLength(1);
  }, 15000);

  it('rejects invalid structured output and settles/revokes before marking blocked', async () => {
    const f = await setup({ result: { summary: 'not a valid result' } });
    expect(await f.runtime.runOnce()).toBe(false);
    expect(f.journal.list()[0]?.status).toBe('blocked');
    expect([...f.credentials.values()]).toEqual(['revoked']);
    expect(f.launches.some((args) => args[0] === 'rm')).toBe(true);
  });

  it('never dispatches started work again after a restart without an execution record', async () => {
    const f = await setup();
    const past = Date.now() - 100;
    const claim = f.journal.claim('lost', 1, past)!;
    f.journal.start(claim, past);
    expect(await f.runtime.runOnce()).toBe(false);
    expect(f.journal.list()[0]?.status).toBe('blocked');
    expect(f.launches).toEqual([]);
  });

  it('recovers an interrupted scheduler by removing, observing, and revoking before terminal bookkeeping', async () => {
    const f = await setup();
    const past = Date.now() - 100;
    const claim = f.journal.claim('lost', 1, past)!;
    const started = f.journal.start(claim, past);
    f.store.createSchedulerExecution({
      id: started.execution_id!,
      workspaceId: f.callback.workspaceId,
      runId: 'run',
      taskId: 'task',
      role: 'test_runner',
      mode: 'read_only',
      deadlineMs: Date.now() + 60_000,
      ownerId: 'owner',
      workspaceLeaseEpoch: 1,
      runLeaseEpoch: 1,
      taskLeaseEpoch: 1,
      processIdentity: `docker:workflow-specialist-${started.execution_id}`,
      credentialLeaseId: `specialist:${started.execution_id}`,
      packet: { fixture: true },
    });
    const execution = f.store.getSchedulerExecution(started.execution_id!)!;
    const containerId = f.transports[0]!.register(execution.id);
    f.store.advanceSchedulerContainer(
      { execution, from: 'not_dispatched', to: 'create_pending' },
      workflowContainerJournalCapability,
    );
    f.store.advanceSchedulerContainer(
      { execution, from: 'create_pending', to: 'acknowledged', containerId },
      workflowContainerJournalCapability,
    );
    expect(await f.runtime.runOnce()).toBe(false);
    expect(f.store.getSchedulerExecution(started.execution_id!)?.status).toBe('escalated');
    expect(f.store.getSchedulerExecution(started.execution_id!)?.credentialStatus).toBe('revoked');
    expect(f.launches).toContainEqual(['rm', '--force', containerId]);
    expect(f.transports[0]!.calls.map((args) => args[0])).toContain('inspect');
    expect(f.store.getSchedulerContainer(execution.id)?.status).toBe('removal_confirmed');
    expect(f.launches.map((args) => args[0])).not.toContain('start');
    expect(f.journal.get(started.id)?.status).toBe('blocked');
  });

  it('cannot add phase role authority through an automatic contract revision', async () => {
    const f = await setup({ roles: false });
    const before = f.store.getExecutionContract('run');
    const after = structuredClone(before);
    after.tasks[0]!.phaseRoles = { task_verification: 'test_runner' };
    expect(deriveContractMaterialDigest(after)).not.toBe(deriveContractMaterialDigest(before));
    expect(() => assertContractRevisionIsNotAuthorityExpansion(before, after)).toThrow(
      /phase role authority/,
    );
  });

  it('validates explicit standalone prerequisites and leaves desktop conformance separate', async () => {
    expect(() => readPhaseRuntimeConfig(undefined)).toThrow('standalone_runtime_config_missing');
    expect(() => readPhaseRuntimeConfig({})).toThrow('standalone_credential_broker_missing');
    expect(() => readPhaseRuntimeConfig({ credentialBrokerBinary: '/missing' })).toThrow(
      'standalone_specialist_image_missing',
    );
    const cli = fileURLToPath(new URL('../dist/cli.js', import.meta.url));
    await expect(
      execute(process.execPath, [cli, 'standalone-conformance'], {
        env: { NODE_ENV: 'production' },
      }),
    ).rejects.toMatchObject({
      stderr: expect.stringContaining('standalone_runtime_config_missing'),
    });
    await expect(
      execute(process.execPath, [cli, 'host-conformance'], { env: { NODE_ENV: 'production' } }),
    ).rejects.toMatchObject({ stderr: expect.stringContaining('host_resume_unavailable') });
    expect(
      await readFile(fileURLToPath(new URL('../src/cli.ts', import.meta.url)), 'utf8'),
    ).toContain('StandalonePhaseRuntime.create');
  });
});

it('rechecks admission after source preparation before credential issuance and dispatch', async () => {
  let available = true;
  const f = await setup({
    admission: async () => {
      if (!available) throw new Error('control_unavailable');
    },
    verifySource: async () => {
      available = false;
    },
  });
  expect(await f.runtime.runOnce()).toBe(false);
  expect(f.launches.some((args) => args[0] === 'start' || args[0] === 'create')).toBe(false);
  expect(f.credentials.size).toBe(0);
});

it('reconciles a crash before atomic interrupted finalization without acquiring execution leases', async () => {
  const f = await setup({ result: { invalid: true } });
  vi.spyOn(f.journal, 'finalizeInterrupted').mockImplementationOnce(() => {
    throw new Error('injected_crash');
  });
  await expect(f.runtime.runOnce()).rejects.toThrow('injected_crash');
  expect(f.journal.interruptions().list('run')[0]?.state).toBe('settled');
  f.db.prepare('UPDATE phase_jobs SET lease_until_ms=0').run();
  f.db
    .prepare("UPDATE leases SET owner_id='competing-owner',expires_at_ms=?")
    .run(Date.now() + 60000);
  expect(await f.runtime.runOnce()).toBe(false);
  expect(f.journal.list()[0]?.status).toBe('blocked');
  expect(f.launches.filter((args) => args[0] === 'start')).toHaveLength(1);
});
it('contains the worker and latches admission when interruption persistence fails', async () => {
  const report = vi.fn();
  const f = await setup({ delayMs: 2500, onFatal: report });
  const failure = vi.spyOn(f.journal, 'interrupt').mockImplementation(() => {
    throw new Error('journal_unavailable');
  });
  const work = f.runtime.runOnce();
  const rejected = expect(work).rejects.toThrow('journal_unavailable');
  while (!f.launches.some((args) => args[0] === 'start'))
    await new Promise((resolve) => setTimeout(resolve, 10));
  await expect(f.runtime.interruptActive('service_stopped')).rejects.toThrow('journal_unavailable');
  expect(report).toHaveBeenCalled();
  expect(f.runtime.cleanupStatus()).toBe('journal_unavailable');
  expect(f.brokerState.healthFailure).toBe(false);
  await rejected;
  expect(f.launches.some((args) => args[0] === 'rm')).toBe(true);
  expect([...f.credentials.values()]).toEqual(['revoked']);
  expect(f.journal.interruptions().list('run')).toEqual([]);
  failure.mockRestore();
  await expect(f.runtime.runOnce()).rejects.toThrow('journal_unavailable');
  expect(f.launches.filter((args) => args[0] === 'start')).toHaveLength(1);
}, 10000);

it('bounds shutdown when container removal fails while attach remains outstanding', async () => {
  const f = await setup({ delayMs: 60000, removeFailure: true });
  const work = f.runtime.runOnce();
  while (!f.launches.some((args) => args[0] === 'start'))
    await new Promise((resolve) => setTimeout(resolve, 10));
  const start = Date.now();
  await f.runtime.close();
  expect(Date.now() - start).toBeLessThan(7000);
  expect(await work).toBe(false);
  expect(
    f.db.prepare('SELECT state,cancel,revoke FROM execution_interruptions').get(),
  ).toMatchObject({ state: 'pending', cancel: 0, revoke: 1 });
}, 10000);

it('records ambiguous issuance before compensating revocation within the cleanup budget', async () => {
  const f = await setup({ issueFailure: true });
  expect(await f.runtime.runOnce()).toBe(false);
  expect(f.revocationSawInterruption).toEqual([true]);
  expect(f.journal.interruptions().list('run')[0]).toMatchObject({ state: 'settled', attempt: 1 });
  expect(f.launches.some((args) => args[0] === 'create')).toBe(false);
});

it('seals the credential pathname before a delayed issuance reply can recreate token bytes', async () => {
  const f = await setup({ issueDelayMs: 2500 });
  const work = f.runtime.runOnce();
  while (!f.credentials.size) await new Promise((resolve) => setTimeout(resolve, 10));
  f.brokerState.healthFailure = true;
  expect(await work).toBe(false);
  const interrupted = f.journal.interruptions().list('run')[0]!;
  expect(interrupted.state).toBe('settled');
  expect(interrupted.effects).toBe('uncertain');
  expect(f.runtime.cleanupStatus()).toBe('reconciliation_required');
  const staging = f.store.getSchedulerStaging(interrupted.execution_id)!;
  expect(await readFile(join(staging.root, 'codex-auth.json'))).toHaveLength(0);
  expect(f.launches.some((args) => args[0] === 'create')).toBe(false);
}, 10000);

it('rejects a late credential acknowledgement after cleanup ownership changes', async () => {
  const f = await setup({ delayMs: 10000, revokeDelayMs: 500 });
  const work = f.runtime.runOnce();
  const rejected = expect(work).rejects.toThrow('cleanup_fence_rejected');
  while (!f.launches.some((args) => args[0] === 'start'))
    await new Promise((resolve) => setTimeout(resolve, 10));
  f.brokerState.healthFailure = true;
  while (
    !f.db.prepare("SELECT 1 FROM scheduler_executions WHERE credential_status='revoking'").get()
  )
    await new Promise((resolve) => setTimeout(resolve, 10));
  f.db.prepare("UPDATE execution_interruptions SET owner='replacement',epoch=epoch+1").run();
  await rejected;
  expect(
    f.db.prepare("SELECT credential_status FROM scheduler_executions WHERE id!='child'").get(),
  ).toEqual({ credential_status: 'revoking' });
  expect(f.journal.interruptions().list('run')[0]?.state).toBe('pending');
}, 10000);

it('finishes pending cleanup after the run becomes terminal without advancing it', async () => {
  const f = await setup({ delayMs: 10000, revokeFailure: true });
  const work = f.runtime.runOnce();
  while (!f.launches.some((args) => args[0] === 'start'))
    await new Promise((resolve) => setTimeout(resolve, 10));
  await f.runtime.interruptActive('service_stopped');
  expect(await work).toBe(false);
  f.db.prepare("UPDATE runs SET state='cancelled'").run();
  f.brokerState.revokeFailure = false;
  f.db.prepare('UPDATE execution_interruptions SET next_attempt_ms=0').run();
  expect(await f.runtime.runOnce()).toBe(false);
  expect(f.journal.interruptions().list('run')[0]?.state).toBe('settled');
  expect(f.journal.list()[0]?.status).toBe('blocked');
  expect(f.store.getRun('run')?.state).toBe('cancelled');
  expect(f.launches.filter((args) => args[0] === 'start')).toHaveLength(1);
});

it('preserves committed success when interruption loses the completion race', async () => {
  const f = await setup();
  expect(await f.runtime.runOnce()).toBe(true);
  const completed = f.journal.list().find((job) => job.status === 'completed')!;
  expect(f.journal.interrupt(completed, 'service_stopped', Date.now())).toBe(false);
  expect(f.journal.interruptions().list('run')).toEqual([]);
  expect(f.store.getSchedulerExecution(completed.execution_id!)?.status).toBe('completed');
});

it('reports pending recovery for an orphan whose phase lease has not expired', async () => {
  const f = await setup();
  const claim = f.journal.claim('previous-runtime', 60000, Date.now())!;
  f.journal.start(claim, Date.now());
  expect(f.runtime.cleanupStatus()).toBe('pending');
  expect(await f.runtime.runOnce()).toBe(false);
  expect(f.launches).toEqual([]);
});

it('rejects late success and callback commitment when interruption wins the transaction race', async () => {
  const f = await setup({ delayMs: 10000 });
  const work = f.runtime.runOnce();
  while (!f.launches.some((args) => args[0] === 'start'))
    await new Promise((resolve) => setTimeout(resolve, 10));
  const job = f.journal.list().find((job) => job.status === 'started')!;
  const execution = f.store.getSchedulerExecution(job.execution_id!)!;
  f.journal.interrupt(job, 'service_stopped', Date.now());
  expect(() =>
    f.store.finishSchedulerExecution({
      id: execution.id,
      status: 'completed',
      ownerId: execution.ownerId,
      workspaceLeaseEpoch: execution.workspaceLeaseEpoch,
      runLeaseEpoch: execution.runLeaseEpoch,
      taskLeaseEpoch: execution.taskLeaseEpoch,
      result: terminalResult,
    }),
  ).toThrow('execution_interrupted');
  const identity = {
    ...Object.fromEntries(Object.entries(f.callback).filter(([key]) => key !== 'callbackId')),
    delegationId: execution.id,
  };
  const callback = { ...identity, callbackId: digestGovernedValue(identity) };
  expect(() =>
    f.store.recordDelegateCallbackAndTransition(
      { callback, target: 'task_verification', ownerId: execution.ownerId, nowMs: Date.now() },
      workflowGovernedPersistenceCapability,
    ),
  ).toThrow('execution_interrupted');
  await f.runtime.interruptActive('service_stopped');
  expect(await work).toBe(false);
  expect(f.store.getRun('run')?.state).toBe('task_verification');
  expect(f.launches.filter((args) => args[0] === 'start')).toHaveLength(1);
});

it.each(['cancel', 'revoke', 'settle'] as const)(
  'recovers a crash after the %s effect before its durable acknowledgement',
  async (position) => {
    const f = await setup({ delayMs: 10000 });
    const work = f.runtime.runOnce().catch(() => false);
    while (!f.launches.some((args) => args[0] === 'start'))
      await new Promise((resolve) => setTimeout(resolve, 10));
    const original = InterruptionCleanupJournal.prototype.confirm;
    let injected = false;
    const fault = vi
      .spyOn(InterruptionCleanupJournal.prototype, 'confirm')
      .mockImplementation(function (this: InterruptionCleanupJournal, row, operation, now) {
        if (operation === position && !injected) {
          injected = true;
          throw new Error('injected_crash_before_ack');
        }
        return original.call(this, row, operation, now);
      });
    try {
      await f.runtime.interruptActive('service_stopped').catch(() => undefined);
      await work;
      expect(injected).toBe(true);
    } finally {
      fault.mockRestore();
    }
    f.db.prepare('UPDATE phase_jobs SET lease_until_ms=0').run();
    f.db
      .prepare(
        'UPDATE execution_interruptions SET lease_until_ms=0,attempt_deadline_ms=0,next_attempt_ms=0',
      )
      .run();
    await f.runtime.runOnce();
    expect(f.journal.interruptions().list('run')[0]).toMatchObject({
      state: 'settled',
      cancel: 1,
      revoke: 1,
      settle: 1,
      effects: 'uncertain',
    });
    expect(f.journal.list()[0]?.status).toBe('blocked');
    expect(f.launches.filter((args) => args[0] === 'start')).toHaveLength(1);
    expect(f.store.getRun('run')?.state).toBe('task_verification');
  },
);

it('recovers a persisted pre-reservation interruption without stranding cleanup', async () => {
  const f = await setup();
  const past = Date.now() - 1000;
  const claim = f.journal.claim('lost', 500, past)!;
  const job = f.journal.start(claim, past);
  f.journal.interrupt(job, 'service_stopped', past + 1);
  const reopened = new PhaseJobJournal(f.database);
  try {
    expect(reopened.interruptions().list('run')).toHaveLength(1);
  } finally {
    reopened.close();
  }
  expect(f.store.getSchedulerExecution(job.execution_id!)).toBeUndefined();
  await f.runtime.runOnce();
  expect(f.journal.interruptions().list('run')[0]?.state).toBe('settled');
  expect(f.journal.get(job.id)?.status).toBe('blocked');
  expect(f.launches).toEqual([]);
});

it('keeps a delayed create isolated until acknowledgement, then attaches before start', async () => {
  const f = await setup({ createDelayMs: 300 });
  const work = f.runtime.runOnce();
  while (!f.launches.some((args) => args[0] === 'create'))
    await new Promise((resolve) => setTimeout(resolve, 10));
  const create = f.launches.find((args) => args[0] === 'create')!;
  expect(create[create.indexOf('--network') + 1]).toBe('none');
  expect(f.launches.some((args) => args[0] === 'network' || args[0] === 'start')).toBe(false);
  expect(await work).toBe(true);
  const connect = f.launches.findIndex((args) => args[0] === 'network' && args[1] === 'connect');
  expect(connect).toBeGreaterThan(0);
  expect(f.launches.findIndex((args) => args[0] === 'start')).toBeGreaterThan(connect);
});

it('redacts source verification exceptions before persisting a blocked phase', async () => {
  const f = await setup({
    verifySource: async () => {
      throw new Error('secret-sentinel subprocess stderr');
    },
  });
  expect(await f.runtime.runOnce()).toBe(false);
  expect(f.journal.list()[0]?.failure_code).toBe('phase_source_or_packet_invalid');
  expect(JSON.stringify(f.journal.list())).not.toContain('secret-sentinel');
});

it('bounds credential filesystem settlement and rejects a late completion', async () => {
  const f = await setup({ result: { invalid: true } });
  let release!: () => void;
  let settlementStarted = 0;
  const blocked = vi.spyOn(f.launcher, 'removeInterruptedCredentials').mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        settlementStarted = Date.now();
        release = resolve;
      }),
  );
  expect(await f.runtime.runOnce()).toBe(false);
  expect(Date.now() - settlementStarted).toBeLessThan(6000);
  expect(f.journal.interruptions().list('run')[0]).toMatchObject({ state: 'pending', settle: 0 });
  release();
  await Promise.resolve();
  blocked.mockRestore();
  expect(f.journal.interruptions().list('run')[0]?.settle).toBe(0);
}, 10000);

it('bounds waiting for a held container lock and prevents a late start', async () => {
  let release!: () => void;
  let waiting = false;
  let released = false;
  const f = await setup({
    admission: async () => {
      if (!released && f?.launches.some((args) => args[0] === 'network' && args[1] === 'connect')) {
        waiting = true;
        await new Promise<void>((resolve) => {
          release = resolve;
        });
      }
    },
  });
  const work = f.runtime.runOnce();
  while (!waiting) await new Promise((resolve) => setTimeout(resolve, 10));
  const job = f.journal.list().find((job) => job.status === 'started')!;
  const execution = f.store.getSchedulerExecution(job.execution_id!)!;
  const started = Date.now();
  await expect(
    f.launcher.stopContainer({
      id: execution.id,
      role: execution.role,
      deadlineMs: execution.deadlineMs,
    }),
  ).rejects.toThrow('cleanup_operation_timed_out');
  expect(Date.now() - started).toBeLessThan(6000);
  released = true;
  release();
  expect(await work).toBe(false);
  expect(f.launches.some((args) => args[0] === 'start')).toBe(false);
}, 12000);

it('redacts sensitive exceptions from both background runtime rejection paths', async () => {
  const f = await setup();
  const diagnostics: string[] = [];
  const write = vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
    diagnostics.push(String(chunk));
    return true;
  });
  const tick = vi
    .spyOn(f.runtime, 'runOnce')
    .mockRejectedValue(new Error('secret-sentinel bearer-token'));
  try {
    f.runtime.start();
    await vi.waitFor(() => expect(diagnostics.join('')).toContain('background_tick_failed'), {
      timeout: 2000,
    });
    expect(diagnostics.join('')).toContain('background_start_failed');
    expect(diagnostics.join('')).not.toContain('secret-sentinel');
  } finally {
    await f.runtime.close();
    tick.mockRestore();
    write.mockRestore();
  }
});

it.each(['topology_stale', 'control_unavailable'])(
  'rechecks service admission after synchronous document verification: %s',
  async (code) => {
    let failure: string | undefined;
    const f = await setup({
      assertAdmission: () => {
        if (failure) throw new Error(failure);
      },
    });
    const verify = f.store.verifyApprovedDocumentSnapshot.bind(f.store);
    const spy = vi.spyOn(f.store, 'verifyApprovedDocumentSnapshot').mockImplementation((input) => {
      const result = verify(input);
      if (input.boundary === 'specialist.snapshot_start') failure = code;
      return result;
    });
    try {
      await f.runtime.runOnce();
      expect(failure).toBe(code);
      expect(f.launches.some((args) => args[0] === 'create')).toBe(true);
      expect(f.launches.some((args) => args[0] === 'start')).toBe(false);
      expect(f.journal.interruptions().list('run')).toHaveLength(1);
    } finally {
      spy.mockRestore();
    }
  },
);

it.each(['admission', 'preflight'])(
  'settles a create rejected at %s before Docker was invoked',
  async (boundary) => {
    const current: { value?: Awaited<ReturnType<typeof setup>> } = {};
    const f = await setup({
      assertAdmission: () => {
        const execution = current.value?.store.listActiveSchedulerExecutions(
          current.value.contract.workspaceId,
        )[0];
        if (
          boundary === 'admission' &&
          execution &&
          current.value?.store.getSchedulerContainer(execution.id)?.status === 'create_pending'
        )
          throw new Error('topology_stale');
      },
    });
    current.value = f;
    const verify = f.store.verifyPlanningDocuments.bind(f.store);
    const spy = vi.spyOn(f.store, 'verifyPlanningDocuments').mockImplementation((input) => {
      const execution = f.store.listActiveSchedulerExecutions(f.contract.workspaceId)[0];
      if (
        boundary === 'preflight' &&
        input.boundary === 'specialist.lifecycle' &&
        execution &&
        f.store.getSchedulerContainer(execution.id)?.status === 'create_pending'
      )
        throw new Error('preflight_rejected');
      return verify(input);
    });
    try {
      await f.runtime.runOnce();
    } finally {
      spy.mockRestore();
    }

    expect(f.launches.some((args) => args[0] === 'create')).toBe(false);
    const interrupted = f.journal.interruptions().list('run')[0]!;
    expect(interrupted).toMatchObject({ state: 'settled', cancel: 1, revoke: 1, settle: 1 });
    const observer = new Database(f.database, { readonly: true });
    try {
      expect(
        observer
          .prepare('SELECT status FROM scheduler_containers WHERE execution_id=?')
          .get(interrupted.execution_id),
      ).toEqual({ status: 'not_dispatched' });
    } finally {
      observer.close();
    }
  },
);

it('waits for live predecessor leases without charging retained-handoff recovery or launching a worker', async () => {
  const f = await setup();
  const prior = f.journal.start(f.journal.claim('owner', 60000, Date.now())!, Date.now());
  // A retained handoff selects the planner recovery path. Keep a real scheduler record
  // but deliberately hold resource authority elsewhere; admission must stop before use.
  f.db
    .prepare("UPDATE phase_jobs SET execution_id='child',lease_until_ms=0 WHERE id=?")
    .run(prior.id);
  f.db
    .prepare(
      "UPDATE scheduler_executions SET status='active',role='feature_planner' WHERE id='child'",
    )
    .run();
  f.db
    .prepare(
      "INSERT INTO repair_planning_handoffs VALUES('child','retained-child','{}','{}','retained-result',0)",
    )
    .run();
  const until = Date.now() + 30000;
  f.db.prepare("UPDATE leases SET owner_id='previous-runtime',expires_at_ms=?").run(until);
  expect(await f.runtime.runOnce()).toBe(false);
  expect(f.journal.get(prior.id)).toMatchObject({
    status: 'started',
    failure_code: 'phase_coordinator_waiting_for_owner',
  });
  expect(f.journal.get(prior.id)!.lease_until_ms).toBeGreaterThanOrEqual(until);
  expect(f.db.prepare('SELECT COUNT(*) AS n FROM coordinator_recovery_attempts').get()).toEqual({
    n: 0,
  });
  expect(f.journal.interruptions().list('run')).toEqual([]);
  expect(f.launches).toEqual([]);
});
