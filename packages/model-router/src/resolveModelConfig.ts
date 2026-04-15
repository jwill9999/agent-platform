import type { ApiOpenAiKeyOutcome, OpenAiKeyGateResult } from './resolveOpenAiApiKey.js';
import {
  openAiKeyGateToApiOutcome,
  resolveGatedOpenAiKeyForRequest,
} from './resolveOpenAiApiKey.js';

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
  apiKey: string;
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
// Resolution chain
// ---------------------------------------------------------------------------

/**
 * Resolves the full model configuration using a precedence chain:
 *
 *   1. **Agent override** — `agent.modelOverride.{ provider, model }`
 *   2. **Environment default** — `DEFAULT_MODEL_PROVIDER` / `DEFAULT_MODEL`
 *   3. **System fallback** — `openai` / `gpt-4o`
 *
 * API key resolution uses the existing gated key logic:
 *   header → AGENT_OPENAI_API_KEY → OPENAI_API_KEY (if legacy allowed)
 */
export function resolveModelConfig(options: ResolveModelConfigOptions = {}): ModelConfigResolution {
  const { agentOverride, headerKey } = options;

  // --- Provider + model ---
  const provider = agentOverride?.provider ?? process.env.DEFAULT_MODEL_PROVIDER ?? 'openai';

  const model = agentOverride?.model ?? process.env.DEFAULT_MODEL ?? 'gpt-4o';

  // --- API key ---
  const gated: OpenAiKeyGateResult = resolveGatedOpenAiKeyForRequest({
    preferredEnvVar: 'AGENT_OPENAI_API_KEY',
    headerKey,
  });

  const keyOutcome: ApiOpenAiKeyOutcome = openAiKeyGateToApiOutcome(gated);

  if (keyOutcome.kind === 'error') {
    return { kind: 'error', code: keyOutcome.code, message: keyOutcome.message };
  }

  return {
    kind: 'ok',
    config: { provider, model, apiKey: keyOutcome.key },
  };
}
