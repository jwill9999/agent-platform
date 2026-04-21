import { z } from 'zod';
import { ExecutionLimitsSchema } from './limits.js';

const modelOverrideShape = z
  .object({
    provider: z.string().min(1),
    model: z.string().min(1),
  })
  .optional();

/** Context window configuration for conversation windowing. */
export const ContextWindowSchema = z.object({
  /** Maximum input tokens for context (system + history + new message). */
  maxInputTokens: z.number().int().positive().default(8000),
  /** Strategy for handling overflow: truncate oldest or summarize dropped messages. */
  strategy: z.enum(['truncate', 'summarize']).default('truncate'),
});

export type ContextWindow = z.infer<typeof ContextWindowSchema>;

export const DEFAULT_CONTEXT_WINDOW: ContextWindow = {
  maxInputTokens: 8000,
  strategy: 'truncate',
};

/**
 * Full agent record returned by the API.
 * `id` and `slug` are assigned at create time. The display `name` (and other fields in
 * {@link AgentCreateBodySchema}) may be updated via PUT; `slug` is immutable for the
 * lifetime of the agent.
 */
export const AgentSchema = z.object({
  id: z.string().min(1),
  /** Stable URL-safe identifier; never changes after create. */
  slug: z.string().min(1),
  /** Display label; may be changed without affecting `slug`. */
  name: z.string().min(1),
  systemPrompt: z.string().min(1),
  description: z.string().optional(),
  allowedSkillIds: z.array(z.string()),
  allowedToolIds: z.array(z.string()),
  allowedMcpServerIds: z.array(z.string()),
  executionLimits: ExecutionLimitsSchema,
  modelOverride: modelOverrideShape,
  /**
   * ID of a saved model config (provider + model + encrypted API key).
   * When set, takes precedence over `modelOverride` and env-var key resolution.
   */
  modelConfigId: z.string().optional(),
  contextWindow: ContextWindowSchema.optional(),
  pluginAllowlist: z.array(z.string()).nullable().optional(),
  pluginDenylist: z.array(z.string()).nullable().optional(),
});

export type Agent = z.infer<typeof AgentSchema>;

/**
 * POST /v1/agents body — `id` and `slug` are system-generated at create (`slug` is derived
 * from `name`). PUT /v1/agents/{idOrSlug} uses the same shape; the server preserves the
 * existing `slug` (immutable).
 */
export const AgentCreateBodySchema = AgentSchema.omit({ id: true, slug: true });

export type AgentCreateBody = z.infer<typeof AgentCreateBodySchema>;
