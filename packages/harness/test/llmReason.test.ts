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

// ---------------------------------------------------------------------------
// Mock the AI SDK before importing the node (delegates to shared helper)
// ---------------------------------------------------------------------------

vi.mock('ai', () => setupAiMock());
vi.mock('@ai-sdk/openai', () => setupOpenAiProviderMock());

// Import after mocks — use createLlmReasonNode (llmReasonNode is deprecated)
const { createLlmReasonNode: _createNode } = await import('../src/nodes/llmReason.js');
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
    expect(result.trace).toHaveLength(1);
    expect(result.trace![0]).toMatchObject({
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

  it('handles empty text and no tool calls gracefully', async () => {
    mockStreamText.mockReturnValueOnce(
      mockStreamResult({
        textChunks: [],
        usage: undefined,
      }),
    );

    const result = await llmReasonNode(makeState());

    expect(result.llmOutput).toEqual({ kind: 'text', content: '' });
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

  it('emits resolved `text` when `textStream` yields nothing (provider quirk)', async () => {
    mockStreamText.mockReturnValueOnce(
      mockStreamResult({
        textChunks: [],
        textOverride: 'Answer without streaming deltas',
        usage: { promptTokens: 3, completionTokens: 10 },
      }),
    );

    const emitted: { type: string; content?: string }[] = [];
    const emitter = {
      emit: (event: { type: string; content?: string }) => emitted.push(event),
      end: vi.fn(),
    };

    const node = createLlmReasonNode(emitter);
    const result = await node(makeState());

    expect(emitted).toEqual([{ type: 'text', content: 'Answer without streaming deltas' }]);
    expect(result.llmOutput).toEqual({ kind: 'text', content: 'Answer without streaming deltas' });
  });

  it('emits placeholder text when the model requests tools with no streamed text', async () => {
    mockStreamText.mockReturnValueOnce(
      mockStreamResult({
        textChunks: [],
        toolCalls: [
          { toolCallId: 'tc1', toolName: 'search', args: { query: 'hello' } },
          { toolCallId: 'tc2', toolName: 'read_file', args: { path: '/foo' } },
        ],
        usage: { promptTokens: 5, completionTokens: 3 },
      }),
    );

    const emitted: { type: string; content?: string }[] = [];
    const emitter = {
      emit: (event: { type: string; content?: string }) => emitted.push(event),
      end: vi.fn(),
    };

    const node = createLlmReasonNode(emitter);
    const state = makeState({
      toolDefinitions: [
        { name: 'search', description: 'Search', parameters: { type: 'object', properties: {} } },
        { name: 'read_file', description: 'Read', parameters: { type: 'object', properties: {} } },
      ],
    });
    await node(state);

    expect(emitted).toEqual([{ type: 'text', content: 'Calling tools: Search, Read…' }]);
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
