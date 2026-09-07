import { execFile } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';

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
import { WorkflowStore } from '../src/storage.js';
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
    delayMs?: number;
    result?: unknown;
    sourceFailure?: boolean;
    review?: boolean;
  } = {},
) {
  const f = await continuationFixture(Date.now(), 'implementation_worker');
  const db = new Database(f.database);
  const row = db.prepare('SELECT body_json FROM contracts').get() as { body_json: string };
  const contract: ExecutionContract = executionContractSchema.parse(JSON.parse(row.body_json));
  contract.authority.allowedActions.push('artifact.write', 'workspace.read', 'process.test');
  contract.tasks[0]!.allowedOperations.push('artifact.write', 'workspace.read', 'process.test');
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
  const initialState = options.review ? 'task_verification' : 'implementing';
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
  const sourceRoot = join(f.root, 'source');
  const sourceFile = join(sourceRoot, 'packages/workflow-control/example.txt');
  await mkdir(dirname(sourceFile), { recursive: true });
  await writeFile(sourceFile, 'source');
  const credentials = new Map<string, 'active' | 'revoked'>();
  const credentialBroker = (store: WorkflowStore) =>
    RevocableSpecialistCredentialBroker.createForTest({
      store,
      conformance: async () => 'generation-one',
      issue: async (root, _executionId, leaseId, generation) => {
        const authFile = join(root, 'auth.json');
        await writeFile(authFile, '{}');
        credentials.set(leaseId, 'active');
        return { authFile, leaseId, generation };
      },
      revoke: async (leaseId) => {
        credentials.set(leaseId, 'revoked');
      },
      observe: async (leaseId) => credentials.get(leaseId) ?? 'revoked',
    });
  const launches: string[][] = [];
  const prompts: SpecialistInputEnvelope[] = [];
  const staging: string[] = [];
  const makeLauncher = (store: WorkflowStore) =>
    DockerIsolatedSpecialistLauncher.createForTest({
      sourceRoot,
      image: 'fixture@sha256:' + 'a'.repeat(64),
      credentialBroker: credentialBroker(store),
      egressNetwork: 'fixture-egress',
      containerUser: '501:20',
      executor: async (_binary, args, settings) => {
        expect(settings.env).toEqual({});
        launches.push([...args]);
        if (args[0] === 'create') {
          const mount = args.find((arg) => arg.endsWith(':/workspace:rw'))!;
          staging.push(dirname(mount.slice(0, -':/workspace:rw'.length)));
          const promptMount = args.find((arg) => arg.endsWith(':/run/specialist/prompt.txt:ro'))!;
          prompts.push(
            specialistInputEnvelopeSchema.parse(
              JSON.parse(
                await readFile(
                  promptMount.slice(0, -':/run/specialist/prompt.txt:ro'.length),
                  'utf8',
                ),
              ),
            ),
          );
          return { stdout: 'fixture-container', stderr: '' };
        }
        if (args[0] === 'start') {
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
            { env: {}, timeout: 5000 },
          );
        }
        return { stdout: 'false', stderr: '' };
      },
    });
  const launcher = makeLauncher(f.store);
  const config = readPhaseRuntimeConfig({
    runId: 'run',
    sourceRoot,
    image: 'fixture@sha256:' + 'a'.repeat(64),
    credentialBrokerBinary: '/fixture/credentials',
    egressNetwork: 'fixture-egress',
    containerUser: '501:20',
    leaseTtlMs: 600,
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
    verifySource: async () => {
      if (options.sourceFailure) throw new Error('source changed');
    },
  });
  cleanups.push(async () => {
    await runtime.close();
    continuation.close();
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
    config,
    launcher,
    prompts,
    makeLauncher,
  };
}

describe('standalone phase runtime production orchestration with fixture launcher transport', () => {
  it.each([
    [
      'failed criterion',
      { acceptanceCriteria: { passed: ['durable'], failed: ['durable'] } },
      'repair',
    ],
    ['omitted criterion', { acceptanceCriteria: { passed: [], failed: [] } }, 'repair'],
    [
      'unapproved criterion',
      { acceptanceCriteria: { passed: ['durable', 'extra'], failed: [] } },
      'repair',
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
      'repair',
    ],
    ['remaining risk', { remainingRisks: ['unresolved risk'] }, 'escalated'],
    ['repair status with integrate intent', { status: 'needs_repair' }, 'repair'],
    ['blocked status with integrate intent', { status: 'blocked' }, 'escalated'],
    ['passed status with continue review intent', { recommendedTransition: 'continue' }, 'repair'],
    ['passed status with repair intent', { recommendedTransition: 'repair' }, 'repair'],
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
        launcher: f.makeLauncher(store),
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
        expect(secondPrompt.task).toEqual(firstPrompt.task);
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
    const f = await setup({ delayMs: 1000 });
    expect(await f.runtime.runOnce()).toBe(true);
    expect(f.journal.list()[0]?.status).toBe('completed');
  });

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
      result: { ...terminalResult, status: 'needs_repair', recommendedTransition: 'repair' },
    });
    expect(await f.runtime.runOnce()).toBe(true);
    expect(f.store.getRun('run')?.state).toBe('repair');
  });

  it('rejects invalid structured output and settles/revokes before marking blocked', async () => {
    const f = await setup({ result: { summary: 'not a valid result' } });
    expect(await f.runtime.runOnce()).toBe(false);
    expect(f.journal.list()[0]?.status).toBe('blocked');
    expect([...f.credentials.values()]).toEqual(['revoked']);
    expect(f.launches.some((args) => args[0] === 'stop')).toBe(true);
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

  it('recovers an interrupted scheduler by stopping, observing, and revoking before terminal bookkeeping', async () => {
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
    expect(await f.runtime.runOnce()).toBe(false);
    expect(f.store.getSchedulerExecution(started.execution_id!)?.status).toBe('escalated');
    expect(f.store.getSchedulerExecution(started.execution_id!)?.credentialStatus).toBe('revoked');
    expect(f.launches.map((args) => args[0])).toContain('stop');
    expect(f.launches.map((args) => args[0])).toContain('inspect');
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
