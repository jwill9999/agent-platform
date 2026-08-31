import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { realpathSync } from 'node:fs';

import { z } from 'zod';

import {
  agentResultSchema,
  evidenceReferenceSchema,
  executionContractSchema,
  relativePathSchema,
  workflowRoleSchema,
  type EvidenceReference,
  type ExecutionContract,
  type WorkflowRole,
} from './contracts.js';
import {
  workflowRepairMutationCapability,
  type RepairDispatchRecord,
  type RepairEscalationRecord,
  type WorkflowStore,
} from './storage.js';

const identifierSchema = z.string().min(1).max(200);

export const repairFailureSourceSchema = z.enum([
  'compile',
  'test',
  'review',
  'security',
  'sonar',
  'qa',
  'evaluator',
  'test_definition',
  'environment',
]);

export const repairFindingSchema = z
  .object({
    id: identifierSchema,
    runId: identifierSchema,
    taskId: identifierSchema,
    source: repairFailureSourceSchema,
    producerRole: workflowRoleSchema,
    severity: z.enum(['low', 'medium', 'high', 'critical']),
    summary: z.string().min(1),
    acceptanceCriterion: z.string().min(1).optional(),
    evidence: z.array(evidenceReferenceSchema).min(1),
  })
  .strict();

const evidenceChangeSchema = z
  .object({
    kind: z.enum(['implementation', 'environment', 'test']),
    evidence: z.array(evidenceReferenceSchema).min(1),
  })
  .strict();

export const repairChangeSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('hypothesis'), value: z.string().min(1) }).strict(),
  evidenceChangeSchema.extend({ kind: z.literal('implementation') }).strict(),
  evidenceChangeSchema.extend({ kind: z.literal('environment') }).strict(),
  evidenceChangeSchema.extend({ kind: z.literal('test') }).strict(),
]);

export const repairDispatchPacketSchema = z
  .object({
    dispatchId: identifierSchema,
    runId: identifierSchema,
    taskId: identifierSchema,
    findingId: identifierSchema,
    failureHeadSha: z.string().regex(/^[a-f0-9]{40}$/u),
    source: repairFailureSourceSchema,
    producerRole: workflowRoleSchema,
    ownerRole: workflowRoleSchema,
    summary: z.string().min(1),
    acceptanceCriterion: z.string().min(1).optional(),
    evidence: z.array(evidenceReferenceSchema).min(1),
    hypothesis: z.string().min(1),
    change: repairChangeSchema,
    remainingBudget: z
      .object({ task: z.number().int().nonnegative(), finding: z.number().int().nonnegative() })
      .strict(),
  })
  .strict();

export type RepairFailureSource = z.infer<typeof repairFailureSourceSchema>;
export type RepairFinding = z.infer<typeof repairFindingSchema>;
export type RepairChange = z.infer<typeof repairChangeSchema>;
export type RepairDispatchPacket = z.infer<typeof repairDispatchPacketSchema>;

export interface RepairFence {
  workspaceLeaseEpoch: number;
  runLeaseEpoch: number;
  taskLeaseEpoch: number;
}

export type RepairFenceProvider = (runId: string, taskId: string) => RepairFence;

export interface RepairHeadVerifier {
  assertCanonicalCommit(headSha: string): void;
  assertStrictDescendant(baseSha: string, candidateSha: string): void;
  assertExactHead(headSha: string): void;
  changedFiles(baseSha: string, candidateSha: string): string[];
}

export type RepairGitExecutor = (args: readonly string[]) => string;

function monotonicClock(clock: () => number): () => number {
  let previous = Number.NEGATIVE_INFINITY;
  return () => {
    const current = clock();
    if (!Number.isFinite(current)) throw new Error('repair clock returned a non-finite time');
    if (current < previous) throw new Error('repair clock moved backwards');
    previous = current;
    return current;
  };
}

