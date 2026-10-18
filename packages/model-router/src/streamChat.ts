import { streamText } from 'ai';
import {
  createLanguageModel,
  providerGenerationOptions,
  type ProviderConfig,
} from './providers.js';
import {
  ProviderRequestError,
  toProviderRequestError,
  type ProviderErrorCategory,
} from './providerErrors.js';

export type ChatMessage = { role: 'user' | 'assistant' | 'system'; content: string };
export type StreamChatOptions = ProviderConfig & {
  messages: ChatMessage[];
  abortSignal?: AbortSignal;
  onProviderError?: (failure: { category: ProviderErrorCategory }) => void;
};
export type StreamChatResult = { textStream: AsyncIterable<string> };

async function* safeTextStream(
  source: AsyncIterable<{ type: string; text?: string; error?: unknown }>,
): AsyncIterable<string> {
  try {
    for await (const part of source) {
      if (part.type === 'error') throw toProviderRequestError(part.error);
      if (part.type === 'text-delta' && typeof part.text === 'string') yield part.text;
    }
  } catch (error) {
    throw toProviderRequestError(error);
  }
}
function observeFailure(error: unknown, observer: StreamChatOptions['onProviderError']): void {
  const safe = toProviderRequestError(error);
  try {
    observer?.({ category: safe instanceof ProviderRequestError ? safe.category : 'unknown' });
  } catch {
    /* best-effort safe observation */
  }
}
/** Expose only sanitized text, not SDK-private results or raw error events. */
export function streamChat(options: StreamChatOptions): StreamChatResult {
  const { messages, abortSignal, onProviderError, ...providerConfig } = options;
  const model = createLanguageModel(providerConfig);
  const result = streamText({
    model,
    messages,
    abortSignal,
    allowSystemInMessages: true,
    maxRetries: 0,
    onError: ({ error }) => observeFailure(error, onProviderError),
    ...providerGenerationOptions(providerConfig),
  });
  return { textStream: safeTextStream(result.fullStream) };
}
