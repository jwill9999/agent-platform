import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  ContentAddressedArtifactStore,
  JournaledArtifactRecorder,
  WorkflowStore,
  type ArtifactFaultBoundary,
  type ExecutionContract,
} from '../src/index.js';

const digest = `sha256:${'f'.repeat(64)}`;
const contract: ExecutionContract = {
  featureId: 'artifact-feature',
  contractVersion: 1,
  policyDigest: digest,
  workspaceId: digest,
  objective: 'record evidence',
  requirements: [],
  nonGoals: [],
  acceptanceCriteria: ['stored'],
  constraints: { architecture: [], security: [], allowedPaths: ['packages/workflow-control'] },
  authority: {
    deliveryTarget: 'staging',
    allowedActions: ['artifact.write'],
    github: { repository: 'o/r', base: 'staging', mergeMethod: 'squash', requiredChecks: [] },
  },
  tasks: [
    {
      id: 'artifact-feature.1',
      dependsOn: [],
      risk: 'standard',
      assignedRole: 'test_runner',
      branchParent: 'feature/artifact',
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
    idPattern: 'artifact-feature.repair.<sequence>',
    maxChildren: 0,
    allowedRoles: ['implementation_worker'],
    allowedPaths: ['packages/workflow-control'],
    authorityMayExpand: false,
  },
  escalationPolicy: [],
};

describe('ContentAddressedArtifactStore', () => {
  it('stores immutable content by digest and verifies reads', async () => {
    const root = await mkdtemp(join(tmpdir(), 'workflow-artifacts-'));
    const store = new ContentAddressedArtifactStore(root);
    const first = await store.put(Buffer.from('evidence'));
    const replay = await store.put(Buffer.from('evidence'));
    expect(replay).toEqual(first);
    await expect(store.get(first.digest)).resolves.toEqual(Buffer.from('evidence'));
    await writeFile(first.path, 'tampered');
    await expect(store.get(first.digest)).rejects.toThrow('integrity check failed');
    await expect(store.put(Buffer.from('evidence'))).rejects.toThrow('digest collision');
    await rm(root, { recursive: true, force: true });
  });

  it.each([
    'before_artifact_put',
    'after_artifact_put',
    'before_evidence_record',
    'after_evidence_record',
  ] as const)('recovers artifact fault boundary %s idempotently', async (boundary) => {
    const root = await mkdtemp(join(tmpdir(), 'workflow-artifact-journal-'));
    const store = new WorkflowStore(join(root, 'workflow.sqlite'));
    const contractId = store.createContract(contract);
    store.createRun(contractId, 'task_verification', 'run-artifact');
    const artifacts = new ContentAddressedArtifactStore(join(root, 'artifacts'));
    const failing = new JournaledArtifactRecorder(artifacts, store, (current) => {
      if (current === (boundary as ArtifactFaultBoundary)) throw new Error(`fault:${boundary}`);
    });
    const metadata = {
      mediaType: 'application/json',
      kind: 'test',
      producer: 'test-runner-1',
      producerRole: 'test_runner',
      workspaceId: digest,
      runId: 'run-artifact',
      contractVersion: 1,
      policyDigest: digest,
    };
    await expect(failing.record(Buffer.from('test evidence'), metadata)).rejects.toThrow(
      `fault:${boundary}`,
    );
    const recovered = await new JournaledArtifactRecorder(artifacts, store).record(
      Buffer.from('test evidence'),
      metadata,
    );
    expect(store.hasEvidence(recovered.digest)).toBe(true);
    store.close();
    await rm(root, { recursive: true, force: true });
  });
});
