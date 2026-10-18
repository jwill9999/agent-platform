import { randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  openDatabase,
  appendMessageWithContinuation,
  listMessagesWithContinuation,
  type ProviderContinuationRecord,
} from '@agent-platform/db';
import {
  attachProviderContinuation,
  getProviderContinuation,
  projectProviderContinuation,
  validateProviderContinuation,
  validateCapturedProviderText,
  requiresProviderContinuation,
} from '../src/providerContinuation.js';
import { createLlmReasonNode, toCoreMessages } from '../src/nodes/llmReason.js';
import { admitProviderContext } from '../src/providerContext.js';
import { buildHarnessGraph } from '../src/buildGraph.js';
import type { ChatMessage } from '../src/types.js';

const binding = {
  provider: 'openai',
  model: 'ExactCase',
  apiMode: 'responses',
  endpoint: 'http://localhost/v1',
  credentialRevision: 'revision-one',
};
const message: ChatMessage = {
  id: 'assistant-one',
  role: 'assistant',
  content: '',
  toolCalls: [{ id: 'call-one', name: 'mcp:read', args: { path: 'note.txt' } }],
};
const record: ProviderContinuationRecord = {
  version: 1,
  binding,
  responseMessages: [
    {
      role: 'assistant',
      content: [
        {
          type: 'reasoning',
          text: '',
          providerOptions: {
            openai: { itemId: 'reason-one', reasoningEncryptedContent: 'PRIVATE_OPAQUE' },
          },
        },
        {
          type: 'tool-call',
          toolCallId: 'call-one',
          toolName: 'mcp__read',
          input: { path: 'note.txt' },
        },
      ],
    },
  ],
};
const cleanups: (() => Promise<void> | void)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});
function state(overrides: Record<string, unknown> = {}) {
  return {
    trace: [],
    plan: null,
    mode: 'react' as const,
    taskIndex: 0,
    limits: { maxSteps: 5, timeoutMs: 60_000 },
    runId: 'fixture-run',
    sessionId: 'fixture-session',
    halted: false,
    messages: [{ role: 'user' as const, content: 'Read' }],
    toolDefinitions: [
      {
        name: 'mcp:read',
        description: 'Read',
        parameters: {
          type: 'object',
          properties: { path: { type: 'string' } },
          required: ['path'],
        },
      },
    ],
    llmOutput: null,
    modelConfig: { provider: 'openai', model: 'ExactCase', continuationBinding: binding },
    totalTokensUsed: 0,
    totalCostUnits: 0,
    ...overrides,
  };
}
async function service(
  reasoningText = '',
  reasoningOnly = false,
  plain = false,
  omitReasoning = false,
) {
  const requests: Record<string, unknown>[] = [];
  const server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      requests.push(JSON.parse(Buffer.concat(chunks).toString()) as Record<string, unknown>);
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      const emit = (value: unknown) => res.write(`data: ${JSON.stringify(value)}\n\n`);
      emit({
        type: 'response.created',
        response: { id: 'resp-one', created_at: 1, model: 'ExactCase' },
      });
      if (requests.length === 1 && !plain) {
        const reasoning = {
          type: 'reasoning',
          id: 'reason-one',
          summary: reasoningText ? [{ type: 'summary_text', text: reasoningText }] : [],
          encrypted_content: 'PRIVATE_OPAQUE',
        };
        if (!omitReasoning)
          emit({ type: 'response.output_item.added', output_index: 0, item: reasoning });
        if (reasoningText && !omitReasoning)
          emit({
            type: 'response.reasoning_summary_text.delta',
            item_id: 'reason-one',
            output_index: 0,
            summary_index: 0,
            delta: reasoningText,
          });
        if (!omitReasoning)
          emit({ type: 'response.output_item.done', output_index: 0, item: reasoning });
        if (!reasoningOnly) {
          emit({
            type: 'response.output_item.added',
            output_index: omitReasoning ? 0 : 1,
            item: {
              type: 'function_call',
              id: 'fc-one',
              call_id: 'call-one',
              name: 'mcp__read',
              arguments: '',
            },
          });
          emit({
            type: 'response.function_call_arguments.delta',
            output_index: omitReasoning ? 0 : 1,
            item_id: 'fc-one',
            delta: '{"path":"note.txt"}',
          });
          emit({
            type: 'response.output_item.done',
            output_index: omitReasoning ? 0 : 1,
            item: {
              type: 'function_call',
              status: 'completed',
              id: 'fc-one',
              call_id: 'call-one',
              name: 'mcp__read',
              arguments: '{"path":"note.txt"}',
            },
          });
        }
      } else {
        emit({
          type: 'response.output_item.added',
          output_index: 0,
          item: { type: 'message', id: 'message-two', role: 'assistant', content: [] },
        });
        emit({
          type: 'response.output_text.delta',
          item_id: 'message-two',
          output_index: 0,
          content_index: 0,
          delta: 'Done',
        });
        emit({
          type: 'response.output_item.done',
          output_index: 0,
          item: {
            type: 'message',
            status: 'completed',
            id: 'message-two',
            role: 'assistant',
            content: [{ type: 'output_text', text: 'Done', annotations: [] }],
          },
        });
      }
      emit({
        type: 'response.completed',
        response: {
          id: 'resp-one',
          created_at: 1,
          model: 'ExactCase',
          status: 'completed',
          incomplete_details: null,
          usage: {
            input_tokens: 3,
            output_tokens: 2,
            input_tokens_details: { cached_tokens: 0 },
            output_tokens_details: { reasoning_tokens: 0 },
          },
        },
      });
      res.end();
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  cleanups.push(
    () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  );
  return { requests, baseURL: `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1` };
}

