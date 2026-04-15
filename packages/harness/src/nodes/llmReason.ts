import { createOpenAI } from '@ai-sdk/openai';
import { generateText, jsonSchema } from 'ai';
import type { CoreMessage } from 'ai';

import type { HarnessStateType } from '../graphState.js';
import type { TraceEvent } from '../trace.js';
import type { ChatMessage, LlmOutput, ToolCallIntent, ToolDefinition } from '../types.js';

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

/** Parse generateText response into LlmOutput + assistant message. */
function parseResponse(response: {
  text: string;
  toolCalls: Array<{ toolCallId: string; toolName: string; args: unknown }>;
  usage?: { promptTokens: number; completionTokens: number };
}): {
  output: LlmOutput;
  assistantMessage: ChatMessage;
  tokenUsage?: { promptTokens: number; completionTokens: number };
} {
  const tokenUsage = response.usage
    ? {
        promptTokens: response.usage.promptTokens,
        completionTokens: response.usage.completionTokens,
      }
    : undefined;

  if (response.toolCalls.length > 0) {
    const calls: ToolCallIntent[] = response.toolCalls.map((tc) => ({
      id: tc.toolCallId,
      name: tc.toolName,
      args: (tc.args as Record<string, unknown>) ?? {},
    }));

    const output: LlmOutput = { kind: 'tool_calls', calls };
    const assistantMessage: ChatMessage = {
      role: 'assistant',
      content: response.text || '',
      toolCalls: calls,
    };
    return { output, assistantMessage, tokenUsage };
  }

  const output: LlmOutput = { kind: 'text', content: response.text || '' };
  const assistantMessage: ChatMessage = {
    role: 'assistant',
    content: response.text || '',
  };
  return { output, assistantMessage, tokenUsage };
}

// ---------------------------------------------------------------------------
// LLM reasoning node
// ---------------------------------------------------------------------------

/**
 * Graph node that invokes the LLM via the Vercel AI SDK.
 *
 * Reads `messages`, `toolDefinitions`, and `modelConfig` from state.
 * Produces `LlmOutput` (text or tool-call intents) — does NOT execute tools.
 * Appends the assistant message to conversation history.
 * Emits an `llm_call` trace event with optional token usage.
 */
export async function llmReasonNode(state: HarnessStateType): Promise<Partial<HarnessStateType>> {
  const { messages, toolDefinitions, modelConfig } = state;

  if (!modelConfig) {
    throw new Error('llm_reason: modelConfig is required in state');
  }

  const provider = createOpenAI({ apiKey: modelConfig.apiKey });
  const model = provider(modelConfig.model);

  const coreMessages = toCoreMessages(messages);
  const tools = toolDefinitions.length > 0 ? toSdkTools(toolDefinitions) : undefined;

  const response = await generateText({
    model,
    messages: coreMessages,
    tools,
    maxSteps: 1,
  });

  const { output, assistantMessage, tokenUsage } = parseResponse(response);

  const step = state.taskIndex ?? 0;
  const traceEvent: TraceEvent = { type: 'llm_call', step, tokenUsage };

  const tokenDelta = tokenUsage ? tokenUsage.promptTokens + tokenUsage.completionTokens : 0;

  return {
    llmOutput: output,
    messages: [assistantMessage],
    trace: [traceEvent],
    totalTokensUsed: state.totalTokensUsed + tokenDelta,
  };
}
