import { createLanguageModel, type SupportedProvider } from '@agent-platform/model-router';
import { streamText, jsonSchema, type StreamTextResult, type ToolSet } from 'ai';
import type { CoreMessage } from 'ai';
import type { RunnableConfig } from '@langchain/core/runnables';

import type { HarnessStateType } from '../graphState.js';
import type { TraceEvent } from '../trace.js';
import type {
  ChatMessage,
  LlmOutput,
  OutputEmitter,
  ToolCallIntent,
  ToolDefinition,
} from '../types.js';
import type { PluginDispatcher } from '@agent-platform/plugin-sdk';
import { withRetry, LLM_RETRY_CONFIG } from '../retry.js';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Convert harness ChatMessage[] to Vercel AI SDK CoreMessage[]. */
function toCoreMessages(messages: ChatMessage[]): CoreMessage[] {
  return messages.map((m): CoreMessage => {
    if (m.role === 'tool') {
      return {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: m.toolCallId,
            toolName: m.toolName,
            result: m.content,
          },
        ],
      };
    }
    if (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0) {
      return {
        role: 'assistant',
        content: [
          ...(m.content ? [{ type: 'text' as const, text: m.content }] : []),
          ...m.toolCalls.map((tc) => ({
            type: 'tool-call' as const,
            toolCallId: tc.id,
            toolName: tc.name,
            args: tc.args,
          })),
        ],
      };
    }
    return { role: m.role, content: m.content };
  });
}

/** Convert harness ToolDefinition[] to Vercel AI SDK tools record. */
function toSdkTools(
  defs: ToolDefinition[],
): Record<string, { description: string; parameters: unknown }> {
  const tools: Record<string, { description: string; parameters: unknown }> = {};
  for (const def of defs) {
    tools[def.name] = {
      description: def.description,
      parameters: jsonSchema(def.parameters),
    };
  }
  return tools;
}

/**
 * Labels for the streamed "Calling tools…" placeholder: resolve each model
 * `toolName` against `toolDefinitions` (from the agent `tools` array). Uses
 * each definition's description (first line), falling back to id/`toolName`
 * when unknown.
 */
function placeholderLabelsForToolCalls(
  toolCalls: Array<{ toolName: string }>,
  definitions: ToolDefinition[],
): string {
  const byName = new Map(definitions.map((d) => [d.name, d]));
  return toolCalls
    .map((tc) => {
      const def = byName.get(tc.toolName);
      if (!def) return tc.toolName;
      const raw = (def.description ?? def.name).trim();
      const line = raw.split(/\r?\n/)[0]?.trim() ?? def.name;
      return line.length > 96 ? `${line.slice(0, 93)}…` : line;
    })
    .join(', ');
}

// ---------------------------------------------------------------------------
// LLM reasoning node factory
// ---------------------------------------------------------------------------

export type LlmReasonNodeOptions = {
  emitter?: OutputEmitter;
  dispatcher?: PluginDispatcher;
};

/** Safely fire the onPromptBuild plugin hook — swallows errors. */
async function firePromptBuildHook(
  dispatcher: PluginDispatcher,
  state: HarnessStateType,
): Promise<void> {
  try {
    await dispatcher.onPromptBuild({
      sessionId: state.sessionId ?? '',
      runId: state.runId ?? '',
      plan: null,
      messages: state.messages.map((m) => ({ role: m.role, content: m.content })),
    });
  } catch {
    /* plugin errors must not crash the graph */
  }
}

/**
 * Stream text from `streamText`, emit NDJSON `text` chunks, and return the
 * assistant-visible string.
 *
 * **Use `fullStream`, not `textStream` alone.** In AI SDK 4.x, `textStream`
 * tees the underlying stream; consuming only that branch can leave the other
 * branch unread so the pipeline never finishes and `result.text` never
 * resolves — the UI sees an empty reply. Iterating `fullStream` drains the
 * merged stream once. We still `await result.text` as a fallback when deltas
 * are missing.
 */
async function streamAndAccumulate(
  result: StreamTextResult<ToolSet, unknown>,
  emitter: OutputEmitter | undefined,
): Promise<string> {
  let fullText = '';
  // Prefer fullStream (drains the SDK pipeline once). Some tests / stubs only mock textStream.
  if (result.fullStream) {
    for await (const part of result.fullStream) {
      if (part.type === 'text-delta') {
        const chunk = part.textDelta;
        fullText += chunk;
        if (emitter && chunk) {
          await emitter.emit({ type: 'text', content: chunk });
        }
      } else if (part.type === 'reasoning') {
        const chunk = part.textDelta;
        if (emitter && chunk) {
          await emitter.emit({ type: 'thinking', content: chunk });
        }
      }
    }
  } else {
    for await (const chunk of result.textStream) {
      fullText += chunk;
      if (emitter && chunk) {
        await emitter.emit({ type: 'text', content: chunk });
      }
    }
    await result.consumeStream?.();
  }

  const resolvedText = (await result.text) ?? '';
  if (resolvedText.trim() && !fullText.trim()) {
    if (emitter) {
      await emitter.emit({ type: 'text', content: resolvedText });
    }
    return resolvedText;
  }

  // Prefer SDK `text` over streamed concatenation (canonical); emit any missing suffix to the client.
  if (resolvedText.length > fullText.length && resolvedText.startsWith(fullText)) {
    const suffix = resolvedText.slice(fullText.length);
    if (emitter && suffix) {
      await emitter.emit({ type: 'text', content: suffix });
    }
  }

  const merged = resolvedText || fullText;
  if (!merged.trim()) {
    const reasoning = await result.reasoning;
    if (reasoning?.trim()) {
      if (emitter) {
        await emitter.emit({ type: 'thinking', content: reasoning });
      }
      return reasoning;
    }
  }

  return merged;
}

