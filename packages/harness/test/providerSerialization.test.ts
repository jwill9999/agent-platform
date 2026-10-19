import { createServer, type Server } from 'node:http';
import { once } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HarnessStateType } from '../src/graphState.js';
import type { ToolDefinition } from '../src/types.js';

const fixture = vi.hoisted(() => ({ baseURL: '' }));
vi.mock('@agent-platform/model-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@agent-platform/model-router')>();
  return {
    ...actual,
    createLanguageModel: (config: Parameters<typeof actual.createLanguageModel>[0]) => {
      if (!fixture.baseURL.startsWith('http://127.0.0.1:'))
        throw new Error('Local fixture required');
      return actual.createLanguageModel({ ...config, baseURL: fixture.baseURL });
    },
  };
});
import { createLlmReasonNode } from '../src/nodes/llmReason.js';

let server: Server;
let requests: Record<string, unknown>[];
let completion: 'stop' | 'length';
let partialTool: boolean;
beforeEach(async () => {
  requests = [];
  completion = 'stop';
  partialTool = false;
  server = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    requests.push(JSON.parse(Buffer.concat(chunks).toString()) as Record<string, unknown>);
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    const frame = (value: unknown) => res.write(`data: ${JSON.stringify(value)}\n\n`);
    frame({
      type: 'response.created',
      response: { id: 'response-fixture', created_at: 1, model: 'gpt-4o' },
    });
    frame({
      type: 'response.output_item.added',
      output_index: 0,
      item: { type: 'message', id: 'message-one' },
    });
    frame({
      type: 'response.output_text.delta',
      item_id: 'message-one',
      output_index: 0,
      delta: 'partial',
    });
    frame({
      type: 'response.output_item.done',
      output_index: 0,
      item: {
        type: 'message',
        id: 'message-one',
        status: 'completed',
        role: 'assistant',
        content: [{ type: 'output_text', text: 'partial', annotations: [] }],
      },
    });
    if (partialTool) {
      frame({
        type: 'response.output_item.added',
        output_index: 1,
        item: {
          type: 'function_call',
          id: 'function-one',
          call_id: 'call1',
          name: 'test_tool',
          arguments: '',
        },
      });
      frame({
        type: 'response.function_call_arguments.delta',
        item_id: 'function-one',
        output_index: 1,
        delta: '{"value":',
      });
    }
    frame({
      type: completion === 'length' ? 'response.incomplete' : 'response.completed',
      response: {
        incomplete_details: completion === 'length' ? { reason: 'max_output_tokens' } : null,
        usage: { input_tokens: 2, output_tokens: 2 },
      },
    });
    res.end();
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No fixture port');
  fixture.baseURL = `http://127.0.0.1:${address.port}/v1`;
});
afterEach(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});
function state(tools: ToolDefinition[] = []): HarnessStateType {
  return {
    messages: [
      { role: 'system', content: 'required' },
      { role: 'user', content: 'hi' },
    ],
    currentTurnStartIndex: 1,
    contextWindow: { maxInputTokens: 8000, maxOutputTokens: 123, strategy: 'truncate' },
    toolDefinitions: tools,
    modelConfig: { provider: 'openai', model: 'gpt-4o', apiKey: 'fixture-only' },
    taskIndex: 0,
    totalTokensUsed: 0,
    totalCostUnits: 0,
    totalRetries: 0,
    startedAtMs: Date.now(),
    deadlineMs: 60000,
    limits: { maxSteps: 5, maxParallelTasks: 1, timeoutMs: 60000 },
  } as HarnessStateType;
}
describe('installed AI SDK provider serialization', () => {
  it('sends the configured output cap, model and complete strict mapped tools through actual adapter', async () => {
    const result = await createLlmReasonNode()(
      state([
        {
          name: 'test:tool',
          description: 'safe tool',
          parameters: {
            type: 'object',
            properties: { value: { type: 'string' } },
            required: ['value'],
          },
        },
      ]),
    );
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      model: 'gpt-4o',
      max_output_tokens: 123,
      store: false,
      tools: [
        {
          type: 'function',
          name: 'test__tool',
          description: 'safe tool',
          parameters: { additionalProperties: false, required: ['value'] },
        },
      ],
    });
    expect(result.llmOutput).toEqual({ kind: 'text', content: 'partial' });
  });
  it('retains partial text but halts a length-limited response without tool dispatch', async () => {
    completion = 'length';
    const result = await createLlmReasonNode()(state());
    expect(requests).toHaveLength(1);
    expect(result.totalRetries).toBe(0);
    expect(result).toMatchObject({
      contextHalt: { code: 'MODEL_OUTPUT_INCOMPLETE' },
      halted: true,
      llmOutput: null,
      messages: [{ role: 'assistant', content: 'partial' }],
    });
  });
  it('does not dispatch malformed arguments from a length-limited actual provider stream', async () => {
    completion = 'length';
    partialTool = true;
    const result = await createLlmReasonNode()(
      state([
        {
          name: 'test_tool',
          description: 'test',
          parameters: {
            type: 'object',
            properties: { value: { type: 'string' } },
            required: ['value'],
          },
        },
      ]),
    );
    expect(requests).toHaveLength(1);
    expect(result.totalRetries).toBe(0);
    expect(result).toMatchObject({
      contextHalt: { code: 'MODEL_OUTPUT_INCOMPLETE' },
      halted: true,
      llmOutput: null,
      messages: [{ role: 'assistant', content: 'partial' }],
    });
  });
});
