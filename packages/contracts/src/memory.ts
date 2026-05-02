import { z } from 'zod';

const JsonValueSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(JsonValueSchema),
    z.record(JsonValueSchema),
  ]),
);

export const MemoryScopeSchema = z.enum(['global', 'project', 'agent', 'session']);
export const MemoryKindSchema = z.enum([
  'fact',
  'preference',
  'decision',
  'procedure',
  'failure_learning',
  'correction',
  'working_note',
]);
export const MemoryStatusSchema = z.enum(['pending', 'approved', 'rejected', 'archived']);
export const MemoryReviewStatusSchema = z.enum([
  'unreviewed',
  'approved',
  'rejected',
  'needs_review',
]);
export const MemorySafetyStateSchema = z.enum(['unchecked', 'safe', 'redacted', 'blocked']);
export const MemorySourceKindSchema = z.enum([
  'user',
  'assistant',
  'tool',
  'system',
  'observability',
  'import',
  'manual',
]);
export const MemoryLinkRelationSchema = z.enum([
  'related_to',
  'supports',
  'contradicts',
  'replaces',
  'derived_from',
]);

export const MemorySourceSchema = z.object({
  kind: MemorySourceKindSchema,
  id: z.string().min(1).optional(),
  label: z.string().min(1).optional(),
  metadata: z.record(JsonValueSchema).default({}),
});

const ScopeShape = {
  scope: MemoryScopeSchema,
  scopeId: z.string().min(1).optional(),
};
const MemoryBaseShape = {
  kind: MemoryKindSchema,
  content: z.string().min(1),
  confidence: z.number().min(0).max(1),
  source: MemorySourceSchema,
  tags: z.array(z.string().min(1)).default([]),
  metadata: z.record(JsonValueSchema).default({}),
};
const ReviewMetadataShape = {
  expiresAtMs: z.number().int().positive().optional(),
  reviewedAtMs: z.number().int().nonnegative().optional(),
  reviewedBy: z.string().min(1).optional(),
};

function validateScopedMemory(value: {
  scope: z.infer<typeof MemoryScopeSchema>;
  scopeId?: string;
}) {
  if (value.scope === 'global') return value.scopeId === undefined;
  return value.scopeId !== undefined;
}

function scopedMemoryMessage(scope: z.infer<typeof MemoryScopeSchema>): string {
  return scope === 'global'
    ? 'global memories must not include scopeId'
    : 'non-global memories require scopeId';
}

export const MemoryRecordSchema = z
  .object({
    id: z.string().min(1),
    ...ScopeShape,
    ...MemoryBaseShape,
    status: MemoryStatusSchema,
    reviewStatus: MemoryReviewStatusSchema,
    safetyState: MemorySafetyStateSchema,
    createdAtMs: z.number().int().nonnegative(),
    updatedAtMs: z.number().int().nonnegative(),
    ...ReviewMetadataShape,
  })
  .superRefine((value, ctx) => {
    if (!validateScopedMemory(value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: scopedMemoryMessage(value.scope),
        path: ['scopeId'],
      });
    }
  });

export const MemoryCreateBodySchema = z
  .object({
    ...ScopeShape,
    ...MemoryBaseShape,
    status: MemoryStatusSchema.default('pending'),
    reviewStatus: MemoryReviewStatusSchema.default('unreviewed'),
    confidence: z.number().min(0).max(1).default(0.5),
    safetyState: MemorySafetyStateSchema.default('unchecked'),
    ...ReviewMetadataShape,
  })
  .superRefine((value, ctx) => {
    if (!validateScopedMemory(value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: scopedMemoryMessage(value.scope),
        path: ['scopeId'],
      });
    }
  });

export const MemoryUpdateBodySchema = z.object({
  kind: MemoryKindSchema.optional(),
  status: MemoryStatusSchema.optional(),
  reviewStatus: MemoryReviewStatusSchema.optional(),
  content: z.string().min(1).optional(),
  confidence: z.number().min(0).max(1).optional(),
  source: MemorySourceSchema.optional(),
  tags: z.array(z.string().min(1)).optional(),
  metadata: z.record(JsonValueSchema).optional(),
  safetyState: MemorySafetyStateSchema.optional(),
  expiresAtMs: z.number().int().positive().nullable().optional(),
  reviewedAtMs: z.number().int().nonnegative().nullable().optional(),
  reviewedBy: z.string().min(1).nullable().optional(),
});