/** Build LlmOutput + assistant ChatMessage from the completed LLM response. */
function buildLlmOutput(
  fullText: string,
  finalToolCalls: Array<{ toolCallId: string; toolName: string; args: unknown }>,
): { output: LlmOutput; assistantMessage: ChatMessage } {
  if (finalToolCalls.length > 0) {
    const calls: ToolCallIntent[] = finalToolCalls.map((tc) => ({
      id: tc.toolCallId,
      name: tc.toolName,
      args: (tc.args as Record<string, unknown>) ?? {},
    }));
    return {
      output: { kind: 'tool_calls', calls },
      assistantMessage: { role: 'assistant', content: fullText || '', toolCalls: calls },
    };
  }
  return {
    output: { kind: 'text', content: fullText || '' },
    assistantMessage: { role: 'assistant', content: fullText || '' },
  };
}

/** Check maxTokens limit; appends trace event and emits error if exceeded. */
async function checkTokenLimit(
  limits: HarnessStateType['limits'],
  newTotalTokens: number,
  traceEvents: TraceEvent[],
  emitter: OutputEmitter | undefined,
): Promise<boolean> {
  const maxTokens = limits?.maxTokens;
  if (maxTokens == null || newTotalTokens < maxTokens) return false;

  traceEvents.push({ type: 'limit_hit', kind: 'max_tokens' });
  if (emitter) {
    await emitter.emit({
      type: 'error',
      code: 'MAX_TOKENS',
      message: `Token limit exceeded (${newTotalTokens}/${maxTokens})`,
    });
  }
  return true;
}

/** Check maxCostUnits limit; appends trace event and emits error if exceeded. */
async function checkCostLimit(
  limits: HarnessStateType['limits'],
  newTotalCost: number,
  traceEvents: TraceEvent[],
  emitter: OutputEmitter | undefined,
): Promise<boolean> {
  const maxCost = limits?.maxCostUnits;
  if (maxCost == null || maxCost <= 0 || newTotalCost < maxCost) return false;

  traceEvents.push({ type: 'limit_hit', kind: 'max_cost' });
  if (emitter) {
    await emitter.emit({
      type: 'error',
      code: 'MAX_COST',
      message: `Cost limit exceeded (${newTotalCost}/${maxCost})`,
    });
  }
  return true;
}

const BUDGET_WARN_THRESHOLD = 0.8;

/** Emit warnings when approaching token or cost limits (80% threshold). */
async function emitBudgetWarnings(
  limits: HarnessStateType['limits'],
  newTotalTokens: number,
  newTotalCost: number,
  emitter: OutputEmitter | undefined,
): Promise<void> {
  if (!emitter) return;

  const maxTokens = limits?.maxTokens;
  if (
    maxTokens != null &&
    newTotalTokens >= maxTokens * BUDGET_WARN_THRESHOLD &&
    newTotalTokens < maxTokens
  ) {
    await emitter.emit({
      type: 'text',
      content: `[warning] Token usage at ${Math.round((newTotalTokens / maxTokens) * 100)}% of limit (${newTotalTokens}/${maxTokens})`,
    });
  }

  const maxCost = limits?.maxCostUnits;
  if (
    maxCost != null &&
    maxCost > 0 &&
    newTotalCost >= maxCost * BUDGET_WARN_THRESHOLD &&
    newTotalCost < maxCost
  ) {
    await emitter.emit({
      type: 'text',
      content: `[warning] Cost usage at ${Math.round((newTotalCost / maxCost) * 100)}% of limit (${newTotalCost}/${maxCost})`,
    });
  }
}

/** Normalise the old (OutputEmitter) and new (LlmReasonNodeOptions) signatures. */
function normaliseOptions(options?: OutputEmitter | LlmReasonNodeOptions): LlmReasonNodeOptions {
  if (!options || typeof options !== 'object') return {};
  if ('emit' in options) return { emitter: options };
  return options;
}

