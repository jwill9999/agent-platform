/**
 * Shared test helpers for harness tests that mock the AI SDK.
 *
 * Extracted to avoid code duplication across test files (SonarCloud S1192).
 */
import { vi } from 'vitest';

// ---------------------------------------------------------------------------
// AI SDK mock setup
// ---------------------------------------------------------------------------

export const mockStreamText = vi.fn();

export function setupAiMock() {
  return {
    streamText: (...args: unknown[]) => mockStreamText(...args),
    jsonSchema: (schema: unknown) => ({ type: 'json-schema', jsonSchema: schema }),
  };
}

export function setupOpenAiProviderMock() {
  return {
    createOpenAI: ({ apiKey }: { apiKey: string }) => {
      return (model: string) => ({ provider: 'openai', modelId: model, apiKey });
    },
  };
}

// ---------------------------------------------------------------------------
// Mock stream result factory
// ---------------------------------------------------------------------------

export function mockStreamResult(opts: {
  textChunks?: string[];
  toolCalls?: Array<{ toolCallId: string; toolName: string; args: unknown }>;
  usage?: { promptTokens: number; completionTokens: number };
}) {
  const chunks = opts.textChunks ?? [];
  return {
    textStream: (async function* () {
      for (const chunk of chunks) yield chunk;
    })(),
    toolCalls: Promise.resolve(opts.toolCalls ?? []),
    usage: Promise.resolve(opts.usage),
  };
}