export const MemoryQuerySchema = z.object({
  scope: MemoryScopeSchema.optional(),
  scopeId: z.string().min(1).optional(),
  kind: MemoryKindSchema.optional(),
  status: MemoryStatusSchema.optional(),
  reviewStatus: MemoryReviewStatusSchema.optional(),
  safetyState: MemorySafetyStateSchema.optional(),
  minConfidence: z.coerce.number().min(0).max(1).optional(),
  sourceKind: MemorySourceKindSchema.optional(),
  sourceId: z.string().min(1).optional(),
  sourceMetadata: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
  tag: z.string().min(1).optional(),
  includeExpired: z.coerce.boolean().default(false),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

export const MemoryReviewBodySchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  reviewedBy: z.string().min(1).default('local-user'),
  reason: z.string().min(1).max(1000).optional(),
});

export const MemoryClearBodySchema = z
  .object({
    scope: MemoryScopeSchema,
    scopeId: z.string().min(1).optional(),
    status: MemoryStatusSchema.optional(),
    reviewStatus: MemoryReviewStatusSchema.optional(),
    safetyState: MemorySafetyStateSchema.optional(),
    includeExpired: z.boolean().default(false),
    confirm: z.literal(true),
  })
  .superRefine((value, ctx) => {
    if (!validateScopedMemory(value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: scopedMemoryMessage(value.scope),
        path: ['scopeId'],
      });
    }
  });

export const MemoryCleanupBodySchema = z
  .object({
    scope: MemoryScopeSchema.optional(),
    scopeId: z.string().min(1).optional(),
    beforeMs: z.number().int().positive().optional(),
    dryRun: z.boolean().default(true),
    confirm: z.boolean().default(false),
  })
  .superRefine((value, ctx) => {
    if (value.scope === undefined && value.scopeId !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'scopeId requires scope',
        path: ['scopeId'],
      });
    }
    if (
      value.scope !== undefined &&
      !validateScopedMemory({ scope: value.scope, scopeId: value.scopeId })
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: scopedMemoryMessage(value.scope),
        path: ['scopeId'],
      });
    }
    if (!value.dryRun && !value.confirm) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'destructive cleanup requires confirm: true',
        path: ['confirm'],
      });
    }
  });

export const MemoryLinkSchema = z.object({
  sourceMemoryId: z.string().min(1),
  targetMemoryId: z.string().min(1),
  relation: MemoryLinkRelationSchema,
  metadata: z.record(JsonValueSchema).default({}),
  createdAtMs: z.number().int().nonnegative(),
});

export const PromptMemorySourceSchema = z.object({
  kind: MemorySourceKindSchema,
  id: z.string().min(1).optional(),
  label: z.string().min(1).optional(),
});

export const PromptMemoryItemSchema = z.object({
  id: z.string().min(1),
  scope: MemoryScopeSchema,
  scopeId: z.string().min(1).optional(),
  kind: MemoryKindSchema,
  content: z.string().min(1).max(2000),
  confidence: z.number().min(0).max(1),
  source: PromptMemorySourceSchema,
  tags: z.array(z.string().min(1)).default([]),
  updatedAtMs: z.number().int().nonnegative(),
  score: z.number().nonnegative(),
});

export const PromptMemoryBundleSchema = z.object({
  items: z.array(PromptMemoryItemSchema).default([]),
  includedCount: z.number().int().nonnegative(),
  omitted: z.object({
    expired: z.number().int().nonnegative().default(0),
    lowConfidence: z.number().int().nonnegative().default(0),
    unsafe: z.number().int().nonnegative().default(0),
    notRelevant: z.number().int().nonnegative().default(0),
    crossScope: z.number().int().nonnegative().default(0),
  }),
});

export const WorkingMemoryToolSummarySchema = z.object({
  toolName: z.string().min(1),
  ok: z.boolean(),
  summary: z.string().max(500),
  atMs: z.number().int().nonnegative(),
});

