import { createHash, randomBytes } from 'node:crypto';

import type { WorkflowOperation, WorkflowRole } from './contracts.js';

export interface ProcessIdentity {
  pid: number;
  startTimeMs: number;
  executableDigest: string;
}

export interface CapabilityClaims {
  workspaceId: string;
  runId: string;
  role: WorkflowRole;
  contractVersion: number;
  policyDigest: string;
  operations: readonly WorkflowOperation[];
  allowedPaths: readonly string[];
  expiresAtMs: number;
  process: ProcessIdentity;
}

export interface CapabilityHandle {
  token: string;
  expiresAtMs: number;
}

export interface AuthorizationRequest {
  workspaceId: string;
  runId: string;
  contractVersion: number;
  policyDigest: string;
  operation: WorkflowOperation;
  normalizedArguments: unknown;
  nowMs: number;
}

export interface AuthorizationDecision {
  allowed: boolean;
  role?: string;
  reason?: string;
  argumentsDigest: string;
}

export interface AuthorizationAuditEvent extends AuthorizationDecision {
  atMs: number;
  workspaceId: string;
  runId: string;
  operation: WorkflowOperation;
  observedPid: number;
}

export type AuthorizationAuditSink = (event: AuthorizationAuditEvent) => void;
export type RoleOperationPolicy = Readonly<Record<WorkflowRole, readonly WorkflowOperation[]>>;

export const DEFAULT_ROLE_OPERATION_POLICY: RoleOperationPolicy = {
  feature_planner: ['workspace.read', 'beads.read', 'github.read'],
  plan_critic: ['workspace.read', 'beads.read', 'github.read'],
  workflow_orchestrator: [
    'workspace.read',
    'artifact.write',
    'workflow.transition',
    'beads.read',
    'beads.mutate',
    'git.read',
    'git.commit',
    'git.push',
    'github.read',
    'github.deliver',
  ],
  repo_explorer: ['workspace.read', 'beads.read', 'github.read'],
  implementation_worker: ['workspace.read', 'workspace.patch', 'process.test', 'artifact.write'],
  code_reviewer: ['workspace.read', 'beads.read', 'git.read', 'github.read'],
  test_runner: ['workspace.read', 'process.test', 'artifact.write', 'github.read'],
  qa_evaluator: ['workspace.read', 'process.test', 'artifact.write', 'github.read'],
  feature_evaluator: ['workspace.read', 'beads.read', 'git.read', 'github.read'],
};

interface StoredCapability {
  tokenDigest: Buffer;
  claims: CapabilityClaims;
  revoked: boolean;
}

const pathBoundOperations = new Set<WorkflowOperation>([
  'workspace.read',
  'workspace.patch',
  'artifact.write',
]);

function pathIsWithin(path: string, roots: readonly string[]): boolean {
  return (
    !path.startsWith('/') &&
    !path.split('/').includes('..') &&
    roots.some((root) => path === root || path.startsWith(`${root}/`))
  );
}

function argumentsStayWithinPaths(value: unknown, roots: readonly string[]): boolean {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const paths = [
    ...(typeof record.path === 'string' ? [record.path] : []),
    ...(Array.isArray(record.paths) && record.paths.every((path) => typeof path === 'string')
      ? (record.paths as string[])
      : []),
  ];
  return paths.length > 0 && paths.every((path) => pathIsWithin(path, roots));
}

