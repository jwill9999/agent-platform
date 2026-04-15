import type { Output, Tool as ContractTool } from '@agent-platform/contracts';

// ---------------------------------------------------------------------------
// Chat messages (LLM conversation format)
// ---------------------------------------------------------------------------

export type ChatMessage =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string; toolCalls?: ToolCallIntent[] }
  | { role: 'tool'; content: string; toolCallId: string; toolName: string };

// ---------------------------------------------------------------------------
// Tool definitions (OpenAI function-calling format)
// ---------------------------------------------------------------------------

export type ToolDefinition = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// LLM output (discriminated union)
// ---------------------------------------------------------------------------

export type ToolCallIntent = {
  id: string;
  name: string;
  args: Record<string, unknown>;
};

export type LlmTextOutput = {
  kind: 'text';
  content: string;
};

export type LlmToolCallsOutput = {
  kind: 'tool_calls';
  calls: ToolCallIntent[];
};

export type LlmOutput = LlmTextOutput | LlmToolCallsOutput;

// ---------------------------------------------------------------------------
// Model config for the LLM node (includes apiKey for invocation)
// ---------------------------------------------------------------------------

export type LlmModelConfig = {
  provider: string;
  model: string;
  apiKey: string;
};

// ---------------------------------------------------------------------------
// Native tool executor (non-MCP tools)
// ---------------------------------------------------------------------------

/** Pluggable executor for non-MCP (registry/native) tools. */
export type NativeToolExecutor = (toolId: string, args: Record<string, unknown>) => Promise<Output>;

// ---------------------------------------------------------------------------
// Output emitter (streaming interface)
// ---------------------------------------------------------------------------

/** Streaming event emitter for Output union events. */
export type OutputEmitter = {
  /** Emit a single Output event to the client stream. Non-blocking. */
  emit(event: Output): void;
  /** Signal stream completion. */
  end(): void;
};

// ---------------------------------------------------------------------------
// Tool definition mapping
// ---------------------------------------------------------------------------

/**
 * Converts contract tools (from AgentContext) to OpenAI function-calling format.
 * MCP tools carry inputSchema in config; registry tools without schema get empty parameters.
 */
export function contractToolsToDefinitions(tools: ContractTool[]): ToolDefinition[] {
  return tools.map((t) => {
    const inputSchema =
      t.config && typeof t.config === 'object' && 'inputSchema' in t.config
        ? (t.config.inputSchema as Record<string, unknown>)
        : undefined;

    return {
      name: t.id,
      description: t.description ?? t.name,
      parameters: inputSchema ?? { type: 'object', properties: {} },
    };
  });
}
