import { z } from 'zod';
import { ExecutionLimitsSchema } from './limits.js';

/** Persisted agent profile (governance); runtime is still ephemeral per run. */
export const AgentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  systemPrompt: z.string().min(1),
  description: z.string().optional(),
  allowedSkillIds: z.array(z.string()),
  allowedToolIds: z.array(z.string()),
  allowedMcpServerIds: z.array(z.string()),
  executionLimits: ExecutionLimitsSchema,
  modelOverride: z
    .object({
      provider: z.string().min(1),
      model: z.string().min(1),
    })
    .optional(),
  pluginAllowlist: z.array(z.string()).nullable().optional(),
  pluginDenylist: z.array(z.string()).nullable().optional(),
});

export type Agent = z.infer<typeof AgentSchema>;