describe('private continuation invariants', () => {
  it('distinguishes canonical opaque material from ordinary item identifiers and null optional metadata', () => {
    expect(requiresProviderContinuation(record.responseMessages, binding)).toBe(true);
    const plain = [
      {
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: 'Done',
            providerOptions: {
              openai: { itemId: 'public-item' },
              google: { thoughtSignature: null },
            },
          },
        ],
      },
    ];
    expect(requiresProviderContinuation(plain, binding)).toBe(false);
    const modernGoogle = [
      {
        role: 'assistant',
        content: [{ type: 'tool-call', toolCallId: 'one', toolName: 'read', input: {} }],
      },
    ];
    expect(
      requiresProviderContinuation(modernGoogle, {
        ...binding,
        provider: 'google',
        model: 'gemini-3-pro-preview',
      }),
    ).toBe(true);
    for (const metadata of [
      { signature: '' },
      { redactedData: 42 },
      { reasoning_details: 'malformed' },
      { reasoning_details: [{ type: 'reasoning.encrypted', data: 'PRIVATE' }] },
    ]) {
      expect(
        requiresProviderContinuation(
          [
            {
              role: 'assistant',
              content: [{ type: 'text', text: 'Done', providerOptions: { openrouter: metadata } }],
            },
          ],
          binding,
        ),
      ).toBe(true);
    }
  });
  it('keeps empty reasoning plus opaque data in SDK input but absent from public JSON', () => {
    const internal = attachProviderContinuation(message, record);
    expect(JSON.stringify(internal)).not.toContain('PRIVATE_OPAQUE');
    expect(JSON.stringify(toCoreMessages([internal], binding))).toContain('PRIVATE_OPAQUE');
    expect(() =>
      toCoreMessages([JSON.parse(JSON.stringify(internal)) as ChatMessage], binding),
    ).toThrow('continuation');
    expect(validateProviderContinuation(internal, record)).toMatchObject({ role: 'assistant' });
  });
  it.each(['model', 'provider', 'endpoint', 'apiMode', 'credentialRevision'] as const)(
    'fails pending %s changes, strips foreign completed opaque data',
    (field) => {
      const internal = attachProviderContinuation(message, record);
      const changed = { ...binding, [field]: 'changed' };
      expect(() => projectProviderContinuation(internal, changed, ['call-one'])).toThrow(
        'continuation',
      );
      expect(toCoreMessages([internal], changed)[0]).toMatchObject({
        role: 'assistant',
        content: [{ type: 'tool-call', toolCallId: 'call-one' }],
      });
      expect(JSON.stringify(toCoreMessages([internal], changed))).not.toContain('PRIVATE_OPAQUE');
    },
  );
  it.each([{ toolCallId: 'other' }, { toolName: 'other' }, { input: { path: 'other' } }])(
    'rejects SDK/public tool identity disagreement %j',
    (changed) => {
      const corrupt = structuredClone(record);
      const response = corrupt.responseMessages[0] as { content: Record<string, unknown>[] };
      Object.assign(response.content[1]!, changed);
      expect(() => validateProviderContinuation(message, corrupt)).toThrow('continuation');
    },
  );
  it.each([undefined, '', null, 42])(
    'rejects missing or malformed encrypted reasoning %j',
    (value) => {
      const corrupt = structuredClone(record);
      const assistant = corrupt.responseMessages[0] as { content: { providerOptions?: unknown }[] };
      assistant.content[0]!.providerOptions = {
        openai: { itemId: 'reason-one', reasoningEncryptedContent: value },
      };
      expect(() => validateProviderContinuation(message, corrupt)).toThrow('continuation');
    },
  );
  it('rejects duplicate empty reasoning and mismatched public text before capture', () => {
    const duplicate = structuredClone(record);
    const assistant = duplicate.responseMessages[0] as { content: unknown[] };
    assistant.content.splice(1, 0, structuredClone(assistant.content[0]));
    expect(() => validateProviderContinuation(message, duplicate)).toThrow('continuation');
    expect(() => validateCapturedProviderText({ ...message, content: 'tampered' }, record)).toThrow(
      'continuation',
    );
  });
  it.each([
    { provider: 'anthropic', key: 'signature' },
    { provider: 'google', key: 'thoughtSignature' },
  ])('retains and validates $provider signed reasoning', ({ provider, key }) => {
    const signed = structuredClone(record);
    signed.binding.provider = provider;
    const assistant = signed.responseMessages[0] as { content: { providerOptions?: unknown }[] };
    assistant.content[0]!.providerOptions = { [provider]: { [key]: 'SIGNED_PRIVATE' } };
    expect(JSON.stringify(validateProviderContinuation(message, signed))).toContain(
      'SIGNED_PRIVATE',
    );
    assistant.content[0]!.providerOptions = { [provider]: { [key]: '' } };
    expect(() => validateProviderContinuation(message, signed)).toThrow('continuation');
  });

  it('accounts for opaque bytes before atomic context admission and rejects over-cap records', () => {
    const oversized = structuredClone(record);
    (
      oversized.responseMessages[0] as { content: { providerOptions?: unknown }[] }
    ).content[0]!.providerOptions = {
      openai: { reasoningEncryptedContent: 'x'.repeat(256 * 1024) },
    };
    expect(() => toCoreMessages([attachProviderContinuation(message, oversized)], binding)).toThrow(
      'continuation',
    );
    const internal = attachProviderContinuation(message, record);
    const messages: ChatMessage[] = [
      { role: 'user', content: 'Read' },
      internal,
      { role: 'tool', content: 'OK', toolName: 'mcp:read', toolCallId: 'call-one' },
    ];
    const mappedMessages = toCoreMessages(messages, binding);
    const admitted = admitProviderContext({
      messages,
      mappedMessages,
      mappedTools: [],
      currentTurnStartIndex: 0,
    });
    expect(admitted.admitted).toBe(true);
    expect(JSON.stringify(admitted.messages)).toContain('PRIVATE_OPAQUE');
    expect(admitted.decision.includedGroups).toBe(2);
  });
});

