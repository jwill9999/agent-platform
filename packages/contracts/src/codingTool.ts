import { z } from 'zod';
import { RiskTierSchema } from './tool.js';

export const CodingToolKindSchema = z.enum(['edit', 'git', 'test', 'repo_map', 'search']);
export type CodingToolKind = z.infer<typeof CodingToolKindSchema>;

export const CodingToolStatusSchema = z.enum(['succeeded', 'failed', 'denied']);
export type CodingToolStatus = z.infer<typeof CodingToolStatusSchema>;

export const CodingArtifactKindSchema = z.enum([
  'diff',
  'stdout',
  'stderr',
  'file_list',
  'repo_map',
  'search_matches',
  'test_summary',
  'failure_summary',
  'audit_summary',
]);
export type CodingArtifactKind = z.infer<typeof CodingArtifactKindSchema>;

export const CodingArtifactStorageSchema = z.enum(['inline', 'workspace_file', 'database']);
export type CodingArtifactStorage = z.infer<typeof CodingArtifactStorageSchema>;

export const CodingArtifactSchema = z.object({
  kind: CodingArtifactKindSchema,
  label: z.string().min(1),
  storage: CodingArtifactStorageSchema,
  mimeType: z.string().min(1).default('text/plain'),
  content: z.string().optional(),
  uri: z.string().min(1).optional(),
  sizeBytes: z.number().int().min(0),
  truncated: z.boolean().default(false),
  sha256: z.string().length(64).optional(),
});
export type CodingArtifact = z.infer<typeof CodingArtifactSchema>;

export const CodingEvidenceSchema = z.object({
  kind: CodingToolKindSchema,
  summary: z.string().min(1),
  artifacts: z.array(CodingArtifactSchema).default([]),
  riskTier: RiskTierSchema,
  status: CodingToolStatusSchema,
  sourceTool: z.string().min(1),
  startedAtMs: z.number().int().nonnegative(),
  completedAtMs: z.number().int().nonnegative().optional(),
  durationMs: z.number().int().nonnegative().optional(),
});
export type CodingEvidence = z.infer<typeof CodingEvidenceSchema>;

export const CodingToolErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  details: z.unknown().optional(),
});
export type CodingToolError = z.infer<typeof CodingToolErrorSchema>;

export const CodingToolEnvelopeSchema = z.object({
  ok: z.boolean(),
  evidence: CodingEvidenceSchema,
  result: z.record(z.unknown()),
  message: z.string().optional(),
  error: CodingToolErrorSchema.optional(),
});
export type CodingToolEnvelope = z.infer<typeof CodingToolEnvelopeSchema>;

export const CodingPatchOperationSchema = z.object({
  path: z.string().min(1),
  oldText: z.string().optional(),
  newText: z.string(),
});
export type CodingPatchOperation = z.infer<typeof CodingPatchOperationSchema>;

export const CodingApplyPatchInputSchema = z.object({
  operations: z.array(CodingPatchOperationSchema).min(1),
  reason: z.string().min(1),
  dryRun: z.boolean().default(false),
});
export type CodingApplyPatchInput = z.infer<typeof CodingApplyPatchInputSchema>;

export const CodingApplyPatchResultSchema = z.object({
  dryRun: z.boolean(),
  changedFiles: z.array(z.string()),
  createdFiles: z.array(z.string()).default([]),
  deletedFiles: z.array(z.string()).default([]),
  diffStat: z
    .object({
      filesChanged: z.number().int().min(0),
      insertions: z.number().int().min(0),
      deletions: z.number().int().min(0),
    })
    .optional(),
});
export type CodingApplyPatchResult = z.infer<typeof CodingApplyPatchResultSchema>;
