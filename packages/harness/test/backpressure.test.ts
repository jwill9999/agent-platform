import { describe, it, expect, vi } from 'vitest';
import { PassThrough } from 'node:stream';
import { createNdjsonEmitter, createNoopEmitter } from '../src/emitters/ndjson.js';
import type { Output } from '@agent-platform/contracts';
import type { HarnessStateType } from '../src/graphState.js';
import type { McpSessionManager } from '@agent-platform/mcp-adapter';
import type { ToolDispatchContext } from '../src/nodes/toolDispatch.js';
import {
  mockStreamText,
  setupAiMock,
  setupOpenAiProviderMock,
  mockStreamResult,
} from './helpers/aiMock.js';

// ---------------------------------------------------------------------------
// Mock AI SDK before importing nodes (delegates to shared helper)
// ---------------------------------------------------------------------------

vi.mock('ai', () => setupAiMock());
vi.mock('@ai-sdk/openai', () => setupOpenAiProviderMock());

const { createLlmReasonNode } = await import('../src/nodes/llmReason.js');
const { createToolDispatchNode } = await import('../src/nodes/toolDispatch.js');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAgent(overrides?: Partial<Record<string, unknown>>) {
  return {
    id: 'a1',
    name: 'test',
    description: '',
    systemPrompt: '',
    allowedSkillIds: [],
    allowedToolIds: ['echo'],
    allowedMcpServerIds: [],
    executionLimits: { maxSteps: 10 },
    ...overrides,
  };
}

function makeToolDispatchCtx(executorFn: ReturnType<typeof vi.fn>): ToolDispatchContext {
  return {
    agent: makeAgent(),
    tools: [{ id: 'echo', slug: 'echo', name: 'echo', riskTier: 'low' }],
    mcpManager: { getSession: () => undefined } as unknown as McpSessionManager,
    nativeToolExecutor: executorFn,
  };
}

