import { createHash } from 'node:crypto';

import { z } from 'zod';

import {
  EXECUTION_CONTRACT_VERSION,
  evidenceReferenceSchema,
  executionContractSchema,
  findingSchema,
  relativePathSchema,
  workflowOperationSchema,
  workflowRoleSchema,
} from './contracts.js';
import { workflowStateSchema, type WorkflowState } from './stateMachine.js';

const identifierSchema = z.string().min(1).max(200);
const digestSchema = z.string().regex(/^sha256:[a-f0-9]{64}$/u);
const timestampSchema = z.string().datetime({ offset: true });

export const attemptCounterSchema = z
  .object({
    attemptsUsed: z.number().int().positive(),
    maxAttempts: z.number().int().positive(),
    hypotheses: z.array(z.string().min(1)),
  })
  .strict()
  .superRefine((counter, context) => {
    if (counter.attemptsUsed > counter.maxAttempts) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'retry budget is exhausted' });
    }
    if (counter.hypotheses.length !== counter.attemptsUsed) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'each attempt, including attempt 1, requires exactly one hypothesis',
      });
    }
  });

export const retryAccountingSchema = z
  .object({
    task: attemptCounterSchema,
    findings: z.record(identifierSchema, attemptCounterSchema),
    infrastructureChecks: z.record(identifierSchema, attemptCounterSchema),
  })
  .strict();

export const waitRecordSchema = z
  .object({
    eventIdentity: identifierSchema,
    nextPollAt: timestampSchema,
    absoluteWaitDeadline: timestampSchema,
    backoffCount: z.number().int().nonnegative(),
    checkId: identifierSchema,
    attempts: attemptCounterSchema,
  })
  .strict()
  .superRefine((wait, context) => {
    if (Date.parse(wait.nextPollAt) >= Date.parse(wait.absoluteWaitDeadline)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'next poll must be before the absolute wait deadline',
      });
    }
  });

export const cancellationRecordSchema = z
  .object({
    requestedAt: timestampSchema,
    requestedBy: identifierSchema,
    reason: z.string().min(1),
    stopDeadline: timestampSchema,
    ownedWorkStopped: z.boolean(),
    incompleteCleanup: z.array(z.string().min(1)),
    retainedEvidence: z.array(evidenceReferenceSchema),
  })
  .strict()
  .superRefine((record, context) => {
    if (Date.parse(record.stopDeadline) < Date.parse(record.requestedAt)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'cancellation stop deadline precedes the request',
      });
    }
  });

const recoveryTargetSchema = z.enum([
  'scheduling',
  'implementing',
  'repair',
  'pipeline',
  'waiting',
  'delivery',
  'finalizing',
]);

export const recoveryRecordSchema = z
  .object({
    interruptedState: recoveryTargetSchema,
    recoveryTarget: recoveryTargetSchema,
    interruptedTransitionId: identifierSchema,
    previousLeaseEpoch: z.number().int().nonnegative(),
    recoveryLeaseEpoch: z.number().int().positive(),
    mergeVerified: z.boolean(),
    evidence: z.array(evidenceReferenceSchema).min(1),
  })
  .strict()
  .superRefine((record, context) => {
    if (!record.mergeVerified && record.interruptedState !== record.recoveryTarget) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'recovery target must equal the exact interrupted state',
      });
    }
    if (record.recoveryLeaseEpoch <= record.previousLeaseEpoch) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'recovery lease epoch must fence the interrupted owner',
      });
    }
    if (record.mergeVerified && record.recoveryTarget !== 'finalizing') {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'verified merge recovery may only target finalizing',
      });
    }
  });

export const repairChildSchema = z
  .object({
    featureId: identifierSchema,
    id: identifierSchema,
    sequence: z.number().int().positive(),
    parentEpicId: identifierSchema,
    dependsOn: identifierSchema,
    finding: findingSchema,
    assignedRole: workflowRoleSchema,
    allowedPaths: z.array(relativePathSchema),
    allowedOperations: z.array(workflowOperationSchema),
    authorityExpanded: z.literal(false),
  })
  .strict()
  .superRefine((repair, context) => {
    if (repair.id !== `${repair.featureId}.repair.${repair.sequence}`) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'repair child id must be derived from feature id and sequence',
      });
    }
  });

const verifiedExternalResultSchema = z
  .object({
    verified: z.boolean(),
    evidence: z.array(evidenceReferenceSchema),
  })
  .strict();

