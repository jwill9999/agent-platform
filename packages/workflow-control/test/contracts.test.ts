import { describe, expect, it } from 'vitest';

import { assertTaskPacketWithinContract, executionContractSchema } from '../src/index.js';

const digest = `sha256:${'a'.repeat(64)}`;
const contract = {
  featureId: 'agent-platform-example',
  contractVersion: 1,
  policyDigest: digest,
  workspaceId: digest,
  objective: 'Deliver an observable result',
  requirements: ['Keep transitions durable'],
  nonGoals: [],
  acceptanceCriteria: ['The contract is machine-valid'],
  constraints: { architecture: [], security: [], allowedPaths: ['packages/workflow-control'] },
  authority: {
    deliveryTarget: 'staging',
    allowedActions: ['workspace.read', 'workspace.patch', 'process.test'],
    github: {
      repository: 'owner/repository',
      base: 'staging',
      mergeMethod: 'squash',
      requiredChecks: ['verify'],
    },
  },
  tasks: [
    {
      id: 'agent-platform-example.1',
      dependsOn: [],
      risk: 'standard',
      assignedRole: 'implementation_worker',
      branchParent: 'feature/agent-platform-example',
      allowedPaths: ['packages/workflow-control'],
      allowedOperations: ['workspace.read', 'workspace.patch', 'process.test'],
    },
  ],
  qualityGates: ['test'],
  retryPolicy: {
    implementationAttempts: 3,
    findingAttempts: 2,
    infrastructureAttempts: 3,
    waitDeadlineSeconds: 86400,
  },
  repairTaskPolicy: {
    idPattern: 'agent-platform-example.repair.<sequence>',
    maxChildren: 2,
    allowedRoles: ['implementation_worker'],
    allowedPaths: ['packages/workflow-control'],
    authorityMayExpand: false,
  },
  escalationPolicy: ['authority expansion'],
} as const;

describe('executionContractSchema', () => {
  it('accepts the current contract version', () => {
    expect(executionContractSchema.parse(contract)).toEqual(contract);
  });

  it('rejects stale versions', () => {
    expect(() => executionContractSchema.parse({ ...contract, contractVersion: 0 })).toThrow();
  });

  it('rejects task authority expansion', () => {
    const expanded = {
      ...contract,
      tasks: [{ ...contract.tasks[0], allowedOperations: ['github.deliver'] }],
    };
    expect(() => executionContractSchema.parse(expanded)).toThrow('expands contract authority');
  });

  it('rejects paths that escape the workspace', () => {
    const escaped = {
      ...contract,
      constraints: { ...contract.constraints, allowedPaths: ['../outside'] },
    };
    expect(() => executionContractSchema.parse(escaped)).toThrow('workspace-relative');
  });

  it('rejects undefined and cyclic task dependencies', () => {
    const undefinedDependency = {
      ...contract,
      tasks: [{ ...contract.tasks[0], dependsOn: ['missing'] }],
    };
    expect(() => executionContractSchema.parse(undefinedDependency)).toThrow('not defined');

    const cyclic = {
      ...contract,
      tasks: [
        { ...contract.tasks[0], id: 'one', dependsOn: ['two'] },
        { ...contract.tasks[0], id: 'two', dependsOn: ['one'] },
      ],
    };
    expect(() => executionContractSchema.parse(cyclic)).toThrow('cyclic');
  });

  it('rejects task paths outside the contract envelope', () => {
    const expanded = {
      ...contract,
      tasks: [{ ...contract.tasks[0], allowedPaths: ['apps/api'] }],
    };
    expect(() => executionContractSchema.parse(expanded)).toThrow('task path');
  });

  it('rejects task packets that expand task authority', () => {
    const packet = {
      runId: 'run-1',
      taskId: contract.tasks[0].id,
      contractVersion: 1,
      policyDigest: digest,
      assignedRole: 'implementation_worker',
      objective: contract.objective,
      acceptanceCriteria: contract.acceptanceCriteria,
      allowedPaths: ['apps/api'],
      allowedOperations: ['workspace.read'],
      retryBudget: contract.retryPolicy,
      evidence: [],
    };
    expect(() => assertTaskPacketWithinContract(contract, packet)).toThrow('allowed paths');
  });
});