function makeState(overrides: Record<string, unknown> = {}) {
  return {
    trace: [],
    plan: null,
    taskIndex: 0,
    limits: { maxSteps: 10, maxParallelTasks: 1, timeoutMs: 60_000 },
    runId: 'test-run',
    sessionId: 'test-session',
    halted: false,
    messages: [{ role: 'user' as const, content: 'Hello' }],
    toolDefinitions: [],
    llmOutput: null,
    modelConfig: { provider: 'openai', model: 'gpt-4o', apiKey: 'test-key' },
    totalTokensUsed: 0,
    totalCostUnits: 0,
    stepCount: 0,
    recentToolCalls: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Backpressure-aware NDJSON emitter
// ---------------------------------------------------------------------------

describe('backpressure-aware NDJSON emitter', () => {
  it('waits for drain when stream buffer is full', async () => {
    // Create a stream with a tiny highWaterMark so write() returns false quickly
    const stream = new PassThrough({ highWaterMark: 1 });
    const emitter = createNdjsonEmitter(stream);

    // Consume data to prevent the stream from staying paused
    const chunks: string[] = [];
    stream.on('data', (chunk) => chunks.push(chunk.toString()));

    const event: Output = { type: 'text', content: 'Hello backpressure' };

    // Multiple emissions should work without throwing
    await emitter.emit(event);
    await emitter.emit(event);
    await emitter.emit(event);

    expect(chunks.length).toBeGreaterThanOrEqual(1);
    for (const chunk of chunks) {
      expect(JSON.parse(chunk.trim())).toEqual(event);
    }
  });

  it('skips write when stream is not writable', async () => {
    const stream = new PassThrough();
    stream.end();
    const emitter = createNdjsonEmitter(stream);

    // Should not throw
    await emitter.emit({ type: 'text', content: 'after end' });
    emitter.end();
  });

  it('redacts credential-shaped strings before streaming NDJSON', async () => {
    const stream = new PassThrough();
    const chunks: string[] = [];
    stream.on('data', (chunk) => chunks.push(chunk.toString()));
    const emitter = createNdjsonEmitter(stream);
    const openAiKey = ['sk-proj-', 'abcdefghijklmnopqrstuvwxyz1234567890'].join('');

    await emitter.emit({
      type: 'error',
      message: `Incorrect API key provided: ${openAiKey}`,
    });

    const event = JSON.parse(chunks.join('').trim()) as { message: string };
    expect(event.message).not.toContain(openAiKey);
    expect(event.message).toContain('[REDACTED:OpenAI API Key]');
  });

  it('returns a promise from emit', () => {
    const stream = new PassThrough();
    const emitter = createNdjsonEmitter(stream);
    const result = emitter.emit({ type: 'text', content: 'test' });
    expect(result).toBeInstanceOf(Promise);
    stream.destroy();
  });

  it('noop emitter still returns void (sync)', () => {
    const emitter = createNoopEmitter();
    const result = emitter.emit({ type: 'text', content: 'ignored' });
    expect(result).toBeUndefined();
  });

  it('normal streaming (fast client) has no unnecessary drain waits', async () => {
    const stream = new PassThrough(); // default 16KB highWaterMark
    const chunks: string[] = [];
    stream.on('data', (chunk) => chunks.push(chunk.toString()));

    const emitter = createNdjsonEmitter(stream);

    // Rapid-fire small events — should all complete immediately
    for (let i = 0; i < 100; i++) {
      await emitter.emit({ type: 'text', content: `chunk-${i}` });
    }

    expect(chunks).toHaveLength(100);
  });
});

// ---------------------------------------------------------------------------
// AbortSignal propagation — LLM node
// ---------------------------------------------------------------------------

describe('AbortSignal in llmReasonNode', () => {
  it('short-circuits when signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort('client_disconnect');

    const node = createLlmReasonNode();
    const config = { configurable: { signal: controller.signal } };
    const result = await node(makeState(), config);

    expect(result.halted).toBe(true);
    expect(result.trace).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'stream_aborted', reason: 'client_disconnect' }),
      ]),
    );
    // streamText should NOT have been called
    expect(mockStreamText).not.toHaveBeenCalled();
  });

  it('passes abortSignal to streamText when signal is provided', async () => {
    const controller = new AbortController();

    mockStreamText.mockReturnValueOnce(
      mockStreamResult({
        textChunks: ['ok'],
        usage: { promptTokens: 5, completionTokens: 3 },
      }),
    );

    const node = createLlmReasonNode();
    const config = { configurable: { signal: controller.signal } };
    await node(makeState(), config);

    expect(mockStreamText).toHaveBeenCalledWith(
      expect.objectContaining({
        abortSignal: controller.signal,
      }),
    );
  });

  it('works normally without signal (backwards compatible)', async () => {
    mockStreamText.mockReturnValueOnce(
      mockStreamResult({
        textChunks: ['Hello'],
        usage: { promptTokens: 5, completionTokens: 3 },
      }),
    );

    const node = createLlmReasonNode();
    const result = await node(makeState());

    expect(result.llmOutput).toEqual({ kind: 'text', content: 'Hello' });
    expect(result.halted).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// AbortSignal propagation — tool dispatch node
// ---------------------------------------------------------------------------

describe('AbortSignal in toolDispatchNode', () => {
  it('skips remaining tool calls when signal is aborted', async () => {
    const controller = new AbortController();
    const executorFn = vi.fn().mockResolvedValue({
      type: 'tool_result',
      toolId: 'echo',
      data: 'ok',
    });

    const node = createToolDispatchNode(makeToolDispatchCtx(executorFn));

    // Abort after first call
    executorFn.mockImplementationOnce(async () => {
      controller.abort('client_disconnect');
      return { type: 'tool_result', toolId: 'echo', data: 'first' };
    });

    const state = makeState({
      llmOutput: {
        kind: 'tool_calls',
        calls: [
          { id: 'tc-1', name: 'echo', args: { text: 'first' } },
          { id: 'tc-2', name: 'echo', args: { text: 'second' } },
        ],
      },
    });

    const config = { configurable: { signal: controller.signal } };
    const result = await node(state as unknown as HarnessStateType, config);

    // Only first tool should have been dispatched
    expect(result.messages).toHaveLength(1);
    expect(result.messages![0]).toMatchObject({ toolCallId: 'tc-1' });
  });

  it('works normally without signal (backwards compatible)', async () => {
    const executorFn = vi.fn().mockResolvedValue({
      type: 'tool_result',
      toolId: 'echo',
      data: 'ok',
    });

    const node = createToolDispatchNode(makeToolDispatchCtx(executorFn));
    const state = makeState({
      llmOutput: {
        kind: 'tool_calls',
        calls: [{ id: 'tc-1', name: 'echo', args: {} }],
      },
    });

    const result = await node(state as unknown as HarnessStateType);
    expect(result.messages).toHaveLength(1);
  });
});