it('uses the real SDK Responses stream, awaits encrypted persistence before tools, and rehydrates a restarted graph', async () => {
  const fixture = await service();
  const dir = mkdtempSync(join(tmpdir(), 'harness-private-'));
  cleanups.push(() => rmSync(dir, { recursive: true, force: true }));
  let opened = openDatabase(join(dir, 'profile.sqlite'));
  cleanups.push(() => opened.sqlite.close());
  opened.sqlite.exec(
    "INSERT INTO agents(id,name,execution_limits_json,created_at_ms,updated_at_ms) VALUES('fixture-agent','Test','{}',1,1); INSERT INTO sessions(id,agent_id,created_at_ms,updated_at_ms) VALUES('fixture-session','fixture-agent',1,1)",
  );
  const key = randomBytes(32);
  const events: string[] = [];
  const modelConfig = {
    provider: 'openai',
    model: 'ExactCase',
    apiKey: 'fixture-key',
    baseURL: fixture.baseURL,
    continuationBinding: { ...binding, endpoint: fixture.baseURL },
  };
  const node = createLlmReasonNode({
    onAssistantMessage: async (assistant) => {
      await Promise.resolve();
      appendMessageWithContinuation(
        opened.db,
        {
          id: assistant.id!,
          sessionId: 'fixture-session',
          role: 'assistant',
          content: assistant.content,
          toolCalls: assistant.role === 'assistant' ? assistant.toolCalls : undefined,
          continuation: getProviderContinuation(assistant),
        },
        key,
        1,
      );
      events.push('persisted');
    },
    hydrateMessages: async (messages) =>
      messages.map((item) => {
        const saved = listMessagesWithContinuation(opened.db, 'fixture-session', key).find(
          (entry) => entry.message.id === item.id,
        );
        return saved?.continuation ? attachProviderContinuation(item, saved.continuation) : item;
      }),
  });
  const effects = vi.fn(async (current) => {
    expect(listMessagesWithContinuation(opened.db, 'fixture-session', key)).toHaveLength(1);
    expect(current.messages.at(-1)?.providerContinuationRequired).toBe(true);
    events.push('approval-wait');
    return { halted: true, llmOutput: null };
  });
  const approvalGraph = buildHarnessGraph({
    executeTool: async () => ({ ok: true }),
    llmReasonNode: node,
    toolDispatchNode: effects,
  });
  const waiting = await approvalGraph.invoke(state({ modelConfig }), {
    configurable: { thread_id: 'approval' },
  });
  expect(effects).toHaveBeenCalledTimes(1);
  const first = {
    messages: [waiting.messages.at(-1)!],
    llmOutput: {
      kind: 'tool_calls',
      calls:
        waiting.messages.at(-1)!.role === 'assistant' ? waiting.messages.at(-1)!.toolCalls : [],
    },
  };
  expect(first.llmOutput).toMatchObject({
    kind: 'tool_calls',
    calls: [{ id: 'call-one', name: 'mcp:read', args: { path: 'note.txt' } }],
  });
  expect(events).toEqual(['persisted', 'approval-wait']);
  const assistant = first.messages![0]!;
  expect(JSON.stringify(getProviderContinuation(assistant))).toContain('PRIVATE_OPAQUE');
  expect(JSON.stringify(assistant)).not.toContain('PRIVATE_OPAQUE');
  opened.sqlite.close();
  opened = openDatabase(join(dir, 'profile.sqlite'));
  const checkpoint = JSON.parse(JSON.stringify(assistant)) as ChatMessage;
  const toolEffect = vi.fn(async () => {
    events.push('tool');
    return {
      messages: [
        { role: 'tool' as const, content: 'OK', toolCallId: 'call-one', toolName: 'mcp:read' },
      ],
    };
  });
  const graph = buildHarnessGraph({
    executeTool: async () => ({ ok: true }),
    llmReasonNode: node,
    toolDispatchNode: toolEffect,
  });
  const result = await graph.invoke(
    state({
      modelConfig,
      messages: [
        { role: 'user', content: 'Read' },
        checkpoint,
        { role: 'tool', content: 'OK', toolCallId: 'call-one', toolName: 'mcp:read' },
      ],
    }),
    { configurable: { thread_id: 'restart' } },
  );
  expect(result.llmOutput).toEqual({ kind: 'text', content: 'Done' });
  expect(fixture.requests).toHaveLength(2);
  expect(JSON.stringify(fixture.requests[1]!.input)).toContain('PRIVATE_OPAQUE');
  expect(
    fixture.requests.every(
      (request) => request.store === false && !('previous_response_id' in request),
    ),
  ).toBe(true);
  expect(toolEffect).not.toHaveBeenCalled();
});

