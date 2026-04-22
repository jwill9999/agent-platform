import { generateText } from 'ai';
import { createLanguageModel, isSupportedProvider } from './providers.js';

export type TestConnectionOptions = {
  provider: string;
  model: string;
  apiKey?: string;
};

export type TestConnectionResult =
  | { ok: true; latencyMs: number }
  | { ok: false; latencyMs: number; error: string };

/**
 * Fire a minimal chat completion to verify the provider/model/key combination is working.
 * Uses maxTokens: 5 — low enough to minimise cost, high enough for models that require
 * more than 1 token to produce any output (maxTokens: 1 causes a false-negative for those).
 */
export async function testModelConnection(
  options: TestConnectionOptions,
): Promise<TestConnectionResult> {
  if (!isSupportedProvider(options.provider)) {
    return { ok: false, latencyMs: 0, error: `Unsupported provider: ${options.provider}` };
  }

  const start = Date.now();
  try {
    const model = createLanguageModel({
      provider: options.provider,
      model: options.model,
      apiKey: options.apiKey,
    });
    await generateText({ model, messages: [{ role: 'user', content: 'Hi' }], maxTokens: 5 });
    return { ok: true, latencyMs: Date.now() - start };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    // A "max tokens reached" finish reason means the model responded — treat as success.
    if (message.includes('max_tokens') || message.includes('output limit')) {
      return { ok: true, latencyMs: Date.now() - start };
    }
    return { ok: false, latencyMs: Date.now() - start, error: message };
  }
}
