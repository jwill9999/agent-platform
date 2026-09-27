import { z } from 'zod';
import {
  EXECUTION_CONTRACT_VERSION,
  findingSchema,
  relativePathSchema,
  workflowRoleSchema,
  workflowOperationSchema,
} from './contracts.js';
const identifierSchema = z.string().min(1).max(200);
const digestSchema = z.string().regex(/^sha256:[a-f0-9]{64}$/u);
const shaSchema = z.string().regex(/^[a-f0-9]{40}$/u);
export const remainingRetryBudgetSchema = z
  .object({
    implementationAttempts: z.number().int().nonnegative(),
    findingAttempts: z.number().int().nonnegative(),
    infrastructureAttempts: z.number().int().nonnegative(),
    waitDeadlineSeconds: z.number().int().positive(),
  })
  .strict();

export const repairChildRequestSchema = z
  .object({
    workspaceId: digestSchema,
    runId: identifierSchema,
    featureId: identifierSchema,
    id: identifierSchema,
    sequence: z.number().int().positive(),
    parentEpicId: identifierSchema,
    dependsOn: identifierSchema,
    chainTipTaskId: identifierSchema,
    branchParent: z.string().regex(/^task\/[A-Za-z0-9._-]+$/u),
    branchParentSha: shaSchema,
    evaluationId: digestSchema,
    finding: findingSchema,
    findingDigest: digestSchema,
    remainingRetryBudget: remainingRetryBudgetSchema,
    assignedRole: workflowRoleSchema,
    allowedPaths: z.array(relativePathSchema),
    allowedOperations: z.array(workflowOperationSchema),
    authorityExpanded: z.literal(false),
    actorRole: z.literal('workflow_orchestrator'),
    contractVersion: z.literal(EXECUTION_CONTRACT_VERSION),
    policyDigest: digestSchema,
  })
  .strict();

export type RepairChildRequest = z.infer<typeof repairChildRequestSchema>;
