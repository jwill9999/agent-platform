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

export const CodingGitStatusInputSchema = z.object({
  repoPath: z.string().min(1).default('.'),
});
export type CodingGitStatusInput = z.infer<typeof CodingGitStatusInputSchema>;

export const CodingGitDiffInputSchema = z.object({
  repoPath: z.string().min(1).default('.'),
  path: z.string().min(1).optional(),
  staged: z.boolean().default(false),
  maxBytes: z.number().int().positive().max(100_000).default(20_000),
});
export type CodingGitDiffInput = z.infer<typeof CodingGitDiffInputSchema>;

export const CodingGitLogInputSchema = z.object({
  repoPath: z.string().min(1).default('.'),
  ref: z.string().min(1).optional(),
  maxCount: z.number().int().positive().max(50).default(10),
});
export type CodingGitLogInput = z.infer<typeof CodingGitLogInputSchema>;

export const CodingGitBranchInfoInputSchema = z.object({
  repoPath: z.string().min(1).default('.'),
});
export type CodingGitBranchInfoInput = z.infer<typeof CodingGitBranchInfoInputSchema>;

export const CodingGitChangedFilesInputSchema = z.object({
  repoPath: z.string().min(1).default('.'),
});
export type CodingGitChangedFilesInput = z.infer<typeof CodingGitChangedFilesInputSchema>;

export const CodingGitFileChangeSchema = z.object({
  path: z.string(),
  status: z.string(),
  staged: z.boolean(),
  unstaged: z.boolean(),
});
export type CodingGitFileChange = z.infer<typeof CodingGitFileChangeSchema>;

export const CodingGitStatusResultSchema = z.object({
  repoPath: z.string(),
  branch: z.string(),
  head: z.string().optional(),
  clean: z.boolean(),
  ahead: z.number().int().min(0).default(0),
  behind: z.number().int().min(0).default(0),
  changedFiles: z.array(CodingGitFileChangeSchema),
});
export type CodingGitStatusResult = z.infer<typeof CodingGitStatusResultSchema>;

export const CodingGitDiffResultSchema = z.object({
  repoPath: z.string(),
  staged: z.boolean(),
  path: z.string().optional(),
  diff: z.string(),
  sizeBytes: z.number().int().min(0),
  truncated: z.boolean(),
  filesChanged: z.number().int().min(0),
});
export type CodingGitDiffResult = z.infer<typeof CodingGitDiffResultSchema>;

export const CodingGitLogEntrySchema = z.object({
  hash: z.string(),
  shortHash: z.string(),
  author: z.string(),
  authoredAt: z.string(),
  subject: z.string(),
});
export type CodingGitLogEntry = z.infer<typeof CodingGitLogEntrySchema>;

export const CodingGitLogResultSchema = z.object({
  repoPath: z.string(),
  ref: z.string().optional(),
  commits: z.array(CodingGitLogEntrySchema),
  truncated: z.boolean(),
});
export type CodingGitLogResult = z.infer<typeof CodingGitLogResultSchema>;

export const CodingGitBranchInfoResultSchema = z.object({
  repoPath: z.string(),
  branch: z.string(),
  head: z.string().optional(),
  upstream: z.string().optional(),
  ahead: z.number().int().min(0).default(0),
  behind: z.number().int().min(0).default(0),
});
export type CodingGitBranchInfoResult = z.infer<typeof CodingGitBranchInfoResultSchema>;

export const CodingGitChangedFilesResultSchema = z.object({
  repoPath: z.string(),
  count: z.number().int().min(0),
  files: z.array(CodingGitFileChangeSchema),
  truncated: z.boolean(),
});
export type CodingGitChangedFilesResult = z.infer<typeof CodingGitChangedFilesResultSchema>;

export const CodingQualityGateProfileSchema = z.enum([
  'test',
  'typecheck',
  'lint',
  'format',
  'docs',
  'build',
  'e2e',
]);
export type CodingQualityGateProfile = z.infer<typeof CodingQualityGateProfileSchema>;

export const CodingRunQualityGateInputSchema = z
  .object({
    profile: CodingQualityGateProfileSchema,
    repoPath: z.string().min(1).default('.'),
    packageName: z
      .string()
      .regex(/^(@agent-platform\/[a-z0-9-]+|(?:apps|packages)\/[a-z0-9-]+)$/)
      .optional(),
    timeoutMs: z.number().int().positive().max(600_000).default(120_000),
    maxOutputBytes: z.number().int().positive().max(100_000).default(20_000),
  })
  .strict();
export type CodingRunQualityGateInput = z.infer<typeof CodingRunQualityGateInputSchema>;

export const CodingQualityGateFailureSchema = z.object({
  message: z.string(),
  file: z.string().optional(),
  line: z.number().int().positive().optional(),
});
export type CodingQualityGateFailure = z.infer<typeof CodingQualityGateFailureSchema>;

export const CodingRunQualityGateResultSchema = z.object({
  profile: CodingQualityGateProfileSchema,
  packageName: z.string().optional(),
  repoPath: z.string(),
  command: z.array(z.string()),
  exitCode: z.number().int().nullable(),
  timedOut: z.boolean(),
  durationMs: z.number().int().nonnegative(),
  stdoutTail: z.string(),
  stderrTail: z.string(),
  truncated: z.boolean(),
  failures: z.array(CodingQualityGateFailureSchema),
});
export type CodingRunQualityGateResult = z.infer<typeof CodingRunQualityGateResultSchema>;
