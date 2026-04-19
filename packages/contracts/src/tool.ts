import { z } from 'zod';

/** Risk tiers for tool classification — drives security enforcement. */
export const RiskTierSchema = z.enum(['zero', 'low', 'medium', 'high', 'critical']);
export type RiskTier = z.infer<typeof RiskTierSchema>;

/** Full tool record returned by the API. */
export const ToolSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  config: z.record(z.unknown()).optional(),
  riskTier: RiskTierSchema.optional(),
  requiresApproval: z.boolean().optional(),
});

export type Tool = z.infer<typeof ToolSchema>;

/** POST /v1/tools body — id and slug are system-generated. */
export const ToolCreateBodySchema = ToolSchema.omit({ id: true, slug: true });

export type ToolCreateBody = z.infer<typeof ToolCreateBodySchema>;