const WorkingMemoryTextShape = {
  currentGoal: z.string().max(500).optional(),
  activeProject: z.string().max(200).optional(),
  activeTask: z.string().max(200).optional(),
  nextAction: z.string().max(500).optional(),
};
const WorkingMemoryListShape = {
  decisions: z.array(z.string().max(500)),
  importantFiles: z.array(z.string().max(500)),
  toolsUsed: z.array(z.string().min(1)),
  toolSummaries: z.array(WorkingMemoryToolSummarySchema),
  blockers: z.array(z.string().max(500)),
  pendingApprovalIds: z.array(z.string().min(1)),
};

export const WorkingMemoryArtifactSchema = z.object({
  sessionId: z.string().min(1),
  runId: z.string().min(1).optional(),
  ...WorkingMemoryTextShape,
  decisions: WorkingMemoryListShape.decisions.default([]),
  importantFiles: WorkingMemoryListShape.importantFiles.default([]),
  toolsUsed: WorkingMemoryListShape.toolsUsed.default([]),
  toolSummaries: WorkingMemoryListShape.toolSummaries.default([]),
  blockers: WorkingMemoryListShape.blockers.default([]),
  pendingApprovalIds: WorkingMemoryListShape.pendingApprovalIds.default([]),
  summary: z.string().max(1200).default(''),
  createdAtMs: z.number().int().nonnegative(),
  updatedAtMs: z.number().int().nonnegative(),
});

export const WorkingMemoryUpdateBodySchema = z.object({
  sessionId: z.string().min(1),
  runId: z.string().min(1).optional(),
  ...WorkingMemoryTextShape,
  decisions: WorkingMemoryListShape.decisions.optional(),
  importantFiles: WorkingMemoryListShape.importantFiles.optional(),
  toolsUsed: WorkingMemoryListShape.toolsUsed.optional(),
  toolSummaries: WorkingMemoryListShape.toolSummaries.optional(),
  blockers: WorkingMemoryListShape.blockers.optional(),
  pendingApprovalIds: WorkingMemoryListShape.pendingApprovalIds.optional(),
  summary: z.string().max(1200).optional(),
});

export const MemoryCandidateEvidenceSchema = z.object({
  kind: z.enum(['user_message', 'assistant_message', 'tool_result', 'observability']),
  id: z.string().min(1).optional(),
  excerpt: z.string().min(1).max(1000),
  atMs: z.number().int().nonnegative().optional(),
});

export const ExtractedMemoryCandidateSchema = z
  .object({
    ...ScopeShape,
    kind: MemoryKindSchema,
    content: z.string().min(1).max(2000),
    confidence: z.number().min(0).max(1),
    rationale: z.string().min(1).max(1000),
    evidence: z.array(MemoryCandidateEvidenceSchema).min(1).max(10),
    tags: z.array(z.string().min(1)).default([]),
    safetyState: MemorySafetyStateSchema.default('safe'),
  })
  .superRefine((value, ctx) => {
    if (!validateScopedMemory(value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: scopedMemoryMessage(value.scope),
        path: ['scopeId'],
      });
    }
  });

export const MemoryCandidateMessageSchema = z.object({
  id: z.string().min(1).optional(),
  role: z.enum(['user', 'assistant', 'tool', 'system']),
  content: z.string(),
  toolName: z.string().min(1).optional(),
  createdAtMs: z.number().int().nonnegative().optional(),
});

export const MemoryCandidateExtractionInputSchema = z.object({
  sessionId: z.string().min(1),
  agentId: z.string().min(1).optional(),
  projectId: z.string().min(1).optional(),
  messages: z.array(MemoryCandidateMessageSchema).default([]),
});

export const SelfLearningObjectiveSchema = z.enum(['recoverable_workspace_path_errors']);

export const SelfLearningObservedOutcomeSchema = z.object({
  kind: z.enum(['observability_error', 'memory_candidate']),
  id: z.string().min(1).optional(),
  message: z.string().min(1).max(2000),
  atMs: z.number().int().nonnegative().optional(),
});

