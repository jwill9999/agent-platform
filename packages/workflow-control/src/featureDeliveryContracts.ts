import { createHash } from 'node:crypto';

import { z } from 'zod';

import { evidenceReferenceSchema, EXECUTION_CONTRACT_VERSION } from './contracts.js';

export const FEATURE_DELIVERY_CONTRACT_VERSION = 1 as const;

const identifierSchema = z.string().min(1).max(200);
const digestSchema = z.string().regex(/^sha256:[a-f0-9]{64}$/u);
const shaSchema = z.string().regex(/^[a-f0-9]{40,64}$/u);
const repositorySchema = z.string().regex(/^[^/\s]+\/[^/\s]+$/u);
const featureRefSchema = z.string().regex(/^feature\/[A-Za-z0-9._-]+$/u);
const taskRefSchema = z.string().regex(/^task\/[A-Za-z0-9._-]+$/u);

export const featureDeliveryContractSchema = z
  .object({
    contractVersion: z.literal(FEATURE_DELIVERY_CONTRACT_VERSION),
    executionContractDigest: digestSchema,
    featureId: identifierSchema,
    workspaceId: digestSchema,
    policyDigest: digestSchema,
    origin: z
      .object({
        executionContractVersion: z.literal(EXECUTION_CONTRACT_VERSION),
        repository: repositorySchema,
        taskId: identifierSchema,
        taskRef: taskRefSchema,
        taskHeadSha: shaSchema,
        integrationPullRequestNumber: z.number().int().positive(),
        integrationMergeOperationId: digestSchema,
        integrationMergeAttestationDigest: digestSchema,
        featureRef: featureRefSchema,
        integratedHeadSha: shaSchema,
        mergeMethod: z.literal('squash'),
      })
      .strict(),
    authority: z
      .object({
        actorRole: z.literal('workflow_orchestrator'),
        repository: repositorySchema,
        headRef: featureRefSchema,
        headSha: shaSchema,
        base: z.literal('staging'),
        requiredChecks: z.array(z.string().min(1)),
        protectionDigest: digestSchema,
        mergeMethod: z.literal('squash'),
        adminBypass: z.literal(false),
      })
      .strict(),
  })
  .strict()
  .superRefine((contract, context) => {
    if (contract.origin.taskRef !== `task/${contract.origin.taskId}`) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['origin', 'taskRef'],
        message: 'origin task ref must be derived from the exact task id',
      });
    }
    if (contract.origin.repository !== contract.authority.repository) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['authority', 'repository'],
        message: 'delivery repository must match the origin repository',
      });
    }
    if (
      contract.origin.featureRef !== contract.authority.headRef ||
      contract.origin.integratedHeadSha !== contract.authority.headSha
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['authority', 'headRef'],
        message: 'delivery head must be the exact integrated feature head',
      });
    }
    if (
      new Set(contract.authority.requiredChecks).size !== contract.authority.requiredChecks.length
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['authority', 'requiredChecks'],
        message: 'required checks must be unique',
      });
    }
  });

export type FeatureDeliveryContract = z.infer<typeof featureDeliveryContractSchema>;

const featureDeliveryIntentMaterialShape = {
  intentVersion: z.literal(1),
  intentId: identifierSchema,
  runId: identifierSchema,
  taskId: identifierSchema,
  executionContractVersion: z.literal(EXECUTION_CONTRACT_VERSION),
  executionContractDigest: digestSchema,
  featureId: identifierSchema,
  workspaceId: digestSchema,
  policyDigest: digestSchema,
  repository: repositorySchema,
  taskRef: taskRefSchema,
  taskHeadSha: shaSchema,
  featureRef: featureRefSchema,
  destination: z.literal('staging'),
  requiredChecks: z.array(z.string().min(1)),
  protectionDigest: digestSchema,
  mergeMethod: z.literal('squash'),
  adminBypass: z.literal(false),
  decidedAtMs: z.number().int().nonnegative(),
  evidence: z.array(evidenceReferenceSchema).min(1),
} as const;

const featureDeliveryIntentMaterialSchema = z.object(featureDeliveryIntentMaterialShape);

