import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { LanguageModelV1 } from 'ai';

// ---------------------------------------------------------------------------
// Supported providers
// ---------------------------------------------------------------------------

export const SUPPORTED_PROVIDERS = ['openai', 'anthropic', 'ollama'] as const;
export type SupportedProvider = (typeof SUPPORTED_PROVIDERS)[number];

export function isSupportedProvider(value: string): value is SupportedProvider {
  return (SUPPORTED_PROVIDERS as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// Provider configuration
// ---------------------------------------------------------------------------

export type ProviderConfig = {
  provider: string;
  model: string;
  apiKey?: string;
  /** Base URL override (required for Ollama, optional for others). */
  baseURL?: string;
};

// ---------------------------------------------------------------------------
// Provider factory
// ---------------------------------------------------------------------------

/**
 * Creates a Vercel AI SDK LanguageModel from provider configuration.
 *
 * Supported providers:
 * - `openai`    — OpenAI models via @ai-sdk/openai
 * - `anthropic` — Anthropic Claude models via @ai-sdk/anthropic
 * - `ollama`    — Local Ollama models via OpenAI-compatible protocol
 */
export function createLanguageModel(config: ProviderConfig): LanguageModelV1 {
  const { provider, model, apiKey, baseURL } = config;

  switch (provider) {
    case 'openai': {
      const openai = createOpenAI({
        apiKey: apiKey ?? '',
        ...(baseURL ? { baseURL } : {}),
      });
      return openai(model);
    }

    case 'anthropic': {
      const anthropic = createAnthropic({
        apiKey: apiKey ?? '',
        ...(baseURL ? { baseURL } : {}),
      });
      return anthropic(model);
    }

    case 'ollama': {
      const ollama = createOpenAICompatible({
        name: 'ollama',
        baseURL: baseURL ?? process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434/v1',
        // Ollama doesn't require an API key
        apiKey: apiKey ?? 'ollama',
      });
      return ollama(model);
    }

    default:
      throw new Error(
        `Unsupported model provider "${provider}". Supported: ${SUPPORTED_PROVIDERS.join(', ')}`,
      );
  }
}
