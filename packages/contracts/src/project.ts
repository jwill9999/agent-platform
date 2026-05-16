import { z } from 'zod';

export const ProjectModeSchema = z.enum(['project', 'chat']);
export type ProjectMode = z.infer<typeof ProjectModeSchema>;

export const ProjectDefaultAgentProfileSchema = z.enum(['coding', 'personal_assistant']);
export type ProjectDefaultAgentProfile = z.infer<typeof ProjectDefaultAgentProfileSchema>;

export const ProjectProfileSchema = z.enum([
  'coding',
  'docs_content',
  'research',
  'automation',
  'mixed',
  'unknown',
]);
export type ProjectProfile = z.infer<typeof ProjectProfileSchema>;

export const ProjectCapabilitySchema = z.enum([
  'files',
  'chat',
  'coding_tools',
  'terminal',
  'git',
  'tests',
  'automation',
  'docs_research',
]);
export type ProjectCapability = z.infer<typeof ProjectCapabilitySchema>;

export const ProjectCapabilityStateSchema = z.enum([
  'backend_accessible',
  'readonly',
  'unavailable',
]);
export type ProjectCapabilityState = z.infer<typeof ProjectCapabilityStateSchema>;

export const ProjectOnboardingStateSchema = z.enum([
  'missing',
  'in_progress',
  'approved',
  'needs_review',
]);
export type ProjectOnboardingState = z.infer<typeof ProjectOnboardingStateSchema>;

export const ProjectInstructionFileScopeSchema = z.enum(['root', 'nested']);
export type ProjectInstructionFileScope = z.infer<typeof ProjectInstructionFileScopeSchema>;

export const ProjectAccessPolicyBlockReasonSchema = z.enum([
  'capability_unavailable',
  'readonly_capability',
  'onboarding_not_approved',
]);
export type ProjectAccessPolicyBlockReason = z.infer<typeof ProjectAccessPolicyBlockReasonSchema>;

const RelativeProjectPathSchema = z
  .string()
  .min(1)
  .max(1000)
  .refine(
    (value) => {
      if (value.trim() !== value) return false;
      if (/[\\\s]/.test(value)) return false;
      if (value.startsWith('/')) return false;

      const segments = value.split('/');
      return !segments.some((segment) => segment.length === 0 || segment === '..');
    },
    {
      message:
        'Path must be project-relative and contain no whitespace, backslashes, empty segments, or parent traversal',
    },
  );

const ProjectSlugSchema = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

type ProjectMetadataValue =
  | string
  | number
  | boolean
  | null
  | ProjectMetadataValue[]
  | { [key: string]: ProjectMetadataValue };

const ProjectMetadataValueSchema: z.ZodType<ProjectMetadataValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(ProjectMetadataValueSchema),
    z.record(z.string(), ProjectMetadataValueSchema),
  ]),
);

const ProjectMetadataSchema = z.record(ProjectMetadataValueSchema);

export const ProjectSubprojectScopeSchema = z.object({
  path: RelativeProjectPathSchema,
  packageName: z.string().min(1).max(200).optional(),
});
export type ProjectSubprojectScope = z.infer<typeof ProjectSubprojectScopeSchema>;

export const ProjectInstructionFileReferenceSchema = z.object({
  scope: ProjectInstructionFileScopeSchema,
  path: RelativeProjectPathSchema,
  appliesToPath: RelativeProjectPathSchema.optional(),
  contentHash: z.string().min(1).max(200).optional(),
  approvedAtMs: z.number().int().nonnegative().optional(),
});
export type ProjectInstructionFileReference = z.infer<typeof ProjectInstructionFileReferenceSchema>;

export const ProjectOnboardingAssessmentStatusSchema = z.enum([
  'approved',
  'in_progress',
  'needs_review',
]);
export type ProjectOnboardingAssessmentStatus = z.infer<
  typeof ProjectOnboardingAssessmentStatusSchema
>;

export const ProjectOnboardingEvidenceKindSchema = z.enum([
  'instructions',
  'manifest',
  'config',
  'docs',
  'source',
  'test',
  'container',
  'automation',
  'other',
]);
export type ProjectOnboardingEvidenceKind = z.infer<typeof ProjectOnboardingEvidenceKindSchema>;