it.each(['binding', 'persistence'] as const)(
  'rejects real SDK opaque output without %s before graph tool effects',
  async (missing) => {
    const fixture = await service();
    const effects = vi.fn(async () => ({}));
    const persist = vi.fn(async () => {});
    const node = createLlmReasonNode(
      missing === 'persistence' ? {} : { onAssistantMessage: persist },
    );
    const graph = buildHarnessGraph({
      executeTool: async () => ({ ok: true }),
      llmReasonNode: node,
      toolDispatchNode: effects,
    });
    await expect(
      graph.invoke(
        state({
          modelConfig: {
            provider: 'openai',
            model: 'ExactCase',
            baseURL: fixture.baseURL,
            ...(missing === 'binding'
              ? {}
              : { continuationBinding: { ...binding, endpoint: fixture.baseURL } }),
          },
        }),
        { configurable: { thread_id: `missing-${missing}` } },
      ),
    ).rejects.toThrow('continuation');
    expect(fixture.requests).toHaveLength(1);
    expect(persist).not.toHaveBeenCalled();
    expect(effects).not.toHaveBeenCalled();
  },
);

it('rejects bound nonthinking SDK tool turns without their durable persistence callback before effects', async () => {
  const fixture = await service('', false, false, true);
  const effects = vi.fn(async () => ({}));
  const graph = buildHarnessGraph({
    executeTool: async () => ({ ok: true }),
    llmReasonNode: createLlmReasonNode(),
    toolDispatchNode: effects,
  });
  await expect(
    graph.invoke(
      state({
        modelConfig: {
          provider: 'openai',
          model: 'ExactCase',
          baseURL: fixture.baseURL,
          continuationBinding: { ...binding, endpoint: fixture.baseURL },
        },
      }),
      { configurable: { thread_id: 'bound-nonthinking' } },
    ),
  ).rejects.toThrow('continuation');
  expect(fixture.requests).toHaveLength(1);
  expect(effects).not.toHaveBeenCalled();
});