const defaultRepairGitExecutor =
  (workspaceRoot: string): RepairGitExecutor =>
  (args) =>
    execFileSync('git', [...args], {
      cwd: workspaceRoot,
      encoding: 'utf8',
      env: {
        GIT_CONFIG_GLOBAL: '/dev/null',
        GIT_CONFIG_NOSYSTEM: '1',
        GIT_OPTIONAL_LOCKS: '0',
        GIT_TERMINAL_PROMPT: '0',
        LANG: process.env.LANG,
        LC_ALL: process.env.LC_ALL,
        PATH: process.env.PATH,
        TMPDIR: process.env.TMPDIR,
      },
      maxBuffer: 64 * 1024,
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 5000,
    });

export class LocalGitRepairHeadVerifier implements RepairHeadVerifier {
  readonly #execute: RepairGitExecutor;

  constructor(workspaceRoot: string, executor?: RepairGitExecutor) {
    if (workspaceRoot.trim() === '') throw new Error('repair Git workspace root is required');
    this.#execute = executor ?? defaultRepairGitExecutor(workspaceRoot);
  }

  #git(args: readonly string[]): string {
    return this.#gitRaw(args).trim();
  }

  #gitRaw(args: readonly string[]): string {
    try {
      return this.#execute(args);
    } catch {
      throw new Error('repair Git verification command failed or timed out');
    }
  }

  assertWorkspaceRoot(expectedCanonicalRoot: string): void {
    const actual = realpathSync(this.#git(['rev-parse', '--show-toplevel']));
    if (actual !== expectedCanonicalRoot) {
      throw new Error('repair Git verifier repository does not match the contract workspace');
    }
  }

  assertCanonicalCommit(headSha: string): void {
    if (!/^[a-f0-9]{40}$/u.test(headSha)) throw new Error('repair evidence head is not a full SHA');
    const resolved = this.#git(['rev-parse', '--verify', `${headSha}^{commit}`]);
    if (resolved !== headSha) throw new Error('repair evidence head is not canonical');
  }

  assertStrictDescendant(baseSha: string, candidateSha: string): void {
    this.assertCanonicalCommit(baseSha);
    this.assertCanonicalCommit(candidateSha);
    if (baseSha === candidateSha) throw new Error('repair head does not advance beyond failure');
    try {
      this.#git(['merge-base', '--is-ancestor', baseSha, candidateSha]);
    } catch {
      throw new Error('repair head is not a descendant of the failure baseline');
    }
  }

  assertExactHead(headSha: string): void {
    this.assertCanonicalCommit(headSha);
    const current = this.#git(['rev-parse', 'HEAD']);
    if (current !== headSha) throw new Error('repair acceptance evidence is not at exact HEAD');
    const dirty = this.#git(['status', '--porcelain', '--untracked-files=all']);
    if (dirty !== '') throw new Error('repair acceptance requires a clean exact HEAD');
    if (this.#git(['rev-parse', 'HEAD']) !== headSha) {
      throw new Error('repair acceptance HEAD changed during verification');
    }
  }

  changedFiles(baseSha: string, candidateSha: string): string[] {
    this.assertStrictDescendant(baseSha, candidateSha);
    const output = this.#gitRaw([
      'diff',
      '--name-status',
      '-z',
      '--find-renames',
      '--find-copies',
      `${baseSha}...${candidateSha}`,
      '--',
    ]);
    const tokens = output.split('\0');
    if (tokens.at(-1) === '') tokens.pop();
    const paths: string[] = [];
    for (let index = 0; index < tokens.length; ) {
      const status = tokens[index++];
      if (status === undefined || !/^(?:[ACDMRTUXB]|[RC]\d{1,3})$/u.test(status)) {
        throw new Error('repair Git diff returned an invalid status record');
      }
      const pathCount = status.startsWith('R') || status.startsWith('C') ? 2 : 1;
      for (let pathIndex = 0; pathIndex < pathCount; pathIndex += 1) {
        const path = tokens[index++];
        if (path === undefined) throw new Error('repair Git diff returned a truncated path record');
        paths.push(relativePathSchema.parse(path));
      }
    }
    if (new Set(paths).size !== paths.length)
      throw new Error('repair Git diff contains duplicate paths');
    return paths;
  }
}

