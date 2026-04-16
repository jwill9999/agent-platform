import { z } from 'zod';
import { ExecutionLimitsSchema } from './limits.js';

const modelOverrideShape = z
  .object({
    provider: z.string().min(1),
    model: z.string().min(1),
  })
  .optional();

/** Full agent record returned by the API (includes system-generated id + slug). */
export const AgentSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  name: z.string().min(1),
  systemPrompt: z.string().min(1),
  description: z.string().optional(),
  allowedSkillIds: z.array(z.string()),
  allowedToolIds: z.array(z.string()),
  allowedMcpServerIds: z.array(z.string()),
  executionLimits: ExecutionLimitsSchema,
  modelOverride: modelOverrideShape,
  pluginAllowlist: z.array(z.string()).nullable().optional(),
  pluginDenylist: z.array(z.string()).nullable().optional(),
});

export type Agent = z.infer<typeof AgentSchema>;

/** POST /v1/agents body — id and slug are system-generated. */
export const AgentCreateBodySchema = AgentSchema.omit({ id: true, slug: true });

export type AgentCreateBody = z.infer<typeof AgentCreateBodySchema>;