export const finalizationRecordSchema = z
  .object({
    status: z.enum(['finalizing', 'closed']),
    merge: verifiedExternalResultSchema,
    epicClosure: verifiedExternalResultSchema,
    doltRemoteSync: verifiedExternalResultSchema,
    finalEvidence: verifiedExternalResultSchema,
  })
  .strict()
  .superRefine((record, context) => {
    if (
      record.status === 'closed' &&
      ![record.merge, record.epicClosure, record.doltRemoteSync, record.finalEvidence].every(
        (result) => result.verified && result.evidence.length > 0,
      )
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'closed requires verified merge, epic closure, Dolt sync, and final evidence',
      });
    }
  });

export const transitionRequestSchema = z
  .object({
    runId: identifierSchema,
    transitionId: identifierSchema,
    operation: identifierSchema,
    expectedVersion: z.number().int().nonnegative(),
    contractVersion: z.literal(EXECUTION_CONTRACT_VERSION),
    policyDigest: digestSchema,
    from: workflowStateSchema,
    to: workflowStateSchema,
    workspaceLeaseEpoch: z.number().int().positive(),
    taskLeaseEpoch: z.number().int().positive().nullable(),
    idempotencyKey: digestSchema,
  })
  .strict();

export function deriveTransitionIdempotencyKey(
  request: Pick<
    z.infer<typeof transitionRequestSchema>,
    'runId' | 'transitionId' | 'operation' | 'expectedVersion'
  >,
): string {
  const canonical = JSON.stringify([
    request.runId,
    request.transitionId,
    request.operation,
    request.expectedVersion,
  ]);
  return `sha256:${createHash('sha256').update(canonical).digest('hex')}`;
}

export function assertTransitionIdempotencyKey(requestInput: unknown): void {
  const request = transitionRequestSchema.parse(requestInput);
  if (request.idempotencyKey !== deriveTransitionIdempotencyKey(request)) {
    throw new Error('transition idempotency key does not match canonical transition identity');
  }
}

export function assertContractRevisionIsNotAuthorityExpansion(
  previousInput: unknown,
  nextInput: unknown,
): void {
  const previous = executionContractSchema.parse(previousInput);
  const next = executionContractSchema.parse(nextInput);
  const previousActions = new Set(previous.authority.allowedActions);
  const previousPaths = new Set(previous.constraints.allowedPaths);

  if (next.authority.deliveryTarget !== previous.authority.deliveryTarget) {
    throw new Error('contract revision changes the approved delivery target');
  }
  if (
    next.authority.github.repository !== previous.authority.github.repository ||
    next.authority.github.base !== previous.authority.github.base ||
    next.authority.github.mergeMethod !== previous.authority.github.mergeMethod
  ) {
    throw new Error('contract revision changes approved GitHub authority');
  }
  if (next.authority.allowedActions.some((action) => !previousActions.has(action))) {
    throw new Error('contract revision expands allowed actions');
  }
  if (next.constraints.allowedPaths.some((path) => !previousPaths.has(path))) {
    throw new Error('contract revision expands allowed paths');
  }
}

export function assertRepairChildWithinContract(
  contractInput: unknown,
  repairInput: unknown,
): void {
  const contract = executionContractSchema.parse(contractInput);
  const repair = repairChildSchema.parse(repairInput);
  const allowedRoles = new Set(contract.repairTaskPolicy.allowedRoles);
  const allowedPaths = new Set(contract.repairTaskPolicy.allowedPaths);
  const allowedActions = new Set<string>(contract.authority.allowedActions);

  if (repair.featureId !== contract.featureId || repair.parentEpicId !== contract.featureId) {
    throw new Error('repair child belongs to a different feature');
  }
  if (repair.sequence > contract.repairTaskPolicy.maxChildren) {
    throw new Error('repair child budget is exhausted');
  }
  if (!allowedRoles.has(repair.assignedRole)) throw new Error('repair role exceeds contract');
  if (repair.allowedPaths.some((path) => !allowedPaths.has(path))) {
    throw new Error('repair paths exceed contract');
  }
  if (repair.allowedOperations.some((operation) => !allowedActions.has(operation))) {
    throw new Error('repair operations exceed contract');
  }
}

export type CancellationRecord = z.infer<typeof cancellationRecordSchema>;
export type FinalizationRecord = z.infer<typeof finalizationRecordSchema>;
export type RecoveryRecord = z.infer<typeof recoveryRecordSchema>;
export type RetryAccounting = z.infer<typeof retryAccountingSchema>;
export type TransitionRequest = z.infer<typeof transitionRequestSchema>;
export type WaitRecord = z.infer<typeof waitRecordSchema>;
export type RecoveryTarget = z.infer<typeof recoveryTargetSchema>;

export function isTerminalState(state: WorkflowState): boolean {
  return state === 'cancelled' || state === 'closed';
}
