import { describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_ROLE_OPERATION_POLICY,
  ProcessCapabilityBroker,
  assertBuiltInCollaborationAgentAllowed,
  capabilityTokenDigest,
  digestNormalizedArguments,
  revalidateApproval,
  type AuthorizationAuditEvent,
  type CapabilityClaims,
  workflowOperationSchema,
} from '../src/index.js';

const now = Date.now();
const processIdentity = { pid: 321, startTimeMs: 1000, executableDigest: 'sha256:codex' };
const claims: CapabilityClaims = {
  workspaceId: 'workspace-1',
  runId: 'run-1',
  role: 'implementation_worker',
  contractVersion: 1,
  policyDigest: 'sha256:policy',
  operations: ['workspace.read', 'workspace.patch', 'process.test'],
  allowedPaths: ['packages/workflow-control'],
  expiresAtMs: now + 60_000,
  process: processIdentity,
};

function pathBoundArguments(operation: string): Record<string, unknown> {
  return ['workspace.read', 'workspace.patch', 'artifact.write'].includes(operation)
    ? { path: 'packages/workflow-control/result.json' }
    : {};
}

describe('ProcessCapabilityBroker', () => {
  it('derives role from the process-bound session and audits allows', () => {
    const events: AuthorizationAuditEvent[] = [];
    const broker = new ProcessCapabilityBroker((event) => events.push(event));
    const capability = broker.issue(claims);
    const decision = broker.authorize(capability.token, processIdentity, {
      workspaceId: claims.workspaceId,
      runId: claims.runId,
      contractVersion: 1,
      policyDigest: claims.policyDigest,
      operation: 'workspace.patch',
      normalizedArguments: {
        path: 'packages/workflow-control/src/index.ts',
        actorRole: 'workflow_orchestrator',
      },
      nowMs: now,
    });
    expect(decision).toMatchObject({ allowed: true, role: 'implementation_worker' });
    expect(events).toEqual([expect.objectContaining({ allowed: true, observedPid: 321 })]);
  });

  it.each([
    ['process_identity_mismatch', { process: { ...processIdentity, pid: 999 } }],
    ['workspace_mismatch', { workspaceId: 'other' }],
    ['run_mismatch', { runId: 'other' }],
    ['contract_mismatch', { contractVersion: 2 }],
    ['policy_mismatch', { policyDigest: 'sha256:changed' }],
    ['operation_denied', { operation: 'github.deliver' }],
  ] as const)('denies and audits %s', (reason, change) => {
    const audit = vi.fn();
    const broker = new ProcessCapabilityBroker(audit);
    const capability = broker.issue(claims);
    const observed = 'process' in change ? change.process : processIdentity;
    const decision = broker.authorize(capability.token, observed, {
      workspaceId: 'workspaceId' in change ? change.workspaceId : claims.workspaceId,
      runId: 'runId' in change ? change.runId : claims.runId,
      contractVersion: 'contractVersion' in change ? change.contractVersion : 1,
      policyDigest: 'policyDigest' in change ? change.policyDigest : claims.policyDigest,
      operation: 'operation' in change ? change.operation : 'workspace.read',
      normalizedArguments: {},
      nowMs: now,
    });
    expect(decision).toMatchObject({ allowed: false, reason });
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ allowed: false, reason }));
  });

  it('denies revoked and expired capabilities', () => {
    const broker = new ProcessCapabilityBroker(() => undefined);
    const capability = broker.issue(claims);
    broker.revoke(capability.token);
    const request = {
      workspaceId: claims.workspaceId,
      runId: claims.runId,
      contractVersion: 1,
      policyDigest: claims.policyDigest,
      operation: 'workspace.read' as const,
      normalizedArguments: {},
      nowMs: now,
    };
    expect(broker.authorize(capability.token, processIdentity, request)).toMatchObject({
      reason: 'revoked_capability',
    });
    const expiry = Date.now() + 60_000;
    const shortLived = broker.issue({ ...claims, expiresAtMs: expiry });
    expect(
      broker.authorize(shortLived.token, processIdentity, { ...request, nowMs: expiry }),
    ).toMatchObject({ reason: 'expired_capability' });
  });

  it('rejects capability issuance above the fixed role ceiling', () => {
    const broker = new ProcessCapabilityBroker(() => undefined);
    expect(() =>
      broker.issue({ ...claims, role: 'code_reviewer', operations: ['workspace.patch'] }),
    ).toThrow('denied for role code_reviewer');
  });

  it('denies path-bound operations outside assigned source paths', () => {
    const audit = vi.fn();
    const broker = new ProcessCapabilityBroker(audit);
    const capability = broker.issue(claims);
    const baseRequest = {
      workspaceId: claims.workspaceId,
      runId: claims.runId,
      contractVersion: 1,
      policyDigest: claims.policyDigest,
      operation: 'workspace.patch' as const,
      nowMs: now,
    };
    expect(
      broker.authorize(capability.token, processIdentity, {
        ...baseRequest,
        normalizedArguments: { path: 'packages/workflow-control/src/index.ts' },
      }),
    ).toMatchObject({ allowed: true });
    expect(
      broker.authorize(capability.token, processIdentity, {
        ...baseRequest,
        normalizedArguments: { path: 'apps/api/src/index.ts' },
      }),
    ).toMatchObject({ allowed: false, reason: 'path_denied' });
  });

  it('denies and audits every prohibited role-operation pair', () => {
    for (const [role, allowedOperations] of Object.entries(DEFAULT_ROLE_OPERATION_POLICY)) {
      const audit = vi.fn();
      const broker = new ProcessCapabilityBroker(audit);
      const capability = broker.issue({
        ...claims,
        role: role as CapabilityClaims['role'],
        operations: allowedOperations,
      });
      for (const operation of workflowOperationSchema.options) {
        const decision = broker.authorize(capability.token, processIdentity, {
          workspaceId: claims.workspaceId,
          runId: claims.runId,
          contractVersion: 1,
          policyDigest: claims.policyDigest,
          operation,
          normalizedArguments: pathBoundArguments(operation),
          nowMs: now,
        });
        expect(decision.allowed).toBe(allowedOperations.includes(operation));
        if (!allowedOperations.includes(operation)) {
          expect(decision.reason).toBe('operation_denied');
        }
      }
      expect(audit).toHaveBeenCalledTimes(workflowOperationSchema.options.length);
    }
  });

  it('audits malformed normalized arguments as a denial', () => {
    const audit = vi.fn();
    const broker = new ProcessCapabilityBroker(audit);
    const capability = broker.issue(claims);
    const cyclic: { self?: unknown } = {};
    cyclic.self = cyclic;
    const decision = broker.authorize(capability.token, processIdentity, {
      workspaceId: claims.workspaceId,
      runId: claims.runId,
      contractVersion: 1,
      policyDigest: claims.policyDigest,
      operation: 'workspace.read',
      normalizedArguments: cyclic,
      nowMs: now,
    });
    expect(decision).toEqual({
      allowed: false,
      reason: 'invalid_arguments',
      argumentsDigest: 'invalid',
    });
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ reason: 'invalid_arguments' }));
  });
});