const PRODUCER_BY_SOURCE: Readonly<Record<RepairFailureSource, WorkflowRole>> = {
  compile: 'test_runner',
  test: 'test_runner',
  review: 'code_reviewer',
  security: 'code_reviewer',
  sonar: 'code_reviewer',
  qa: 'qa_evaluator',
  evaluator: 'feature_evaluator',
  test_definition: 'code_reviewer',
  environment: 'test_runner',
};

const OWNER_BY_SOURCE: Readonly<Record<RepairFailureSource, WorkflowRole>> = {
  compile: 'implementation_worker',
  test: 'implementation_worker',
  review: 'implementation_worker',
  security: 'implementation_worker',
  sonar: 'implementation_worker',
  qa: 'implementation_worker',
  evaluator: 'implementation_worker',
  test_definition: 'test_runner',
  environment: 'workflow_orchestrator',
};

function changeDigest(change: RepairChange): string {
  const canonical =
    change.kind === 'hypothesis'
      ? [change.kind, change.value.trim()]
      : [
          change.kind,
          [...change.evidence]
            .map((reference) => reference.digest)
            .sort((left, right) => left.localeCompare(right)),
        ];
  return `sha256:${createHash('sha256').update(JSON.stringify(canonical)).digest('hex')}`;
}

function findingDigest(finding: RepairFinding): string {
  const canonical = JSON.stringify({
    ...finding,
    evidence: [...finding.evidence].sort((left, right) => left.digest.localeCompare(right.digest)),
  });
  return `sha256:${createHash('sha256').update(canonical).digest('hex')}`;
}

function changeEvidence(change: RepairChange): EvidenceReference[] {
  return change.kind === 'hypothesis' ? [] : change.evidence;
}

function pathWithin(path: string, root: string): boolean {
  return path === root || path.startsWith(`${root}/`);
}

export type RepairDecision =
  | { kind: 'dispatch'; dispatch: RepairDispatchRecord; packet: RepairDispatchPacket }
  | { kind: 'escalated'; escalation: RepairEscalationRecord };

export class DurableRepairCoordinator {
  readonly #store: WorkflowStore;
  readonly #contract: ExecutionContract;
  readonly #ownerId: string;
  readonly #fence: RepairFenceProvider;
  readonly #headVerifier: RepairHeadVerifier;
  readonly #clock: () => number;

  private constructor(
    store: WorkflowStore,
    contractInput: unknown,
    ownerId: string,
    fence: RepairFenceProvider,
    headVerifier: RepairHeadVerifier,
    clock: () => number = Date.now,
  ) {
    if (ownerId.trim() === '') throw new Error('repair coordinator owner is required');
    this.#store = store;
    this.#contract = executionContractSchema.parse(contractInput);
    this.#ownerId = ownerId;
    this.#fence = fence;
    this.#headVerifier = headVerifier;
    this.#clock = monotonicClock(clock);
  }

  static create(input: {
    store: WorkflowStore;
    contract: unknown;
    ownerId: string;
    fence: RepairFenceProvider;
    workspaceRoot: string;
  }): DurableRepairCoordinator {
    const contract = executionContractSchema.parse(input.contract);
    const canonicalWorkspaceRoot = realpathSync(input.workspaceRoot);
    const workspaceId = `sha256:${createHash('sha256').update(canonicalWorkspaceRoot).digest('hex')}`;
    if (workspaceId !== contract.workspaceId) {
      throw new Error('repair workspace root does not match the execution contract');
    }
    const headVerifier = new LocalGitRepairHeadVerifier(canonicalWorkspaceRoot);
    headVerifier.assertWorkspaceRoot(canonicalWorkspaceRoot);
    return new DurableRepairCoordinator(
      input.store,
      contract,
      input.ownerId,
      input.fence,
      headVerifier,
      Date.now,
    );
  }