export const SelfLearningEvaluateBodySchema = z.object({
  sessionId: z.string().min(1),
  agentId: z.string().min(1).optional(),
  projectId: z.string().min(1).optional(),
  objective: SelfLearningObjectiveSchema.default('recoverable_workspace_path_errors'),
  minOccurrences: z.number().int().min(2).max(20).default(2),
  observedOutcomes: z.array(SelfLearningObservedOutcomeSchema).default([]),
});

export const SelfLearningMetricsSchema = z.object({
  before: z.object({
    observedSignals: z.number().int().nonnegative(),
    matchingSignals: z.number().int().nonnegative(),
    candidateSignals: z.number().int().nonnegative(),
  }),
  after: z.object({
    approvedLearningMemories: z.number().int().nonnegative(),
    existingPendingProposals: z.number().int().nonnegative(),
  }),
});

export const SelfLearningEvaluationResultSchema = z.object({
  objective: SelfLearningObjectiveSchema,
  proposed: z.boolean(),
  reason: z.string().min(1),
  metrics: SelfLearningMetricsSchema,
  memory: MemoryRecordSchema.optional(),
});

export type MemoryScope = z.infer<typeof MemoryScopeSchema>;
export type MemoryKind = z.infer<typeof MemoryKindSchema>;
export type MemoryStatus = z.infer<typeof MemoryStatusSchema>;
export type MemoryReviewStatus = z.infer<typeof MemoryReviewStatusSchema>;
export type MemorySafetyState = z.infer<typeof MemorySafetyStateSchema>;
export type MemorySourceKind = z.infer<typeof MemorySourceKindSchema>;
export type MemoryLinkRelation = z.infer<typeof MemoryLinkRelationSchema>;
export type MemorySource = z.infer<typeof MemorySourceSchema>;
export type MemoryRecord = z.infer<typeof MemoryRecordSchema>;
export type MemoryCreateBody = z.infer<typeof MemoryCreateBodySchema>;
export type MemoryCreateBodyInput = z.input<typeof MemoryCreateBodySchema>;
export type MemoryUpdateBody = z.infer<typeof MemoryUpdateBodySchema>;
export type MemoryQuery = z.infer<typeof MemoryQuerySchema>;
export type MemoryQueryInput = z.input<typeof MemoryQuerySchema>;
export type MemoryReviewBody = z.infer<typeof MemoryReviewBodySchema>;
export type MemoryClearBody = z.infer<typeof MemoryClearBodySchema>;
export type MemoryCleanupBody = z.infer<typeof MemoryCleanupBodySchema>;
export type MemoryCleanupBodyInput = z.input<typeof MemoryCleanupBodySchema>;
export type MemoryLink = z.infer<typeof MemoryLinkSchema>;
export type PromptMemorySource = z.infer<typeof PromptMemorySourceSchema>;
export type PromptMemoryItem = z.infer<typeof PromptMemoryItemSchema>;
export type PromptMemoryBundle = z.infer<typeof PromptMemoryBundleSchema>;
export type WorkingMemoryToolSummary = z.infer<typeof WorkingMemoryToolSummarySchema>;
export type WorkingMemoryArtifact = z.infer<typeof WorkingMemoryArtifactSchema>;
export type WorkingMemoryUpdateBody = z.infer<typeof WorkingMemoryUpdateBodySchema>;
export type MemoryCandidateEvidence = z.infer<typeof MemoryCandidateEvidenceSchema>;
export type ExtractedMemoryCandidate = z.infer<typeof ExtractedMemoryCandidateSchema>;
export type MemoryCandidateMessage = z.infer<typeof MemoryCandidateMessageSchema>;
export type MemoryCandidateExtractionInput = z.infer<typeof MemoryCandidateExtractionInputSchema>;
export type SelfLearningObjective = z.infer<typeof SelfLearningObjectiveSchema>;
export type SelfLearningObservedOutcome = z.infer<typeof SelfLearningObservedOutcomeSchema>;
export type SelfLearningEvaluateBody = z.infer<typeof SelfLearningEvaluateBodySchema>;
export type SelfLearningMetrics = z.infer<typeof SelfLearningMetricsSchema>;
export type SelfLearningEvaluationResult = z.infer<typeof SelfLearningEvaluationResultSchema>;
