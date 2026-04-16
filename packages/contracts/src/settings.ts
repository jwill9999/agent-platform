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

/** Full platform settings object. */
export const PlatformSettingsSchema = z.object({
  rateLimits: RateLimitSettingsSchema.default({}),
  costBudget: CostBudgetSettingsSchema.default({}),
});

export type RateLimitSettings = z.infer<typeof RateLimitSettingsSchema>;
export type CostBudgetSettings = z.infer<typeof CostBudgetSettingsSchema>;
export type PlatformSettings = z.infer<typeof PlatformSettingsSchema>;

/** Schema for partial updates — every field is optional. */
export const PlatformSettingsUpdateSchema = z.object({
  rateLimits: RateLimitSettingsSchema.partial().optional(),
  costBudget: CostBudgetSettingsSchema.partial().optional(),
});

export type PlatformSettingsUpdate = z.infer<typeof PlatformSettingsUpdateSchema>;
