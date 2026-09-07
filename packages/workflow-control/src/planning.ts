import { createHash } from 'node:crypto';

import { z } from 'zod';

import {
  evidenceReferenceSchema,
  executionContractSchema,
  type ExecutionContract,
} from './contracts.js';

const identifierSchema = z.string().min(1).max(200);
const digestSchema = z.string().regex(/^sha256:[a-f0-9]{64}$/u);

export const criticFindingSchema = z
  .object({
    id: identifierSchema,
    severity: z.enum(['low', 'medium', 'high', 'critical']),
    summary: z.string().min(1),
    requirement: z.string().min(1),
    evidence: z.array(evidenceReferenceSchema).min(1),
    proposedCorrection: z.string().min(1).optional(),
    requiresHumanDecision: z.boolean(),
  })
  .strict();

export const humanDecisionRequestSchema = z
  .object({
    question: z.string().min(1),
    findingIds: z.array(identifierSchema).min(1),
    options: z
      .array(z.object({ label: z.string().min(1), impact: z.string().min(1) }).strict())
      .min(2)
      .max(3),
  })
  .strict();

export const criticReviewSchema = z
  .object({
    reviewId: identifierSchema,
    runId: identifierSchema,
    plannerId: identifierSchema,
    criticId: identifierSchema,
    contractVersion: z.literal(1),
    policyDigest: digestSchema,
    materialDigest: digestSchema,
    verdict: z.enum(['approved', 'correction_required', 'rejected', 'human_decision_required']),
    summary: z.string().min(1),
    evidence: z.array(evidenceReferenceSchema).min(1),
    findings: z.array(criticFindingSchema),
    humanDecision: humanDecisionRequestSchema.nullable(),
  })
  .strict()
  .superRefine((review, context) => {
    if (review.plannerId === review.criticId) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'planner and critic must differ' });
    }
    if (new Set(review.findings.map((finding) => finding.id)).size !== review.findings.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'critic finding ids must be unique',
      });
    }
    if (review.verdict === 'approved' && review.findings.length > 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'approved review may not have findings',
      });
    }
    if (review.verdict === 'correction_required' && review.findings.length === 0) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'correction requires a finding' });
    }
    if (
      review.verdict === 'rejected' &&
      !review.findings.some((finding) => finding.severity === 'critical')
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'rejection requires a critical finding',
      });
    }
    if (
      review.verdict === 'human_decision_required' &&
      !review.findings.some((finding) => finding.requiresHumanDecision)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'human decision requires a flagged finding',
      });
    }
    if ((review.verdict === 'human_decision_required') !== (review.humanDecision !== null)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'human decision payload must match the verdict',
      });
    }
    const findingIds = new Set(review.findings.map((finding) => finding.id));
    if (review.humanDecision?.findingIds.some((id) => !findingIds.has(id)) === true) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'human decision references unknown finding',
      });
    }
  });

export const findingDispositionSchema = z
  .object({
    findingId: identifierSchema,
    disposition: z.enum(['corrected', 'dismissed_by_human']),
    reason: z.string().min(1),
    decidedBy: identifierSchema,
    evidence: z.array(evidenceReferenceSchema).min(1),
  })
  .strict();

export const planApprovalSchema = z
  .object({
    approvalId: identifierSchema,
    runId: identifierSchema,
    approverId: identifierSchema,
    contractVersion: z.literal(1),
    policyDigest: digestSchema,
    materialDigest: digestSchema,
    status: z.enum(['active', 'invalidated']),
    approvedAtMs: z.number().int().nonnegative(),
    invalidatedAtMs: z.number().int().nonnegative().nullable(),
    invalidationReason: z.string().min(1).nullable(),
    evidence: z.array(evidenceReferenceSchema).min(1),
  })
  .strict();

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalize(entry)]),
    );
  }
  return value;
}

export function deriveContractMaterialDigest(contractInput: unknown): string {
  const contract = executionContractSchema.parse(contractInput);
  const material = { ...contract, policyDigest: undefined };
  const body = JSON.stringify(canonicalize(material));
  return `sha256:${createHash('sha256').update(body).digest('hex')}`;
}

export function approvalInvalidationReason(
  approvalInput: unknown,
  contractInput: unknown,
): string | undefined {
  const approval = planApprovalSchema.parse(approvalInput);
  const contract = executionContractSchema.parse(contractInput);
  if (approval.contractVersion !== contract.contractVersion) return 'contract_version_changed';
  if (approval.policyDigest !== contract.policyDigest) return 'policy_digest_changed';
  if (approval.materialDigest !== deriveContractMaterialDigest(contract))
    return 'material_plan_changed';
  return undefined;
}

export function validateDraftContract(contractInput: unknown): ExecutionContract {
  return executionContractSchema.parse(contractInput);
}

export type CriticReview = z.infer<typeof criticReviewSchema>;
export type FindingDisposition = z.infer<typeof findingDispositionSchema>;
export type PlanApproval = z.infer<typeof planApprovalSchema>;