export const featureDeliveryRequiredIntentSchema = z
  .object({
    ...featureDeliveryIntentMaterialShape,
    materialDigest: digestSchema,
    ownerId: identifierSchema,
    ownerRole: z.literal('human_approver'),
  })
  .strict()
  .superRefine((intent, context) => {
    if (intent.taskRef !== `task/${intent.taskId}`) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['taskRef'],
        message: 'intent task ref must be derived from the exact task id',
      });
    }
    if (new Set(intent.requiredChecks).size !== intent.requiredChecks.length) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'required checks must be unique' });
    }
  });

const featureDeliveryCriticFindingSchema = z
  .object({
    id: identifierSchema,
    severity: z.enum(['low', 'medium', 'high', 'critical']),
    summary: z.string().min(1),
    evidence: z.array(evidenceReferenceSchema).min(1),
  })
  .strict();

export const featureDeliveryCriticReviewSchema = z
  .object({
    reviewVersion: z.literal(1),
    reviewId: identifierSchema,
    runId: identifierSchema,
    taskId: identifierSchema,
    criticId: identifierSchema,
    criticRole: z.literal('plan_critic'),
    executionContractDigest: digestSchema,
    featureContractVersion: z.literal(FEATURE_DELIVERY_CONTRACT_VERSION),
    featureContractDigest: digestSchema,
    materialDigest: digestSchema,
    policyDigest: digestSchema,
    verdict: z.enum(['approved', 'correction_required']),
    summary: z.string().min(1),
    evidence: z.array(evidenceReferenceSchema).min(1),
    findings: z.array(featureDeliveryCriticFindingSchema),
    reviewedAtMs: z.number().int().nonnegative(),
  })
  .strict()
  .superRefine((review, context) => {
    if (review.verdict === 'approved' && review.findings.length > 0) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'approved review has findings' });
    }
    if (review.verdict === 'correction_required' && review.findings.length === 0) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'correction requires findings' });
    }
  });

export type FeatureDeliveryRequiredIntent = z.infer<typeof featureDeliveryRequiredIntentSchema>;
export type FeatureDeliveryCriticReview = z.infer<typeof featureDeliveryCriticReviewSchema>;

export const featureDeliveryApprovalSchema = z
  .object({
    approvalVersion: z.literal(1),
    approvalId: identifierSchema,
    runId: identifierSchema,
    reviewId: identifierSchema,
    taskId: identifierSchema,
    approverId: identifierSchema,
    approverRole: z.literal('human_approver'),
    featureContractVersion: z.literal(FEATURE_DELIVERY_CONTRACT_VERSION),
    featureContractDigest: digestSchema,
    materialDigest: digestSchema,
    policyDigest: digestSchema,
    status: z.enum(['active', 'invalidated']),
    approvedAtMs: z.number().int().nonnegative(),
    invalidatedAtMs: z.number().int().nonnegative().nullable(),
    invalidationReason: z.string().min(1).nullable(),
    evidence: z.array(evidenceReferenceSchema).min(1),
  })
  .strict()
  .superRefine((approval, context) => {
    const invalidated = approval.status === 'invalidated';
    if (
      invalidated !== (approval.invalidatedAtMs !== null) ||
      invalidated !== (approval.invalidationReason !== null)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'approval invalidation fields must match its status',
      });
    }
  });

export type FeatureDeliveryApproval = z.infer<typeof featureDeliveryApprovalSchema>;

export function deriveFeatureDeliveryContractDigest(contractInput: unknown): string {
  const contract = featureDeliveryContractSchema.parse(contractInput);
  return `sha256:${createHash('sha256').update(JSON.stringify(contract)).digest('hex')}`;
}

export function deriveFeatureDeliveryMaterialDigest(contractInput: unknown): string {
  const contract = featureDeliveryContractSchema.parse(contractInput);
  return `sha256:${createHash('sha256')
    .update(JSON.stringify({ kind: 'feature-delivery-approval-material-v1', contract }))
    .digest('hex')}`;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .map(([key, entry]) => [key, canonicalize(entry)]),
    );
  }
  return value;
}

export function deriveFeatureDeliveryIntentMaterialDigest(intentInput: unknown): string {
  const material = featureDeliveryIntentMaterialSchema.parse(intentInput);
  return `sha256:${createHash('sha256')
    .update(
      JSON.stringify(
        canonicalize({ kind: 'feature-delivery-required-intent-material-v1', material }),
      ),
    )
    .digest('hex')}`;
}
