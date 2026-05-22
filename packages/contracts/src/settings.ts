import { z } from 'zod';

/** Rate limit configuration. */
export const RateLimitSettingsSchema = z.object({
  windowMs: z.number().int().positive().default(60_000),
  max: z.number().int().positive().default(100),
});

/** Global cost budget configuration. */
export const CostBudgetSettingsSchema = z.object({
  globalMaxCostUnits: z.number().nonnegative().nullable().default(null),
  warnThreshold: z.number().min(0).max(1).default(0.8),
});

export const ExecutionPolicyModeSchema = z.enum(['auto', 'ask', 'block']);
export const ExecutionPolicyCategorySchema = z.enum([
  'read_only',
  'workspace_write',
  'package_install',
  'network',
  'git_mutation',
  'container',
  'unknown',
  'destructive',
]);
export const ExecutionPolicyDecisionSchema = z.enum([
  'allowed',
  'approval_required',
  'blocked',
  'provider_required',
]);

export const ExecutionPolicySettingsSchema = z.object({
  unknownToolPolicy: z.enum(['ask', 'block']).default('ask'),
  unknownCommandPolicy: z.enum(['ask', 'block']).default('ask'),
  workspaceWrite: ExecutionPolicyModeSchema.default('ask'),
  packageInstall: ExecutionPolicyModeSchema.default('ask'),
  network: ExecutionPolicyModeSchema.default('ask'),
  gitMutation: ExecutionPolicyModeSchema.default('ask'),
  container: ExecutionPolicyModeSchema.default('ask'),
});

/** Full platform settings object. */
export const PlatformSettingsSchema = z.object({
  rateLimits: RateLimitSettingsSchema.default({}),
  costBudget: CostBudgetSettingsSchema.default({}),
  executionPolicy: ExecutionPolicySettingsSchema.default({}),
});

export type RateLimitSettings = z.infer<typeof RateLimitSettingsSchema>;
export type CostBudgetSettings = z.infer<typeof CostBudgetSettingsSchema>;
export type ExecutionPolicyMode = z.infer<typeof ExecutionPolicyModeSchema>;
export type ExecutionPolicyCategory = z.infer<typeof ExecutionPolicyCategorySchema>;
export type ExecutionPolicyDecision = z.infer<typeof ExecutionPolicyDecisionSchema>;
export type ExecutionPolicySettings = z.infer<typeof ExecutionPolicySettingsSchema>;
export type PlatformSettings = z.infer<typeof PlatformSettingsSchema>;

/** Schema for partial updates — every field is optional. */
export const PlatformSettingsUpdateSchema = z.object({
  rateLimits: RateLimitSettingsSchema.partial().optional(),
  costBudget: CostBudgetSettingsSchema.partial().optional(),
  executionPolicy: ExecutionPolicySettingsSchema.partial().optional(),
});

export type PlatformSettingsUpdate = z.infer<typeof PlatformSettingsUpdateSchema>;
