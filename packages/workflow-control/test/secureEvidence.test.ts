import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  ProcessCapabilityBroker,
  SecureEvidenceVault,
  WorkflowStore,
  type ExecutionContract,
} from '../src/index.js';

const roots: string[] = [];
const policyDigest = `sha256:${'a'.repeat(64)}`;
const workspaceId = `sha256:${'b'.repeat(64)}`;
const headSha = '1'.repeat(40);
const contract: ExecutionContract = {
  featureId: 'secure-evidence',
  contractVersion: 1,
  policyDigest,
  workspaceId,
  objective: 'retain safe evidence',
  requirements: [],
  nonGoals: [],
  acceptanceCriteria: ['evidence is safe'],
  constraints: { architecture: [], security: [], allowedPaths: ['packages/workflow-control'] },
  authority: {
    deliveryTarget: 'staging',
    allowedActions: ['artifact.write'],
    github: {
      repository: 'example/repository',
      base: 'staging',
      mergeMethod: 'squash',
      requiredChecks: [],
    },
  },
  tasks: [
    {
      id: 'secure-evidence.8',
      dependsOn: [],
      risk: 'high',
      assignedRole: 'qa_evaluator',
      branchParent: 'task/secure-evidence.7',
      allowedPaths: ['packages/workflow-control'],
      allowedOperations: ['artifact.write'],
    },
  ],
  qualityGates: [],
  retryPolicy: {
    implementationAttempts: 1,
    findingAttempts: 1,
    infrastructureAttempts: 1,
    waitDeadlineSeconds: 60,
  },
  repairTaskPolicy: {
    idPattern: 'secure-evidence.repair.<sequence>',
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

async function setup(maxBytes = 1024, maxRunBytes = 10 * 1024) {
  const root = await mkdtemp(join(tmpdir(), 'secure-evidence-'));
  roots.push(root);
  const store = new WorkflowStore(join(root, 'workflow.sqlite'));
  const contractId = store.createContract(contract, 1000);
  store.createRun(contractId, 'feature_evaluation', 'run-evidence');
  store.seedApprovedTaskHeadForTest({
    workspaceId,
    runId: 'run-evidence',
    taskId: 'secure-evidence.8',
    headSha,
    nowMs: 900,
  });
  let nowMs = 1000;
  const vault = new SecureEvidenceVault({
    store,
    contract,
    maxBytes,
    maxRunBytes,
    clock: () => nowMs,
  });
  return { root, store, vault, setNow: (value: number) => (nowMs = value) };
}

function input(content: string) {
  return {
    content: Buffer.from(content),
    mediaType: 'text/plain',
    kind: 'evaluation' as const,
    producer: 'qa-1',
    producerRole: 'qa_evaluator' as const,
    workspaceId,
    runId: 'run-evidence',
    taskId: 'secure-evidence.8',
    contractVersion: 1,
    policyDigest,
    headSha,
  };
}

describe('SecureEvidenceVault', () => {
  it('redacts before persistence, binds metadata, and enforces role reads', async () => {
    const { vault } = await setup();
    const result = await vault.record(input('token=ghp_123456789012345678901234567890'));
    expect(result.record).toMatchObject({
      redactionCount: 1,
      headSha,
      acceptedAtMs: null,
      retentionClass: 'raw',
      retentionUntilMs: 1000 + 30 * 24 * 60 * 60 * 1000,
    });
    const stored = Buffer.from(
      await vault.read({
        digest: result.reference.digest,
        runId: 'run-evidence',
        taskId: 'secure-evidence.8',
        actorRole: 'workflow_orchestrator',
      }),
    ).toString('utf8');
    expect(stored).toBe('token=[REDACTED]');
    expect(stored).not.toContain('ghp_');
    await expect(
      vault.read({
        ...result.reference,
        runId: 'run-evidence',
        taskId: 'secure-evidence.8',
        actorRole: 'implementation_worker',
      }),
    ).rejects.toThrow('not authorized');
    await expect(
      vault.read({
        digest: result.reference.digest,
        runId: 'run-evidence',
        taskId: 'secure-evidence.8',
        actorRole: 'feature_evaluator',
      }),
    ).resolves.toEqual(Buffer.from('token=[REDACTED]'));
  });

  it('locks accepted evidence and leaves a tombstone after retention deletion', async () => {
    const { vault, setNow } = await setup();
    const result = await vault.record(input('safe evidence'));
    setNow(1500);
    const accepted = vault.accept({
      digest: result.reference.digest,
      runId: 'run-evidence',
      taskId: 'secure-evidence.8',
      actorRole: 'feature_evaluator',
    });
    expect(accepted.acceptedAtMs).toBe(1500);
    setNow(1600);
    expect(() =>
      vault.accept({
        digest: result.reference.digest,
        runId: 'run-evidence',
        taskId: 'secure-evidence.8',
        actorRole: 'feature_evaluator',
      }),
    ).toThrow('immutable');
    setNow(1000 + 30 * 24 * 60 * 60 * 1000 - 1);
    await expect(
      vault.delete({
        digest: result.reference.digest,
        runId: 'run-evidence',
        taskId: 'secure-evidence.8',
        actorRole: 'workflow_orchestrator',
      }),
    ).rejects.toThrow('retention');
    setNow(1000 + 30 * 24 * 60 * 60 * 1000);
    const deleted = await vault.delete({
      digest: result.reference.digest,
      runId: 'run-evidence',
      taskId: 'secure-evidence.8',
      actorRole: 'workflow_orchestrator',
    });
    expect(deleted).toMatchObject({ deletedAtMs: 1000 + 30 * 24 * 60 * 60 * 1000 });
    expect(deleted.tombstoneDigest).toMatch(/^sha256:/u);
    setNow(1001 + 30 * 24 * 60 * 60 * 1000);
    await expect(
      vault.delete({
        digest: result.reference.digest,
        runId: 'run-evidence',
        taskId: 'secure-evidence.8',
        actorRole: 'workflow_orchestrator',
      }),
    ).rejects.toThrow('immutable');
    await expect(
      vault.read({
        digest: result.reference.digest,
        runId: 'run-evidence',
        taskId: 'secure-evidence.8',
        actorRole: 'workflow_orchestrator',
      }),
    ).rejects.toThrow('unavailable');
    await expect(vault.record(input('safe evidence'))).rejects.toThrow('tombstoned');
  });

  it('redacts structured JSON without corrupting it and enforces the per-run bound', async () => {
    const { vault } = await setup(128, 140);
    const structured = await vault.record({
      ...input('{"token":"abcdefghijk","nested":{"value":"ghp_123456789012345678901234"}}'),
      mediaType: 'application/json',
    });
    const stored = JSON.parse(
      Buffer.from(
        await vault.read({
          digest: structured.reference.digest,
          runId: 'run-evidence',
          taskId: 'secure-evidence.8',
          actorRole: 'workflow_orchestrator',
        }),
      ).toString('utf8'),
    ) as { token: string; nested: { value: string } };
    expect(stored).toEqual({
      token: '[REDACTED]',
      nested: { value: '[REDACTED]' },
    });
    expect(structured.record.redactionCount).toBe(2);
    await expect(vault.record(input('x'.repeat(100)))).rejects.toThrow('per-run');
  });

  it.each([
    ['Authorization: Bearer abcdefghijklmnop', 'Bearer abcdefghijklmnop'],
    ['client_secret=abcdefghijklmno', 'abcdefghijklmno'],
    [
      '-----BEGIN PRIVATE KEY-----\nabcdefghijklmnop\n-----END PRIVATE KEY-----',
      'BEGIN PRIVATE KEY',
    ],
    [['xoxb', '123456789012', '123456789012', 'abcdefghijklmnopqrstuvwx'].join('-'), 'xoxb-'],
    ['AIzaSyA1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q', 'AIza'],
  ])('redacts additional credential forms before persistence', async (content, forbidden) => {
    const { vault } = await setup();
    const result = await vault.record(input(content));
    const stored = Buffer.from(
      await vault.read({
        digest: result.reference.digest,
        runId: 'run-evidence',
        taskId: 'secure-evidence.8',
        actorRole: 'workflow_orchestrator',
      }),
    ).toString('utf8');
    expect(result.record.redactionCount).toBeGreaterThan(0);
    expect(stored).not.toContain(forbidden);
  });

  it('fails closed on an unknown high-entropy credential candidate', async () => {
    const { vault } = await setup();
    await expect(
      vault.record(input('session_value=AbCdEf0123456789+/GhIjKlMnOpQrSt')),
    ).rejects.toThrow('residual secret scanning');
    await expect(
      vault.record(input('session_value=0a1b2c3d4e5f6g7h8i9jklmnopqrstuv')),
    ).rejects.toThrow('residual secret scanning');
    await expect(vault.record(input('0a1b2c3d4e5f678901234567890abcdef12345678'))).rejects.toThrow(
      'residual secret scanning',
    );
    await expect(vault.record(input('AbCdEf12GhIj-KlMnOp34QrSt-UvWxYz56AbCd'))).rejects.toThrow(
      'residual secret scanning',
    );
    await expect(vault.record(input('AbCdEf12GhIj~KlMnOp34QrSt~UvWxYz56AbCd'))).rejects.toThrow(
      'residual secret scanning',
    );
    await expect(vault.record(input(`sha256:${'a'.repeat(64)}`))).resolves.toMatchObject({
      record: { retentionClass: 'raw' },
    });
  });

  it('serializes concurrent per-run quota decisions in durable storage', async () => {
    const { vault, store } = await setup(128, 140);
    const results = await Promise.allSettled([
      vault.record(input(`first-${'x'.repeat(74)}`)),
      vault.record(input(`second-${'y'.repeat(73)}`)),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(store.sumLiveSecureEvidenceBytes('run-evidence')).toBeLessThanOrEqual(140);
  });

  it('rejects a producer role forged against the authenticated process capability', async () => {
    const root = await mkdtemp(join(tmpdir(), 'secure-evidence-capability-'));
    roots.push(root);
    const store = new WorkflowStore(join(root, 'workflow.sqlite'));
    const contractId = store.createContract(contract, 1000);
    store.createRun(contractId, 'feature_evaluation', 'run-evidence');
    store.seedApprovedTaskHeadForTest({
      workspaceId,
      runId: 'run-evidence',
      taskId: 'secure-evidence.8',
      headSha,
      nowMs: 900,
    });
    const process = { pid: 42, startTimeMs: 100, executableDigest: 'worker-image' };
    const capabilityBroker = new ProcessCapabilityBroker(() => undefined);
    const handle = capabilityBroker.issue({
      workspaceId,
      runId: 'run-evidence',
      role: 'implementation_worker',
      contractVersion: 1,
      policyDigest,
      operations: ['artifact.write'],
      allowedPaths: ['packages/workflow-control'],
      expiresAtMs: Date.now() + 60_000,
      process,
    });
    const vault = new SecureEvidenceVault({
      store,
      contract,
      capabilityBroker,
      clock: () => 1000,
    });
    await expect(
      vault.record({
        ...input('safe'),
        producerRole: 'qa_evaluator',
        capability: { token: handle.token, observedProcess: process },
      }),
    ).rejects.toThrow('authenticated capability');
  });

  it('rejects oversized, unsupported, malformed, and binary secret evidence', async () => {
    const { vault } = await setup(16);
    await expect(vault.record(input('x'.repeat(17)))).rejects.toThrow('size');
    const expanding = await setup(14, 128);
    await expect(expanding.vault.record(input('token=abcdefgh'))).rejects.toThrow(
      'redacted evidence size',
    );
    await expect(vault.record({ ...input('safe'), mediaType: 'text/html' })).rejects.toThrow(
      'unsupported',
    );
    await expect(
      vault.record({ ...input('{bad'), mediaType: 'application/json' }),
    ).rejects.toThrow();
    const binary = await setup();
    await expect(
      binary.vault.record({
        ...input('RIFFxxxxWEBPtoken=ghp_123456789012345678901234567890'),
        mediaType: 'image/webp',
      }),
    ).rejects.toThrow('secret-like');
  });
});
