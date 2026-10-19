import { z } from 'zod';

export const ModelProviderSchema = z.enum([
  'openai',
  'anthropic',
  'google',
  'deepseek',
  'xai',
  'openrouter',
  'ollama',
  'openai-compatible',
]);
export type ModelProvider = z.infer<typeof ModelProviderSchema>;

/** Explicit endpoints never carry credentials, query strings or fragments. */
export const ModelBaseURLSchema = z
  .string()
  .trim()
  .url()
  .refine((value) => {
    try {
      const url = new URL(value);
      const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
      return (
        !url.username &&
        !url.password &&
        !url.search &&
        !url.hash &&
        (url.protocol === 'https:' || (url.protocol === 'http:' && loopback))
      );
    } catch {
      return false;
    }
  }, 'Use HTTPS, or HTTP on loopback, without URL credentials, query or fragment');

/**
 * A saved model configuration — provider, model name, and whether an API key is stored.
 * The actual API key is never returned by the API.
 */
export const ModelConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  provider: ModelProviderSchema,
  model: z.string().trim().min(1),
  /** true when an encrypted API key is stored for this config */
  hasApiKey: z.boolean(),
  baseURL: ModelBaseURLSchema.nullable().optional(),
  createdAtMs: z.number().int(),
  updatedAtMs: z.number().int(),
});

export type ModelConfig = z.infer<typeof ModelConfigSchema>;

/** Body for POST /v1/model-configs */
export const ModelConfigCreateBodySchema = z.object({
  name: z.string().min(1),
  provider: ModelProviderSchema,
  model: z.string().trim().min(1),
  /** Plaintext API key — encrypted at rest. Optional for Ollama (no key needed). */
  apiKey: z.string().optional(),
  baseURL: ModelBaseURLSchema.optional(),
});

export type ModelConfigCreateBody = z.infer<typeof ModelConfigCreateBodySchema>;

/** Body for PUT /v1/model-configs/:id — all fields optional; omit apiKey to keep existing key */
export const ModelConfigUpdateBodySchema = z.object({
  name: z.string().min(1).optional(),
  provider: ModelProviderSchema.optional(),
  model: z.string().trim().min(1).optional(),
  /**
   * Provide to rotate the API key. Pass empty string `""` to clear the stored key.
   * Omit to keep the key unless changing provider, which clears the old key.
   */
  apiKey: z.string().optional(),
  baseURL: ModelBaseURLSchema.nullable().optional(),
});

export type ModelConfigUpdateBody = z.infer<typeof ModelConfigUpdateBodySchema>;
