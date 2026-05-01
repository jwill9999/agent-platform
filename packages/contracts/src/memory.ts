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
    kind: MemoryKindSchema,
    status: MemoryStatusSchema,
    reviewStatus: MemoryReviewStatusSchema,
    content: z.string().min(1),
    confidence: z.number().min(0).max(1),
    source: MemorySourceSchema,
    tags: z.array(z.string().min(1)).default([]),
    metadata: z.record(JsonValueSchema).default({}),
    safetyState: MemorySafetyStateSchema,
    createdAtMs: z.number().int().nonnegative(),
    updatedAtMs: z.number().int().nonnegative(),
    expiresAtMs: z.number().int().positive().optional(),
    reviewedAtMs: z.number().int().nonnegative().optional(),
    reviewedBy: z.string().min(1).optional(),
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
    kind: MemoryKindSchema,
    status: MemoryStatusSchema.default('pending'),
    reviewStatus: MemoryReviewStatusSchema.default('unreviewed'),
    content: z.string().min(1),
    confidence: z.number().min(0).max(1).default(0.5),
    source: MemorySourceSchema,
    tags: z.array(z.string().min(1)).default([]),
    metadata: z.record(JsonValueSchema).default({}),
    safetyState: MemorySafetyStateSchema.default('unchecked'),
    expiresAtMs: z.number().int().positive().optional(),
    reviewedAtMs: z.number().int().nonnegative().optional(),
    reviewedBy: z.string().min(1).optional(),
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

export const MemoryLinkSchema = z.object({
  sourceMemoryId: z.string().min(1),
  targetMemoryId: z.string().min(1),
  relation: MemoryLinkRelationSchema,
  metadata: z.record(JsonValueSchema).default({}),
  createdAtMs: z.number().int().nonnegative(),
});

export const WorkingMemoryToolSummarySchema = z.object({
  toolName: z.string().min(1),
  ok: z.boolean(),
  summary: z.string().max(500),
  atMs: z.number().int().nonnegative(),
});

export const WorkingMemoryArtifactSchema = z.object({
  sessionId: z.string().min(1),
  runId: z.string().min(1).optional(),
  currentGoal: z.string().max(500).optional(),
  activeProject: z.string().max(200).optional(),
  activeTask: z.string().max(200).optional(),
  decisions: z.array(z.string().max(500)).default([]),
  importantFiles: z.array(z.string().max(500)).default([]),
  toolsUsed: z.array(z.string().min(1)).default([]),
  toolSummaries: z.array(WorkingMemoryToolSummarySchema).default([]),
  blockers: z.array(z.string().max(500)).default([]),
  pendingApprovalIds: z.array(z.string().min(1)).default([]),
  nextAction: z.string().max(500).optional(),
  summary: z.string().max(1200).default(''),
  createdAtMs: z.number().int().nonnegative(),
  updatedAtMs: z.number().int().nonnegative(),
});

export const WorkingMemoryUpdateBodySchema = z.object({
  sessionId: z.string().min(1),
  runId: z.string().min(1).optional(),
  currentGoal: z.string().max(500).optional(),
  activeProject: z.string().max(200).optional(),
  activeTask: z.string().max(200).optional(),
  decisions: z.array(z.string().max(500)).optional(),
  importantFiles: z.array(z.string().max(500)).optional(),
  toolsUsed: z.array(z.string().min(1)).optional(),
  toolSummaries: z.array(WorkingMemoryToolSummarySchema).optional(),
  blockers: z.array(z.string().max(500)).optional(),
  pendingApprovalIds: z.array(z.string().min(1)).optional(),
  nextAction: z.string().max(500).optional(),
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
    scope: MemoryScopeSchema,
    scopeId: z.string().min(1).optional(),
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
export type MemoryLink = z.infer<typeof MemoryLinkSchema>;
export type WorkingMemoryToolSummary = z.infer<typeof WorkingMemoryToolSummarySchema>;
export type WorkingMemoryArtifact = z.infer<typeof WorkingMemoryArtifactSchema>;
export type WorkingMemoryUpdateBody = z.infer<typeof WorkingMemoryUpdateBodySchema>;
export type MemoryCandidateEvidence = z.infer<typeof MemoryCandidateEvidenceSchema>;
export type ExtractedMemoryCandidate = z.infer<typeof ExtractedMemoryCandidateSchema>;
export type MemoryCandidateMessage = z.infer<typeof MemoryCandidateMessageSchema>;
export type MemoryCandidateExtractionInput = z.infer<typeof MemoryCandidateExtractionInputSchema>;