it('preserves generic plain SDK text without private binding or persistence', async () => {
  const fixture = await service('', false, true);
  const result = await createLlmReasonNode()(
    state({ modelConfig: { provider: 'openai', model: 'ExactCase', baseURL: fixture.baseURL } }),
  );
  expect(result.llmOutput).toEqual({ kind: 'text', content: 'Done' });
  expect(getProviderContinuation(result.messages![0]!)).toBeUndefined();
  expect(result.messages![0]!.providerContinuationRequired).toBeUndefined();
});

it('fails a real SDK graph before approval/tool admission when the awaited persistence barrier rejects', async () => {
  const fixture = await service();
  const effects = vi.fn(async () => ({}));
  const persist = vi.fn(async () => {
    throw new Error('PROVIDER_CONTINUATION_UNAVAILABLE');
  });
  const node = createLlmReasonNode({ onAssistantMessage: persist });
  const graph = buildHarnessGraph({
    executeTool: async () => ({ ok: true }),
    llmReasonNode: node,
    toolDispatchNode: effects,
  });
  await expect(
    graph.invoke(
      state({
        modelConfig: {
          provider: 'openai',
          model: 'ExactCase',
          baseURL: fixture.baseURL,
          continuationBinding: { ...binding, endpoint: fixture.baseURL },
        },
      }),
      { configurable: { thread_id: 'failed-barrier' } },
    ),
  ).rejects.toThrow('PROVIDER_CONTINUATION_UNAVAILABLE');
  expect(fixture.requests).toHaveLength(1);
  expect(persist).toHaveBeenCalledTimes(1);
  expect(effects).not.toHaveBeenCalled();
});

it('keeps nonempty provider reasoning private and halts a reasoning-only response without a fabricated answer', async () => {
  const fixture = await service('PRIVATE_REASONING_SENTINEL', true);
  const emit = vi.fn();
  const persist = vi.fn(async () => {});
  const result = await createLlmReasonNode({
    emitter: { emit, end() {} },
    onAssistantMessage: persist,
  })(
    state({
      modelConfig: {
        provider: 'openai',
        model: 'ExactCase',
        baseURL: fixture.baseURL,
        continuationBinding: { ...binding, endpoint: fixture.baseURL },
      },
    }),
  );
  expect(result).toMatchObject({
    halted: true,
    llmOutput: null,
    contextHalt: { code: 'MODEL_OUTPUT_INCOMPLETE' },
    messages: [{ role: 'assistant', content: '' }],
  });
  expect(JSON.stringify(emit.mock.calls)).not.toMatch(/PRIVATE_REASONING_SENTINEL|PRIVATE_OPAQUE/);
  expect(JSON.stringify(result)).not.toMatch(/PRIVATE_REASONING_SENTINEL|PRIVATE_OPAQUE/);
  expect(persist).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(getProviderContinuation(result.messages![0]!))).toContain(
    'PRIVATE_REASONING_SENTINEL',
  );
  expect(fixture.requests).toHaveLength(1);
});

