import { describe, expect, it, vi } from 'vitest';
import type { Tool as ContractTool } from '@agent-platform/contracts';

import { contractToolsToDefinitions } from '../src/types.js';
import type { ChatMessage, LlmModelConfig, ToolDefinition } from '../src/types.js';

// ---------------------------------------------------------------------------
// Mock the AI SDK before importing the node
// ---------------------------------------------------------------------------

const mockGenerateText = vi.fn();

vi.mock('ai', () => ({
  generateText: (...args: unknown[]) => mockGenerateText(...args),
  jsonSchema: (schema: unknown) => ({ type: 'json-schema', jsonSchema: schema }),
}));

vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: ({ apiKey }: { apiKey: string }) => {
    return (model: string) => ({ provider: 'openai', modelId: model, apiKey });
  },
}));

// Import after mocks
const { llmReasonNode } = await import('../src/nodes/llmReason.js');

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
    mockGenerateText.mockResolvedValueOnce({
      text: 'Hello, world!',
      toolCalls: [],
      usage: { promptTokens: 10, completionTokens: 5 },
    });

    const result = await llmReasonNode(makeState());

    expect(result.llmOutput).toEqual({ kind: 'text', content: 'Hello, world!' });
    expect(result.messages).toHaveLength(1);
    expect(result.messages![0]).toEqual({ role: 'assistant', content: 'Hello, world!' });
    expect(result.trace).toHaveLength(1);
    expect(result.trace![0]).toMatchObject({
      type: 'llm_call',
      step: 0,
      tokenUsage: { promptTokens: 10, completionTokens: 5 },
    });
    expect(result.totalTokensUsed).toBe(15);
  });

  it('produces tool_calls output when LLM returns tool calls', async () => {
    mockGenerateText.mockResolvedValueOnce({
      text: '',
      toolCalls: [
        { toolCallId: 'tc1', toolName: 'search', args: { query: 'hello' } },
        { toolCallId: 'tc2', toolName: 'read_file', args: { path: '/foo' } },
      ],
      usage: { promptTokens: 20, completionTokens: 15 },
    });

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

  it('handles empty text and no tool calls gracefully', async () => {
    mockGenerateText.mockResolvedValueOnce({
      text: '',
      toolCalls: [],
      usage: undefined,
    });

    const result = await llmReasonNode(makeState());

    expect(result.llmOutput).toEqual({ kind: 'text', content: '' });
    expect(result.totalTokensUsed).toBe(0);
  });

  it('throws when modelConfig is missing', async () => {
    const state = makeState({ modelConfig: null });
    await expect(llmReasonNode(state)).rejects.toThrow('modelConfig is required');
  });

  it('accumulates token usage onto totalTokensUsed', async () => {
    mockGenerateText.mockResolvedValueOnce({
      text: 'ok',
      toolCalls: [],
      usage: { promptTokens: 100, completionTokens: 50 },
    });

    const state = makeState({ totalTokensUsed: 200 });
    const result = await llmReasonNode(state);

    expect(result.totalTokensUsed).toBe(350);
  });

  it('passes tool definitions to generateText when present', async () => {
    mockGenerateText.mockResolvedValueOnce({
      text: 'using tools',
      toolCalls: [],
      usage: { promptTokens: 5, completionTokens: 3 },
    });

    const toolDefs: ToolDefinition[] = [
      {
        name: 'my_tool',
        description: 'A tool',
        parameters: { type: 'object', properties: { x: { type: 'string' } } },
      },
    ];

    await llmReasonNode(makeState({ toolDefinitions: toolDefs }));

    expect(mockGenerateText).toHaveBeenCalledWith(
      expect.objectContaining({
        tools: expect.objectContaining({
          my_tool: expect.objectContaining({
            description: 'A tool',
          }),
        }),
      }),
    );
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
    const tools: ContractTool[] = [{ id: 'my-tool', name: 'my-tool', description: 'Does stuff' }];

    const defs = contractToolsToDefinitions(tools);

    expect(defs[0]).toEqual({
      name: 'my-tool',
      description: 'Does stuff',
      parameters: { type: 'object', properties: {} },
    });
  });

  it('uses name as description fallback when description is missing', () => {
    const tools: ContractTool[] = [{ id: 'tool-a', name: 'tool-a' }];

    const defs = contractToolsToDefinitions(tools);

    expect(defs[0]!.description).toBe('tool-a');
  });
});
