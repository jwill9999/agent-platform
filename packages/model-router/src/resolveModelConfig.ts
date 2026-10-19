import { isSupportedProvider, type SupportedProvider } from './providers.js';
import { resolveApiKeyForProvider, apiKeyResultToOutcome } from './resolveApiKey.js';
// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ModelOverride = {
  provider: string;
  model: string;
};

export type ResolvedModelConfig = {
  provider: string;
  model: string;
  apiKey?: string;
};

export type ModelConfigResolution =
  | { kind: 'ok'; config: ResolvedModelConfig }
  | { kind: 'error'; code: string; message: string };

export type ResolveModelConfigOptions = {
  /** Agent-level model override (from Agent.modelOverride). */
  agentOverride?: ModelOverride | null;
  /** Explicit header key (e.g. x-openai-key). */
  headerKey?: string | null;
};

// ---------------------------------------------------------------------------
// Default models per provider
// ---------------------------------------------------------------------------

const DEFAULT_MODELS: Partial<Record<SupportedProvider, string>> = {
  openai: 'gpt-4o',
  anthropic: 'claude-sonnet-4-20250514',
  ollama: 'llama3.2',
};

// ---------------------------------------------------------------------------
// Resolution chain
// ---------------------------------------------------------------------------

/**
 * Resolves the full model configuration using a precedence chain:
 *
 *   1. **Agent override** — `agent.modelOverride.{ provider, model }`
 *   2. **Environment default** — `DEFAULT_MODEL_PROVIDER` / `DEFAULT_MODEL`
 *   3. **System fallback** — `openai` / `gpt-4o`
 *
 * API key resolution is provider-aware:
 *   - OpenAI: header → AGENT_OPENAI_API_KEY → OPENAI_API_KEY (if legacy allowed)
 *   - Anthropic: header → AGENT_ANTHROPIC_API_KEY → ANTHROPIC_API_KEY (if legacy allowed)
 *   - Ollama: no key required (local)
 */
export function resolveModelConfig(options: ResolveModelConfigOptions = {}): ModelConfigResolution {
  const { agentOverride, headerKey } = options;

  // --- Provider + model ---
  const provider = agentOverride?.provider ?? process.env.DEFAULT_MODEL_PROVIDER ?? 'openai';

  if (!isSupportedProvider(provider))
    return { kind: 'error', code: 'UNSUPPORTED_PROVIDER', message: 'Unsupported model provider' };
  const defaultModel = DEFAULT_MODELS[provider];
  const model = agentOverride?.model ?? process.env.DEFAULT_MODEL ?? defaultModel;
  if (!model)
    return { kind: 'error', code: 'MISSING_MODEL', message: 'Choose a model for this provider' };

  // --- API key (provider-aware) ---
  const keyResult = resolveApiKeyForProvider({ provider, headerKey });
  const outcome = apiKeyResultToOutcome(keyResult);
  if (outcome.kind === 'error') return outcome;
  return { kind: 'ok', config: { provider, model, apiKey: outcome.key } };
}
