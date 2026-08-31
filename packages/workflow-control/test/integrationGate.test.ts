import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  ContentAddressedArtifactStore,
  JournaledArtifactRecorder,
  LocalExactHeadIntegrationGate,
  WorkflowStore,
  type ExecutionContract,
  type GateCommandExecutor,
} from '../src/index.js';

const roots: string[] = [];
const digest = `sha256:${'d'.repeat(64)}`;
const contract: ExecutionContract = {
  featureId: 'gate-feature',
  contractVersion: 1,
  policyDigest: digest,
  workspaceId: digest,
  objective: 'verify exact head',
  requirements: [],
  nonGoals: [],
  acceptanceCriteria: ['verified'],
  constraints: { architecture: [], security: [], allowedPaths: ['packages/workflow-control'] },
  authority: {
    deliveryTarget: 'staging',
    allowedActions: ['process.test'],
    github: { repository: 'o/r', base: 'staging', mergeMethod: 'squash', requiredChecks: ['test'] },
  },
  tasks: [
    {
      id: 'gate-feature.1',
      dependsOn: [],
      risk: 'standard',
      assignedRole: 'test_runner',
      branchParent: 'feature/gate',
      allowedPaths: ['packages/workflow-control'],
      allowedOperations: ['process.test'],
    },
  ],
  qualityGates: ['test'],
  retryPolicy: {
    implementationAttempts: 1,
    findingAttempts: 1,
    infrastructureAttempts: 1,
    waitDeadlineSeconds: 60,
  },
  repairTaskPolicy: {
    idPattern: 'gate-feature.repair.<sequence>',
    maxChildren: 0,
    allowedRoles: ['implementation_worker'],
    allowedPaths: ['packages/workflow-control'],
    authorityMayExpand: false,
  },
  escalationPolicy: [],
};

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function setup(executor: GateCommandExecutor) {
  const root = await mkdtemp(join(tmpdir(), 'workflow-integration-gate-'));
  roots.push(root);
  const workspaceRoot = join(root, 'workspace');
  await mkdir(workspaceRoot);
  const store = new WorkflowStore(join(root, 'workflow.sqlite'));
  const contractId = store.createContract(contract);
  store.createRun(contractId, 'task_accepted', 'gate-run');
  const artifacts = new ContentAddressedArtifactStore(join(root, 'artifacts'));
  const gate = LocalExactHeadIntegrationGate.createForTest({
    workspaceRoot,
    artifacts: new JournaledArtifactRecorder(artifacts, store),
    checkCommands: { test: ['pnpm', 'test'] },
    executor,
  });
  return { artifacts, gate, store };
}

describe('LocalExactHeadIntegrationGate', () => {
  it('derives the real diff and stores retrievable check evidence at a stable head', async () => {
    const head = 'a'.repeat(40);
    const { artifacts, gate, store } = await setup(async (executable, args) => {
      if (executable === 'git' && args[0] === 'rev-parse')
        return { stdout: `${head}\n`, stderr: '' };
      if (executable === 'git' && args[0] === 'diff') {
        return { stdout: 'packages/workflow-control/src/orchestrator.ts\n', stderr: '' };
      }
      if (executable === 'git' && args[0] === 'status') return { stdout: '', stderr: '' };
      return { stdout: 'passed\n', stderr: '' };
    });
    const result = await gate.verify({ contract, runId: 'gate-run', taskId: 'gate-feature.1' });
    expect(result).toMatchObject({
      headSha: head,
      baseSha: head,
      passedChecks: ['test'],
      changedFiles: ['packages/workflow-control/src/orchestrator.ts'],
    });
    const body = await artifacts.get(result.evidence[0]!.digest);
    expect(JSON.parse(Buffer.from(body).toString('utf8'))).toMatchObject({
      check: 'test',
      baseSha: head,
      headSha: head,
    });
    store.close();
  });

  it('rejects a head that changes while checks run', async () => {
    let reads = 0;
    const { gate, store } = await setup(async (executable, args) => {
      if (executable === 'git' && args[0] === 'rev-parse') {
        reads += 1;
        return { stdout: `${(reads === 1 ? 'a' : 'b').repeat(40)}\n`, stderr: '' };
      }
      if (executable === 'git' && args[0] === 'diff') return { stdout: '', stderr: '' };
      if (executable === 'git' && args[0] === 'status') return { stdout: '', stderr: '' };
      return { stdout: 'passed\n', stderr: '' };
    });
    await expect(
      gate.verify({ contract, runId: 'gate-run', taskId: 'gate-feature.1' }),
    ).rejects.toThrow('head changed');
    store.close();
  });

  it('rejects tracked, staged, or untracked workspace changes', async () => {
    const head = 'a'.repeat(40);
    const { gate, store } = await setup(async (executable, args) => {
      if (executable === 'git' && args[0] === 'status') {
        return { stdout: '?? outside-contract.txt\n', stderr: '' };
      }
      if (executable === 'git' && args[0] === 'rev-parse') {
        return { stdout: `${head}\n`, stderr: '' };
      }
      return { stdout: '', stderr: '' };
    });
    await expect(
      gate.verify({ contract, runId: 'gate-run', taskId: 'gate-feature.1' }),
    ).rejects.toThrow('clean Git index and worktree');
    store.close();
  });

  it('pins the symbolic branch parent to one immutable SHA', async () => {
    const head = 'a'.repeat(40);
    const base = 'b'.repeat(40);
    let diffRange = '';
    const { gate, store } = await setup(async (executable, args) => {
      if (executable === 'git' && args[0] === 'status') return { stdout: '', stderr: '' };
      if (executable === 'git' && args[0] === 'rev-parse') {
        return { stdout: `${args[1] === 'HEAD' ? head : base}\n`, stderr: '' };
      }
      if (executable === 'git' && args[0] === 'diff') {
        diffRange = args[2]!;
        return { stdout: '', stderr: '' };
      }
      return { stdout: 'passed\n', stderr: '' };
    });
    const result = await gate.verify({ contract, runId: 'gate-run', taskId: 'gate-feature.1' });
    expect(result.baseSha).toBe(base);
    expect(diffRange).toBe(`${base}...${head}`);
    store.close();
  });
});