export const ProjectOnboardingEvidenceFileSchema = z.object({
  path: RelativeProjectPathSchema,
  kind: ProjectOnboardingEvidenceKindSchema,
  summary: z.string().min(1).max(1000).optional(),
});
export type ProjectOnboardingEvidenceFile = z.infer<typeof ProjectOnboardingEvidenceFileSchema>;

export const ProjectOnboardingCommandKindSchema = z.enum([
  'run',
  'build',
  'test',
  'lint',
  'container',
  'automation',
  'other',
]);
export type ProjectOnboardingCommandKind = z.infer<typeof ProjectOnboardingCommandKindSchema>;

export const ProjectOnboardingCommandSchema = z.object({
  kind: ProjectOnboardingCommandKindSchema,
  command: z.string().min(1).max(1000),
  path: RelativeProjectPathSchema.optional(),
  packageName: z.string().min(1).max(200).optional(),
  confidence: z.number().min(0).max(1).optional(),
});
export type ProjectOnboardingCommand = z.infer<typeof ProjectOnboardingCommandSchema>;

export const ProjectOnboardingGapKindSchema = z.enum([
  'missing_instructions',
  'stale_instructions',
  'contradiction',
  'ambiguous_scope',
  'missing_command',
  'unknown_profile',
  'other',
]);
export type ProjectOnboardingGapKind = z.infer<typeof ProjectOnboardingGapKindSchema>;

export const ProjectOnboardingGapSchema = z.object({
  kind: ProjectOnboardingGapKindSchema,
  severity: z.enum(['info', 'warning', 'blocking']),
  message: z.string().min(1).max(1000),
  evidencePaths: z.array(RelativeProjectPathSchema).default([]),
});
export type ProjectOnboardingGap = z.infer<typeof ProjectOnboardingGapSchema>;

export const ProjectOnboardingQuestionSchema = z.object({
  id: z.string().min(1).max(120),
  prompt: z.string().min(1).max(1000),
  reason: z.string().min(1).max(1000).optional(),
  required: z.boolean().default(true),
});
export type ProjectOnboardingQuestion = z.infer<typeof ProjectOnboardingQuestionSchema>;

export const ProjectInstructionUpdateRecommendationSchema = z.object({
  targetPath: RelativeProjectPathSchema.default('AGENTS.md'),
  summary: z.string().min(1).max(1000),
  rationale: z.string().min(1).max(1000).optional(),
  proposedMarkdown: z.string().min(1).max(20000).optional(),
});
export type ProjectInstructionUpdateRecommendation = z.infer<
  typeof ProjectInstructionUpdateRecommendationSchema
>;

export const ProjectInstructionUpdateSourceSchema = z.enum([
  'agent_observation',
  'closeout',
  'refresh',
  'user_feedback',
]);
export type ProjectInstructionUpdateSource = z.infer<typeof ProjectInstructionUpdateSourceSchema>;

export const ProjectInstructionUpdateRiskSchema = z.enum([
  'low_risk_fact',
  'needs_review',
  'policy_change',
]);
export type ProjectInstructionUpdateRisk = z.infer<typeof ProjectInstructionUpdateRiskSchema>;

export const ProjectInstructionUpdateStatusSchema = z.enum([
  'pending',
  'proposed',
  'applied',
  'rejected',
]);
export type ProjectInstructionUpdateStatus = z.infer<typeof ProjectInstructionUpdateStatusSchema>;

export const ProjectInstructionUpdateCandidateSchema = z.object({
  id: z.string().min(1).max(120),
  targetPath: RelativeProjectPathSchema.default('AGENTS.md'),
  summary: z.string().min(1).max(1000),
  rationale: z.string().min(1).max(1000).optional(),
  proposedMarkdown: z.string().min(1).max(5000).optional(),
  source: ProjectInstructionUpdateSourceSchema,
  risk: ProjectInstructionUpdateRiskSchema.default('needs_review'),
  status: ProjectInstructionUpdateStatusSchema.default('pending'),
  evidence: z.array(ProjectOnboardingEvidenceFileSchema).default([]),
  createdAtMs: z.number().int().nonnegative(),
  decidedAtMs: z.number().int().nonnegative().optional(),
  reviewer: z.string().min(1).max(200).optional(),
  decisionComment: z.string().max(2000).optional(),
});
export type ProjectInstructionUpdateCandidate = z.infer<
  typeof ProjectInstructionUpdateCandidateSchema