/**
 * Creates a graph node that invokes the LLM via the Vercel AI SDK using streamText.
 *
 * Reads `messages`, `toolDefinitions`, and `modelConfig` from state.
 * Produces `LlmOutput` (text or tool-call intents) — does NOT execute tools.
 * Streams text chunks via the emitter in real-time while accumulating the full response.
 * Appends the assistant message to conversation history.
 * Emits an `llm_call` trace event with optional token usage.
 * Calls `onPromptBuild` plugin hook before each LLM call.
 * Supports AbortSignal via `config.configurable.signal` for cancellation.
 */
export function createLlmReasonNode(options?: OutputEmitter | LlmReasonNodeOptions) {
  const { emitter, dispatcher } = normaliseOptions(options);

  return async function llmReasonNode(
    state: HarnessStateType,
    config?: RunnableConfig,
  ): Promise<Partial<HarnessStateType>> {
    const signal = config?.configurable?.signal as AbortSignal | undefined;

    if (signal?.aborted) {
      return {
        halted: true,
        trace: [{ type: 'stream_aborted', reason: 'client_disconnect' }],
      };
    }

    const { messages, toolDefinitions, modelConfig } = state;

    if (!modelConfig) {
      throw new Error('llm_reason: modelConfig is required in state');
    }

    const model = createLanguageModel({
      provider: (modelConfig.provider ?? 'openai') as SupportedProvider,
      model: modelConfig.model,
      apiKey: modelConfig.apiKey,
    });
    const tools = toolDefinitions.length > 0 ? toSdkTools(toolDefinitions) : undefined;

    if (dispatcher) {
      await firePromptBuildHook(dispatcher, state);
    }

    const step = state.taskIndex ?? 0;
    const retryTraceEvents: TraceEvent[] = [];
    let retryCount = 0;

    const { fullText, finalToolCalls, usage } = await withRetry(
      async () => {
        const res = streamText({
          model,
          messages: toCoreMessages(messages),
          tools,
          maxSteps: 1,
          abortSignal: signal,
        });

        const text = await streamAndAccumulate(res, emitter);
        const toolCalls = await res.toolCalls;
        const usageInfo = await res.usage;

        // Models often request tools with no streamed text; the UI only shows streamed `text`
        // events — emit a short line so the chat is not blank until tool results arrive.
        if (toolCalls && toolCalls.length > 0 && !text.trim() && emitter) {
          const names = placeholderLabelsForToolCalls(toolCalls, toolDefinitions);
          const label = toolCalls.length === 1 ? 'tool' : 'tools';
          await emitter.emit({
            type: 'text',
            content: `Calling ${label}: ${names}…`,
          });
        }

        return { fullText: text, finalToolCalls: toolCalls, usage: usageInfo };
      },
      LLM_RETRY_CONFIG,
      (attempt, error, delayMs) => {
        retryCount++;
        const errMsg = error instanceof Error ? error.message : String(error);
        retryTraceEvents.push({ type: 'llm_retry', step, attempt, error: errMsg, delayMs });

        if (dispatcher) {
          dispatcher
            .onError({
              sessionId: state.sessionId ?? '',
              runId: state.runId ?? '',
              phase: 'prompt',
              error,
              retryAttempt: attempt,
              willRetry: attempt < LLM_RETRY_CONFIG.maxAttempts - 1,
              maxRetries: LLM_RETRY_CONFIG.maxAttempts - 1,
            })
            .catch(() => {
              /* plugin errors must not crash the graph */
            });
        }
      },
    );

    const tokenUsage = usage
      ? { promptTokens: usage.promptTokens, completionTokens: usage.completionTokens }
      : undefined;

    const { output, assistantMessage } = buildLlmOutput(fullText, finalToolCalls);

    const tokenDelta = tokenUsage ? tokenUsage.promptTokens + tokenUsage.completionTokens : 0;
    const newTotalTokens = state.totalTokensUsed + tokenDelta;
    const costDelta = tokenDelta / 1000;
    const newTotalCost = (state.totalCostUnits ?? 0) + costDelta;
    const traceEvents: TraceEvent[] = [...retryTraceEvents, { type: 'llm_call', step, tokenUsage }];

    const tokenHalted = await checkTokenLimit(state.limits, newTotalTokens, traceEvents, emitter);
    const costHalted =
      !tokenHalted && (await checkCostLimit(state.limits, newTotalCost, traceEvents, emitter));
    const halted = tokenHalted || costHalted;

    if (!halted) {
      await emitBudgetWarnings(state.limits, newTotalTokens, newTotalCost, emitter);
    }

    return {
      llmOutput: output,
      messages: [assistantMessage],
      trace: traceEvents,
      totalTokensUsed: newTotalTokens,
      totalCostUnits: newTotalCost,
      totalRetries: (state.totalRetries ?? 0) + retryCount,
      ...(halted ? { halted: true } : {}),
    };
  };
}

/**
 * Backwards-compatible standalone node (no emitter).
 * @deprecated Use createLlmReasonNode(emitter) instead.
 */
export async function llmReasonNode(state: HarnessStateType): Promise<Partial<HarnessStateType>> {
  return createLlmReasonNode()(state);
}