function canonicalize(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value))
      throw new Error('normalized arguments must contain finite numbers');
    return JSON.stringify(value);
  }
  if (typeof value !== 'object') throw new Error('normalized arguments must be JSON values');
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => `${JSON.stringify(key)}:${canonicalize(item)}`)
    .join(',')}}`;
}

export function digestNormalizedArguments(value: unknown): string {
  return `sha256:${createHash('sha256').update(canonicalize(value)).digest('hex')}`;
}

function tokenDigest(token: string): Buffer {
  return createHash('sha256').update(token).digest();
}

function sameProcess(expected: ProcessIdentity, observed: ProcessIdentity): boolean {
  return (
    expected.pid === observed.pid &&
    expected.startTimeMs === observed.startTimeMs &&
    expected.executableDigest === observed.executableDigest
  );
}

export class ProcessCapabilityBroker {
  readonly #capabilities = new Map<string, StoredCapability>();
  readonly #audit: AuthorizationAuditSink;
  readonly #policy: RoleOperationPolicy;

  constructor(
    audit: AuthorizationAuditSink,
    policy: RoleOperationPolicy = DEFAULT_ROLE_OPERATION_POLICY,
  ) {
    this.#audit = audit;
    this.#policy = policy;
  }

  issue(claims: CapabilityClaims): CapabilityHandle {
    if (claims.operations.length === 0) throw new Error('capability operations must not be empty');
    if (claims.allowedPaths.length === 0) throw new Error('capability paths must not be empty');
    const roleOperations = this.#policy[claims.role];
    const unauthorized = claims.operations.find((operation) => !roleOperations.includes(operation));
    if (unauthorized !== undefined) {
      throw new Error(`capability operation ${unauthorized} is denied for role ${claims.role}`);
    }
    if (claims.expiresAtMs <= Date.now())
      throw new Error('capability expiry must be in the future');
    const token = randomBytes(32).toString('base64url');
    const digest = tokenDigest(token);
    this.#capabilities.set(digest.toString('hex'), {
      tokenDigest: digest,
      claims: {
        ...claims,
        operations: [...claims.operations],
        allowedPaths: [...claims.allowedPaths],
      },
      revoked: false,
    });
    return { token, expiresAtMs: claims.expiresAtMs };
  }

  revoke(token: string): void {
    const stored = this.#lookup(token);
    if (stored !== undefined) stored.revoked = true;
  }

  authorize(
    token: string,
    observedProcess: ProcessIdentity,
    request: AuthorizationRequest,
  ): AuthorizationDecision {
    let argumentsDigest = 'invalid';
    let reason: string | undefined;
    try {
      argumentsDigest = digestNormalizedArguments(request.normalizedArguments);
    } catch {
      reason = 'invalid_arguments';
    }
    const stored = this.#lookup(token);
    if (reason !== undefined) {
      // Invalid normalized input is denied before capability evaluation but is still audited below.
    } else if (stored === undefined) reason = 'unknown_capability';
    else if (stored.revoked) reason = 'revoked_capability';
    else if (!sameProcess(stored.claims.process, observedProcess))
      reason = 'process_identity_mismatch';
    else if (request.nowMs >= stored.claims.expiresAtMs) reason = 'expired_capability';
    else if (request.workspaceId !== stored.claims.workspaceId) reason = 'workspace_mismatch';
    else if (request.runId !== stored.claims.runId) reason = 'run_mismatch';
    else if (request.contractVersion !== stored.claims.contractVersion)
      reason = 'contract_mismatch';
    else if (request.policyDigest !== stored.claims.policyDigest) reason = 'policy_mismatch';
    else if (!stored.claims.operations.includes(request.operation)) reason = 'operation_denied';
    else if (
      pathBoundOperations.has(request.operation) &&
      !argumentsStayWithinPaths(request.normalizedArguments, stored.claims.allowedPaths)
    ) {
      reason = 'path_denied';
    }

    const decision: AuthorizationDecision =
      reason === undefined
        ? { allowed: true, role: stored!.claims.role, argumentsDigest }
        : { allowed: false, reason, argumentsDigest };
    this.#audit({
      ...decision,
      atMs: request.nowMs,
      workspaceId: request.workspaceId,
      runId: request.runId,
      operation: request.operation,
      observedPid: observedProcess.pid,
    });
    return decision;
  }

  #lookup(token: string): StoredCapability | undefined {
    return this.#capabilities.get(tokenDigest(token).toString('hex'));
  }
}

export function assertBuiltInCollaborationAgentAllowed(input: {
  privilegedCapabilityActive: boolean;
  mutationCapableToolsExposed: boolean;
}): void {
  if (input.privilegedCapabilityActive) {
    throw new Error('built-in collaboration agents are denied while broker capability is active');
  }
  if (input.mutationCapableToolsExposed) {
    throw new Error('built-in collaboration agents require a read-only primary session');
  }
}

export interface ApprovalBinding {
  capabilityTokenDigest: string;
  agentId: string;
  operation: WorkflowOperation;
  argumentsDigest: string;
  workspaceId: string;
  runId: string;
  contractVersion: number;
  policyDigest: string;
  expiresAtMs: number;
}

export interface ApprovalResumeContext extends Omit<
  ApprovalBinding,
  'argumentsDigest' | 'expiresAtMs'
> {
  normalizedArguments: unknown;
  nowMs: number;
}

export function capabilityTokenDigest(token: string): string {
  return `sha256:${tokenDigest(token).toString('hex')}`;
}

export function revalidateApproval(binding: ApprovalBinding, context: ApprovalResumeContext): void {
  if (context.nowMs >= binding.expiresAtMs) throw new Error('approval expired');
  const checks: Array<[unknown, unknown, string]> = [
    [context.capabilityTokenDigest, binding.capabilityTokenDigest, 'capability'],
    [context.agentId, binding.agentId, 'agent'],
    [context.operation, binding.operation, 'operation'],
    [context.workspaceId, binding.workspaceId, 'workspace'],
    [context.runId, binding.runId, 'run'],
    [context.contractVersion, binding.contractVersion, 'contract'],
    [context.policyDigest, binding.policyDigest, 'policy'],
  ];
  const mismatch = checks.find(([current, approved]) => current !== approved);
  if (mismatch !== undefined) throw new Error(`approval ${mismatch[2]} binding changed`);
  if (digestNormalizedArguments(context.normalizedArguments) !== binding.argumentsDigest) {
    throw new Error('approval arguments changed');
  }
}