>;

export const ProjectInstructionUpdateCandidateInputSchema = z.object({
  targetPath: RelativeProjectPathSchema.default('AGENTS.md'),
  summary: z.string().trim().min(1).max(1000),
  rationale: z.string().trim().min(1).max(1000).optional(),
  proposedMarkdown: z.string().trim().min(1).max(5000).optional(),
  source: ProjectInstructionUpdateSourceSchema.default('agent_observation'),
  risk: ProjectInstructionUpdateRiskSchema.default('needs_review'),
  evidence: z.array(ProjectOnboardingEvidenceFileSchema).default([]),
});
export type ProjectInstructionUpdateCandidateInput = z.infer<
  typeof ProjectInstructionUpdateCandidateInputSchema
>;

export const ProjectInstructionUpdateCandidateBodySchema = z.object({
  candidates: z.array(ProjectInstructionUpdateCandidateInputSchema).min(1).max(20),
});
export type ProjectInstructionUpdateCandidateBody = z.infer<
  typeof ProjectInstructionUpdateCandidateBodySchema
>;

export const ProjectInstructionUpdateDecisionBodySchema = z.object({
  reviewer: z.string().trim().min(1).max(200).default('User'),
  comment: z.string().trim().max(2000).optional(),
});
export type ProjectInstructionUpdateDecisionBody = z.infer<
  typeof ProjectInstructionUpdateDecisionBodySchema
>;

export const ProjectInstructionUpdateProposalSchema = z.object({
  id: z.string().min(1).max(120),
  status: z.enum(['ready', 'empty']),
  candidateIds: z.array(z.string().min(1).max(120)).default([]),
  summary: z.string().min(1).max(1000),
  policy: z.enum(['relaxed_reviewable', 'strict_blocking']).default('relaxed_reviewable'),
  createdAtMs: z.number().int().nonnegative(),
});
export type ProjectInstructionUpdateProposal = z.infer<
  typeof ProjectInstructionUpdateProposalSchema
>;

export const ProjectOnboardingDisplayContextSchema = z.object({
  projectName: z.string().min(1).max(200),
  folderLabel: z.string().min(1).max(500).optional(),
  relativePath: RelativeProjectPathSchema.optional(),
  profileLabel: z.string().min(1).max(120).optional(),
  onboardingLabel: z.string().min(1).max(120),
  branchLabel: z.string().min(1).max(300).optional(),
});
export type ProjectOnboardingDisplayContext = z.infer<typeof ProjectOnboardingDisplayContextSchema>;

export const ProjectOnboardingAssessmentSchema = z.object({
  status: ProjectOnboardingAssessmentStatusSchema,
  profile: ProjectProfileSchema,
  capabilities: z.array(ProjectCapabilitySchema).default([]),
  summary: z.string().min(1).max(4000),
  evidenceFiles: z.array(ProjectOnboardingEvidenceFileSchema).default([]),
  subprojectScopes: z.array(ProjectSubprojectScopeSchema).default([]),
  commands: z.array(ProjectOnboardingCommandSchema).default([]),
  gaps: z.array(ProjectOnboardingGapSchema).default([]),
  questions: z.array(ProjectOnboardingQuestionSchema).default([]),
  recommendedInstructionUpdates: z.array(ProjectInstructionUpdateRecommendationSchema).default([]),
  display: ProjectOnboardingDisplayContextSchema,
  assessedAtMs: z.number().int().nonnegative(),
});
export type ProjectOnboardingAssessment = z.infer<typeof ProjectOnboardingAssessmentSchema>;

export const ProjectOnboardingDraftSchema = z.object({
  id: z.string().min(1).max(120),
  projectId: z.string().min(1),
  targetPath: RelativeProjectPathSchema.default('AGENTS.md'),
  markdown: z.string().min(1).max(50000),
  revision: z.number().int().positive(),
  history: z
    .array(
      z.object({
        revision: z.number().int().positive(),
        markdown: z.string().min(1).max(50000),
        summary: z.string().min(1).max(1000),
        createdAtMs: z.number().int().nonnegative(),
      }),
    )
    .default([]),
  createdAtMs: z.number().int().nonnegative(),
  updatedAtMs: z.number().int().nonnegative(),
});
export type ProjectOnboardingDraft = z.infer<typeof ProjectOnboardingDraftSchema>;

