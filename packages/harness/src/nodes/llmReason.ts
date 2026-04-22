import { createLanguageModel, type SupportedProvider } from '@agent-platform/model-router';
import { streamText, jsonSchema, type StreamTextResult, type ToolSet, type CoreMessage } from 'ai';
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
import { checkDeadline } from '../deadline.js';

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
            toolName: sanitiseToolName(m.toolName),
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
            toolName: sanitiseToolName(tc.name),
            args: tc.args,
          })),
        ],
      };
    }
    return { role: m.role, content: m.content };
  });
}

/**
 * Sanitise a tool name for LLM providers that restrict characters (e.g. OpenAI
 * requires `^[a-zA-Z0-9_-]+$`).  MCP tool IDs contain `:` which is invalid.
 * We replace `:` with `__` — the reverse mapping is stored alongside.
 */
function sanitiseToolName(name: string): string {
  return name.replaceAll(':', '__');
}

/**
 * Primitive type branches used when a schema has no declared type.
 * These cover every JSON scalar; complex values must be pre-serialised by the model.
 */
const STRICT_ANY_PRIMITIVE: unknown[] = [
  { type: 'string' },
  { type: 'number' },
  { type: 'integer' },
  { type: 'boolean' },
  { type: 'null' },
];

/**
 * Wrap a schema in `anyOf: [schema, {type:'null'}]` unless it is already nullable.
 * Used for optional properties that strict mode forces into `required`.
 */
function makeNullable(schema: unknown): unknown {
  if (typeof schema !== 'object' || schema === null || Array.isArray(schema)) {
    return { anyOf: [schema, { type: 'null' }] };
  }
  const s = schema as Record<string, unknown>;
  if (s['type'] === 'null') return schema;
  if (
    Array.isArray(s['anyOf']) &&
    (s['anyOf'] as unknown[]).some(
      (v) =>
        typeof v === 'object' &&
        v !== null &&
        !Array.isArray(v) &&
        (v as Record<string, unknown>)['type'] === 'null',
    )
  )
    return schema;
  return { anyOf: [schema, { type: 'null' }] };
}

/**
 * Recursively enforce OpenAI strict-mode requirements on every JSON Schema node:
 *   1. Schemas with no `type` (and no anyOf/oneOf/allOf/$ref) → `anyOf` with all JSON primitives.
 *   2. `type: 'object'` → `additionalProperties: false`; empty `properties/required` when absent.
 *   3. Every key in `properties` must appear in `required` — strict mode mandates this.
 *      Properties that were originally optional become nullable (anyOf + null) so the model can
 *      omit them by passing null; handlers already guard with `typeof x === 'string'` etc.
 *   4. `type: 'array'` → inject `items` (anyOf primitives) when missing.
 *
 * All four constraints are either ignored or already satisfied by lenient providers,
 * so patching universally is safe.
 */
function makeStrictSchema(schema: unknown): unknown {
  if (typeof schema !== 'object' || schema === null || Array.isArray(schema)) return schema;
  const s = schema as Record<string, unknown>;
  const result: Record<string, unknown> = { ...s };

  // Rule 1 — typeless, bare schema → anyOf with primitives (covers e.g. `data` in json_stringify).
  if (!s['type'] && !s['anyOf'] && !s['oneOf'] && !s['allOf'] && !s['$ref']) {
    const base: Record<string, unknown> = { anyOf: STRICT_ANY_PRIMITIVE };
    if (s['description']) base['description'] = s['description'];
    return base;
  }

  if (s['type'] === 'object') {
    // Rule 2 — additionalProperties must be false.
    result['additionalProperties'] = false;
    const rawProps = (
      typeof s['properties'] === 'object' && s['properties'] !== null ? s['properties'] : {}
    ) as Record<string, unknown>;
    const originalRequired = new Set(
      Array.isArray(s['required']) ? (s['required'] as string[]) : [],
    );
    const props: Record<string, unknown> = {};
    const propKeys: string[] = [];
    for (const [k, v] of Object.entries(rawProps)) {
      const processed = makeStrictSchema(v);
      // Rule 3 — optional properties become nullable so the model can pass null to "skip" them.
      props[k] = originalRequired.has(k) ? processed : makeNullable(processed);
      propKeys.push(k);
    }
    result['properties'] = props;
    result['required'] = [...new Set([...originalRequired, ...propKeys])];
  }

  // Rule 4 — arrays must declare their item schema.
  if (s['type'] === 'array') {
    result['items'] = s['items'] ? makeStrictSchema(s['items']) : { anyOf: STRICT_ANY_PRIMITIVE };
  } else if (s['items']) {
    result['items'] = makeStrictSchema(s['items']);
  }

  if (Array.isArray(s['anyOf'])) result['anyOf'] = (s['anyOf'] as unknown[]).map(makeStrictSchema);
  if (Array.isArray(s['oneOf'])) result['oneOf'] = (s['oneOf'] as unknown[]).map(makeStrictSchema);
  if (Array.isArray(s['allOf'])) result['allOf'] = (s['allOf'] as unknown[]).map(makeStrictSchema);
  return result;
}