async function signedFamilyFixture(
  provider: 'google' | 'openrouter',
  invalid: boolean,
  toolOnly = false,
) {
  const requests: Record<string, unknown>[] = [];
  const server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      requests.push(JSON.parse(Buffer.concat(chunks).toString()) as Record<string, unknown>);
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      const send = (value: unknown) => res.write(`data: ${JSON.stringify(value)}\n\n`);
      if (provider === 'google') {
        const parts =
          requests.length === 1
            ? [
                ...(toolOnly ? [] : [{ thought: true, text: 'PRIVATE_REASONING_SENTINEL' }]),
                {
                  functionCall: { id: 'google-a', name: 'mcp__read', args: { path: 'one' } },
                  ...(invalid ? {} : { thoughtSignature: 'PRIVATE_GOOGLE_SIGNATURE' }),
                },
                { functionCall: { id: 'google-b', name: 'mcp__read', args: { path: 'two' } } },
              ]
            : [{ text: 'Done' }];
        send({
          candidates: [{ content: { role: 'model', parts }, finishReason: 'STOP' }],
          usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 2, totalTokenCount: 5 },
        });
      } else {
        const delta = (value: unknown, finish: string | null = null) =>
          send({
            id: 'router-response',
            model: 'ExactCase',
            created: 1,
            choices: [{ index: 0, delta: value, finish_reason: finish }],
          });
        if (requests.length === 1) {
          delta({
            role: 'assistant',
            reasoning_details: [
              {
                type: 'reasoning.text',
                id: 'router-reason',
                index: 0,
                format: 'anthropic-claude-v1',
                text: 'PRIVATE_REASONING_SENTINEL',
                ...(invalid ? {} : { signature: 'PRIVATE_ROUTER_SIGNATURE' }),
              },
              {
                type: 'reasoning.encrypted',
                id: 'router-encrypted',
                index: 1,
                format: 'openai-responses-v1',
                data: 'PRIVATE_ROUTER_ENCRYPTED',
              },
            ],
          });
          delta({
            tool_calls: [
              {
                index: 0,
                id: 'router-call',
                type: 'function',
                function: { name: 'mcp__read', arguments: '{"path":"one"}' },
              },
            ],
          });
          delta({}, 'tool_calls');
        } else {
          delta({ content: 'Done' });
          delta({}, 'stop');
        }
        res.write('data: [DONE]\n\n');
      }
      res.end();
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  cleanups.push(
    () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  );
  return { requests, baseURL: `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1` };
}

it('rejects unbound modern Google tool-only output missing its required signature before effects', async () => {
  const fixture = await signedFamilyFixture('google', true, true);
  const effects = vi.fn(async () => ({}));
  const graph = buildHarnessGraph({
    executeTool: async () => ({ ok: true }),
    llmReasonNode: createLlmReasonNode(),
    toolDispatchNode: effects,
  });
  await expect(
    graph.invoke(
      state({
        modelConfig: { provider: 'google', model: 'gemini-4-argon', baseURL: fixture.baseURL },
      }),
      { configurable: { thread_id: 'unbound-google' } },
    ),
  ).rejects.toThrow('continuation');
  expect(fixture.requests).toHaveLength(1);
  expect(effects).not.toHaveBeenCalled();
});

it.each(['google', 'openrouter'] as const)(
  'preserves real %s signed tool groups privately across a persistence barrier and rejects missing required signatures',
  async (provider) => {
    const fixture = await signedFamilyFixture(provider, false);
    const modelConfig = {
      provider,
      model: provider === 'google' ? 'gemini-4-argon' : 'ExactCase',
      baseURL: fixture.baseURL,
      continuationBinding: {
        ...binding,
        provider,
        apiMode: provider === 'google' ? 'generate-content' : 'chat-completions',
        model: provider === 'google' ? 'gemini-4-argon' : 'ExactCase',
        endpoint: fixture.baseURL,
      },
    };
    const emit = vi.fn();
    let saved: ChatMessage | undefined;
    let persisted = false;
    const node = createLlmReasonNode({
      emitter: { emit, end() {} },
      onAssistantMessage: async (message) => {
        await Promise.resolve();
        saved = message;
        persisted = true;
      },
    });
    const effect = vi.fn(async () => {
      expect(persisted).toBe(true);
      return { halted: true };
    });
    const graph = buildHarnessGraph({
      executeTool: async () => ({ ok: true }),
      llmReasonNode: node,
      toolDispatchNode: effect,
    });
    const waiting = await graph.invoke(state({ modelConfig }), {
      configurable: { thread_id: provider },
    });
    expect(effect).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(emit.mock.calls)).not.toMatch(
      /PRIVATE_REASONING|PRIVATE_GOOGLE|PRIVATE_ROUTER/,
    );
    const stored = waiting.messages.at(-1)!;
    expect(stored.providerContinuationRequired).toBe(true);
    const first = saved!;
    const privateRecord = getProviderContinuation(first)!;
    expect(JSON.stringify(privateRecord)).toContain(
      provider === 'google' ? 'PRIVATE_GOOGLE_SIGNATURE' : 'PRIVATE_ROUTER_SIGNATURE',
    );
    const results: ChatMessage[] =
      first.role === 'assistant'
        ? first.toolCalls!.map((call) => ({
            role: 'tool',
            toolCallId: call.id,
            toolName: call.name,
            content: 'OK',
          }))
        : [];
    const completed = await node(
      state({ modelConfig, messages: [{ role: 'user', content: 'Read' }, first, ...results] }),
    );
    expect(completed.llmOutput).toEqual({ kind: 'text', content: 'Done' });
    expect(fixture.requests).toHaveLength(2);
    const replay = JSON.stringify(fixture.requests[1]);
    expect(replay).toContain(
      provider === 'google' ? 'PRIVATE_GOOGLE_SIGNATURE' : 'PRIVATE_ROUTER_SIGNATURE',
    );
    expect(replay).not.toContain('skip_thought_signature_validator');
    expect(JSON.stringify(emit.mock.calls)).not.toMatch(
      /PRIVATE_REASONING|PRIVATE_GOOGLE|PRIVATE_ROUTER/,
    );
  },
);