export const ProjectOnboardingDialogueRoleSchema = z.enum(['assistant', 'user']);
export type ProjectOnboardingDialogueRole = z.infer<typeof ProjectOnboardingDialogueRoleSchema>;

export const ProjectOnboardingDialogueTurnSchema = z.object({
  id: z.string().min(1).max(120),
  role: ProjectOnboardingDialogueRoleSchema,
  content: z.string().min(1).max(5000),
  questionId: z.string().min(1).max(120).optional(),
  createdAtMs: z.number().int().nonnegative(),
});
export type ProjectOnboardingDialogueTurn = z.infer<typeof ProjectOnboardingDialogueTurnSchema>;

export const ProjectOnboardingDialogueSchema = z.object({
  status: z.enum(['idle', 'asking', 'draft_ready']),
  activeQuestionId: z.string().min(1).max(120).optional(),
  answeredQuestionIds: z.array(z.string().min(1).max(120)).default([]),
  turns: z.array(ProjectOnboardingDialogueTurnSchema).default([]),
  updatedAtMs: z.number().int().nonnegative(),
});
export type ProjectOnboardingDialogue = z.infer<typeof ProjectOnboardingDialogueSchema>;

export const ProjectOnboardingAnswerBodySchema = z.object({
  questionId: z.string().min(1).max(120).optional(),
  answer: z.string().trim().min(1).max(5000),
});
export type ProjectOnboardingAnswerBody = z.infer<typeof ProjectOnboardingAnswerBodySchema>;

export const ProjectOnboardingReviewBodySchema = z.object({
  decision: z.enum(['approve', 'reject', 'request_changes']).default('approve'),
  reviewer: z.string().trim().min(1).max(200).default('User'),
  comment: z.string().trim().max(2000).optional(),
});
export type ProjectOnboardingReviewBody = z.infer<typeof ProjectOnboardingReviewBodySchema>;

export const ProjectOnboardingApprovalDecisionSchema = z.object({
  decision: z.enum(['approve', 'reject', 'request_changes']),
  projectId: z.string().min(1),
  targetPath: RelativeProjectPathSchema.default('AGENTS.md'),
  contentHash: z.string().min(1).max(200).optional(),
  reviewer: z.string().min(1).max(200),
  source: z.enum(['auto_assessment', 'manual_review']),
  decidedAtMs: z.number().int().nonnegative(),
  comment: z.string().max(2000).optional(),
});
export type ProjectOnboardingApprovalDecision = z.infer<
  typeof ProjectOnboardingApprovalDecisionSchema
>;

export const ProjectOnboardingRefreshResultSchema = z.object({
  previousState: ProjectOnboardingStateSchema,
  nextState: ProjectOnboardingStateSchema,
  updateStatus: z.enum(['no_change', 'proposed_update', 'material_drift']).default('no_change'),
  materialDrift: z.boolean(),
  assessment: ProjectOnboardingAssessmentSchema,
  refreshedAtMs: z.number().int().nonnegative(),
});
export type ProjectOnboardingRefreshResult = z.infer<typeof ProjectOnboardingRefreshResultSchema>;

export const ProjectOnboardingFixtureStateSchema = z.enum([
  'sufficient_existing_instructions',
  'missing_instructions',
  'insufficient_instructions',
  'stale_instructions',
  'nested_instructions',
  'ambiguous_subproject',
  'mixed_non_code_project',
]);
export type ProjectOnboardingFixtureState = z.infer<typeof ProjectOnboardingFixtureStateSchema>;

export const ProjectOnboardingTransitionTriggerSchema = z.enum([
  'assessment_missing',
  'assessment_needs_review',
  'assessment_approved',
  'approval_granted',
  'approval_rejected',
  'refresh_material_drift',
  'refresh_no_change',
]);
export type ProjectOnboardingTransitionTrigger = z.infer<
  typeof ProjectOnboardingTransitionTriggerSchema
>;