describe('built-in collaboration boundary', () => {
  it('permits only read-only use before capability establishment or after revocation', () => {
    expect(() =>
      assertBuiltInCollaborationAgentAllowed({
        privilegedCapabilityActive: false,
        mutationCapableToolsExposed: false,
      }),
    ).not.toThrow();
    expect(() =>
      assertBuiltInCollaborationAgentAllowed({
        privilegedCapabilityActive: true,
        mutationCapableToolsExposed: false,
      }),
    ).toThrow('capability is active');
    expect(() =>
      assertBuiltInCollaborationAgentAllowed({
        privilegedCapabilityActive: false,
        mutationCapableToolsExposed: true,
      }),
    ).toThrow('read-only primary session');
  });
});

describe('approval resume', () => {
  it('revalidates identity, operation, arguments, policy and expiry', () => {
    const tokenDigest = capabilityTokenDigest('opaque-token');
    const binding = {
      capabilityTokenDigest: tokenDigest,
      agentId: 'worker-1',
      operation: 'workspace.patch' as const,
      argumentsDigest: digestNormalizedArguments({ path: 'safe.ts', content: 'x' }),
      workspaceId: 'workspace-1',
      runId: 'run-1',
      contractVersion: 1,
      policyDigest: 'sha256:policy',
      expiresAtMs: now + 60_000,
    };
    const context = {
      capabilityTokenDigest: tokenDigest,
      agentId: 'worker-1',
      operation: 'workspace.patch' as const,
      normalizedArguments: { content: 'x', path: 'safe.ts' },
      workspaceId: 'workspace-1',
      runId: 'run-1',
      contractVersion: 1,
      policyDigest: 'sha256:policy',
      nowMs: now,
    };
    expect(() => revalidateApproval(binding, context)).not.toThrow();
    expect(() =>
      revalidateApproval(binding, { ...context, normalizedArguments: { path: 'other.ts' } }),
    ).toThrow('arguments changed');
    expect(() => revalidateApproval(binding, { ...context, policyDigest: 'changed' })).toThrow(
      'policy binding changed',
    );
  });
});
