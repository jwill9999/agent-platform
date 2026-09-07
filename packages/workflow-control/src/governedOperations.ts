import { createHash } from 'node:crypto';

import { z } from 'zod';

import { EXECUTION_CONTRACT_VERSION } from './contracts.js';
import { NORMATIVE_TRANSITIONS, workflowStateSchema, type WorkflowState } from './stateMachine.js';

const identifier = z.string().min(1).max(200);
const digest = z.string().regex(/^sha256:[a-f0-9]{64}$/u);
const sha = z.string().regex(/^[a-f0-9]{40,64}$/u);
const repository = z.string().regex(/^[^/\s]+\/[^/\s]+$/u);

export function digestGovernedValue(value: unknown): string {
  return `sha256:${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;
}

const runBinding = {
  workspaceId: digest,
  runId: identifier,
  taskId: identifier,
  actorRole: z.literal('workflow_orchestrator'),
  contractVersion: z.literal(EXECUTION_CONTRACT_VERSION),
  policyDigest: digest,
  materialDigest: digest,
  ownerId: identifier,
  workspaceLeaseEpoch: z.number().int().positive(),
  runLeaseEpoch: z.number().int().positive(),
  taskLeaseEpoch: z.number().int().positive(),
};

export const beadsTaskNoteUpdateSchema = z
  .object({
    ...runBinding,
    kind: z.literal('beads.task_note_update'),
    expectedPriorNotesDigest: digest,
    expectedNonNotesDigest: digest,
    replacementNotes: z.string().max(100_000),
    replacementNotesDigest: digest,
  })
  .strict()
  .superRefine((request, context) => {
    if (digestGovernedValue(request.replacementNotes) !== request.replacementNotesDigest) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'replacement notes digest mismatch',
      });
    }
  });

const githubThreadBinding = {
  ...runBinding,
  repository,
  pullRequestNumber: z.number().int().positive(),
  headSha: sha,
  threadId: identifier,
  reviewEventIdentity: identifier,
};

export const githubReviewThreadsObserveSchema = z
  .object({
    ...runBinding,
    kind: z.literal('github.review_threads_observe'),
    repository,
    pullRequestNumber: z.number().int().positive(),
    headSha: sha,
    reviewEventIdentity: identifier,
  })
  .strict();

export const githubReviewThreadReplySchema = z
  .object({
    ...githubThreadBinding,
    kind: z.literal('github.review_thread_reply'),
    disposition: z.enum([
      'actionable',
      'repaired',
      'already_addressed',
      'false_positive',
      'informational',
      'human_decision_required',
    ]),
    evidenceDigests: z.array(digest).min(1),
    replyBody: z.string().min(1).max(20_000),
    replyBodyDigest: digest,
    reviewerAgentId: identifier,
    implementingAgentId: identifier,
  })
  .strict()
  .superRefine((request, context) => {
    if (request.reviewerAgentId === request.implementingAgentId) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'reviewer separation is required' });
    }
    if (digestGovernedValue(request.replyBody) !== request.replyBodyDigest) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'reply body digest mismatch' });
    }
  });

export const githubReviewThreadResolveSchema = z
  .object({
    ...githubThreadBinding,
    kind: z.literal('github.review_thread_resolve'),
    acceptedDispositionDigest: digest,
    replyMessageId: identifier,
  })
  .strict();

export const governedExternalRequestSchema = z.union([
  beadsTaskNoteUpdateSchema,
  githubReviewThreadsObserveSchema,
  githubReviewThreadReplySchema,
  githubReviewThreadResolveSchema,
]);
export type GovernedExternalRequest = z.infer<typeof governedExternalRequestSchema>;

export interface BeadsTaskWithNotesSnapshot {
  id: string;
  notes: string;
  status: string;
  description: string;
  acceptanceCriteria: string;
  owner: string | null;
  dependencies: readonly string[];
  revision: string;
}

function beadsNonNotesDigest(issue: BeadsTaskWithNotesSnapshot): string {
  return digestGovernedValue({
    id: issue.id,
    status: issue.status,
    description: issue.description,
    acceptanceCriteria: issue.acceptanceCriteria,
    owner: issue.owner,
    dependencies: issue.dependencies,
  });
}

export interface NarrowBeadsNotesClient {
  readIssue(workspaceId: string, taskId: string): Promise<BeadsTaskWithNotesSnapshot>;
  compareAndSwapNotes(input: {
    workspaceId: string;
    taskId: string;
    expectedRevision: string;
    expectedPriorNotesDigest: string;
    expectedNonNotesDigest: string;
    replacementNotes: string;
    replacementNotesDigest: string;
    idempotencyKey: string;
  }): Promise<BeadsTaskWithNotesSnapshot>;
}

export interface ReviewThreadSnapshot {
  id: string;
  isResolved: boolean;
  headSha: string;
  reviewEventIdentity: string;
  replies: readonly { messageId: string; bodyDigest: string }[];
  acceptedDispositionDigest: string | null;
}

export interface NarrowGitHubReviewClient {
  observeThreads(input: {
    repository: string;
    pullRequestNumber: number;
    headSha: string;
  }): Promise<readonly ReviewThreadSnapshot[]>;
  replyToThread(input: {
    repository: string;
    pullRequestNumber: number;
    threadId: string;
    body: string;
    idempotencyKey: string;
  }): Promise<{ messageId: string }>;
  resolveThread(input: {
    repository: string;
    pullRequestNumber: number;
    threadId: string;
    expectedHeadSha: string;
    expectedReviewEventIdentity: string;
    idempotencyKey: string;
  }): Promise<{ resolved: true }>;
}

export interface NarrowGovernedExternalClient
  extends NarrowBeadsNotesClient, NarrowGitHubReviewClient {}

const productionGovernedPorts = new WeakSet<object>();

/** Marks a narrowly constructed application adapter as eligible for production brokering. */
export function registerProductionGovernedPort<T extends object>(port: T): T {
  productionGovernedPorts.add(port);
  return port;
}

export function assertProductionGovernedPort(port: object): void {
  if (!productionGovernedPorts.has(port)) throw new Error('unregistered governed mutation port');
}

class ProductionGovernedExternalPort implements GovernedMutationPort {
  constructor(readonly client: NarrowGovernedExternalClient) {}

  async observe(request: GovernedExternalRequest) {
    if (request.kind === 'beads.task_note_update') {
      const issue = await this.client.readIssue(request.workspaceId, request.taskId);
      const currentDigest = digestGovernedValue(issue.notes);
      if (beadsNonNotesDigest(issue) !== request.expectedNonNotesDigest) {
        return { kind: 'conflict' as const, result: issue };
      }
      if (currentDigest === request.replacementNotesDigest) {
        return { kind: 'expected' as const, result: issue };
      }
      return currentDigest === request.expectedPriorNotesDigest
        ? { kind: 'unchanged' as const, result: issue }
        : { kind: 'conflict' as const, result: issue };
    }
    const threads = await this.client.observeThreads({
      repository: request.repository,
      pullRequestNumber: request.pullRequestNumber,
      headSha: request.headSha,
    });
    if (
      threads.some(
        (thread) =>
          thread.headSha !== request.headSha ||
          thread.reviewEventIdentity !== request.reviewEventIdentity,
      )
    ) {
      return { kind: 'conflict' as const, result: threads };
    }
    if (request.kind === 'github.review_threads_observe') {
      return { kind: 'expected' as const, result: threads };
    }
    const thread = threads.find((candidate) => candidate.id === request.threadId);
    if (thread === undefined) return { kind: 'conflict' as const, result: threads };
    if (request.kind === 'github.review_thread_reply') {
      const reply = thread.replies.find(
        (candidate) => candidate.bodyDigest === request.replyBodyDigest,
      );
      return reply === undefined
        ? { kind: 'unchanged' as const, result: thread }
        : { kind: 'expected' as const, result: reply };
    }
    return thread.isResolved &&
      thread.acceptedDispositionDigest === request.acceptedDispositionDigest &&
      thread.replies.some((reply) => reply.messageId === request.replyMessageId)
      ? { kind: 'expected' as const, result: thread }
      : { kind: 'unchanged' as const, result: thread };
  }

  async mutate(
    request: GovernedExternalRequest,
    idempotencyKey: string,
    guard: GovernedMutationGuard,
  ): Promise<unknown> {
    if (request.kind === 'beads.task_note_update') {
      const prior = await this.client.readIssue(request.workspaceId, request.taskId);
      return guard(() =>
        this.client.compareAndSwapNotes({
          workspaceId: request.workspaceId,
          taskId: request.taskId,
          expectedRevision: prior.revision,
          expectedPriorNotesDigest: request.expectedPriorNotesDigest,
          expectedNonNotesDigest: request.expectedNonNotesDigest,
          replacementNotes: request.replacementNotes,
          replacementNotesDigest: request.replacementNotesDigest,
          idempotencyKey,
        }),
      );
    }
    if (request.kind === 'github.review_threads_observe') {
      throw new Error('review-thread observation is read-only');
    }
    if (request.kind === 'github.review_thread_reply') {
      return guard(() =>
        this.client.replyToThread({
          repository: request.repository,
          pullRequestNumber: request.pullRequestNumber,
          threadId: request.threadId,
          body: request.replyBody,
          idempotencyKey,
        }),
      );
    }
    return guard(() =>
      this.client.resolveThread({
        repository: request.repository,
        pullRequestNumber: request.pullRequestNumber,
        threadId: request.threadId,
        expectedHeadSha: request.headSha,
        expectedReviewEventIdentity: request.reviewEventIdentity,
        idempotencyKey,
      }),
    );
  }
}

export function createProductionGovernedExternalPort(
  client: NarrowGovernedExternalClient,
): GovernedMutationPort {
  return registerProductionGovernedPort(Object.freeze(new ProductionGovernedExternalPort(client)));
}

export const approvalNotificationStateSchema = z.enum([
  'prepared',
  'delivery_pending',
  'delivered',
  'delivery_failed',
  'approved',
  'resume_pending',
  'resumed',
]);
export type ApprovalNotificationState = z.infer<typeof approvalNotificationStateSchema>;

export const approvalNotificationSchema = z
  .object({
    kind: z.literal('notification.approval'),
    eventId: digest,
    workspaceId: digest,
    runId: identifier,
    taskId: identifier,
    phase: identifier,
    predecessor: workflowStateSchema,
    resumeTarget: workflowStateSchema,
    contractVersion: z.literal(EXECUTION_CONTRACT_VERSION),
    policyDigest: digest,
    materialDigest: digest,
    headSha: sha,
    actionScopeDigest: digest,
    recipientIdentity: identifier,
    destinationDigest: digest,
    allowedResponseDigest: digest,
    expiresAtMs: z.number().int().positive(),
    ownerId: identifier,
    workspaceLeaseEpoch: z.number().int().positive(),
    runLeaseEpoch: z.number().int().positive(),
    taskLeaseEpoch: z.number().int().positive(),
    maxAttempts: z.number().int().positive(),
  })
  .strict()
  .superRefine((event, context) => {
    const identity = Object.fromEntries(Object.entries(event).filter(([key]) => key !== 'eventId'));
    if (digestGovernedValue(identity) !== event.eventId) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'approval event id mismatch' });
    }
  });
export type ApprovalNotification = z.infer<typeof approvalNotificationSchema>;

const notificationTransitions: Readonly<
  Record<ApprovalNotificationState, readonly ApprovalNotificationState[]>
> = {
  prepared: ['delivery_pending'],
  delivery_pending: ['delivered', 'delivery_failed'],
  delivered: ['approved'],
  delivery_failed: ['delivery_pending', 'resume_pending'],
  approved: ['resume_pending'],
  resume_pending: ['resume_pending', 'resumed', 'delivery_failed'],
  resumed: [],
};

export function validateApprovalNotificationTransition(input: {
  from: ApprovalNotificationState;
  to: ApprovalNotificationState;
  authenticatedHumanResponse?: boolean;
  providerAcceptedAtMs?: number;
}): void {
  if (!notificationTransitions[input.from].includes(input.to)) {
    throw new Error(`invalid approval notification transition: ${input.from} -> ${input.to}`);
  }
  if (input.to === 'delivered' || input.to === 'resumed') {
    if (input.providerAcceptedAtMs === undefined)
      throw new Error('provider acceptance is required');
  }
  if (input.to === 'approved' && input.authenticatedHumanResponse !== true) {
    throw new Error('authenticated human response is required');
  }
}

export const delegateTerminalStatusSchema = z.enum([
  'continue',
  'repair',
  'approval_required',
  'blocked',
  'complete',
]);
export type DelegateTerminalStatus = z.infer<typeof delegateTerminalStatusSchema>;

export const delegateCallbackSchema = z
  .object({
    kind: z.literal('workflow.delegate_callback'),
    callbackId: digest,
    workspaceId: digest,
    parentRunId: identifier,
    parentTaskId: identifier,
    parentState: z.custom<WorkflowState>(
      (value) => typeof value === 'string' && value in NORMATIVE_TRANSITIONS,
    ),
    parentRunVersion: z.number().int().nonnegative(),
    delegationId: identifier,
    delegateAgentId: identifier,
    delegateRole: identifier,
    attemptNumber: z.number().int().positive(),
    contractVersion: z.literal(EXECUTION_CONTRACT_VERSION),
    policyDigest: digest,
    materialDigest: digest,
    workspaceLeaseEpoch: z.number().int().positive(),
    parentRunLeaseEpoch: z.number().int().positive(),
    taskLeaseEpoch: z.number().int().positive(),
    headSha: sha,
    inputProducerIdentity: identifier,
    resultProducerIdentity: identifier,
    inputArtifactDigest: digest,
    terminalStatus: delegateTerminalStatusSchema,
    resultArtifactDigest: digest,
    approvalIntent: z
      .object({
        eventId: digest,
        phase: identifier,
        resumeTarget: workflowStateSchema,
        recipientIdentity: identifier,
        deadlineMs: z.number().int().positive(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .superRefine((callback, context) => {
    const identity = Object.fromEntries(
      Object.entries(callback).filter(([key]) => key !== 'callbackId'),
    );
    if (digestGovernedValue(identity) !== callback.callbackId) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'delegate callback id mismatch' });
    }
    if (callback.terminalStatus === 'approval_required' && callback.approvalIntent === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'approval callback requires intent',
      });
    }
    if (callback.terminalStatus !== 'approval_required' && callback.approvalIntent !== undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'non-approval callback cannot carry intent',
      });
    }
  });
export type DelegateCallback = z.infer<typeof delegateCallbackSchema>;

export const DELEGATE_CALLBACK_TARGETS = {
  implementing: {
    continue: 'task_verification',
    repair: 'task_verification',
    blocked: 'escalated',
  },
  task_verification: { continue: 'task_review', repair: 'repair', blocked: 'escalated' },
  task_review: {
    continue: 'task_accepted',
    repair: 'repair',
    approval_required: 'approval_waiting',
    blocked: 'escalated',
  },
  feature_evaluation: {
    continue: 'pipeline',
    repair: 'repair_planning',
    approval_required: 'approval_waiting',
    blocked: 'escalated',
  },
  repair_planning: {
    continue: 'implementing',
    approval_required: 'approval_waiting',
    blocked: 'escalated',
  },
  pipeline: {
    continue: 'delivery',
    repair: 'repair_planning',
    approval_required: 'approval_waiting',
    blocked: 'escalated',
  },
  delivery: { continue: 'finalizing', approval_required: 'approval_waiting', blocked: 'escalated' },
  finalizing: {
    complete: 'finalizing',
    approval_required: 'approval_waiting',
    blocked: 'escalated',
  },
} as const satisfies Partial<
  Record<WorkflowState, Partial<Record<DelegateTerminalStatus, WorkflowState>>>
>;

export function delegateCallbackTarget(callbackInput: unknown): WorkflowState {
  const callback = delegateCallbackSchema.parse(callbackInput);
  const phase =
    DELEGATE_CALLBACK_TARGETS[callback.parentState as keyof typeof DELEGATE_CALLBACK_TARGETS];
  const target = phase?.[callback.terminalStatus as keyof typeof phase] as
    | WorkflowState
    | undefined;
  if (target === undefined) throw new Error('unmapped delegate callback');
  if (!NORMATIVE_TRANSITIONS[callback.parentState].includes(target)) {
    throw new Error('delegate callback target is absent from normative transitions');
  }
  return target;
}

export const lineageImportSchema = z
  .object({
    kind: z.literal('workflow.lineage_import'),
    sourceRunId: identifier,
    targetRunId: identifier,
    sourceTaskId: identifier,
    targetTaskId: identifier,
    sourceState: z.literal('cancelled'),
    targetState: z.literal('approved'),
    sourceFenced: z.literal(true),
    sourcePreparedOperationCount: z.literal(0),
    ref: z.string().regex(/^refs\/heads\/task\/[A-Za-z0-9._-]+$/u),
    headSha: sha,
    treeSha: sha,
    implementationArtifactDigest: digest,
    beadsSnapshotDigest: digest,
    contractDigest: digest,
    policyDigest: digest,
    materialDigest: digest,
    workspaceLeaseEpoch: z.number().int().positive(),
    runLeaseEpoch: z.number().int().positive(),
    taskLeaseEpoch: z.number().int().positive(),
  })
  .strict()
  .superRefine((request, context) => {
    if (request.sourceRunId === request.targetRunId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'lineage import requires distinct runs',
      });
    }
  });
export type LineageImport = z.infer<typeof lineageImportSchema>;

export interface VerifiedPullRequestObservation {
  repository: string;
  pullRequestNumber: number;
  headSha: string;
  latestReviewEventIdentity: string;
  requiredChecks: Readonly<Record<string, string>>;
  threads: readonly ReviewThreadSnapshot[];
  observerIdentity: string;
  observedAtMs: number;
  observationDigest: string;
}

export function assertZeroUnresolvedThreads(input: {
  expectedHeadSha: string;
  expectedReviewEventIdentity: string;
  observation: VerifiedPullRequestObservation;
}): void {
  const { observationDigest, ...identity } = input.observation;
  if (
    input.observation.observerIdentity.trim() === '' ||
    observationDigest !== digestGovernedValue(identity)
  ) {
    throw new Error('PR observation attestation is invalid');
  }
  if (
    input.observation.headSha !== input.expectedHeadSha ||
    input.observation.latestReviewEventIdentity !== input.expectedReviewEventIdentity
  ) {
    throw new Error('stale PR-level observation');
  }
  if (Object.values(input.observation.requiredChecks).some((status) => status !== 'success')) {
    throw new Error('required checks are not successful');
  }
  if (
    input.observation.threads.some(
      (thread) =>
        thread.headSha !== input.expectedHeadSha ||
        thread.reviewEventIdentity !== input.expectedReviewEventIdentity,
    )
  ) {
    throw new Error('stale review-thread observation');
  }
  if (input.observation.threads.some((thread) => !thread.isResolved)) {
    throw new Error('unresolved review threads remain');
  }
  if (input.observation.threads.some((thread) => thread.acceptedDispositionDigest === null)) {
    throw new Error('review thread lacks an accepted disposition');
  }
}

export type GovernedJournalStatus = 'prepared' | 'committed' | 'escalated';
export interface GovernedJournalRecord {
  id: string;
  requestDigest: string;
  request: GovernedExternalRequest;
  status: GovernedJournalStatus;
  result: unknown;
}

/** Durable storage boundary. Implementations must CAS on id and immutable request digest. */
export interface GovernedOperationJournal {
  prepare(record: Omit<GovernedJournalRecord, 'status' | 'result'>): GovernedJournalRecord;
  get(id: string): GovernedJournalRecord | undefined;
  commit(id: string, expectedStatus: 'prepared', result: unknown): GovernedJournalRecord;
  escalate(id: string, expectedStatus: 'prepared', result: unknown): GovernedJournalRecord;
  guard(id: string, fence: GovernedFence, initiate: () => Promise<unknown>): Promise<unknown>;
  adopt(id: string, fence: GovernedFence): GovernedJournalRecord;
}

export type GovernedFence = Pick<
  GovernedExternalRequest,
  'ownerId' | 'workspaceLeaseEpoch' | 'runLeaseEpoch' | 'taskLeaseEpoch'
>;
export type GovernedMutationGuard = (initiate: () => Promise<unknown>) => Promise<unknown>;

export interface GovernedMutationPort {
  observe(
    request: GovernedExternalRequest,
  ): Promise<{ kind: 'expected' | 'unchanged' | 'conflict'; result: unknown }>;
  mutate(
    request: GovernedExternalRequest,
    idempotencyKey: string,
    guard: GovernedMutationGuard,
  ): Promise<unknown>;
}

/** Observe-before-mutate journal broker. Replays adopt expected state without duplicating effects. */
export class GovernedOperationBroker {
  readonly #journal: GovernedOperationJournal;
  readonly #port: GovernedMutationPort;

  constructor(journal: GovernedOperationJournal, port: GovernedMutationPort) {
    assertProductionGovernedPort(port);
    this.#journal = journal;
    this.#port = port;
  }

  async execute(requestInput: unknown): Promise<GovernedJournalRecord> {
    const request = governedExternalRequestSchema.parse(requestInput);
    const requestDigest = digestGovernedValue(request);
    const id = digestGovernedValue(['governed-operation', requestDigest]);
    const record = this.#journal.prepare({ id, requestDigest, request });
    if (record.requestDigest !== requestDigest)
      throw new Error('governed operation identity conflict');
    if (record.status !== 'prepared') return record;
    return this.#executePrepared(record, request);
  }

  async #executePrepared(
    record: GovernedJournalRecord,
    fence: GovernedFence,
  ): Promise<GovernedJournalRecord> {
    const { id, request, requestDigest } = record;
    const observed = await this.#port.observe(request);
    const finish = async (kind: 'commit' | 'escalate', result: unknown) =>
      this.#journal.guard(id, fence, async () =>
        this.#journal[kind](id, 'prepared', result),
      ) as Promise<GovernedJournalRecord>;
    if (observed.kind === 'expected') return finish('commit', observed.result);
    if (observed.kind === 'conflict') return finish('escalate', observed.result);
    const result = await this.#port.mutate(request, requestDigest, (initiate) =>
      this.#journal.guard(id, fence, initiate),
    );
    const verified = await this.#port.observe(request);
    if (verified.kind !== 'expected') return finish('escalate', verified.result);
    return finish('commit', result);
  }

  async reconcilePrepared(id: string, fence?: GovernedFence): Promise<GovernedJournalRecord> {
    const record = fence === undefined ? this.#journal.get(id) : this.#journal.adopt(id, fence);
    if (record === undefined) throw new Error('governed operation not found');
    if (record.status !== 'prepared') return record;
    return this.#executePrepared(record, fence ?? record.request);
  }
}

export interface DelegateCallbackStore {
  recordAndTransition(input: {
    callback: DelegateCallback;
    target: WorkflowState;
    expectedParentVersion: number;
  }): {
    disposition: 'committed' | 'duplicate';
    state: WorkflowState;
    version: number;
    needsWake: boolean;
  };
  markParentWoken(input: {
    callbackId: string;
    wakeupId: string;
    generation: string;
    messageId: string;
    providerAcceptedAtMs: number;
  }): void;
  listPendingWakeups(): Array<{ callbackId: string; parentRunId: string }>;
}

export interface ParentWakeAcceptance {
  generation: string;
  messageId: string;
  providerAcceptedAtMs: number;
}
export interface ParentWakePort {
  observe(parentRunId: string, wakeupId: string): ParentWakeAcceptance | null;
  send(parentRunId: string, wakeupId: string): ParentWakeAcceptance;
}
const parentWakePorts = new WeakSet<object>();
const parentWakeCapability = Symbol('parentWakeCapability');
function createParentWakePort(client: ParentWakePort, capability: symbol): ParentWakePort {
  if (capability !== parentWakeCapability)
    throw new Error('parent wake port requires package capability');
  const port = Object.freeze({
    observe: client.observe.bind(client),
    send: client.send.bind(client),
  });
  parentWakePorts.add(port);
  return port;
}
export function createParentWakePortForTest(client: ParentWakePort): ParentWakePort {
  if (process.env.NODE_ENV !== 'test') throw new Error('test parent wake port is unavailable');
  return createParentWakePort(client, parentWakeCapability);
}
export function createProductionParentWakePort(client: ParentWakePort): ParentWakePort {
  return createParentWakePort(client, parentWakeCapability);
}

/** Persists a terminal result, advances exactly once, then wakes its sole parent coordinator. */
export class DelegateCallbackCoordinator {
  constructor(
    readonly store: DelegateCallbackStore,
    readonly wakePort: ParentWakePort,
  ) {
    if (!parentWakePorts.has(wakePort as object)) throw new Error('unregistered parent wake port');
  }

  ingest(callbackInput: unknown) {
    const callback = delegateCallbackSchema.parse(callbackInput);
    const target = delegateCallbackTarget(callback);
    const result = this.store.recordAndTransition({
      callback,
      target,
      expectedParentVersion: callback.parentRunVersion,
    });
    if (result.needsWake) {
      const wakeupId = digestGovernedValue([
        'delegate-parent-wakeup',
        callback.callbackId,
        callback.parentRunId,
      ]);
      const accepted =
        this.wakePort.observe(callback.parentRunId, wakeupId) ??
        this.wakePort.send(callback.parentRunId, wakeupId);
      this.store.markParentWoken({ callbackId: callback.callbackId, wakeupId, ...accepted });
    }
    return result;
  }

  reconcilePendingWakeups(): string[] {
    const reconciled: string[] = [];
    for (const pending of this.store.listPendingWakeups()) {
      const wakeupId = digestGovernedValue([
        'delegate-parent-wakeup',
        pending.callbackId,
        pending.parentRunId,
      ]);
      const accepted =
        this.wakePort.observe(pending.parentRunId, wakeupId) ??
        this.wakePort.send(pending.parentRunId, wakeupId);
      this.store.markParentWoken({ callbackId: pending.callbackId, wakeupId, ...accepted });
      reconciled.push(pending.callbackId);
    }
    return reconciled;
  }
}

export interface ApprovalNotificationPort {
  observe(
    event: ApprovalNotification,
    purpose: 'approval' | 'resume',
  ): Promise<{
    generation: string;
    messageId: string | null;
    providerAcceptedAtMs: number | null;
  }>;
  send(
    event: ApprovalNotification,
    idempotencyKey: string,
    purpose: 'approval' | 'resume',
  ): Promise<{
    generation: string;
    messageId: string;
    providerAcceptedAtMs: number;
  }>;
}

export interface ApprovalNotificationTransportClient {
  observe(
    eventId: string,
    purpose: 'approval' | 'resume',
  ): Promise<{
    generation: string;
    messageId: string | null;
    providerAcceptedAtMs: number | null;
  }>;
  send(input: {
    event: ApprovalNotification;
    idempotencyKey: string;
    purpose: 'approval' | 'resume';
  }): Promise<{ generation: string; messageId: string; providerAcceptedAtMs: number }>;
}

class ProviderNeutralApprovalNotificationPort implements ApprovalNotificationPort {
  constructor(readonly client: ApprovalNotificationTransportClient) {}

  observe(event: ApprovalNotification, purpose: 'approval' | 'resume') {
    return this.client.observe(event.eventId, purpose);
  }

  async send(event: ApprovalNotification, idempotencyKey: string, purpose: 'approval' | 'resume') {
    const accepted = await this.client.send({ event, idempotencyKey, purpose });
    if (
      accepted.generation.length === 0 ||
      accepted.messageId.length === 0 ||
      !Number.isInteger(accepted.providerAcceptedAtMs) ||
      accepted.providerAcceptedAtMs < 0
    ) {
      throw new Error('notification provider did not return transport acceptance evidence');
    }
    return accepted;
  }
}

export function createProductionApprovalNotificationPort(
  client: ApprovalNotificationTransportClient,
): ApprovalNotificationPort {
  return registerProductionGovernedPort(
    Object.freeze(new ProviderNeutralApprovalNotificationPort(client)),
  );
}

export interface ApprovalNotificationRecord {
  event: ApprovalNotification;
  state: ApprovalNotificationState;
  generation: string | null;
  messageId: string | null;
  providerAcceptedAtMs: number | null;
  failurePurpose: 'approval' | 'resume' | null;
}

export interface ApprovalNotificationJournal {
  prepare(event: ApprovalNotification): ApprovalNotificationRecord;
  get(eventId: string): ApprovalNotificationRecord | undefined;
  compareAndSwap(input: {
    eventId: string;
    from: ApprovalNotificationState;
    to: ApprovalNotificationState;
    generation?: string;
    messageId?: string;
    providerAcceptedAtMs?: number;
    authenticatedHumanResponse?: boolean;
    responderIdentity?: string;
    responseEvidenceDigest?: string;
    humanAcceptedAtMs?: number;
    failurePurpose?: 'approval' | 'resume';
  }): ApprovalNotificationRecord;
}

export class ApprovalNotificationCoordinator {
  constructor(
    readonly journal: ApprovalNotificationJournal,
    readonly port: ApprovalNotificationPort,
    readonly clock: () => number = Date.now,
  ) {
    assertProductionGovernedPort(port);
  }

  async deliver(eventInput: unknown): Promise<ApprovalNotificationRecord> {
    const event = approvalNotificationSchema.parse(eventInput);
    if (event.expiresAtMs <= this.clock()) throw new Error('approval notification expired');
    const record = this.journal.prepare(event);
    if (
      record.state === 'delivered' ||
      record.state === 'approved' ||
      record.state === 'resume_pending' ||
      record.state === 'resumed'
    )
      return record;
    if (record.state === 'delivery_failed' && record.failurePurpose !== 'approval') {
      throw new Error('resume delivery failure cannot re-enter approval delivery');
    }
    if (record.state === 'prepared' || record.state === 'delivery_failed') {
      this.journal.compareAndSwap({
        eventId: event.eventId,
        from: record.state,
        to: 'delivery_pending',
      });
    }
    let accepted;
    try {
      const observed = await this.port.observe(event, 'approval');
      accepted =
        observed.providerAcceptedAtMs === null
          ? await this.port.send(event, event.eventId, 'approval')
          : {
              generation: observed.generation,
              messageId: observed.messageId!,
              providerAcceptedAtMs: observed.providerAcceptedAtMs,
            };
    } catch {
      return this.journal.compareAndSwap({
        eventId: event.eventId,
        from: 'delivery_pending',
        to: 'delivery_failed',
        failurePurpose: 'approval',
      });
    }
    validateApprovalNotificationTransition({
      from: 'delivery_pending',
      to: 'delivered',
      providerAcceptedAtMs: accepted.providerAcceptedAtMs,
    });
    return this.journal.compareAndSwap({
      eventId: event.eventId,
      from: 'delivery_pending',
      to: 'delivered',
      ...accepted,
    });
  }

  approve(
    eventId: string,
    input: {
      authenticatedResponseDigest: string;
      responderIdentity: string;
      responseEvidenceDigest: string;
      acceptedAtMs: number;
    },
  ): ApprovalNotificationRecord {
    const record = this.journal.get(eventId);
    if (record === undefined) throw new Error('approval notification not found');
    if (record.event.expiresAtMs <= this.clock()) throw new Error('approval notification expired');
    if (input.authenticatedResponseDigest !== record.event.allowedResponseDigest) {
      throw new Error('authenticated approval response does not match allowed response');
    }
    return this.journal.compareAndSwap({
      eventId,
      from: 'delivered',
      to: 'approved',
      authenticatedHumanResponse: true,
      responderIdentity: input.responderIdentity,
      responseEvidenceDigest: input.responseEvidenceDigest,
      humanAcceptedAtMs: input.acceptedAtMs,
    });
  }

  async resume(eventId: string): Promise<ApprovalNotificationRecord> {
    let record = this.journal.get(eventId);
    if (
      record === undefined ||
      !['approved', 'resume_pending', 'delivery_failed'].includes(record.state) ||
      (record.state === 'delivery_failed' && record.failurePurpose !== 'resume')
    ) {
      throw new Error('approved notification is required before resume');
    }
    if (record.state !== 'resume_pending') {
      record = this.journal.compareAndSwap({
        eventId,
        from: record.state,
        to: 'resume_pending',
      });
    }
    let accepted;
    try {
      const observed = await this.port.observe(record.event, 'resume');
      accepted =
        observed.providerAcceptedAtMs === null
          ? await this.port.send(record.event, `${eventId}:resume`, 'resume')
          : {
              generation: observed.generation,
              messageId: observed.messageId!,
              providerAcceptedAtMs: observed.providerAcceptedAtMs,
            };
    } catch {
      return this.journal.compareAndSwap({
        eventId,
        from: 'resume_pending',
        to: 'delivery_failed',
        failurePurpose: 'resume',
      });
    }
    return this.journal.compareAndSwap({
      eventId,
      from: 'resume_pending',
      to: 'resume_pending',
      ...accepted,
    });
  }
}