export const ProjectWorkspaceBindingSchema = z.object({
  projectId: z.string().min(1),
  displayName: z.string().min(1).max(200),
  projectRoot: z.literal('/workspace'),
  repositoryRoot: z.string().min(1).max(1000),
  activeBranch: z.string().min(1).max(300).optional(),
  activeWorktreeId: z.string().min(1).max(500).optional(),
  subprojectScope: ProjectSubprojectScopeSchema.optional(),
  capabilityState: ProjectCapabilityStateSchema,
  onboardingState: ProjectOnboardingStateSchema,
  defaultAgentProfile: ProjectDefaultAgentProfileSchema,
  instructionFiles: z.array(ProjectInstructionFileReferenceSchema).default([]),
});
export type ProjectWorkspaceBinding = z.infer<typeof ProjectWorkspaceBindingSchema>;

export const ProjectAccessPolicySchema = z.object({
  canInspect: z.boolean(),
  canWrite: z.boolean(),
  writeBlockReason: ProjectAccessPolicyBlockReasonSchema.optional(),
});
export type ProjectAccessPolicy = z.infer<typeof ProjectAccessPolicySchema>;

export const ProjectRecordSchema = z.object({
  id: z.string().min(1),
  slug: ProjectSlugSchema,
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  workspacePath: z.string().min(1).max(1000),
  workspaceKey: z.string().min(1).max(300).optional(),
  metadata: ProjectMetadataSchema.default({}),
  archivedAtMs: z.number().int().nonnegative().optional(),
  createdAtMs: z.number().int().nonnegative(),
  updatedAtMs: z.number().int().nonnegative(),
});

export const ProjectCreateBodySchema = z.object({
  name: z.string().min(1).max(200),
  slug: ProjectSlugSchema.optional(),
  description: z.string().max(1000).optional(),
  workspacePath: z.string().min(1).max(1000).optional(),
  workspaceKey: z.string().min(1).max(300).optional(),
  metadata: ProjectMetadataSchema.default({}),
});

export const ProjectUpdateBodySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  slug: ProjectSlugSchema.optional(),
  description: z.string().max(1000).nullable().optional(),
  workspacePath: z.string().min(1).max(1000).optional(),
  workspaceKey: z.string().min(1).max(300).nullable().optional(),
  metadata: ProjectMetadataSchema.optional(),
  archivedAtMs: z.number().int().nonnegative().nullable().optional(),
});

export const ProjectOpenBodySchema = z.object({
  path: z.string().min(1).max(4000),
  name: z.string().min(1).max(200).optional(),
  slug: ProjectSlugSchema.optional(),
});

export const ProjectDesktopRegistrationBodySchema = ProjectOpenBodySchema;
export type ProjectDesktopRegistrationBody = z.infer<typeof ProjectDesktopRegistrationBodySchema>;

export const ProjectDesktopMetadataSchema = z.object({
  source: z.literal('desktop'),
  folderName: z.string().min(1).max(200),
  folderPathLabel: z.string().min(1).max(1000).optional(),
  capabilityState: ProjectCapabilityStateSchema,
  onboardingState: ProjectOnboardingStateSchema,
  defaultAgentProfile: ProjectDefaultAgentProfileSchema,
  activeBranch: z.string().min(1).max(300).optional(),
  instructionFileCount: z.number().int().nonnegative(),
});
export type ProjectDesktopMetadata = z.infer<typeof ProjectDesktopMetadataSchema>;

export const ProjectDesktopRecordSchema = ProjectRecordSchema.extend({
  workspaceKey: z.undefined().optional(),
  metadata: ProjectDesktopMetadataSchema,
});
export type ProjectDesktopRecord = z.infer<typeof ProjectDesktopRecordSchema>;

export const ProjectDesktopRegistrationResultSchema = z.object({
  created: z.boolean(),
  project: ProjectDesktopRecordSchema,
});
export type ProjectDesktopRegistrationResult = z.infer<
  typeof ProjectDesktopRegistrationResultSchema
>;

export const ProjectDesktopRecentProjectsResultSchema = z.object({
  projects: ProjectDesktopRecordSchema.array(),
});
export type ProjectDesktopRecentProjectsResult = z.infer<
  typeof ProjectDesktopRecentProjectsResultSchema
>;

const ProjectBranchNameSchema = z
  .string()
  .min(1)
  .max(300)
  .refine(
    (value) =>
      value.trim() === value &&
      !value.startsWith('-') &&
      !value.includes('\\') &&
      !value.includes('..') &&
      !/[\s~^:?*[\]\0]/.test(value),
    { message: 'Branch name must be a safe Git branch reference' },
  );

