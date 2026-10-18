import { generateText } from 'ai';
import {
  createLanguageModel,
  isSupportedProvider,
  providerGenerationOptions,
} from './providers.js';
import {
  ProviderRequestError,
  toProviderRequestError,
  type ProviderErrorCategory,
} from './providerErrors.js';
export type TestConnectionOptions = {
  provider: string;
  model: string;
  apiKey?: string;
  baseURL?: string;
  timeoutMs?: number;
};
export type TestConnectionResult =
  | { ok: true; latencyMs: number }
  | {
      ok: false;
      latencyMs: number;
      error: string;
      category: ProviderErrorCategory;
      statusCode?: number;
      retryable: boolean;
    };
/** Exactly one bounded SDK generation, never reinterpret a rejected request as success. */
export async function testModelConnection(
  options: TestConnectionOptions,
): Promise<TestConnectionResult> {
  const start = performance.now();
  const timeoutMs = options.timeoutMs ?? 10000;
  try {
    if (
      !isSupportedProvider(options.provider) ||
      !Number.isInteger(timeoutMs) ||
      timeoutMs < 1 ||
      timeoutMs > 30000
    )
      throw new ProviderRequestError('request');
    const config = { ...options, provider: options.provider };
    const result = await generateText({
      model: createLanguageModel(config),
      messages: [{ role: 'user', content: 'Reply OK.' }],
      maxOutputTokens: 32,
      maxRetries: 0,
      abortSignal: AbortSignal.timeout(timeoutMs),
      ...providerGenerationOptions(config),
    });
    if (!result.text.trim() && result.finishReason === 'length')
      throw new ProviderRequestError('output_limited');
    if (!result.text.trim() || result.finishReason === 'error')
      throw new ProviderRequestError('invalid_response');
    return { ok: true, latencyMs: Math.round(performance.now() - start) };
  } catch (error: unknown) {
    const safe = toProviderRequestError(error);
    const failure =
      safe instanceof ProviderRequestError
        ? safe
        : new ProviderRequestError(safe.name === 'AbortError' ? 'timeout' : 'unknown');
    return {
      ok: false,
      latencyMs: Math.round(performance.now() - start),
      error: failure.message,
      category: failure.category,
      retryable: failure.retryable,
      ...(failure.statusCode ? { statusCode: failure.statusCode } : {}),
    };
  }
}
