import { chmod, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';

import {
  PilotConcurrencyController,
  ContentAddressedArtifactStore,
  DockerIsolatedSpecialistLauncher,
  JournaledBeadsDoltBroker,
  JournaledBeadsTaskCloser,
  JournaledArtifactRecorder,
  OfficialBeadsDoltPort,
  LocalExactHeadIntegrationGate,
  RevocableSpecialistCredentialBroker,
  WorkflowOrchestrator,
  WorkflowStore,
  deriveTransitionIdempotencyKey,
  selectBeadsReadyTasks,
  type EvidenceReference,
  type ExecutionContract,
  type OfficialBeadsDoltClient,
  type SpecialistProcessExecutor,
} from '../src/index.js';

const roots: string[] = [];
const digest = `sha256:${'a'.repeat(64)}`;
const evidence: EvidenceReference[] = [
  { digest, mediaType: 'application/json', sizeBytes: 10, kind: 'test' },
];
const contract: ExecutionContract = {
  featureId: 'schedule-feature',
  contractVersion: 1,
  policyDigest: digest,
  workspaceId: `sha256:${'b'.repeat(64)}`,
  objective: 'schedule safely',
  requirements: [],
  nonGoals: [],
  acceptanceCriteria: ['all checks pass'],
  constraints: { architecture: [], security: [], allowedPaths: ['packages/workflow-control'] },
  authority: {
    deliveryTarget: 'staging',
    allowedActions: ['workspace.read', 'workspace.patch', 'process.test', 'beads.mutate'],
    github: {
      repository: 'owner/repository',
      base: 'staging',
      mergeMethod: 'squash',
      requiredChecks: ['test'],
    },
  },
  tasks: [
    {
      id: 'schedule-feature.1',
      dependsOn: [],
      risk: 'standard',
      assignedRole: 'implementation_worker',
      branchParent: 'feature/schedule',
      allowedPaths: ['packages/workflow-control'],
      allowedOperations: ['workspace.patch', 'process.test'],
    },
    {
      id: 'schedule-feature.2',
      dependsOn: ['schedule-feature.1'],
      risk: 'standard',
      assignedRole: 'implementation_worker',
      branchParent: 'task/schedule-feature.1',
      allowedPaths: ['packages/workflow-control'],
      allowedOperations: ['workspace.patch', 'process.test'],
    },
  ],
  qualityGates: ['test'],
  retryPolicy: {
    implementationAttempts: 2,
    findingAttempts: 2,
    infrastructureAttempts: 2,
    waitDeadlineSeconds: 300,
  },
  repairTaskPolicy: {
    idPattern: 'schedule-feature.repair.<sequence>',
    maxChildren: 1,
    allowedRoles: ['implementation_worker'],
    allowedPaths: ['packages/workflow-control'],
    authorityMayExpand: false,
  },
  escalationPolicy: [],
};

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function setup(
  state: 'task_accepted' | 'scheduling' = 'task_accepted',
  options: { executor?: SpecialistProcessExecutor; clock?: () => number } = {},
) {
  const root = await mkdtemp(join(tmpdir(), 'workflow-orchestrator-'));
  roots.push(root);
  const store = new WorkflowStore(join(root, 'workflow.sqlite'));
  const sourceRoot = join(root, 'source');
  const authFile = join(root, 'auth.json');
  await mkdir(join(sourceRoot, 'packages', 'workflow-control'), { recursive: true });
  await Promise.all([
    writeFile(join(sourceRoot, 'packages', 'workflow-control', 'source.ts'), 'export {};\n'),
    writeFile(authFile, '{"access_token":"test-secret-credential"}\n'),
  ]);
  const revokedCredentialLeases: string[] = [];
  const credentialTombstones = new Set<string>();
  const credentialBroker = RevocableSpecialistCredentialBroker.createForTest({
    store,
    issue: async (stagingRoot, _executionId, leaseId, generation) => {
      if (credentialTombstones.has(leaseId)) throw new Error('credential lease is tombstoned');
      const issuedAuthFile = join(stagingRoot, 'codex-auth.json');
      await writeFile(issuedAuthFile, await readFile(authFile), { mode: 0o600 });
      return { authFile: issuedAuthFile, leaseId, generation };
    },
    revoke: async (leaseId) => {
      revokedCredentialLeases.push(leaseId);
      credentialTombstones.add(leaseId);
    },
    observe: async (leaseId) => (credentialTombstones.has(leaseId) ? 'revoked' : 'active'),
    conformance: async () => 'test-generation',
  });
  const contractId = store.createContract(contract);
  store.createRun(contractId, state, 'run-schedule');
  store.recordEvidence({
    ...evidence[0]!,
    producer: 'planner',
    producerRole: 'planner',
    workspaceId: contract.workspaceId,
    runId: 'run-schedule',
    contractVersion: contract.contractVersion,
    policyDigest: contract.policyDigest,
    createdAtMs: 999,
  });
  const closed: string[] = [];
  let issueStatus: 'open' | 'in_progress' | 'closed' =
    state === 'scheduling' ? 'open' : 'in_progress';
  const client: OfficialBeadsDoltClient = {
    async readIssue() {
      return { status: issueStatus, blockingDependencies: [] };
    },
    async claimIssue() {
      issueStatus = 'in_progress';
      return { status: issueStatus };
    },
    async closeIssue(_workspaceRoot, taskId) {
      issueStatus = 'closed';
      closed.push(taskId);
      return { status: issueStatus };
    },
    async readDoltSync() {
      return 'synced';
    },
    async pushDolt() {
      return { status: 'synced' };
    },
  };
  const port = OfficialBeadsDoltPort.createForTest('/repo/root', client);
  const closer = new JournaledBeadsTaskCloser(
    JournaledBeadsDoltBroker.createForTest(store, port, undefined, options.clock ?? (() => 1000)),
    port,
  );
  const executor: SpecialistProcessExecutor =
    options.executor ??
    (async (executable, args) => {
      if (executable === 'git' && args[0] === 'rev-parse') {
        return { stdout: `${'a'.repeat(40)}\n`, stderr: '' };
      }
      if (executable === 'git' && args[0] === 'diff') {
        return { stdout: 'packages/workflow-control/src/orchestrator.ts\n', stderr: '' };
      }
      if (executable === 'git') return { stdout: '', stderr: '' };
      if (args[0] === 'stop' || args[0] === 'rm') return { stdout: '', stderr: '' };
      if (args[0] === 'inspect') return { stdout: 'false\n', stderr: '' };
      if (executable === '/usr/local/bin/docker') {
        if (args[0] === 'create') {
          const workspaceMount = args.find((argument) => argument.endsWith(':/workspace:rw'))!;
          const mountedRoot = workspaceMount.slice(0, -':/workspace:rw'.length);
          await writeFile(
            join(mountedRoot, 'packages/workflow-control/source.ts'),
            'export const retained = true;\n',
          );
          return { stdout: 'container-id\n', stderr: '' };
        }
        return args[0] === 'start'
          ? { stdout: '{"type":"result","status":"launched"}\n', stderr: '' }
          : { stdout: 'container-id\n', stderr: '' };
      }
      return { stdout: 'passed\n', stderr: '' };
    });
  const launcher = DockerIsolatedSpecialistLauncher.createForTest({
    sourceRoot,
    image: 'workflow-codex:test',
    credentialBroker,
    egressNetwork: 'workflow-model-egress',
    containerUser: '501:20',
    executor,
    clock: options.clock ?? (() => 1000),
    cancellationSettleMs: 20,
  });
  const artifacts = new JournaledArtifactRecorder(
    new ContentAddressedArtifactStore(join(root, 'artifacts')),
    store,
  );
  const integrationGate = LocalExactHeadIntegrationGate.createForTest({
    workspaceRoot: sourceRoot,
    artifacts,
    checkCommands: { test: ['pnpm', 'test'] },
    executor: async (executable, args, commandOptions) =>
      executor(executable, args, {
        env: {},
        timeout: commandOptions.timeout,
        maxBuffer: commandOptions.maxBuffer,
      }),
  });
  return {
    root,
    sourceRoot,
    authFile,
    credentialBroker,
    revokedCredentialLeases,
    client,
    store,
    closed,
    closer,
    launcher,
    integrationGate,
    orchestrator: new WorkflowOrchestrator({
      contract,
      store,
      closer,
      launcher,
      integrationGate,
      ownerId: 'owner-1',
      clock: options.clock ?? (() => 1000),
    }),
  };
}

describe('Beads-authoritative scheduling', () => {
  it('rejects a non-journaled task closer', async () => {
    const { store, launcher, integrationGate } = await setup();
    expect(
      () =>
        new WorkflowOrchestrator({
          contract,
          store,
          closer: { closeTask: async () => undefined } as never,
          launcher,
          integrationGate,
          ownerId: 'owner-1',
        }),
    ).toThrow('exclusive journaled Beads task closer');
    store.close();
  });

  it('rejects an in-process specialist launcher', async () => {
    const { store, closer, integrationGate } = await setup();
    expect(
      () =>
        new WorkflowOrchestrator({
          contract,
          store,
          closer,
          launcher: { launch: async () => undefined } as never,
          integrationGate,
          ownerId: 'owner-1',
        }),
    ).toThrow('Docker-isolated');
    store.close();
  });

  it('rejects packet evidence that is bound only to another run', async () => {
    const { store, orchestrator } = await setup();
    const foreignEvidence = {
      digest: `sha256:${'c'.repeat(64)}`,
      mediaType: 'application/json',
      sizeBytes: 12,
      kind: 'review' as const,
    };
    const contractId = store.createContract(contract);
    store.createRun(contractId, 'approved', 'other-run');
    store.recordEvidence({
      ...foreignEvidence,
      producer: 'planner',
      producerRole: 'planner',
      workspaceId: contract.workspaceId,
      runId: 'other-run',
      contractVersion: contract.contractVersion,
      policyDigest: contract.policyDigest,
    });
    expect(() =>
      orchestrator.createTaskPacket({
        runId: 'run-schedule',
        taskId: 'schedule-feature.1',
        evidence: [foreignEvidence],
      }),
    ).toThrow('evidence is not recorded');
    store.close();
  });

  it('schedules only tasks whose complete dependency set is closed', () => {
    expect(
      selectBeadsReadyTasks(contract, [
        { id: 'schedule-feature.1', status: 'open', blockingDependencies: [] },
        {
          id: 'schedule-feature.2',
          status: 'open',
          blockingDependencies: ['schedule-feature.1'],
        },
      ]),
    ).toEqual(['schedule-feature.1']);
    expect(
      selectBeadsReadyTasks(contract, [
        { id: 'schedule-feature.1', status: 'closed', blockingDependencies: [] },
        {
          id: 'schedule-feature.2',
          status: 'open',
          blockingDependencies: ['schedule-feature.1'],
        },
      ]),
    ).toEqual(['schedule-feature.2']);
  });

  it('fences a second orchestrator while the workspace lease is live', async () => {
    const { store, closer, launcher, integrationGate, orchestrator } = await setup();
    expect(orchestrator.acquireWorkspace(100, 1000)).toBe(1);
    const second = new WorkflowOrchestrator({
      contract,
      store,
      closer,
      launcher,
      integrationGate,
      ownerId: 'owner-2',
    });
    expect(() => second.acquireWorkspace(100, 1050)).toThrow('another owner');
    expect(second.acquireWorkspace(100, 1100)).toBe(2);
    store.close();
  });

  it('allows one mutating and at most four read-only specialists', () => {
    const concurrency = new PilotConcurrencyController();
    concurrency.reserve({
      role: 'implementation_worker',
      mode: 'mutating',
      deadlineMs: 2000,
      nowMs: 1000,
    });
    expect(() =>
      concurrency.reserve({
        role: 'implementation_worker',
        mode: 'mutating',
        deadlineMs: 2000,
        nowMs: 1000,
      }),
    ).toThrow('only one mutating');
    for (let index = 0; index < 3; index += 1) {
      concurrency.reserve({
        role: 'code_reviewer',
        mode: 'read_only',
        deadlineMs: 2000,
        nowMs: 1000,
      });
    }
    expect(() =>
      concurrency.reserve({
        role: 'test_runner',
        mode: 'read_only',
        deadlineMs: 2000,
        nowMs: 1000,
      }),
    ).toThrow('concurrency limit');
  });

  it('cancels and times out reservations deterministically', () => {
    const concurrency = new PilotConcurrencyController();
    const cancelled = concurrency.reserve({
      role: 'repo_explorer',
      mode: 'read_only',
      deadlineMs: 2000,
      nowMs: 1000,
    });
    concurrency.cancel(cancelled.id);
    expect(() => concurrency.release(cancelled.id, 1100)).toThrow('cancelled');
    const expired = concurrency.reserve({
      role: 'test_runner',
      mode: 'read_only',
      deadlineMs: 1200,
      nowMs: 1100,
    });
    expect(() => concurrency.release(expired.id, 1200)).toThrow('timed out');
  });

  it('closes only accepted exact-head results through the injected broker', async () => {
    const { store, closed, orchestrator } = await setup();
    const workspaceLeaseEpoch = orchestrator.acquireWorkspace(1000, 1000);
    const runLeaseEpoch = orchestrator.acquireRun('run-schedule', 1000, 1000);
    const taskLeaseEpoch = orchestrator.acquireTask('schedule-feature.1', 1000, 1000);
    const packet = orchestrator.createTaskPacket({
      runId: 'run-schedule',
      taskId: 'schedule-feature.1',
      evidence,
    });
    const result = {
      status: 'passed' as const,
      summary: 'accepted',
      changedFiles: ['packages/workflow-control/src/orchestrator.ts'],
      acceptanceCriteria: { passed: ['all checks pass'], failed: [] },
      evidence,
      findings: [],
      remainingRisks: [],
      recommendedTransition: 'integrate' as const,
    };
    store.recordEvidence({
      ...evidence[0]!,
      producer: 'test-runner',
      producerRole: 'test_runner',
      workspaceId: contract.workspaceId,
      runId: packet.runId,
      taskId: packet.taskId,
      contractVersion: contract.contractVersion,
      policyDigest: contract.policyDigest,
      headSha: 'abc',
      createdAtMs: 1000,
    });
    const closeContext = {
      workspaceLeaseEpoch,
      runLeaseEpoch,
      taskLeaseEpoch,
      transitionId: 'close-transition',
    };
    await expect(
      orchestrator.acceptAndCloseTask({
        packet,
        result: { ...result, changedFiles: ['apps/api/src/index.ts'] },
        ...closeContext,
      }),
    ).rejects.toThrow('do not match the exact-head Git diff');
    await expect(
      orchestrator.acceptAndCloseTask({
        packet,
        result,
        ...closeContext,
      }),
    ).rejects.toThrow('not recorded at the exact head');
    await expect(
      orchestrator.acceptAndCloseTask({
        packet,
        result: {
          ...result,
          findings: [
            {
              id: 'critical-finding',
              severity: 'critical',
              summary: 'unresolved',
              evidence,
            },
          ],
        },
        ...closeContext,
      }),
    ).rejects.toThrow('unresolved findings');
    store.recordEvidence({
      ...evidence[0]!,
      producer: 'test-runner',
      producerRole: 'test_runner',
      workspaceId: contract.workspaceId,
      runId: packet.runId,
      taskId: packet.taskId,
      contractVersion: contract.contractVersion,
      policyDigest: contract.policyDigest,
      headSha: 'a'.repeat(40),
      createdAtMs: 1000,
    });
    await orchestrator.acceptAndCloseTask({
      packet,
      result,
      ...closeContext,
    });
    expect(closed).toEqual(['schedule-feature.1']);
    expect(
      selectBeadsReadyTasks(contract, [
        { id: 'schedule-feature.1', status: 'closed', blockingDependencies: [] },
        {
          id: 'schedule-feature.2',
          status: 'open',
          blockingDependencies: ['schedule-feature.1'],
        },
      ]),
    ).toEqual(['schedule-feature.2']);
    store.close();
  });

  it('launches bounded packets through the isolated launcher and releases capacity', async () => {
    const { store, orchestrator } = await setup('scheduling');
    const workspaceLeaseEpoch = orchestrator.acquireWorkspace(1000, 1000);
    const runLeaseEpoch = orchestrator.acquireRun('run-schedule', 1000, 1000);
    const packet = orchestrator.createTaskPacket({
      runId: 'run-schedule',
      taskId: 'schedule-feature.1',
      evidence,
    });
    const seen: string[] = [];
    const output = await orchestrator.launchTask({
      packet,
      workspaceLeaseEpoch,
      runLeaseEpoch,
      claimTransitionId: 'claim-transition',
      deadlineMs: 2000,
    });
    seen.push(store.getRun('run-schedule')!.state);
    expect(output).toMatchObject({ events: [{ type: 'result', status: 'launched' }] });
    const retainedWorkspaceRoot = (output as { retainedWorkspaceRoot: string })
      .retainedWorkspaceRoot;
    roots.push(dirname(retainedWorkspaceRoot));
    await expect(
      readFile(join(retainedWorkspaceRoot, 'packages/workflow-control/source.ts'), 'utf8'),
    ).resolves.toBe('export const retained = true;\n');
    expect(seen).toEqual(['implementing']);
    expect(store.listActiveSchedulerExecutions(contract.workspaceId)).toEqual([]);
    store.close();
  });

  it('revokes the single-run credential before releasing a retained workspace', async () => {
    let specialistStagingRoot: string | undefined;
    const executor: SpecialistProcessExecutor = async (executable, args) => {
      if (executable !== '/usr/local/bin/docker') return { stdout: '', stderr: '' };
      if (args[0] === 'create') {
        const workspaceMount = args.find((argument) => argument.endsWith(':/workspace:rw'))!;
        const authMount = args.find((argument) => argument.endsWith(':/codex-home/auth.json:ro'))!;
        const mountedRoot = workspaceMount.slice(0, -':/workspace:rw'.length);
        specialistStagingRoot = dirname(mountedRoot);
        const mountedAuth = authMount.slice(0, -':/codex-home/auth.json:ro'.length);
        await writeFile(join(mountedRoot, 'stolen.json'), await readFile(mountedAuth));
        return { stdout: 'container-id\n', stderr: '' };
      }
      if (args[0] === 'start') {
        return { stdout: '{"type":"result","status":"launched"}\n', stderr: '' };
      }
      if (args[0] === 'inspect') return { stdout: 'false\n', stderr: '' };
      return { stdout: '', stderr: '' };
    };
    const { store, orchestrator, revokedCredentialLeases } = await setup('scheduling', {
      executor,
    });
    const workspaceLeaseEpoch = orchestrator.acquireWorkspace(1000, 1000);
    const runLeaseEpoch = orchestrator.acquireRun('run-schedule', 1000, 1000);
    const packet = orchestrator.createTaskPacket({
      runId: 'run-schedule',
      taskId: 'schedule-feature.1',
      evidence,
    });
    const output = await orchestrator.launchTask({
      packet,
      workspaceLeaseEpoch,
      runLeaseEpoch,
      claimTransitionId: 'claim-secret-copy-transition',
      deadlineMs: 2000,
    });
    expect(specialistStagingRoot).toBeDefined();
    await expect(
      readFile(join(specialistStagingRoot!, 'workspace', 'stolen.json'), 'utf8'),
    ).resolves.toContain('test-secret-credential');
    expect(revokedCredentialLeases).toEqual(
      expect.arrayContaining([expect.stringMatching(/^specialist:/u)]),
    );
    await expect(
      realpath((output as { retainedWorkspaceRoot: string }).retainedWorkspaceRoot),
    ).resolves.toBe(await realpath(join(specialistStagingRoot!, 'workspace')));
    expect(store.listActiveSchedulerExecutions(contract.workspaceId)).toEqual([]);
    store.close();
  });

  it('compensates when a delayed issue response arrives after restart revocation', async () => {
    const first = await setup('scheduling');
    const workspaceLeaseEpoch = first.orchestrator.acquireWorkspace(1000, 1000);
    const runLeaseEpoch = first.orchestrator.acquireRun('run-schedule', 1000, 1000);
    const taskLeaseEpoch = first.orchestrator.acquireTask('schedule-feature.1', 1000, 1000);
    const executionId = '44444444-4444-4444-8444-444444444444';
    first.store.createSchedulerExecution({
      id: executionId,
      workspaceId: contract.workspaceId,
      runId: 'run-schedule',
      taskId: 'schedule-feature.1',
      role: 'implementation_worker',
      mode: 'mutating',
      deadlineMs: 2000,
      ownerId: 'owner-1',
      workspaceLeaseEpoch,
      runLeaseEpoch,
      taskLeaseEpoch,
      processIdentity: `docker:workflow-specialist-${executionId}`,
      credentialLeaseId: `specialist:${executionId}`,
      packet: { taskId: 'schedule-feature.1' },
      nowMs: 1000,
    });
    const stagingRoot = await mkdtemp(join(tmpdir(), 'workflow-delayed-credential-'));
    roots.push(stagingRoot);
    let releaseIssue!: () => void;
    let active = false;
    const broker = RevocableSpecialistCredentialBroker.createForTest({
      store: first.store,
      issue: async (_root, _id, leaseId, generation) => {
        await new Promise<void>((resolve) => {
          releaseIssue = resolve;
        });
        active = true;
        const authFile = join(stagingRoot, 'auth.json');
        await writeFile(authFile, '{"access_token":"delayed"}\n');
        return { authFile, leaseId, generation };
      },
      revoke: async () => {
        active = false;
      },
      observe: async () => (active ? 'active' : 'revoked'),
      conformance: async () => 'test-generation',
    });
    const issuing = broker.issue(stagingRoot, executionId, 'test-generation');
    await broker.revoke(executionId);
    releaseIssue();
    await expect(issuing).rejects.toThrow();
    expect(active).toBe(false);
    expect(first.store.getSchedulerExecution(executionId)?.credentialStatus).toBe('revoked');
    first.store.close();
  });

  it('validates the production command-backed credential protocol', async () => {
    const first = await setup('scheduling');
    const workspaceLeaseEpoch = first.orchestrator.acquireWorkspace(1000, 1000);
    const runLeaseEpoch = first.orchestrator.acquireRun('run-schedule', 1000, 1000);
    const taskLeaseEpoch = first.orchestrator.acquireTask('schedule-feature.1', 1000, 1000);
    const createExecution = (id: string, mode: 'mutating' | 'read_only') =>
      first.store.createSchedulerExecution({
        id,
        workspaceId: contract.workspaceId,
        runId: 'run-schedule',
        taskId: 'schedule-feature.1',
        role: 'implementation_worker',
        mode,
        deadlineMs: 2000,
        ownerId: 'owner-1',
        workspaceLeaseEpoch,
        runLeaseEpoch,
        taskLeaseEpoch,
        processIdentity: `docker:workflow-specialist-${id}`,
        credentialLeaseId: `specialist:${id}`,
        packet: { taskId: 'schedule-feature.1' },
        nowMs: 1000,
      });
    const brokerBinary = join(first.root, 'credential-broker.cjs');
    await writeFile(
      brokerBinary,
      `#!${process.execPath}
const fs = require('node:fs');
const args = process.argv.slice(2);
const value = (name) => args[args.indexOf(name) + 1];
const command = args[0];
if (command === 'conformance') {
  if (value('--protocol') !== 'revoke-wins-v1' || value('--max-probe-ttl-seconds') !== '30') process.exit(3);
  process.stdout.write(JSON.stringify({ protocol: 'revoke-wins-v1', passed: true, cleanup: 'broker_owned_ttl', generation: 'generation-A', probeTtlSeconds: 30 }));
} else if (command === 'issue') {
  const leaseId = value('--lease-id');
  const generation = value('--generation');
  fs.writeFileSync(value('--output'), '{"access_token":"ephemeral"}\\n');
  process.stdout.write(JSON.stringify({ leaseId: leaseId.includes('99999999') ? 'specialist:wrong' : leaseId, generation }));
} else if (command === 'revoke' || command === 'status') {
  const leaseId = value('--lease-id');
  process.stdout.write(JSON.stringify({
    status: 'revoked',
    leaseId: command === 'revoke' && leaseId.includes('bbbbbbbb') ? 'specialist:wrong' : leaseId,
    generation: command === 'status' && leaseId.includes('cccccccc') ? 'wrong-generation' : value('--generation'),
  }));
} else {
  process.exitCode = 2;
}
`,
      { mode: 0o700 },
    );
    await chmod(brokerBinary, 0o700);
    const broker = RevocableSpecialistCredentialBroker.create({
      binary: brokerBinary,
      store: first.store,
    });
    await expect(broker.assertConformant()).resolves.toBe('generation-A');
    const successfulId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    createExecution(successfulId, 'mutating');
    const stagingRoot = await mkdtemp(join(tmpdir(), 'workflow-command-broker-'));
    roots.push(stagingRoot);
    await expect(broker.issue(stagingRoot, successfulId, 'generation-A')).resolves.toMatchObject({
      leaseId: `specialist:${successfulId}`,
      generation: 'generation-A',
    });
    await broker.revoke(successfulId);
    expect(first.store.getSchedulerExecution(successfulId)?.credentialStatus).toBe('revoked');

    const wrongLeaseId = '99999999-9999-4999-8999-999999999999';
    createExecution(wrongLeaseId, 'read_only');
    await expect(broker.issue(stagingRoot, wrongLeaseId, 'generation-A')).rejects.toThrow(
      'requested lease id',
    );
    expect(first.store.getSchedulerExecution(wrongLeaseId)?.credentialStatus).toBe('revoked');

    const wrongRevokeLeaseId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    createExecution(wrongRevokeLeaseId, 'read_only');
    await broker.issue(stagingRoot, wrongRevokeLeaseId, 'generation-A');
    await expect(broker.revoke(wrongRevokeLeaseId)).rejects.toThrow('generation-pinned revocation');
    expect(first.store.getSchedulerExecution(wrongRevokeLeaseId)?.credentialStatus).toBe(
      'revoking',
    );

    const wrongStatusGenerationId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    createExecution(wrongStatusGenerationId, 'read_only');
    await broker.issue(stagingRoot, wrongStatusGenerationId, 'generation-A');
    await expect(broker.revoke(wrongStatusGenerationId)).rejects.toThrow(
      'generation-pinned lease status',
    );
    expect(first.store.getSchedulerExecution(wrongStatusGenerationId)?.credentialStatus).toBe(
      'revoking',
    );

    for (const invalidTtl of [31, 0, -1]) {
      const badBinary = join(first.root, `bad-credential-broker-${invalidTtl}.cjs`);
      await writeFile(
        badBinary,
        `#!${process.execPath}\nprocess.stdout.write(JSON.stringify({ protocol: 'revoke-wins-v1', passed: true, cleanup: 'broker_owned_ttl', generation: 'generation-A', probeTtlSeconds: ${invalidTtl} }));\n`,
        { mode: 0o700 },
      );
      await chmod(badBinary, 0o700);
      await expect(
        RevocableSpecialistCredentialBroker.create({
          binary: badBinary,
          store: first.store,
        }).assertConformant(),
      ).rejects.toThrow('failed revoke-wins conformance');
    }
    first.store.close();
  });

  it('interrupts timed-out specialists and records durable escalation', async () => {
    let clock = 1000;
    let cancelled = false;
    let rejectStart: ((error: Error) => void) | undefined;
    const executor: SpecialistProcessExecutor = async (_executable, args) => {
      if (args[0] === 'stop') {
        cancelled = true;
        clock = 1005;
        rejectStart?.(new Error('container stopped'));
        return { stdout: '', stderr: '' };
      }
      if (args[0] === 'inspect') return { stdout: 'false\n', stderr: '' };
      if (args[0] === 'rm') return { stdout: '', stderr: '' };
      if (args[0] === 'create') return { stdout: 'container-id\n', stderr: '' };
      return new Promise<never>((_resolve, reject) => {
        rejectStart = reject;
      });
    };
    const { store, orchestrator } = await setup('scheduling', {
      executor,
      clock: () => clock,
    });
    const workspaceLeaseEpoch = orchestrator.acquireWorkspace(1000, 1000);
    const runLeaseEpoch = orchestrator.acquireRun('run-schedule', 1000, 1000);
    const packet = orchestrator.createTaskPacket({
      runId: 'run-schedule',
      taskId: 'schedule-feature.1',
      evidence,
    });
    await expect(
      orchestrator.launchTask({
        packet,
        workspaceLeaseEpoch,
        runLeaseEpoch,
        claimTransitionId: 'claim-timeout-transition',
        deadlineMs: 1005,
      }),
    ).rejects.toThrow('timed out');
    expect(cancelled).toBe(true);
    expect(store.listActiveSchedulerExecutions(contract.workspaceId)).toEqual([]);
    store.close();
  });

  it('rejects completion when leases expire while the specialist runs', async () => {
    let clock = 1000;
    const executor: SpecialistProcessExecutor = async (executable, args) => {
      if (executable === '/usr/local/bin/docker' && args[0] === 'create') {
        return { stdout: 'container-id\n', stderr: '' };
      }
      if (executable === '/usr/local/bin/docker' && args[0] === 'start') {
        clock = 2001;
        return { stdout: '{"type":"result"}\n', stderr: '' };
      }
      if (args[0] === 'inspect') return { stdout: 'false\n', stderr: '' };
      if (args[0] === 'stop') return { stdout: '', stderr: '' };
      return { stdout: 'passed\n', stderr: '' };
    };
    const { store, orchestrator } = await setup('scheduling', {
      executor,
      clock: () => clock,
    });
    const workspaceLeaseEpoch = orchestrator.acquireWorkspace(1000, 1000);
    const runLeaseEpoch = orchestrator.acquireRun('run-schedule', 1000, 1000);
    const packet = orchestrator.createTaskPacket({
      runId: 'run-schedule',
      taskId: 'schedule-feature.1',
      evidence,
    });
    await expect(
      orchestrator.launchTask({
        packet,
        workspaceLeaseEpoch,
        runLeaseEpoch,
        claimTransitionId: 'claim-expired-lease-transition',
        deadlineMs: 3000,
      }),
    ).rejects.toThrow('stale or expired workspace fencing token');
    expect(store.listActiveSchedulerExecutions(contract.workspaceId)).toHaveLength(1);
    store.close();
  });

  it('rejects a blocked task using the official Beads snapshot', async () => {
    const { store, orchestrator } = await setup('scheduling');
    const workspaceLeaseEpoch = orchestrator.acquireWorkspace(1000, 1000);
    const runLeaseEpoch = orchestrator.acquireRun('run-schedule', 1000, 1000);
    const secondPacket = orchestrator.createTaskPacket({
      runId: 'run-schedule',
      taskId: 'schedule-feature.2',
      evidence,
    });
    await expect(
      orchestrator.launchTask({
        packet: secondPacket,
        workspaceLeaseEpoch,
        runLeaseEpoch,
        claimTransitionId: 'blocked-claim-transition',
        deadlineMs: 2000,
      }),
    ).rejects.toThrow('not ready in authoritative Beads state');
    store.close();
  });

  it('reserves durable scheduler capacity before committing the Beads claim', async () => {
    const { store, client, orchestrator } = await setup('scheduling');
    const workspaceLeaseEpoch = orchestrator.acquireWorkspace(1000, 1000);
    const runLeaseEpoch = orchestrator.acquireRun('run-schedule', 1000, 1000);
    const contractId = store.createContract(contract);
    store.createRun(contractId, 'implementing', 'other-active-run');
    const otherRunLease = store.acquireLease('run', 'other-active-run', 'owner-1', 1000, 1000);
    const otherTaskLease = store.acquireLease('task', 'schedule-feature.2', 'owner-1', 1000, 1000);
    store.createSchedulerExecution({
      id: '22222222-2222-4222-8222-222222222222',
      workspaceId: contract.workspaceId,
      runId: 'other-active-run',
      taskId: 'schedule-feature.2',
      role: 'implementation_worker',
      mode: 'mutating',
      deadlineMs: 2000,
      ownerId: 'owner-1',
      workspaceLeaseEpoch,
      runLeaseEpoch: otherRunLease.epoch,
      taskLeaseEpoch: otherTaskLease.epoch,
      processIdentity: 'docker:workflow-specialist-22222222-2222-4222-8222-222222222222',
      credentialLeaseId: 'specialist:22222222-2222-4222-8222-222222222222',
      packet: { taskId: 'schedule-feature.2' },
      nowMs: 1000,
    });
    const packet = orchestrator.createTaskPacket({
      runId: 'run-schedule',
      taskId: 'schedule-feature.1',
      evidence,
    });
    await expect(
      orchestrator.launchTask({
        packet,
        workspaceLeaseEpoch,
        runLeaseEpoch,
        claimTransitionId: 'capacity-claim-transition',
        deadlineMs: 2000,
      }),
    ).rejects.toThrow('only one mutating');
    expect(store.getRun('run-schedule')?.state).toBe('scheduling');
    await expect(client.readIssue('/repo/root', packet.taskId)).resolves.toMatchObject({
      status: 'open',
    });
    store.close();
  });

  it('rolls back run-lease adoption when the task lease remains owned elsewhere', async () => {
    const first = await setup('scheduling');
    const workspaceLeaseEpoch = first.orchestrator.acquireWorkspace(100, 1000);
    const runLeaseEpoch = first.orchestrator.acquireRun('run-schedule', 100, 1000);
    const taskLeaseEpoch = first.orchestrator.acquireTask('schedule-feature.1', 1000, 1000);
    const executionId = '66666666-6666-4666-8666-666666666666';
    first.store.createSchedulerExecution({
      id: executionId,
      workspaceId: contract.workspaceId,
      runId: 'run-schedule',
      taskId: 'schedule-feature.1',
      role: 'implementation_worker',
      mode: 'mutating',
      deadlineMs: 2000,
      ownerId: 'owner-1',
      workspaceLeaseEpoch,
      runLeaseEpoch,
      taskLeaseEpoch,
      processIdentity: `docker:workflow-specialist-${executionId}`,
      credentialLeaseId: `specialist:${executionId}`,
      packet: { taskId: 'schedule-feature.1' },
      nowMs: 1000,
    });
    const recoveryWorkspace = first.store.acquireLease(
      'workspace',
      contract.workspaceId,
      'owner-2',
      100,
      1100,
    );
    expect(() =>
      first.store.adoptSchedulerExecution({
        id: executionId,
        ownerId: 'owner-2',
        workspaceLeaseEpoch: recoveryWorkspace.epoch,
        runLeaseTtlMs: 100,
        taskLeaseTtlMs: 100,
        nowMs: 1100,
      }),
    ).toThrow('resource lease is held by another owner');
    expect(first.store.acquireLease('run', 'run-schedule', 'owner-3', 100, 1100)).toMatchObject({
      ownerId: 'owner-3',
    });
    expect(first.store.getSchedulerExecution(executionId)?.ownerId).toBe('owner-1');
    first.store.close();
  });

  it('stops persisted specialist identity and escalates the run exactly once after restart', async () => {
    const first = await setup('scheduling');
    const workspaceLeaseEpoch = first.orchestrator.acquireWorkspace(100, 1000);
    const runLeaseEpoch = first.orchestrator.acquireRun('run-schedule', 100, 1000);
    const taskLeaseEpoch = first.orchestrator.acquireTask('schedule-feature.1', 100, 1000);
    const packet = first.orchestrator.createTaskPacket({
      runId: 'run-schedule',
      taskId: 'schedule-feature.1',
      evidence,
    });
    await first.closer.claimTask({
      transitionId: 'restart-claim-transition',
      runId: packet.runId,
      taskId: packet.taskId,
      expectedRunVersion: 0,
      contractVersion: contract.contractVersion,
      policyDigest: contract.policyDigest,
      leaseOwnerId: 'owner-1',
      runLeaseEpoch,
      workspaceLeaseEpoch,
      taskLeaseEpoch,
      nowMs: 1000,
    });
    first.store.recordEvidence({
      ...evidence[0]!,
      producer: 'workflow-recovery-checkpoint',
      producerRole: 'workflow_orchestrator',
      workspaceId: contract.workspaceId,
      runId: packet.runId,
      taskId: packet.taskId,
      transitionId: 'restart-claim-transition',
      contractVersion: contract.contractVersion,
      policyDigest: contract.policyDigest,
      createdAtMs: 1000,
    });
    const executionId = '11111111-1111-4111-8111-111111111111';
    first.store.createSchedulerExecution({
      id: executionId,
      workspaceId: contract.workspaceId,
      runId: packet.runId,
      taskId: packet.taskId,
      role: packet.assignedRole,
      mode: 'mutating',
      deadlineMs: 1500,
      ownerId: 'owner-1',
      workspaceLeaseEpoch,
      runLeaseEpoch,
      taskLeaseEpoch,
      processIdentity: `docker:workflow-specialist-${executionId}`,
      credentialLeaseId: `specialist:${executionId}`,
      packet,
      nowMs: 1000,
    });
    const crashFixture = new Database(join(first.root, 'workflow.sqlite'));
    crashFixture
      .prepare(
        `UPDATE scheduler_executions
         SET credential_broker_generation = 'test-generation', credential_status = 'issuing'
         WHERE id = ?`,
      )
      .run(executionId);
    crashFixture.close();
    const recoveryTransitionId = `${executionId}:internal.specialist_recovery`;
    const expectedRunVersion = first.store.getRun(packet.runId)!.version;
    first.store.prepareTransition({
      id: recoveryTransitionId,
      runId: packet.runId,
      from: 'implementing',
      to: 'recovering',
      operation: 'internal.specialist_recovery',
      expectedRunVersion,
      idempotencyKey: deriveTransitionIdempotencyKey({
        runId: packet.runId,
        transitionId: recoveryTransitionId,
        operation: 'internal.specialist_recovery',
        expectedVersion: expectedRunVersion,
      }),
      actorRole: 'workflow_orchestrator',
      contractVersion: contract.contractVersion,
      policyDigest: contract.policyDigest,
      leaseOwnerId: 'owner-1',
      leaseEpoch: runLeaseEpoch,
      transitionContext: {
        workspaceLeaseEpoch,
        taskLeaseEpoch,
        recoveryTarget: 'implementing',
      },
      expectedExternalState: { status: 'internal' },
      externalArguments: {
        taskId: packet.taskId,
        processIdentity: `docker:workflow-specialist-${executionId}`,
        interruptedTransitionId: 'restart-claim-transition',
        evidenceDigests: packet.evidence.map((reference) => reference.digest),
      },
      nowMs: 1000,
    });
    first.store.close();

    const store = new WorkflowStore(join(first.root, 'workflow.sqlite'));
    const port = OfficialBeadsDoltPort.createForTest('/repo/root', first.client);
    const closer = new JournaledBeadsTaskCloser(
      JournaledBeadsDoltBroker.createForTest(store, port, undefined, () => 1100),
      port,
    );
    const stopped: string[] = [];
    const executor: SpecialistProcessExecutor = async (_executable, args) => {
      if (args[0] === 'stop') stopped.push(args.at(-1)!);
      return { stdout: '', stderr: '' };
    };
    const launcher = DockerIsolatedSpecialistLauncher.createForTest({
      sourceRoot: first.sourceRoot,
      image: 'workflow-codex:test',
      credentialBroker: RevocableSpecialistCredentialBroker.createForTest({
        store,
        issue: async (stagingRoot, _executionId, leaseId, generation) => {
          const issuedAuthFile = join(stagingRoot, 'codex-auth.json');
          await writeFile(issuedAuthFile, await readFile(first.authFile), { mode: 0o600 });
          return { authFile: issuedAuthFile, leaseId, generation };
        },
        revoke: async () => undefined,
        observe: async () => 'revoked',
        conformance: async () => 'test-generation',
      }),
      egressNetwork: 'workflow-model-egress',
      containerUser: '501:20',
      executor,
      clock: () => 1100,
    });
    const integrationGate = LocalExactHeadIntegrationGate.createForTest({
      workspaceRoot: first.sourceRoot,
      artifacts: new JournaledArtifactRecorder(
        new ContentAddressedArtifactStore(join(first.root, 'recovery-artifacts')),
        store,
      ),
      checkCommands: { test: ['pnpm', 'test'] },
      executor: async () => ({ stdout: `${'a'.repeat(40)}\n`, stderr: '' }),
    });
    const recovered = new WorkflowOrchestrator({
      contract,
      store,
      closer,
      launcher,
      integrationGate,
      ownerId: 'owner-2',
      clock: () => 1100,
    });
    const recoveryWorkspaceEpoch = recovered.acquireWorkspace(100, 1100);
    expect(
      await recovered.reconcileAfterRestart({
        workspaceLeaseEpoch: recoveryWorkspaceEpoch,
        runLeaseTtlMs: 100,
        taskLeaseTtlMs: 100,
      }),
    ).toEqual([expect.objectContaining({ id: executionId, status: 'escalated' })]);
    expect(stopped).toEqual([`workflow-specialist-${executionId}`]);
    expect(store.getRun(packet.runId)?.state).toBe('escalated');
    expect(store.getSchedulerExecution(executionId)?.credentialStatus).toBe('revoked');
    expect(
      await recovered.reconcileAfterRestart({
        workspaceLeaseEpoch: recoveryWorkspaceEpoch,
        runLeaseTtlMs: 100,
        taskLeaseTtlMs: 100,
      }),
    ).toEqual([]);
    store.close();
  });

  it('finishes a scheduler intent when a conflicting prepared Beads claim escalates recovery', async () => {
    const first = await setup('scheduling');
    const workspaceLeaseEpoch = first.orchestrator.acquireWorkspace(100, 1000);
    const runLeaseEpoch = first.orchestrator.acquireRun('run-schedule', 100, 1000);
    const taskLeaseEpoch = first.orchestrator.acquireTask('schedule-feature.1', 100, 1000);
    const packet = first.orchestrator.createTaskPacket({
      runId: 'run-schedule',
      taskId: 'schedule-feature.1',
      evidence,
    });
    const executionId = '33333333-3333-4333-8333-333333333333';
    first.store.createSchedulerExecution({
      id: executionId,
      workspaceId: contract.workspaceId,
      runId: packet.runId,
      taskId: packet.taskId,
      role: packet.assignedRole,
      mode: 'mutating',
      deadlineMs: 1500,
      ownerId: 'owner-1',
      workspaceLeaseEpoch,
      runLeaseEpoch,
      taskLeaseEpoch,
      processIdentity: `docker:workflow-specialist-${executionId}`,
      credentialLeaseId: `specialist:${executionId}`,
      packet,
      nowMs: 1000,
    });
    const transitionId = 'prepared-conflicting-claim';
    first.store.prepareTransition({
      id: transitionId,
      runId: packet.runId,
      from: 'scheduling',
      to: 'implementing',
      operation: 'beads.task_claim',
      expectedRunVersion: 0,
      idempotencyKey: deriveTransitionIdempotencyKey({
        runId: packet.runId,
        transitionId,
        operation: 'beads.task_claim',
        expectedVersion: 0,
      }),
      actorRole: 'workflow_orchestrator',
      contractVersion: contract.contractVersion,
      policyDigest: contract.policyDigest,
      leaseOwnerId: 'owner-1',
      leaseEpoch: runLeaseEpoch,
      transitionContext: { workspaceLeaseEpoch, taskLeaseEpoch },
      expectedExternalState: { status: 'in_progress' },
      externalArguments: { taskId: packet.taskId },
      nowMs: 1000,
    });
    await first.client.closeIssue('/repo/root', packet.taskId, 'external conflict', 'external');

    const port = OfficialBeadsDoltPort.createForTest('/repo/root', first.client);
    const closer = new JournaledBeadsTaskCloser(
      JournaledBeadsDoltBroker.createForTest(first.store, port, undefined, () => 1100),
      port,
    );
    const recovered = new WorkflowOrchestrator({
      contract,
      store: first.store,
      closer,
      launcher: first.launcher,
      integrationGate: first.integrationGate,
      ownerId: 'owner-2',
      clock: () => 1100,
    });
    const recoveryWorkspaceEpoch = recovered.acquireWorkspace(100, 1100);
    expect(
      await recovered.reconcileAfterRestart({
        workspaceLeaseEpoch: recoveryWorkspaceEpoch,
        runLeaseTtlMs: 100,
        taskLeaseTtlMs: 100,
      }),
    ).toEqual([expect.objectContaining({ id: executionId, status: 'escalated' })]);
    expect(first.store.getRun(packet.runId)?.state).toBe('escalated');
    expect(first.store.listActiveSchedulerExecutions(contract.workspaceId)).toEqual([]);
    expect(
      await recovered.reconcileAfterRestart({
        workspaceLeaseEpoch: recoveryWorkspaceEpoch,
        runLeaseTtlMs: 100,
        taskLeaseTtlMs: 100,
      }),
    ).toEqual([]);
    first.store.close();
  });

  it('quarantines an active pre-credential scheduler row until the legacy credential is rotated', async () => {
    const first = await setup('scheduling');
    const workspaceLeaseEpoch = first.orchestrator.acquireWorkspace(100, 1000);
    const runLeaseEpoch = first.orchestrator.acquireRun('run-schedule', 100, 1000);
    const taskLeaseEpoch = first.orchestrator.acquireTask('schedule-feature.1', 100, 1000);
    const executionId = '55555555-5555-4555-8555-555555555555';
    first.store.createSchedulerExecution({
      id: executionId,
      workspaceId: contract.workspaceId,
      runId: 'run-schedule',
      taskId: 'schedule-feature.1',
      role: 'implementation_worker',
      mode: 'mutating',
      deadlineMs: 1500,
      ownerId: 'owner-1',
      workspaceLeaseEpoch,
      runLeaseEpoch,
      taskLeaseEpoch,
      processIdentity: `docker:workflow-specialist-${executionId}`,
      credentialLeaseId: `specialist:${executionId}`,
      packet: { taskId: 'schedule-feature.1' },
      nowMs: 1000,
    });
    first.store.close();

    const databasePath = join(first.root, 'workflow.sqlite');
    const legacy = new Database(databasePath);
    legacy.exec(`
      DROP INDEX IF EXISTS scheduler_executions_workspace_status;
      ALTER TABLE scheduler_executions RENAME TO scheduler_executions_current;
      CREATE TABLE scheduler_executions (
        id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, run_id TEXT NOT NULL REFERENCES runs(id),
        task_id TEXT NOT NULL, role TEXT NOT NULL,
        mode TEXT NOT NULL CHECK(mode IN ('read_only', 'mutating')),
        status TEXT NOT NULL CHECK(status IN ('active', 'completed', 'cancelled', 'escalated')),
        deadline_ms INTEGER NOT NULL, owner_id TEXT NOT NULL,
        workspace_lease_epoch INTEGER NOT NULL, run_lease_epoch INTEGER NOT NULL,
        task_lease_epoch INTEGER NOT NULL, process_identity TEXT NOT NULL,
        packet_json TEXT NOT NULL, result_json TEXT, created_at_ms INTEGER NOT NULL,
        updated_at_ms INTEGER NOT NULL
      );
      INSERT INTO scheduler_executions
      SELECT id, workspace_id, run_id, task_id, role, mode, status, deadline_ms, owner_id,
             workspace_lease_epoch, run_lease_epoch, task_lease_epoch, process_identity,
             packet_json, result_json, created_at_ms, updated_at_ms
      FROM scheduler_executions_current;
      DROP TABLE scheduler_executions_current;
    `);
    legacy.close();

    const store = new WorkflowStore(databasePath);
    expect(store.getSchedulerExecution(executionId)).toMatchObject({
      credentialLeaseId: `legacy-quarantined:${executionId}`,
      credentialStatus: 'legacy_quarantined',
    });
    expect(() =>
      store.advanceSchedulerCredential({
        id: executionId,
        leaseId: `legacy-quarantined:${executionId}`,
        from: ['legacy_quarantined'],
        to: 'revoked',
        nowMs: 1100,
      }),
    ).toThrow('requires broker capability');
    const recoveryWorkspace = store.acquireLease(
      'workspace',
      contract.workspaceId,
      'owner-2',
      100,
      1100,
    );
    const adopted = store.adoptSchedulerExecution({
      id: executionId,
      ownerId: 'owner-2',
      workspaceLeaseEpoch: recoveryWorkspace.epoch,
      runLeaseTtlMs: 100,
      taskLeaseTtlMs: 100,
      nowMs: 1100,
    })!;
    const broker = RevocableSpecialistCredentialBroker.createForTest({
      store,
      issue: async () => {
        throw new Error('not used');
      },
      revoke: async () => undefined,
      observe: async () => 'revoked',
      conformance: async () => 'test-generation',
    });
    await expect(broker.revoke(executionId)).rejects.toThrow(
      'legacy credential remains quarantined',
    );
    expect(() =>
      store.finishSchedulerExecution({
        id: executionId,
        status: 'escalated',
        ownerId: 'owner-2',
        workspaceLeaseEpoch: recoveryWorkspace.epoch,
        runLeaseEpoch: adopted.runLeaseEpoch,
        taskLeaseEpoch: adopted.taskLeaseEpoch,
        result: { reason: 'legacy recovery' },
        nowMs: 1100,
      }),
    ).toThrow('before credential revocation');
    store.close();
  });
});