export const ProjectBranchSummarySchema = z.object({
  name: ProjectBranchNameSchema,
  current: z.boolean(),
});
export type ProjectBranchSummary = z.infer<typeof ProjectBranchSummarySchema>;

export const ProjectBranchListResultSchema = z.object({
  currentBranch: ProjectBranchNameSchema.optional(),
  clean: z.boolean(),
  branches: z.array(ProjectBranchSummarySchema),
});
export type ProjectBranchListResult = z.infer<typeof ProjectBranchListResultSchema>;

export const ProjectBranchCheckoutBodySchema = z.object({
  branch: ProjectBranchNameSchema,
});
export type ProjectBranchCheckoutBody = z.infer<typeof ProjectBranchCheckoutBodySchema>;

export const ProjectGitWorkingTreeSummarySchema = z.object({
  total: z.number().int().nonnegative(),
  staged: z.number().int().nonnegative(),
  unstaged: z.number().int().nonnegative(),
  added: z.number().int().nonnegative(),
  modified: z.number().int().nonnegative(),
  deleted: z.number().int().nonnegative(),
  renamed: z.number().int().nonnegative(),
  untracked: z.number().int().nonnegative(),
  conflicts: z.number().int().nonnegative(),
});
export type ProjectGitWorkingTreeSummary = z.infer<typeof ProjectGitWorkingTreeSummarySchema>;

export const ProjectGitRecentCommitSchema = z.object({
  sha: z.string().min(1).max(80),
  subject: z.string().min(1).max(500),
  authorName: z.string().min(1).max(200).optional(),
  committedAt: z.string().min(1).max(100).optional(),
});
export type ProjectGitRecentCommit = z.infer<typeof ProjectGitRecentCommitSchema>;

export const ProjectGitStatusResultSchema = z.object({
  available: z.boolean(),
  reason: z.string().min(1).max(500).optional(),
  repositoryName: z.string().min(1).max(200).optional(),
  remoteUrl: z.string().min(1).max(1000).optional(),
  currentBranch: z.string().min(1).max(300).optional(),
  upstreamBranch: z.string().min(1).max(300).optional(),
  baseBranch: z.string().min(1).max(300).optional(),
  headSha: z.string().min(1).max(80).optional(),
  ahead: z.number().int().nonnegative().default(0),
  behind: z.number().int().nonnegative().default(0),
  clean: z.boolean(),
  workingTree: ProjectGitWorkingTreeSummarySchema,
  recentCommit: ProjectGitRecentCommitSchema.optional(),
  githubRemoteDetected: z.boolean().default(false),
});
export type ProjectGitStatusResult = z.infer<typeof ProjectGitStatusResultSchema>;

export const ProjectGitFileStatusSchema = z.enum([
  'added',
  'modified',
  'deleted',
  'renamed',
  'untracked',
  'conflict',
]);
export type ProjectGitFileStatus = z.infer<typeof ProjectGitFileStatusSchema>;

export const ProjectGitChangedFileSchema = z.object({
  path: z.string().min(1).max(1000),
  originalPath: z.string().min(1).max(1000).optional(),
  status: ProjectGitFileStatusSchema,
  indexStatus: z.string().min(1).max(2),
  worktreeStatus: z.string().min(1).max(2),
  staged: z.boolean(),
  unstaged: z.boolean(),
  additions: z.number().int().nonnegative().optional(),
  deletions: z.number().int().nonnegative().optional(),
});
export type ProjectGitChangedFile = z.infer<typeof ProjectGitChangedFileSchema>;

export const ProjectGitChangesResultSchema = z.object({
  available: z.boolean(),
  reason: z.string().min(1).max(500).optional(),
  clean: z.boolean(),
  workingTree: ProjectGitWorkingTreeSummarySchema,
  files: z.array(ProjectGitChangedFileSchema),
});
export type ProjectGitChangesResult = z.infer<typeof ProjectGitChangesResultSchema>;

export const ProjectGitDiffModeSchema = z.enum(['unstaged', 'staged']);
export type ProjectGitDiffMode = z.infer<typeof ProjectGitDiffModeSchema>;

