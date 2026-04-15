import { createOpenAI } from '@ai-sdk/openai';
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
  // Support both old signature (emitter?) and new options object
  const opts: LlmReasonNodeOptions =
    options && typeof options === 'object' && 'emit' in options
      ? { emitter: options as OutputEmitter }
      : ((options as LlmReasonNodeOptions) ?? {});

  const { emitter, dispatcher } = opts;

  return async function llmReasonNode(state: HarnessStateType): Promise<Partial<HarnessStateType>> {
    const { messages, toolDefinitions, modelConfig } = state;

    if (!modelConfig) {
      throw new Error('llm_reason: modelConfig is required in state');
    }

    const provider = createOpenAI({ apiKey: modelConfig.apiKey });
    const model = provider(modelConfig.model);

    const coreMessages = toCoreMessages(messages);
    const tools = toolDefinitions.length > 0 ? toSdkTools(toolDefinitions) : undefined;

    // Fire onPromptBuild plugin hook (observer — does not mutate messages)
    if (dispatcher) {
      try {
        await dispatcher.onPromptBuild({
          sessionId: state.sessionId ?? '',
          runId: state.runId ?? '',
          plan: null,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
        });
      } catch {
        /* plugin errors must not crash the graph */
      }
    }

    const result = streamText({
      model,
      messages: coreMessages,
      tools,
      maxSteps: 1,
    });

    // Stream text chunks via emitter while accumulating full response
    let fullText = '';
    for await (const chunk of result.textStream) {
      fullText += chunk;
      if (emitter && chunk) {
        emitter.emit({ type: 'text', content: chunk });
      }
    }

    // Await final result for tool calls and usage
    const finalToolCalls = await result.toolCalls;
    const usage = await result.usage;

    const tokenUsage = usage
      ? { promptTokens: usage.promptTokens, completionTokens: usage.completionTokens }
      : undefined;

    let output: LlmOutput;
    let assistantMessage: ChatMessage;

    if (finalToolCalls && finalToolCalls.length > 0) {
      const calls: ToolCallIntent[] = finalToolCalls.map((tc) => ({
        id: tc.toolCallId,
        name: tc.toolName,
        args: (tc.args as Record<string, unknown>) ?? {},
      }));

      output = { kind: 'tool_calls', calls };
      assistantMessage = {
        role: 'assistant',
        content: fullText || '',
        toolCalls: calls,
      };
    } else {
      output = { kind: 'text', content: fullText || '' };
      assistantMessage = { role: 'assistant', content: fullText || '' };
    }

    const step = state.taskIndex ?? 0;
    const traceEvent: TraceEvent = { type: 'llm_call', step, tokenUsage };
    const tokenDelta = tokenUsage ? tokenUsage.promptTokens + tokenUsage.completionTokens : 0;

    return {
      llmOutput: output,
      messages: [assistantMessage],
      trace: [traceEvent],
      totalTokensUsed: state.totalTokensUsed + tokenDelta,
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
