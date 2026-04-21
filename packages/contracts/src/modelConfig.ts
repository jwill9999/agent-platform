import { z } from 'zod';

/**
 * A saved model configuration — provider, model name, and whether an API key is stored.
 * The actual API key is never returned by the API.
 */
export const ModelConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  provider: z.string().min(1),
  model: z.string().min(1),
  /** true when an encrypted API key is stored for this config */
  hasApiKey: z.boolean(),
  createdAtMs: z.number().int(),
  updatedAtMs: z.number().int(),
});

export type ModelConfig = z.infer<typeof ModelConfigSchema>;

/** Body for POST /v1/model-configs */
export const ModelConfigCreateBodySchema = z.object({
  name: z.string().min(1),
  provider: z.string().min(1),
  model: z.string().min(1),
  /** Plaintext API key — encrypted at rest. Optional for Ollama (no key needed). */
  apiKey: z.string().optional(),
});

export type ModelConfigCreateBody = z.infer<typeof ModelConfigCreateBodySchema>;

/** Body for PUT /v1/model-configs/:id — all fields optional; omit apiKey to keep existing key */
export const ModelConfigUpdateBodySchema = z.object({
  name: z.string().min(1).optional(),
  provider: z.string().min(1).optional(),
  model: z.string().min(1).optional(),
  /**
   * Provide to rotate the API key. Pass empty string `""` to clear the stored key.
   * Omit entirely to keep the existing key unchanged.
   */
  apiKey: z.string().optional(),
});

export type ModelConfigUpdateBody = z.infer<typeof ModelConfigUpdateBodySchema>;