export const ProjectGitFileDiffResultSchema = z.object({
  path: z.string().min(1).max(1000),
  mode: ProjectGitDiffModeSchema,
  status: ProjectGitFileStatusSchema.optional(),
  diff: z.string(),
  truncated: z.boolean().default(false),
});
export type ProjectGitFileDiffResult = z.infer<typeof ProjectGitFileDiffResultSchema>;

export const ProjectGitStageBodySchema = z
  .object({
    all: z.boolean().optional(),
    paths: z.array(z.string().min(1).max(1000)).max(100).optional(),
  })
  .refine((value) => value.all === true || Boolean(value.paths?.length), {
    message: 'Specify all=true or at least one path',
  });
export type ProjectGitStageBody = z.infer<typeof ProjectGitStageBodySchema>;

export type ProjectFileNode = {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  children?: ProjectFileNode[];
};

export const ProjectFileNodeSchema: z.ZodType<ProjectFileNode> = z.lazy(() =>
  z.object({
    name: z.string().min(1),
    path: z.string().min(1),
    type: z.enum(['file', 'directory']),
    size: z.number().int().nonnegative().optional(),
    children: z.array(ProjectFileNodeSchema).optional(),
  }),
);

export const ProjectFileTreeResultSchema = z.object({
  rootName: z.string().min(1),
  files: z.array(ProjectFileNodeSchema),
});
export type ProjectFileTreeResult = z.infer<typeof ProjectFileTreeResultSchema>;

export const ProjectFileReadResultSchema = z.object({
  name: z.string().min(1),
  path: z.string().min(1),
  content: z.string(),
  size: z.number().int().nonnegative(),
});
export type ProjectFileReadResult = z.infer<typeof ProjectFileReadResultSchema>;

export const ProjectQuerySchema = z.object({
  includeArchived: z.coerce.boolean().default(false),
});

export function getDefaultAgentProfileForMode(mode: ProjectMode): ProjectDefaultAgentProfile {
  return mode === 'project' ? 'coding' : 'personal_assistant';
}

function assertNever(value: never): never {
  throw new Error(`Unhandled Project state: ${String(value)}`);
}

export function getProjectAccessPolicy(input: {
  capabilityState: ProjectCapabilityState;
  onboardingState: ProjectOnboardingState;
}): ProjectAccessPolicy {
  switch (input.capabilityState) {
    case 'unavailable':
      return {
        canInspect: false,
        canWrite: false,
        writeBlockReason: 'capability_unavailable',
      };
    case 'readonly':
      return {
        canInspect: true,
        canWrite: false,
        writeBlockReason: 'readonly_capability',
      };
    case 'backend_accessible':
      return {
        canInspect: true,
        canWrite: true,
        writeBlockReason: undefined,
      };
    default:
      return assertNever(input.capabilityState);
  }
}

export function transitionProjectOnboardingState(input: {
  current: ProjectOnboardingState;
  trigger: ProjectOnboardingTransitionTrigger;
}): ProjectOnboardingState {
  switch (input.trigger) {
    case 'assessment_missing':
      if (input.current === 'missing') return 'in_progress';
      break;
    case 'assessment_needs_review':
      if (input.current === 'missing' || input.current === 'needs_review') return 'in_progress';
      if (input.current === 'approved') return 'needs_review';
      break;
    case 'assessment_approved':
    case 'approval_granted':
      if (input.current === 'needs_review' || input.current === 'in_progress') return 'approved';
      break;
    case 'approval_rejected':
      if (input.current === 'needs_review' || input.current === 'in_progress') {
        return 'in_progress';
      }
      break;
    case 'refresh_material_drift':
      if (input.current === 'approved') return 'needs_review';
      break;
    case 'refresh_no_change':
      return input.current;
    default:
      return assertNever(input.trigger);
  }

  throw new Error(`Invalid Project onboarding transition: ${input.current} via ${input.trigger}`);
}

export type ProjectRecord = z.infer<typeof ProjectRecordSchema>;
export type ProjectCreateBody = z.infer<typeof ProjectCreateBodySchema>;
export type ProjectOpenBody = z.infer<typeof ProjectOpenBodySchema>;
export type ProjectUpdateBody = z.infer<typeof ProjectUpdateBodySchema>;
export type ProjectQuery = z.infer<typeof ProjectQuerySchema>;
