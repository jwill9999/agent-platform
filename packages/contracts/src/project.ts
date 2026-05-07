import { z } from 'zod';

export const ProjectModeSchema = z.enum(['project', 'chat']);
export type ProjectMode = z.infer<typeof ProjectModeSchema>;

export const ProjectDefaultAgentProfileSchema = z.enum(['coding', 'personal_assistant']);
export type ProjectDefaultAgentProfile = z.infer<typeof ProjectDefaultAgentProfileSchema>;

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

const ProjectMetadataSchema = z.record(
  z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(z.string())]),
);

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
      switch (input.onboardingState) {
        case 'approved':
          return {
            canInspect: true,
            canWrite: true,
            writeBlockReason: undefined,
          };
        case 'missing':
        case 'in_progress':
        case 'needs_review':
          return {
            canInspect: true,
            canWrite: false,
            writeBlockReason: 'onboarding_not_approved',
          };
        default:
          return assertNever(input.onboardingState);
      }
    default:
      return assertNever(input.capabilityState);
  }
}

export type ProjectRecord = z.infer<typeof ProjectRecordSchema>;
export type ProjectCreateBody = z.infer<typeof ProjectCreateBodySchema>;
export type ProjectUpdateBody = z.infer<typeof ProjectUpdateBodySchema>;
export type ProjectQuery = z.infer<typeof ProjectQuerySchema>;