/**
 * Build a bidirectional map between sanitised (LLM-safe) names and original
 * harness tool IDs so we can translate tool-call responses back.
 */
function buildToolNameMap(defs: ToolDefinition[]): {
  tools: Record<string, { description: string; parameters: unknown }>;
  /** sanitised → original */
  toOriginal: Map<string, string>;
} {
  const tools: Record<string, { description: string; parameters: unknown }> = {};
  const toOriginal = new Map<string, string>();

  for (const def of defs) {
    const safe = sanitiseToolName(def.name);
    tools[safe] = {
      description: def.description,
      parameters: jsonSchema(makeStrictSchema(def.parameters) as Record<string, unknown>),
    };
    toOriginal.set(safe, def.name);
  }

  return { tools, toOriginal };
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
  nameMap: Map<string, string>,
): string {
  const byName = new Map(definitions.map((d) => [d.name, d]));
  return toolCalls
    .map((tc) => {
      const originalName = nameMap.get(tc.toolName) ?? tc.toolName;
      const def = byName.get(originalName);
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
 * Consume the merged `fullStream` — drains the SDK pipeline once.
 * Returns the accumulated text-delta content.
 */
async function consumeFullStream(
  result: StreamTextResult<ToolSet, unknown>,
  emitter: OutputEmitter | undefined,
): Promise<string> {
  let fullText = '';
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
    } else if (part.type === 'error') {
      // Throw immediately so callers never reach `await result.text`, which
      // hangs indefinitely when the stream errors while `onError` is set.
      throw part.error instanceof Error ? part.error : new Error(String(part.error));
    }
  }
  return fullText;
}

/** Fallback: consume `textStream` when `fullStream` is unavailable (e.g. test stubs). */
async function consumeTextStream(
  result: StreamTextResult<ToolSet, unknown>,
  emitter: OutputEmitter | undefined,
): Promise<string> {
  let fullText = '';
  for await (const chunk of result.textStream) {
    fullText += chunk;
    if (emitter && chunk) {
      await emitter.emit({ type: 'text', content: chunk });
    }
  }
  await result.consumeStream?.();
  return fullText;
}

/**
 * Reconcile the streamed text with the SDK-resolved `result.text`.
 * Emits any missing suffix or falls back to reasoning content.
 */
async function reconcileText(
  streamedText: string,
  result: StreamTextResult<ToolSet, unknown>,
  emitter: OutputEmitter | undefined,
): Promise<string> {
  const resolvedText = (await result.text) ?? '';

  if (resolvedText.trim() && !streamedText.trim()) {
    if (emitter) {
      await emitter.emit({ type: 'text', content: resolvedText });
    }
    return resolvedText;
  }

  // Prefer SDK `text` over streamed concatenation (canonical); emit any missing suffix.
  if (resolvedText.length > streamedText.length && resolvedText.startsWith(streamedText)) {
    const suffix = resolvedText.slice(streamedText.length);
    if (emitter && suffix) {
      await emitter.emit({ type: 'text', content: suffix });
    }
  }

  const merged = resolvedText || streamedText;
  if (!merged.trim()) {
    return (await tryReasoningFallback(result, emitter)) ?? merged;
  }

  return merged;
}

/** Return reasoning text if available, emitting it as a thinking chunk. */
async function tryReasoningFallback(
  result: StreamTextResult<ToolSet, unknown>,
  emitter: OutputEmitter | undefined,
): Promise<string | null> {
  const reasoning = await result.reasoning;
  if (!reasoning?.trim()) return null;
  if (emitter) {
    await emitter.emit({ type: 'thinking', content: reasoning });
  }
  return reasoning;
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
  const streamedText = result.fullStream
    ? await consumeFullStream(result, emitter)
    : await consumeTextStream(result, emitter);

  return reconcileText(streamedText, result, emitter);
}

/** Build LlmOutput + assistant ChatMessage from the completed LLM response.
 *  Reverses sanitised tool names back to original IDs via `nameMap`. */
function buildLlmOutput(
  fullText: string,
  finalToolCalls: Array<{ toolCallId: string; toolName: string; args: unknown }>,
  nameMap: Map<string, string>,
): { output: LlmOutput; assistantMessage: ChatMessage } {
  if (finalToolCalls.length > 0) {
    const calls: ToolCallIntent[] = finalToolCalls.map((tc) => ({
      id: tc.toolCallId,
      name: nameMap.get(tc.toolName) ?? tc.toolName,
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

/** Sum prompt + completion tokens; missing or invalid usage from the SDK → 0 (avoid NaN budgets). */
function sumUsageTokens(
  usage: { promptTokens?: number; completionTokens?: number } | undefined,
): number {
  if (!usage) return 0;
  const p = Number(usage.promptTokens);
  const c = Number(usage.completionTokens);
  const sum = (Number.isFinite(p) ? p : 0) + (Number.isFinite(c) ? c : 0);
  return Number.isFinite(sum) ? sum : 0;
}

/** Check maxTokens limit; appends trace event and emits error if exceeded. */
async function checkTokenLimit(
  limits: HarnessStateType['limits'],
  newTotalTokens: number,
  traceEvents: TraceEvent[],
  emitter: OutputEmitter | undefined,
): Promise<boolean> {
  const maxTokens = limits?.maxTokens;
  if (maxTokens == null || !Number.isFinite(newTotalTokens) || newTotalTokens < maxTokens)
    return false;

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
  if (maxCost == null || maxCost <= 0 || !Number.isFinite(newTotalCost) || newTotalCost < maxCost)
    return false;

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
    Number.isFinite(newTotalTokens) &&
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
    Number.isFinite(newTotalCost) &&
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

/** Normalise raw SDK usage into safe prompt/completion token counts. */
function normaliseTokenUsage(
  usage: { promptTokens?: number; completionTokens?: number } | undefined,
): { promptTokens: number; completionTokens: number } | undefined {
  if (!usage) return undefined;
  const p = Number(usage.promptTokens);
  const c = Number(usage.completionTokens);
  return {
    promptTokens: Number.isFinite(p) ? p : 0,
    completionTokens: Number.isFinite(c) ? c : 0,
  };
}

/** Emit a placeholder line when the model requests tools with no streamed text. */
async function emitToolCallPlaceholder(
  text: string,
  toolCalls: Array<{ toolName: string }>,
  toolDefinitions: ToolDefinition[],
  toolNameMap: Map<string, string>,
  emitter: OutputEmitter | undefined,
): Promise<void> {
  if (!emitter || !toolCalls.length || text.trim()) return;
  const names = placeholderLabelsForToolCalls(toolCalls, toolDefinitions, toolNameMap);
  const label = toolCalls.length === 1 ? 'tool' : 'tools';
  await emitter.emit({ type: 'text', content: `Calling ${label}: ${names}…` });
}

/** Build retry-notification callback for the withRetry helper. */
function buildRetryCallback(
  step: number,
  retryTraceEvents: TraceEvent[],
  retryCounter: { count: number },
  dispatcher: PluginDispatcher | undefined,
  state: HarnessStateType,
): (attempt: number, error: unknown, delayMs: number) => void {
  return (attempt, error, delayMs) => {
    retryCounter.count++;
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
  };
}

/** Check budget limits and return whether execution should halt. */
async function checkBudgetLimits(
  state: HarnessStateType,
  newTotalTokens: number,
  newTotalCost: number,
  traceEvents: TraceEvent[],
  emitter: OutputEmitter | undefined,
): Promise<boolean> {
  const tokenHalted = await checkTokenLimit(state.limits, newTotalTokens, traceEvents, emitter);
  if (tokenHalted) return true;

  const costHalted = await checkCostLimit(state.limits, newTotalCost, traceEvents, emitter);
  if (costHalted) return true;

  await emitBudgetWarnings(state.limits, newTotalTokens, newTotalCost, emitter);
  return false;
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

    // Wall-time deadline check — abort before starting an LLM call
    const deadline = checkDeadline(state);
    if (deadline.expired) {
      return {
        halted: true,
        trace: [
          {
            type: 'deadline_exceeded',
            elapsedMs: deadline.elapsedMs,
            deadlineMs: state.deadlineMs,
          },
        ],
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
    const { tools: sdkTools, toOriginal: toolNameMap } =
      toolDefinitions.length > 0
        ? buildToolNameMap(toolDefinitions)
        : {
            tools: undefined as
              | Record<string, { description: string; parameters: unknown }>
              | undefined,
            toOriginal: new Map<string, string>(),
          };
    const tools = sdkTools && Object.keys(sdkTools).length > 0 ? sdkTools : undefined;

    if (dispatcher) {
      await firePromptBuildHook(dispatcher, state);
    }

    const step = state.taskIndex ?? 0;
    const retryTraceEvents: TraceEvent[] = [];
    const retryCounter = { count: 0 };

    const { fullText, finalToolCalls, usage } = await withRetry(
      async () => {
        let streamError: Error | null = null;
        const coreMessages = toCoreMessages(messages);
        const res = streamText({
          model,
          messages: coreMessages,
          tools,
          maxSteps: 1,
          abortSignal: signal,
          onError: ({ error }) => {
            streamError = error instanceof Error ? error : new Error(String(error));
          },
        });

        const text = await streamAndAccumulate(res, emitter);

        if (streamError) {
          throw streamError;
        }

        const toolCalls = await res.toolCalls;
        const usageInfo = await res.usage;

        await emitToolCallPlaceholder(text, toolCalls, toolDefinitions, toolNameMap, emitter);

        return { fullText: text, finalToolCalls: toolCalls, usage: usageInfo };
      },
      LLM_RETRY_CONFIG,
      buildRetryCallback(step, retryTraceEvents, retryCounter, dispatcher, state),
    );

    const tokenUsage = normaliseTokenUsage(usage);
    const { output, assistantMessage } = buildLlmOutput(fullText, finalToolCalls, toolNameMap);

    const tokenDelta = sumUsageTokens(usage);
    const newTotalTokens = state.totalTokensUsed + tokenDelta;
    const costDelta = tokenDelta / 1000;
    const newTotalCost = (state.totalCostUnits ?? 0) + costDelta;
    const traceEvents: TraceEvent[] = [...retryTraceEvents, { type: 'llm_call', step, tokenUsage }];

    const halted = await checkBudgetLimits(
      state,
      newTotalTokens,
      newTotalCost,
      traceEvents,
      emitter,
    );

    return {
      llmOutput: output,
      messages: [assistantMessage],
      trace: traceEvents,
      totalTokensUsed: newTotalTokens,
      totalCostUnits: newTotalCost,
      totalRetries: (state.totalRetries ?? 0) + retryCounter.count,
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