it.each(['google', 'openrouter'] as const)(
  'rejects real %s unsigned required continuation before persistence or tool effects',
  async (provider) => {
    const fixture = await signedFamilyFixture(provider, true);
    const persist = vi.fn(async () => {});
    const effect = vi.fn(async () => ({}));
    const modelConfig = {
      provider,
      model: provider === 'google' ? 'gemini-4-argon' : 'ExactCase',
      baseURL: fixture.baseURL,
      continuationBinding: {
        ...binding,
        provider,
        apiMode: provider === 'google' ? 'generate-content' : 'chat-completions',
        model: provider === 'google' ? 'gemini-4-argon' : 'ExactCase',
        endpoint: fixture.baseURL,
      },
    };
    const graph = buildHarnessGraph({
      executeTool: async () => ({ ok: true }),
      llmReasonNode: createLlmReasonNode({ onAssistantMessage: persist }),
      toolDispatchNode: effect,
    });
    await expect(
      graph.invoke(state({ modelConfig }), { configurable: { thread_id: `${provider}-invalid` } }),
    ).rejects.toThrow('continuation');
    expect(persist).not.toHaveBeenCalled();
    expect(effect).not.toHaveBeenCalled();
    expect(fixture.requests).toHaveLength(1);
  },
);

it.each([
  ['gemini-1.5-pro', false],
  ['gemini-2.5-pro', false],
  ['gemini-pro', false],
  ['gemini-robotics-er-1.5', false],
  ['gemini-3-pro', true],
  ['gemini-4-argon', true],
  ['models/gemini-future-alias', true],
] as const)('matches pinned Google signed-group capability for %s', (model, required) => {
  const native = structuredClone(record);
  native.binding = { ...binding, provider: 'google', model };
  const check = () => validateProviderContinuation(message, native);
  if (required) expect(check).toThrow('continuation');
  else expect(check).not.toThrow();
});

it.each([
  { details: 'malformed' },
  { details: [{ type: 'reasoning.encrypted', id: 'same', data: '' }] },
  {
    details: [
      { type: 'reasoning.text', id: 'same', signature: 'signed' },
      { type: 'reasoning.text', id: 'same', signature: 'other' },
    ],
  },
] as const)('rejects malformed or ambiguous OpenRouter private detail arrays %j', ({ details }) => {
  const native = structuredClone(record);
  native.binding.provider = 'openrouter';
  const response = native.responseMessages[0] as { content: { providerOptions?: unknown }[] };
  response.content[1]!.providerOptions = { openrouter: { reasoning_details: details } };
  expect(() => validateProviderContinuation(message, native)).toThrow('continuation');
});

it('allows native nullable unsigned Google reasoning while requiring its signed function group', () => {
  const native = structuredClone(record);
  native.binding = { ...binding, provider: 'google', model: 'gemini-4-argon' };
  const response = native.responseMessages[0] as { content: { providerOptions?: unknown }[] };
  response.content[0]!.providerOptions = { google: { thoughtSignature: null } };
  response.content[1]!.providerOptions = { google: { thoughtSignature: 'SIGNED_FUNCTION' } };
  expect(() => validateProviderContinuation(message, native)).not.toThrow();
});