  static createForTest(input: {
    store: WorkflowStore;
    contract: unknown;
    ownerId: string;
    fence: RepairFenceProvider;
    headVerifier: RepairHeadVerifier;
    clock?: () => number;
  }): DurableRepairCoordinator {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('custom repair head verifier is restricted to tests');
    }
    return new DurableRepairCoordinator(
      input.store,
      input.contract,
      input.ownerId,
      input.fence,
      input.headVerifier,
      input.clock,
    );
  }

  dispatch(input: {
    dispatchId: string;
    finding: unknown;
    hypothesis: string;
    change: unknown;
  }): RepairDecision {
    const finding = repairFindingSchema.parse(input.finding);
    const change = repairChangeSchema.parse(input.change);
    this.#store.assertRunUsesContract(finding.runId, this.#contract);
    const task = this.#contract.tasks.find((candidate) => candidate.id === finding.taskId);
    if (task === undefined) {
      throw new Error('repair finding references an unknown task');
    }
    if (finding.producerRole !== PRODUCER_BY_SOURCE[finding.source]) {
      throw new Error(`repair finding source ${finding.source} requires producer role`);
    }
    if (
      finding.acceptanceCriterion !== undefined &&
      !this.#contract.acceptanceCriteria.includes(finding.acceptanceCriterion)
    ) {
      throw new Error('repair finding references an unapproved acceptance criterion');
    }
    const ownerRole = OWNER_BY_SOURCE[finding.source];
    if (change.kind === 'hypothesis' && change.value.trim() !== input.hypothesis.trim()) {
      throw new Error('repair hypothesis change must use the canonical attempt hypothesis');
    }
    const normalizedChange: RepairChange =
      change.kind === 'hypothesis'
        ? { kind: 'hypothesis', value: input.hypothesis.trim() }
        : change;
    const changedEvidence = changeEvidence(normalizedChange);
    const evidenceCreatedAt = (
      reference: EvidenceReference,
      allowedProducerRoles: readonly WorkflowRole[],
    ) =>
      this.#store.getTaskEvidenceBindingCreatedAt({
        digest: reference.digest,
        mediaType: reference.mediaType,
        sizeBytes: reference.sizeBytes,
        kind: reference.kind,
        workspaceId: this.#contract.workspaceId,
        runId: finding.runId,
        taskId: finding.taskId,
        contractVersion: this.#contract.contractVersion,
        policyDigest: this.#contract.policyDigest,
        allowedProducerRoles,
      });
    const failureEvidenceBindings = finding.evidence.map((reference) =>
      evidenceCreatedAt(reference, [finding.producerRole]),
    );
    if (failureEvidenceBindings.some((binding) => binding === undefined)) {
      throw new Error('repair finding references unbound producer evidence');
    }
    const failureHeads = new Set(failureEvidenceBindings.map((binding) => binding!.headSha));
    if (failureHeads.has('') || failureHeads.size !== 1) {
      throw new Error('repair finding evidence must bind to one canonical failure head');
    }
    const failureHeadSha = [...failureHeads][0]!;
    this.#headVerifier.assertCanonicalCommit(failureHeadSha);
    const changeEvidenceBindings = changedEvidence.map((reference) =>
      evidenceCreatedAt(reference, [ownerRole]),
    );
    if (changeEvidenceBindings.some((binding) => binding === undefined)) {
      throw new Error('repair change references unbound owner evidence');
    }
    const failureEvidenceAtMs = Math.max(
      ...failureEvidenceBindings.map((binding) => binding!.createdAtMs),
    );
    const changeEvidenceTimes = changeEvidenceBindings.map((binding) => binding!.createdAtMs);
    const changeEvidenceAtMs =
      changeEvidenceTimes.length === 0 ? null : Math.max(...changeEvidenceTimes);
    const changeEvidenceMinAtMs =
      changeEvidenceTimes.length === 0 ? null : Math.min(...changeEvidenceTimes);
    const changeHeads = new Set(changeEvidenceBindings.map((binding) => binding!.headSha));
    if (changeEvidenceBindings.some((binding) => binding!.headSha === '')) {
      throw new Error('repair change evidence requires a nonempty repaired head');
    }
    if (changeEvidenceBindings.length > 0 && changeHeads.size !== 1) {
      throw new Error('repair change evidence must bind to one repaired head');
    }
    const changeHeadSha = changeHeads.size === 1 ? [...changeHeads][0]! : null;
    if (changeHeadSha !== null) {
      this.#headVerifier.assertStrictDescendant(failureHeadSha, changeHeadSha);
    }
    if (changeEvidenceMinAtMs !== null && changeEvidenceMinAtMs <= failureEvidenceAtMs) {
      throw new Error('repair evidence does not prove a newer changed condition');
    }
    const evidence = [...finding.evidence, ...changedEvidence];
    const packetForAttempt = (taskAttempt: number, findingAttempt: number) =>
      repairDispatchPacketSchema.parse({
        dispatchId: input.dispatchId,
        runId: finding.runId,
        taskId: finding.taskId,
        findingId: finding.id,
        failureHeadSha,
        source: finding.source,
        producerRole: finding.producerRole,
        ownerRole,
        summary: finding.summary,
        acceptanceCriterion: finding.acceptanceCriterion,
        evidence: finding.evidence,
        hypothesis: input.hypothesis.trim(),
        change: normalizedChange,
        remainingBudget: {
          task: Math.max(0, this.#contract.retryPolicy.implementationAttempts - taskAttempt),
          finding: Math.max(0, this.#contract.retryPolicy.findingAttempts - findingAttempt),
        },
      });
    const planned = this.#store.planRepairDispatch(
      {
        id: input.dispatchId,
        runId: finding.runId,
        taskId: finding.taskId,
        findingId: finding.id,
        ownerRole,
        findingDigest: findingDigest(finding),
        failureHeadSha,
        hypothesis: input.hypothesis.trim(),
        requiresHypothesisChange: change.kind === 'hypothesis',
        changeDigest: changeDigest(normalizedChange),
        changeEvidenceMinAtMs,
        changeEvidenceAtMs,
        changeHeadSha,
        failureEvidenceAtMs,
        packet: packetForAttempt,
        maxTaskAttempts: this.#contract.retryPolicy.implementationAttempts,
        maxFindingAttempts: this.#contract.retryPolicy.findingAttempts,
        escalationReport: (scope, attemptsUsed) => ({
          reason: 'approved_repair_budget_exhausted',
          scope,
          scopeId: scope === 'task' ? finding.taskId : finding.id,
          finding,
          attemptsUsed,
          evidence,
        }),
        nowMs: this.#clock(),
        workspaceId: this.#contract.workspaceId,
        ownerId: this.#ownerId,
        ...this.#fence(finding.runId, finding.taskId),
      },
      workflowRepairMutationCapability,
    );
    if (planned.kind === 'escalated') return planned;
    const persistedPacket = repairDispatchPacketSchema.parse(planned.dispatch.packet);
    return { kind: 'dispatch', dispatch: planned.dispatch, packet: persistedPacket };
  }

  accept(dispatchId: string, resultInput: unknown): RepairDispatchRecord {
    const result = agentResultSchema.parse(resultInput);
    const dispatch = this.#store.getRepairDispatch(dispatchId);
    if (dispatch === undefined) throw new Error('repair dispatch not found');
    const packet = repairDispatchPacketSchema.parse(dispatch.packet);
    const task = this.#contract.tasks.find((candidate) => candidate.id === packet.taskId);
    if (task === undefined) throw new Error('repair dispatch task is no longer in the contract');
    if (
      result.status !== 'passed' ||
      result.acceptanceCriteria.failed.length > 0 ||
      result.findings.length > 0 ||
      result.remainingRisks.length > 0 ||
      (result.recommendedTransition !== 'continue' && result.recommendedTransition !== 'integrate')
    ) {
      throw new Error('repair result is not accepted');
    }
    if (
      packet.acceptanceCriterion !== undefined &&
      !result.acceptanceCriteria.passed.includes(packet.acceptanceCriterion)
    ) {
      throw new Error('repair result does not prove the affected acceptance criterion');
    }
    if (
      result.acceptanceCriteria.passed.some(
        (criterion) => !this.#contract.acceptanceCriteria.includes(criterion),
      )
    ) {
      throw new Error('repair result claims an unapproved acceptance criterion');
    }
    if (result.evidence.length === 0) throw new Error('repair acceptance requires evidence');
    const verifierBindings = result.evidence.map((reference) =>
      this.#store.getTaskEvidenceBindingCreatedAt({
        digest: reference.digest,
        mediaType: reference.mediaType,
        sizeBytes: reference.sizeBytes,
        kind: reference.kind,
        workspaceId: this.#contract.workspaceId,
        runId: packet.runId,
        taskId: packet.taskId,
        contractVersion: this.#contract.contractVersion,
        policyDigest: this.#contract.policyDigest,
        allowedProducerRoles: [packet.producerRole],
      }),
    );
    if (verifierBindings.some((binding) => binding === undefined)) {
      throw new Error('repair acceptance references unbound verifier evidence');
    }
    const verifierHeads = new Set(verifierBindings.map((binding) => binding!.headSha));
    if (verifierHeads.has('') || verifierHeads.size !== 1) {
      throw new Error('repair acceptance evidence must bind to one repaired head');
    }
    if (
      verifierBindings.some(
        (binding) =>
          binding!.createdAtMs <= dispatch.createdAtMs ||
          binding!.headSha === '' ||
          (dispatch.changeHeadSha !== null && binding!.headSha !== dispatch.changeHeadSha),
      )
    ) {
      throw new Error('repair acceptance evidence predates or does not match the repaired head');
    }
    const verifierHead = [...verifierHeads][0]!;
    if (dispatch.changeHeadSha === null) {
      this.#headVerifier.assertStrictDescendant(dispatch.failureHeadSha, verifierHead);
    }
    return this.#store.acceptRepairDispatch(
      {
        id: dispatchId,
        result,
        workspaceId: this.#contract.workspaceId,
        ownerId: this.#ownerId,
        ...this.#fence(packet.runId, packet.taskId),
        assertExternalState: () => {
          const observedFiles = this.#headVerifier.changedFiles(
            dispatch.failureHeadSha,
            verifierHead,
          );
          const reportedFiles = new Set(result.changedFiles);
          const observedSet = new Set(observedFiles);
          if (
            reportedFiles.size !== result.changedFiles.length ||
            observedSet.size !== reportedFiles.size ||
            [...observedSet].some((path) => !reportedFiles.has(path))
          ) {
            throw new Error('repair result changed files do not match the trusted Git diff');
          }
          if (
            observedFiles.some(
              (path) => !task.allowedPaths.some((allowedPath) => pathWithin(path, allowedPath)),
            )
          ) {
            throw new Error('trusted repair Git diff exceeds task authority');
          }
          this.#headVerifier.assertExactHead(verifierHead);
        },
        clock: this.#clock,
      },
      workflowRepairMutationCapability,
    );
  }

  cancel(dispatchId: string, reason: string): RepairDispatchRecord {
    if (reason.trim() === '') throw new Error('repair cancellation reason is required');
    const dispatch = this.#store.getRepairDispatch(dispatchId);
    if (dispatch === undefined) throw new Error('repair dispatch not found');
    const packet = repairDispatchPacketSchema.parse(dispatch.packet);
    return this.#store.cancelRepairDispatch(
      {
        id: dispatchId,
        reason: { reason },
        workspaceId: this.#contract.workspaceId,
        ownerId: this.#ownerId,
        ...this.#fence(packet.runId, packet.taskId),
        nowMs: this.#clock(),
      },
      workflowRepairMutationCapability,
    );
  }

  recover(dispatchId: string): RepairDispatchRecord | undefined {
    return this.#store.getRepairDispatch(dispatchId);
  }
}

export function repairOwnerForSource(source: RepairFailureSource): WorkflowRole {
  return OWNER_BY_SOURCE[source];
}
