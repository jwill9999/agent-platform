import { streamText } from 'ai';
import { createLanguageModel, type ProviderConfig } from './providers.js';

export type ChatMessage = { role: 'user' | 'assistant' | 'system'; content: string };

export type StreamChatOptions = ProviderConfig & {
  messages: ChatMessage[];
};

/**
 * Provider-agnostic streaming chat via Vercel AI SDK (`streamText`).
 *
 * Works with any supported provider (OpenAI, Anthropic, Ollama).
 * API key must come from env / secret store at the call site — never log it.
 */
export function streamChat(options: StreamChatOptions) {
  const { messages, ...providerConfig } = options;
  const model = createLanguageModel(providerConfig);
  return streamText({ model, messages });
}
