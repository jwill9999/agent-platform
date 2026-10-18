import { describe, expect, it, vi } from 'vitest';
import type { Tool as ContractTool } from '@agent-platform/contracts';

import { contractToolsToDefinitions } from '../src/types.js';
import type { ChatMessage, LlmModelConfig, ToolDefinition } from '../src/types.js';
import {
  mockStreamText,
  setupAiMock,
  setupOpenAiProviderMock,
  mockStreamResult,
} from './helpers/aiMock.js';
import { SYSTEM_TOOLS } from '../src/systemTools.js';
import { GIT_DELIVERY_TOOLS } from '../src/tools/gitTools.js';
import { createAgent, openDatabase, upsertTool } from '@agent-platform/db';
import { buildAgentContext, destroyAgentContext } from '../src/factory.js';

// ---------------------------------------------------------------------------
// Mock the AI SDK before importing the node (delegates to shared helper)
// ---------------------------------------------------------------------------

vi.mock('ai', () => setupAiMock());
vi.mock('@ai-sdk/openai', () => setupOpenAiProviderMock());

// Import after mocks — use createLlmReasonNode (llmReasonNode is deprecated)
const { createLlmReasonNode: _createNode, buildToolNameMap } =
  await import('../src/nodes/llmReason.js');
const llmReasonNode = _createNode();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const modelConfig: LlmModelConfig = { provider: 'openai', model: 'gpt-4o', apiKey: 'test-key' };

