import { createLanguageModel, type SupportedProvider } from '@agent-platform/model-router';
import { streamText, jsonSchema } from 'ai';
import type { CoreMessage } from 'ai';

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

/** Stream text from result, emitting chunks, and return the accumulated text. */
async function streamAndAccumulate(
  textStream: AsyncIterable<string>,
  emitter: OutputEmitter | undefined,
): Promise<string> {
  let fullText = '';
  for await (const chunk of textStream) {
    fullText += chunk;
    if (emitter && chunk) {
      emitter.emit({ type: 'text', content: chunk });
    }
  }
  return fullText;
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
function checkTokenLimit(
  limits: HarnessStateType['limits'],
  newTotalTokens: number,
  traceEvents: TraceEvent[],
  emitter: OutputEmitter | undefined,
): boolean {
  const maxTokens = limits?.maxTokens;
  if (maxTokens == null || newTotalTokens < maxTokens) return false;

  traceEvents.push({ type: 'limit_hit', kind: 'max_tokens' });
  if (emitter) {
    emitter.emit({
      type: 'error',
      code: 'MAX_TOKENS',
      message: `Token limit exceeded (${newTotalTokens}/${maxTokens})`,
    });
  }
  return true;
}

/** Check maxCostUnits limit; appends trace event and emits error if exceeded. */
function checkCostLimit(
  limits: HarnessStateType['limits'],
  newTotalCost: number,
  traceEvents: TraceEvent[],
  emitter: OutputEmitter | undefined,
): boolean {
  const maxCost = limits?.maxCostUnits;
  if (maxCost == null || maxCost <= 0 || newTotalCost < maxCost) return false;

  traceEvents.push({ type: 'limit_hit', kind: 'max_cost' });
  if (emitter) {
    emitter.emit({
      type: 'error',
      code: 'MAX_COST',
      message: `Cost limit exceeded (${newTotalCost}/${maxCost})`,
    });
  }
  return true;
}

const BUDGET_WARN_THRESHOLD = 0.8;

/** Emit warnings when approaching token or cost limits (80% threshold). */
function emitBudgetWarnings(
  limits: HarnessStateType['limits'],
  newTotalTokens: number,
  newTotalCost: number,
  emitter: OutputEmitter | undefined,
): void {
  if (!emitter) return;

  const maxTokens = limits?.maxTokens;
  if (
    maxTokens != null &&
    newTotalTokens >= maxTokens * BUDGET_WARN_THRESHOLD &&
    newTotalTokens < maxTokens
  ) {
    emitter.emit({
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
    emitter.emit({
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
 */
export function createLlmReasonNode(options?: OutputEmitter | LlmReasonNodeOptions) {
  const { emitter, dispatcher } = normaliseOptions(options);

  return async function llmReasonNode(state: HarnessStateType): Promise<Partial<HarnessStateType>> {
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

    const result = streamText({ model, messages: toCoreMessages(messages), tools, maxSteps: 1 });

    const fullText = await streamAndAccumulate(result.textStream, emitter);
    const finalToolCalls = await result.toolCalls;
    const usage = await result.usage;

    const tokenUsage = usage
      ? { promptTokens: usage.promptTokens, completionTokens: usage.completionTokens }
      : undefined;

    const { output, assistantMessage } = buildLlmOutput(fullText, finalToolCalls);

    const tokenDelta = tokenUsage ? tokenUsage.promptTokens + tokenUsage.completionTokens : 0;
    const newTotalTokens = state.totalTokensUsed + tokenDelta;
    const costDelta = tokenDelta / 1000;
    const newTotalCost = (state.totalCostUnits ?? 0) + costDelta;
    const step = state.taskIndex ?? 0;
    const traceEvents: TraceEvent[] = [{ type: 'llm_call', step, tokenUsage }];

    const tokenHalted = checkTokenLimit(state.limits, newTotalTokens, traceEvents, emitter);
    const costHalted =
      !tokenHalted && checkCostLimit(state.limits, newTotalCost, traceEvents, emitter);
    const halted = tokenHalted || costHalted;

    if (!halted) {
      emitBudgetWarnings(state.limits, newTotalTokens, newTotalCost, emitter);
    }

    return {
      llmOutput: output,
      messages: [assistantMessage],
      trace: traceEvents,
      totalTokensUsed: newTotalTokens,
      totalCostUnits: newTotalCost,
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
