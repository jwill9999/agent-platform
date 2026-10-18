import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createDeepSeek } from '@ai-sdk/deepseek';
import { createXai } from '@ai-sdk/xai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { LanguageModel } from 'ai';
import { ProviderRequestError } from './providerErrors.js';
type ProviderOptions = NonNullable<
  Parameters<typeof import('ai').streamText>[0]['providerOptions']
>;
import { ensureSafeProviderWarningLogger } from './providerWarnings.js';
import { normalizeProviderEndpoint, providerFetch } from './providerEndpoint.js';

export const SUPPORTED_PROVIDERS = [
  'openai',
  'anthropic',
  'google',
  'deepseek',
  'xai',
  'openrouter',
  'ollama',
  'openai-compatible',
] as const;
export type SupportedProvider = (typeof SUPPORTED_PROVIDERS)[number];
export const PROVIDER_CATALOGUE = [
  { id: 'openai', label: 'OpenAI', requiresApiKey: true, apiMode: 'responses' },
  { id: 'anthropic', label: 'Anthropic Claude', requiresApiKey: true, apiMode: 'messages' },
  { id: 'google', label: 'Google Gemini', requiresApiKey: true, apiMode: 'generate-content' },
  { id: 'deepseek', label: 'DeepSeek', requiresApiKey: true, apiMode: 'chat-completions' },
  { id: 'xai', label: 'xAI Grok', requiresApiKey: true, apiMode: 'responses' },
  { id: 'openrouter', label: 'OpenRouter', requiresApiKey: true, apiMode: 'chat-completions' },
  {
    id: 'openai-compatible',
    label: 'OpenAI-compatible',
    requiresApiKey: false,
    apiMode: 'chat-completions',
  },
  { id: 'ollama', label: 'Ollama', requiresApiKey: false, apiMode: 'chat-completions' },
] as const;
export function isSupportedProvider(value: string): value is SupportedProvider {
  return (SUPPORTED_PROVIDERS as readonly string[]).includes(value);
}
export type ProviderConfig = {
  provider: SupportedProvider;
  model: string;
  apiKey?: string;
  baseURL?: string;
};
/** Canonical configured endpoint, also used to bind private continuation. */
export function providerEndpointIdentity(config: { provider: string; baseURL?: string }): string {
  if (!isSupportedProvider(config.provider)) throw new Error('Unsupported model provider');
  const endpoints: Partial<Record<SupportedProvider, string>> = {
    openai: 'https://api.openai.com/v1',
    anthropic: 'https://api.anthropic.com/v1',
    google: 'https://generativelanguage.googleapis.com/v1beta',
    deepseek: 'https://api.deepseek.com',
    xai: 'https://api.x.ai/v1',
    openrouter: 'https://openrouter.ai/api/v1',
    ollama: process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434/v1',
  };
  const endpoint = config.baseURL ?? endpoints[config.provider];
  if (!endpoint) throw new Error('A compatible provider endpoint is required');
  return normalizeProviderEndpoint(endpoint);
}
/** SDK options shared by every generation path; no server-stored continuation. */
export function providerGenerationOptions(config: { provider: string }): {
  providerOptions: ProviderOptions;
} {
  switch (config.provider) {
    case 'openai':
      return {
        providerOptions: { openai: { store: false, include: ['reasoning.encrypted_content'] } },
      };
    case 'xai':
      return {
        providerOptions: { xai: { store: false, include: ['reasoning.encrypted_content'] } },
      };
    default:
      return { providerOptions: {} };
  }
}
export function createLanguageModel(config: ProviderConfig): LanguageModel {
  ensureSafeProviderWarningLogger();
  const { provider, model } = config;
  if (config.apiKey && /[^\x21-\x7E]/.test(config.apiKey))
    throw new ProviderRequestError('authentication');
  const settings = {
    apiKey: config.apiKey ?? '',
    fetch: providerFetch,
    baseURL: providerEndpointIdentity(config),
  };
  switch (provider) {
    case 'openai':
      return createOpenAI(settings).responses(model);
    case 'anthropic':
      return createAnthropic(settings)(model);
    case 'google':
      return createGoogleGenerativeAI(settings)(model);
    case 'deepseek':
      return createDeepSeek(settings)(model);
    case 'xai':
      return createXai(settings).responses(model);
    case 'openrouter':
      return createOpenRouter(settings).chat(model);
    case 'openai-compatible': {
      if (!config.baseURL) throw new Error('A compatible provider endpoint is required');
      return createOpenAICompatible({
        ...settings,
        name: 'openai-compatible',
        baseURL: normalizeProviderEndpoint(config.baseURL),
      })(model);
    }
    case 'ollama':
      return createOpenAICompatible({
        ...settings,
        name: 'ollama',
        apiKey: config.apiKey ?? 'ollama',
        baseURL: normalizeProviderEndpoint(
          config.baseURL ?? process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434/v1',
        ),
      })(model);
    default:
      throw new Error('Unsupported model provider');
  }
}
