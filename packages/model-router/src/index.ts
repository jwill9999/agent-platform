// Provider factory
export {
  createLanguageModel,
  isSupportedProvider,
  SUPPORTED_PROVIDERS,
  type SupportedProvider,
  type ProviderConfig,
} from './providers.js';

// Provider-agnostic streaming
export { streamChat, type ChatMessage, type StreamChatOptions } from './streamChat.js';

// Provider-aware API key resolution
export {
  resolveApiKeyForProvider,
  apiKeyResultToOutcome,
  type ApiKeyResult,
} from './resolveApiKey.js';

// Model config resolution (provider-aware)
export {
  resolveModelConfig,
  type ModelOverride,
  type ResolvedModelConfig,
  type ModelConfigResolution,
  type ResolveModelConfigOptions,
} from './resolveModelConfig.js';

// Connection test utility
export {
  testModelConnection,
  type TestConnectionOptions,
  type TestConnectionResult,
} from './testConnection.js';

// Legacy OpenAI-specific exports (backward compatible)
export { streamOpenAiChat } from './openai.js';
export {
  foldOpenAiKeyGate,
  getOpenAiKeyOrNextJsonResponse,
  openAiKeyGateToApiOutcome,
  openAiLegacyBlockedMessage,
  resolveOpenAiApiKeyFromEnv,
  resolveGatedOpenAiKeyForRequest,
  resolveOpenAiKeyForRequest,
  type ApiOpenAiKeyOutcome,
  type OpenAiKeyGateResult,
  type PreferredOpenAiEnvVar,
} from './resolveOpenAiApiKey.js';