function makeState(overrides: Record<string, unknown> = {}) {
  return {
    trace: [],
    plan: null,
    taskIndex: 0,
    limits: { maxSteps: 10, maxParallelTasks: 1, timeoutMs: 60_000 },
    runId: 'test-run',
    halted: false,
    messages: [{ role: 'user' as const, content: 'Hello' }] as ChatMessage[],
    toolDefinitions: [] as ToolDefinition[],
    llmOutput: null,
    modelConfig,
    totalTokensUsed: 0,
    totalCostUnits: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests: llmReasonNode
// ---------------------------------------------------------------------------

describe('llmReasonNode', () => {
  it('produces text output when LLM returns text (no tool calls)', async () => {
    mockStreamText.mockReturnValueOnce(
      mockStreamResult({
        textChunks: ['Hello, ', 'world!'],
        usage: { promptTokens: 10, completionTokens: 5 },
      }),
    );

    const result = await llmReasonNode(makeState());

    expect(result.llmOutput).toEqual({ kind: 'text', content: 'Hello, world!' });
    expect(result.messages).toHaveLength(1);
    expect(result.messages![0]).toEqual({ role: 'assistant', content: 'Hello, world!' });
    expect(result.trace).toHaveLength(2);
    expect(result.trace![1]).toMatchObject({
      type: 'llm_call',
      step: 0,
      tokenUsage: { promptTokens: 10, completionTokens: 5 },
    });
    expect(result.totalTokensUsed).toBe(15);
  });

  it('produces tool_calls output when LLM returns tool calls', async () => {
    mockStreamText.mockReturnValueOnce(
      mockStreamResult({
        textChunks: [],
        toolCalls: [
          { toolCallId: 'tc1', toolName: 'search', args: { query: 'hello' } },
          { toolCallId: 'tc2', toolName: 'read_file', args: { path: '/foo' } },
        ],
        usage: { promptTokens: 20, completionTokens: 15 },
      }),
    );

    const state = makeState({
      toolDefinitions: [
        { name: 'search', description: 'Search', parameters: { type: 'object', properties: {} } },
        { name: 'read_file', description: 'Read', parameters: { type: 'object', properties: {} } },
      ],
    });

    const result = await llmReasonNode(state);

    expect(result.llmOutput).toEqual({
      kind: 'tool_calls',
      calls: [
        { id: 'tc1', name: 'search', args: { query: 'hello' } },
        { id: 'tc2', name: 'read_file', args: { path: '/foo' } },
      ],
    });
    expect(result.messages![0]).toHaveProperty('toolCalls');
  });

  it('halts safely on empty output rather than inventing a public answer', async () => {
    mockStreamText.mockReturnValueOnce(
      mockStreamResult({
        textChunks: [],
        usage: undefined,
      }),
    );

    const result = await llmReasonNode(makeState());

    expect(result.llmOutput).toBeNull();
    expect(result.contextHalt?.code).toBe('MODEL_OUTPUT_INCOMPLETE');
    expect(result.halted).toBe(true);
    expect(result.totalTokensUsed).toBe(0);
  });

  it('throws when modelConfig is missing', async () => {
    const state = makeState({ modelConfig: null });
    await expect(llmReasonNode(state)).rejects.toThrow('modelConfig is required');
  });

  it('accumulates token usage onto totalTokensUsed', async () => {
    mockStreamText.mockReturnValueOnce(
      mockStreamResult({
        textChunks: ['ok'],
        usage: { promptTokens: 100, completionTokens: 50 },
      }),
    );

    const state = makeState({ totalTokensUsed: 200 });
    const result = await llmReasonNode(state);

    expect(result.totalTokensUsed).toBe(350);
  });

  it('passes tool definitions to streamText when present', async () => {
    mockStreamText.mockReturnValueOnce(
      mockStreamResult({
        textChunks: ['using tools'],
        usage: { promptTokens: 5, completionTokens: 3 },
      }),
    );

    const toolDefs: ToolDefinition[] = [
      {
        name: 'my_tool',
        description: 'A tool',
        parameters: { type: 'object', properties: { x: { type: 'string' } } },
      },
    ];

    await llmReasonNode(makeState({ toolDefinitions: toolDefs }));

    expect(mockStreamText).toHaveBeenCalledWith(
      expect.objectContaining({
        tools: expect.objectContaining({
          my_tool: expect.objectContaining({
            description: 'A tool',
          }),
        }),
      }),
    );
  });

  it('strips unsupported schema keywords from nested tool definitions', async () => {
    mockStreamText.mockReturnValueOnce(
      mockStreamResult({
        textChunks: ['using tools'],
        usage: { promptTokens: 5, completionTokens: 3 },
      }),
    );

    const toolDefs: ToolDefinition[] = [
      {
        name: 'browser_drop',
        description: 'Drop browser data',
        parameters: {
          type: 'object',
          properties: {
            data: {
              anyOf: [
                {
                  type: 'object',
                  propertyNames: { pattern: '^[a-z]+$' },
                  additionalProperties: { type: 'string' },
                },
              ],
            },
          },
        },
      },
    ];

    await llmReasonNode(makeState({ toolDefinitions: toolDefs }));

    const call = mockStreamText.mock.calls.at(-1)?.[0] as {
      tools?: Record<string, { inputSchema?: unknown }>;
    };
    expect(JSON.stringify(call.tools?.browser_drop?.inputSchema)).not.toContain('propertyNames');
  });

  it('passes built-in system tools to the SDK with OpenAI-safe strict schemas', async () => {
    mockStreamText.mockReturnValueOnce(
      mockStreamResult({
        textChunks: ['using system tools'],
        usage: { promptTokens: 5, completionTokens: 3 },
      }),
    );

    await llmReasonNode(
      makeState({ toolDefinitions: contractToolsToDefinitions([...SYSTEM_TOOLS]) }),
    );

    const call = mockStreamText.mock.calls.at(-1)?.[0] as {
      tools?: Record<string, { inputSchema?: { jsonSchema?: Record<string, unknown> } }>;
    };
    expect(Object.keys(call.tools ?? {})).not.toContain(expect.stringContaining(':'));
    const bashSchema = call.tools?.sys_bash?.inputSchema?.jsonSchema;
    expect(bashSchema).toMatchObject({
      type: 'object',
      additionalProperties: false,
      required: ['command', 'timeout_ms'],
    });
    expect(JSON.stringify(call.tools)).not.toContain('propertyNames');
  });
});

// ---------------------------------------------------------------------------
// Tests: createLlmReasonNode with emitter
// ---------------------------------------------------------------------------

const { createLlmReasonNode } = await import('../src/nodes/llmReason.js');

describe('createLlmReasonNode with emitter', () => {
  it('emits text chunks to emitter during streaming', async () => {
    mockStreamText.mockReturnValueOnce(
      mockStreamResult({
        textChunks: ['chunk1', 'chunk2', 'chunk3'],
        usage: { promptTokens: 5, completionTokens: 3 },
      }),
    );

    const emitted: { type: string; content?: string }[] = [];
    const emitter = {
      emit: (event: { type: string; content?: string }) => emitted.push(event),
      end: vi.fn(),
    };

    const node = createLlmReasonNode(emitter);
    const result = await node(makeState());

    expect(emitted).toEqual([
      { type: 'text', content: 'chunk1' },
      { type: 'text', content: 'chunk2' },
      { type: 'text', content: 'chunk3' },
    ]);
    expect(result.llmOutput).toEqual({ kind: 'text', content: 'chunk1chunk2chunk3' });
  });

  it('does not emit empty chunks', async () => {
    mockStreamText.mockReturnValueOnce(
      mockStreamResult({
        textChunks: ['', 'text', ''],
        usage: { promptTokens: 5, completionTokens: 3 },
      }),
    );

    const emitted: unknown[] = [];
    const emitter = {
      emit: (event: unknown) => emitted.push(event),
      end: vi.fn(),
    };

    const node = createLlmReasonNode(emitter);
    await node(makeState());

    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toEqual({ type: 'text', content: 'text' });
  });

  it('re-throws errors from onError callback', async () => {
    const apiError = new Error('Invalid API key provided');

    // Mock streamText to call onError synchronously before returning
    // This simulates how the AI SDK fires onError when the request fails immediately
    mockStreamText.mockImplementationOnce(
      (options: { onError?: (opts: { error: Error }) => void }) => {
        // Fire onError synchronously before returning the result
        if (options.onError) {
          options.onError({ error: apiError });
        }
        return {
          textStream: (async function* () {
            // Yield nothing - simulates empty response on error
          })(),
          toolCalls: Promise.resolve([]),
          usage: Promise.resolve(undefined),
        };
      },
    );

    const emitter = {
      emit: vi.fn(),

      end: vi.fn(),
    };

    const node = createLlmReasonNode(emitter);

    await expect(node(makeState())).rejects.toThrow('The provider request failed.');
  });
});

// ---------------------------------------------------------------------------
// Tests: contractToolsToDefinitions
// ---------------------------------------------------------------------------

describe('contractToolsToDefinitions', () => {
  it('maps MCP tools with inputSchema from config', () => {
    const tools: ContractTool[] = [
      {
        id: 'server1:read',
        name: 'read',
        description: 'Read a file',
        config: {
          mcpServerId: 'server1',
          mcpToolName: 'read',
          inputSchema: { type: 'object', properties: { path: { type: 'string' } } },
        },
      },
    ];

    const defs = contractToolsToDefinitions(tools);

    expect(defs).toHaveLength(1);
    expect(defs[0]).toEqual({
      name: 'server1:read',
      description: 'Read a file',
      parameters: { type: 'object', properties: { path: { type: 'string' } } },
    });
  });

  it('maps registry tools without schema to empty parameters', () => {
    const tools: ContractTool[] = [
      { id: 'my-tool', slug: 'my-tool', name: 'my-tool', description: 'Does stuff' },
    ];

    const defs = contractToolsToDefinitions(tools);

    expect(defs[0]).toEqual({
      name: 'my-tool',
      description: 'Does stuff',
      parameters: { type: 'object', properties: {} },
    });
  });

  it('uses name as description fallback when description is missing', () => {
    const tools: ContractTool[] = [{ id: 'tool-a', slug: 'tool-a', name: 'tool-a' }];

    const defs = contractToolsToDefinitions(tools);

    expect(defs[0]!.description).toBe('tool-a');
  });
});

// ---------------------------------------------------------------------------
// Tests: wall-time deadline propagation in llmReasonNode
// ---------------------------------------------------------------------------

describe('llmReasonNode — deadline propagation', () => {
  it('halts immediately when deadline is already exceeded', async () => {
    const node = _createNode();
    const state = makeState({
      startedAtMs: 1000,
      deadlineMs: 5000,
    });

    // Simulate "now" well past the deadline (1000 + 5000 = 6000 deadline, now=99999)
    // The real implementation calls Date.now() internally, so we use fake timers
    vi.useFakeTimers();
    vi.setSystemTime(99999);

    const result = await node(state);

    vi.useRealTimers();

    expect(result.halted).toBe(true);
    expect(result.trace).toContainEqual(expect.objectContaining({ type: 'deadline_exceeded' }));
  });

  it('does not halt when deadline has time remaining', async () => {
    mockStreamText.mockReturnValueOnce(
      mockStreamResult({
        textChunks: ['ok'],
        usage: { promptTokens: 5, completionTokens: 5 },
      }),
    );
    const now = Date.now();
    const node = _createNode();
    const state = makeState({
      startedAtMs: now,
      deadlineMs: 60_000, // 60s budget — plenty of room
    });

    const result = await node(state);

    expect(result.halted).toBeUndefined();
    expect(result.llmOutput).toBeDefined();
  });

  it('is backwards-compatible when deadline fields are missing', async () => {
    mockStreamText.mockReturnValueOnce(
      mockStreamResult({
        textChunks: ['ok'],
        usage: { promptTokens: 5, completionTokens: 5 },
      }),
    );
    const node = _createNode();
    const state = makeState(); // no startedAtMs / deadlineMs

    const result = await node(state);

    expect(result.halted).toBeUndefined();
    expect(result.llmOutput).toBeDefined();
  });
});

describe('provider admission boundary', () => {
  it('returns a typed halt without a provider attempt or changing existing effects', async () => {
    mockStreamText.mockClear();
    const onModelAttempt = vi.fn();
    const onContextDecision = vi.fn();
    const state = makeState({
      contextWindow: { maxInputTokens: 10, maxOutputTokens: 2048, strategy: 'truncate' },
      totalToolCalls: 2,
    });
    const before = structuredClone(state.messages);
    const result = await _createNode({ onModelAttempt, onContextDecision })(state);
    expect(result).toMatchObject({
      halted: true,
      contextHalt: { code: 'CONTEXT_BUDGET_EXCEEDED' },
      llmOutput: null,
    });
    expect(result.messages).toBeUndefined();
    expect(state.messages).toEqual(before);
    expect(state.totalToolCalls).toBe(2);
    expect(mockStreamText).not.toHaveBeenCalled();
    expect(onModelAttempt).not.toHaveBeenCalled();
    expect(onContextDecision).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'required_overflow' }),
    );
  });

  it('passes output cap and fixes admission payload once across transient retries', async () => {
    mockStreamText.mockClear();
    const error = Object.assign(new Error('transient'), { status: 503 });
    mockStreamText.mockImplementationOnce(() => {
      throw error;
    });
    mockStreamText.mockReturnValueOnce(mockStreamResult({ textChunks: ['ok'] }));
    const onModelAttempt = vi.fn();
    const onContextDecision = vi.fn();
    const result = await _createNode({ onModelAttempt, onContextDecision })(
      makeState({
        contextWindow: { maxInputTokens: 8000, maxOutputTokens: 123, strategy: 'truncate' },
      }),
    );
    expect(result.contextHalt).toBeUndefined();
    expect(mockStreamText).toHaveBeenCalledTimes(2);
    expect(mockStreamText.mock.calls[0]![0].messages).toBe(
      mockStreamText.mock.calls[1]![0].messages,
    );
    expect(mockStreamText.mock.calls[0]![0].maxOutputTokens).toBe(123);
    expect(onContextDecision).toHaveBeenCalledTimes(1);
    expect(onModelAttempt).toHaveBeenCalledTimes(2);
  });

  it('marks length completion incomplete and never creates tool intents or tool placeholders', async () => {
    const emit = vi.fn(async () => {});
    mockStreamText.mockReturnValueOnce({
      ...mockStreamResult({
        textChunks: ['partial'],
        toolCalls: [{ toolCallId: 'call', toolName: 'danger', args: {} }],
      }),
      finishReason: Promise.resolve('length'),
    });
    const result = await _createNode({ emitter: { emit } })(makeState());
    expect(result).toMatchObject({
      halted: true,
      contextHalt: { code: 'MODEL_OUTPUT_INCOMPLETE' },
      llmOutput: null,
      messages: [{ role: 'assistant', content: 'partial' }],
    });
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'error', code: 'MODEL_OUTPUT_INCOMPLETE' }),
    );
    expect(emit.mock.calls.flat()).not.toContainEqual(
      expect.objectContaining({ content: expect.stringContaining('Calling') }),
    );
  });

  it('does not let a diagnostic observer failure change admission or call execution', async () => {
    mockStreamText.mockReturnValueOnce(mockStreamResult({ textChunks: ['ok'] }));
    const result = await _createNode({
      onContextDecision: () => {
        throw new Error('storage unavailable');
      },
      onModelAttempt: () => {
        throw new Error('storage unavailable');
      },
    })(makeState());
    expect(result.llmOutput).toEqual({ kind: 'text', content: 'ok' });
  });
});

