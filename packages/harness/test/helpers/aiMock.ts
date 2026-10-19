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

export async function setupAiMock() {
  const actual = await vi.importActual<typeof import('ai')>('ai');
  return {
    ...actual,
    streamText: (...args: unknown[]) => mockStreamText(...args),
    jsonSchema: (schema: unknown) => ({ type: 'json-schema', jsonSchema: schema }),
  };
}

export function setupOpenAiProviderMock() {
  return {
    createOpenAI: ({ apiKey }: { apiKey: string }) => {
      const makeModel = (model: string) => ({ provider: 'openai', modelId: model, apiKey });
      return Object.assign(makeModel, { responses: makeModel });
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
  /** When set, `text` resolves to this instead of joined chunks (simulates empty `textStream`). */
  textOverride?: string;
  reasoning?: string;
}) {
  const chunks = opts.textChunks ?? [];
  const joined = opts.textOverride ?? chunks.join('');
  return {
    textStream: (async function* () {
      for (const chunk of chunks) yield chunk;
    })(),
    fullStream: (async function* () {
      for (const chunk of chunks) {
        yield { type: 'text-delta' as const, text: chunk };
      }
    })(),
    text: Promise.resolve(joined),
    reasoningText: Promise.resolve(opts.reasoning ?? undefined),
    responseMessages: Promise.resolve([
      {
        role: 'assistant',
        content: [
          ...(joined ? [{ type: 'text', text: joined }] : []),
          ...(opts.toolCalls ?? []).map(({ args, ...call }) => ({
            type: 'tool-call',
            ...call,
            input: args,
          })),
        ],
      },
    ]),
    toolCalls: Promise.resolve(
      (opts.toolCalls ?? []).map(({ args, ...call }) => ({ ...call, input: args })),
    ),
    usage: Promise.resolve(
      opts.usage
        ? { inputTokens: opts.usage.promptTokens, outputTokens: opts.usage.completionTokens }
        : undefined,
    ),
  };
}