it('rejects ambiguous sanitized tool names before any provider request', async () => {
  mockStreamText.mockClear();
  await expect(
    _createNode()(
      makeState({
        toolDefinitions: [
          { name: 'mcp:read', description: 'One', parameters: { type: 'object', properties: {} } },
          { name: 'mcp__read', description: 'Two', parameters: { type: 'object', properties: {} } },
        ],
      }),
    ),
  ).rejects.toThrow('ambiguous');
  expect(mockStreamText).not.toHaveBeenCalled();
});

it('coalesces the assigned canonical Git registry records into one provider tool identity', async () => {
  const opened = openDatabase(':memory:');
  let context: Awaited<ReturnType<typeof buildAgentContext>> | undefined;
  try {
    // The actual agents router persists assigned native Git tools this way.
    for (const tool of GIT_DELIVERY_TOOLS) upsertTool(opened.db, tool);
    const agent = createAgent(opened.db, {
      name: 'Canonical Git registry fixture',
      systemPrompt: 'Use reviewed Git tools.',
      allowedSkillIds: [],
      allowedToolIds: GIT_DELIVERY_TOOLS.map((tool) => tool.id),
      allowedMcpServerIds: [],
      executionLimits: { maxSteps: 6, maxParallelTasks: 1, timeoutMs: 30000 },
    });
    context = await buildAgentContext(opened.db, agent.id);
    const definitions = contractToolsToDefinitions(context.tools);
    for (const tool of GIT_DELIVERY_TOOLS)
      expect(definitions.filter((definition) => definition.name === tool.id)).toHaveLength(2);
    const mapped = buildToolNameMap(definitions);
    for (const tool of GIT_DELIVERY_TOOLS) {
      expect(Object.keys(mapped.tools).filter((id) => id === tool.id)).toHaveLength(1);
      expect(mapped.mappedSchemas.filter((definition) => definition.name === tool.id)).toHaveLength(
        1,
      );
      expect(
        [...mapped.toOriginal].filter(
          ([safe, original]) => safe === tool.id && original === tool.id,
        ),
      ).toHaveLength(1);
    }
    mockStreamText.mockClear();
    mockStreamText.mockReturnValueOnce(mockStreamResult({ textChunks: ['Git ready'] }));
    const result = await _createNode()(makeState({ toolDefinitions: definitions }));
    expect(result.llmOutput).toEqual({ kind: 'text', content: 'Git ready' });
    expect(mockStreamText).toHaveBeenCalledTimes(1);
    expect(Object.keys(mockStreamText.mock.calls[0]![0].tools)).toHaveLength(SYSTEM_TOOLS.length);
  } finally {
    if (context) await destroyAgentContext(context);
    opened.sqlite.close();
  }
});

it.each(['description', 'schema', 'distinct-id'] as const)(
  'rejects %s collisions in either input order before any provider request',
  async (conflict) => {
    const first: ToolDefinition = {
      name: 'mcp:read',
      description: 'Read',
      parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
    };
    const second: ToolDefinition =
      conflict === 'description'
        ? { ...first, description: 'Different' }
        : conflict === 'schema'
          ? {
              ...first,
              parameters: {
                type: 'object',
                properties: { path: { type: 'number' } },
                required: ['path'],
              },
            }
          : { ...first, name: 'mcp__read' };
    for (const toolDefinitions of [
      [first, second],
      [second, first],
    ]) {
      mockStreamText.mockClear();
      await expect(_createNode()(makeState({ toolDefinitions }))).rejects.toThrow('ambiguous');
      expect(mockStreamText).not.toHaveBeenCalled();
    }
  },
);
