import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { streamChat } from '../src/streamChat.js';
import { generateText, jsonSchema, streamText } from 'ai';
import {
  createLanguageModel,
  providerGenerationOptions,
  type SupportedProvider,
} from '../src/providers.js';
import { testModelConnection } from '../src/testConnection.js';
import { normalizeProviderEndpoint } from '../src/providerEndpoint.js';
import { ProviderRequestError, toProviderRequestError } from '../src/providerErrors.js';
import { installSafeProviderWarningLogger } from '../src/providerWarnings.js';

type RequestRecord = {
  path: string;
  body: Record<string, unknown>;
  headers: IncomingMessage['headers'];
};
const servers: ReturnType<typeof createServer>[] = [];
afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          server.closeAllConnections();
          server.close(() => resolve());
        }),
    ),
  );
});
async function fixture(handler: (request: RequestRecord, response: ServerResponse) => void) {
  const requests: RequestRecord[] = [];
  const server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () => {
      const record = {
        path: request.url ?? '',
        headers: request.headers,
        body: JSON.parse(Buffer.concat(chunks).toString()) as Record<string, unknown>,
      };
      requests.push(record);
      handler(record, response);
    });
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { baseURL: `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`, requests };
}
function reply(response: ServerResponse, value: unknown, status = 200) {
  response.writeHead(status, { 'content-type': 'application/json' });
  response.end(JSON.stringify(value));
}
function chatResponse() {
  return {
    id: 'chat-fixture',
    object: 'chat.completion',
    created: 1,
    model: 'ExactCase',
    choices: [{ index: 0, message: { role: 'assistant', content: 'OK' }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 2, completion_tokens: 1, total_tokens: 3 },
  };
}
function responsesResponse() {
  return {
    id: 'resp_fixture',
    object: 'response',
    created_at: 1,
    model: 'ExactCase',
    status: 'completed',
    output: [
      {
        id: 'msg_fixture',
        type: 'message',
        status: 'completed',
        role: 'assistant',
        content: [{ type: 'output_text', text: 'OK', annotations: [], logprobs: [] }],
      },
    ],
    usage: {
      input_tokens: 2,
      output_tokens: 1,
      total_tokens: 3,
      input_tokens_details: { cached_tokens: 0 },
      output_tokens_details: { reasoning_tokens: 0 },
    },
  };
}
const cases: { provider: SupportedProvider; path: string; response: () => unknown }[] = [
  { provider: 'openai', path: '/v1/responses', response: responsesResponse },
  { provider: 'xai', path: '/v1/responses', response: responsesResponse },
  {
    provider: 'anthropic',
    path: '/v1/messages',
    response: () => ({
      id: 'msg_fixture',
      type: 'message',
      role: 'assistant',
      model: 'ExactCase',
      content: [{ type: 'text', text: 'OK' }],
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: { input_tokens: 2, output_tokens: 1 },
    }),
  },
  {
    provider: 'google',
    path: '/v1/models/ExactCase:generateContent',
    response: () => ({
      candidates: [{ content: { role: 'model', parts: [{ text: 'OK' }] }, finishReason: 'STOP' }],
      usageMetadata: { promptTokenCount: 2, candidatesTokenCount: 1, totalTokenCount: 3 },
    }),
  },
  ...(['deepseek', 'openrouter', 'ollama', 'openai-compatible'] as const).map((provider) => ({
    provider,
    path: '/v1/chat/completions',
    response: chatResponse,
  })),
];

describe('maintained SDK adapters against real loopback HTTP protocols', () => {
  it.each(cases)(
    '$provider uses its native wire shape and parses a completed response',
    async ({ provider, path, response }) => {
      const service = await fixture((_, res) => reply(res, response()));
      const config = {
        provider,
        model: 'ExactCase',
        apiKey: 'fixture-key',
        baseURL: service.baseURL,
      };
      const result = await generateText({
        model: createLanguageModel(config),
        messages: [{ role: 'user', content: 'Hi' }],
        maxOutputTokens: 32,
        maxRetries: 0,
        ...providerGenerationOptions(config),
      });
      expect(result.text).toBe('OK');
      expect(result.usage.inputTokens).toBe(2);
      expect(result.usage.outputTokens).toBe(1);
      expect(service.requests).toHaveLength(1);
      const sent = service.requests[0]!;
      expect(sent.path).toBe(path);
      expect(sent.body.model ?? (provider === 'google' ? 'ExactCase' : undefined)).toBe(
        'ExactCase',
      );
      if (provider === 'openai' || provider === 'xai') {
        expect(sent.body.max_output_tokens).toBe(32);
        expect(sent.body.store).toBe(false);
        expect(sent.body).not.toHaveProperty('max_tokens');
        expect(sent.body).not.toHaveProperty('temperature');
        expect(sent.body).not.toHaveProperty('previous_response_id');
        expect(sent.body.include).toContain('reasoning.encrypted_content');
      } else if (provider === 'google') {
        expect(sent.body.generationConfig).toMatchObject({ maxOutputTokens: 32 });
        expect(sent.headers['x-goog-api-key']).toBe('fixture-key');
      } else if (provider === 'anthropic') {
        expect(sent.body.max_tokens).toBe(32);
        expect(sent.headers['x-api-key']).toBe('fixture-key');
      } else {
        expect(sent.body.messages).toEqual([{ role: 'user', content: 'Hi' }]);
        expect(sent.headers.authorization).toBe('Bearer fixture-key');
      }
    },
  );

  it.each(cases)(
    '$provider parses native tool calls and emits its SDK tool declaration',
    async ({ provider, response }) => {
      const native = response() as Record<string, unknown>;
      if (provider === 'openai' || provider === 'xai')
        native.output = [
          {
            id: 'fc_fixture',
            type: 'function_call',
            call_id: 'call_fixture',
            name: 'read',
            arguments: '{"path":"note.txt"}',
          },
        ];
      else if (provider === 'anthropic') {
        native.content = [
          { type: 'tool_use', id: 'call_fixture', name: 'read', input: { path: 'note.txt' } },
        ];
        native.stop_reason = 'tool_use';
      } else if (provider === 'google')
        native.candidates = [
          {
            content: {
              role: 'model',
              parts: [
                {
                  functionCall: { name: 'read', args: { path: 'note.txt' } },
                  thoughtSignature: 'fixture-signature',
                },
              ],
            },
            finishReason: 'STOP',
          },
        ];
      else
        native.choices = [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: null,
              tool_calls: [
                {
                  id: 'call_fixture',
                  type: 'function',
                  function: { name: 'read', arguments: '{"path":"note.txt"}' },
                },
              ],
            },
            finish_reason: 'tool_calls',
          },
        ];
      const service = await fixture((_, res) => reply(res, native));
      const config = {
        provider,
        model: 'ExactCase',
        apiKey: 'fixture-key',
        baseURL: service.baseURL,
      };
      const result = await generateText({
        model: createLanguageModel(config),
        messages: [{ role: 'user', content: 'Read' }],
        tools: {
          read: {
            inputSchema: jsonSchema({
              type: 'object',
              properties: { path: { type: 'string' } },
              required: ['path'],
            }),
          },
        },
        maxRetries: 0,
        ...providerGenerationOptions(config),
      });
      expect(result.toolCalls).toMatchObject([{ toolName: 'read', input: { path: 'note.txt' } }]);
      if (provider !== 'google') expect(result.toolCalls[0]?.toolCallId).toBe('call_fixture');
      expect(service.requests).toHaveLength(1);
      expect(JSON.stringify(service.requests[0]?.body.tools)).toContain('read');
      if (provider === 'google')
        expect(JSON.stringify(result.response.messages)).toContain('fixture-signature');
    },
  );

  it.each(cases)('$provider decodes its native SSE text and token usage', async ({ provider }) => {
    const service = await fixture((_, res) => {
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      const send = (value: unknown) => res.write(`data: ${JSON.stringify(value)}\n\n`);
      if (provider === 'openai' || provider === 'xai') {
        const complete = responsesResponse();
        send({ type: 'response.created', response: { ...complete, output: [] } });
        const item = {
          id: 'msg_fixture',
          type: 'message',
          status: 'in_progress',
          role: 'assistant',
          content: [],
        };
        send({ type: 'response.output_item.added', output_index: 0, item });
        send({
          type: 'response.content_part.added',
          item_id: 'msg_fixture',
          output_index: 0,
          content_index: 0,
          part: { type: 'output_text', text: '', annotations: [], logprobs: [] },
        });
        send({
          type: 'response.output_text.delta',
          item_id: 'msg_fixture',
          output_index: 0,
          content_index: 0,
          delta: 'O',
        });
        send({
          type: 'response.output_text.delta',
          item_id: 'msg_fixture',
          output_index: 0,
          content_index: 0,
          delta: 'K',
        });
        send({
          type: 'response.output_text.done',
          item_id: 'msg_fixture',
          output_index: 0,
          content_index: 0,
          text: 'OK',
        });
        send({ type: 'response.output_item.done', output_index: 0, item: complete.output[0] });
        send({ type: 'response.completed', response: complete });
      } else if (provider === 'anthropic') {
        send({
          type: 'message_start',
          message: {
            id: 'msg_fixture',
            type: 'message',
            role: 'assistant',
            model: 'ExactCase',
            content: [],
            usage: { input_tokens: 2, output_tokens: 0 },
          },
        });
        send({ type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } });
        send({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'OK' } });
        send({ type: 'content_block_stop', index: 0 });
        send({
          type: 'message_delta',
          delta: { stop_reason: 'end_turn', stop_sequence: null },
          usage: { output_tokens: 1 },
        });
        send({ type: 'message_stop' });
      } else if (provider === 'google') {
        send({
          candidates: [
            { content: { role: 'model', parts: [{ text: 'OK' }] }, finishReason: 'STOP' },
          ],
          usageMetadata: { promptTokenCount: 2, candidatesTokenCount: 1, totalTokenCount: 3 },
        });
      } else {
        send({
          id: 'chat_fixture',
          created: 1,
          model: 'ExactCase',
          choices: [{ index: 0, delta: { role: 'assistant', content: 'OK' }, finish_reason: null }],
        });
        send({
          id: 'chat_fixture',
          created: 1,
          model: 'ExactCase',
          choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
          usage: { prompt_tokens: 2, completion_tokens: 1, total_tokens: 3 },
        });
        res.write('data: [DONE]\n\n');
      }
      res.end();
    });
    const config = {
      provider,
      model: 'ExactCase',
      apiKey: 'fixture-key',
      baseURL: service.baseURL,
    };
    const result = streamText({
      model: createLanguageModel(config),
      messages: [{ role: 'user', content: 'Hi' }],
      maxRetries: 0,
      ...providerGenerationOptions(config),
    });
    const parts = [];
    for await (const part of result.fullStream) parts.push(part);
    expect(parts.filter((part) => part.type === 'error')).toEqual([]);
    expect(
      parts
        .filter((part) => part.type === 'text-delta')
        .map((part) => part.text)
        .join(''),
    ).toBe('OK');
    expect(await result.usage).toMatchObject({ inputTokens: 2, outputTokens: 1 });
    expect(service.requests).toHaveLength(1);
    if (provider === 'google')
      expect(service.requests[0]?.path).toBe('/v1/models/ExactCase:streamGenerateContent?alt=sse');
    else expect(service.requests[0]?.body.stream).toBe(true);
  });

  it.each(['openai', 'xai'] as const)(
    '%s replays empty-summary encrypted reasoning and tool output without server storage',
    async (provider) => {
      let count = 0;
      const service = await fixture((_, res) => {
        const output =
          count++ === 0
            ? [
                {
                  id: 'rs_fixture',
                  type: 'reasoning',
                  status: 'completed',
                  summary: [],
                  encrypted_content: 'PRIVATE_ENCRYPTED_REASONING',
                },
                {
                  id: 'fc_fixture',
                  type: 'function_call',
                  name: 'read',
                  call_id: 'call_fixture',
                  arguments: '{"path":"note.txt"}',
                },
              ]
            : responsesResponse().output;
        reply(res, { ...responsesResponse(), output });
      });
      const config = {
        provider,
        model: provider === 'xai' ? 'grok-4.7' : 'gpt-6.1-sol',
        apiKey: 'fixture-key',
        baseURL: service.baseURL,
      };
      const model = createLanguageModel(config);
      const tools = {
        read: {
          inputSchema: jsonSchema({
            type: 'object',
            properties: { path: { type: 'string' } },
            required: ['path'],
          }),
        },
      };
      const first = await generateText({
        model,
        messages: [{ role: 'user', content: 'Read' }],
        tools,
        maxRetries: 0,
        ...providerGenerationOptions(config),
      });
      const restored = JSON.parse(
        JSON.stringify(first.response.messages),
      ) as typeof first.response.messages;
      expect(JSON.stringify(restored)).toContain('PRIVATE_ENCRYPTED_REASONING');
      const second = await generateText({
        model,
        messages: [
          { role: 'user', content: 'Read' },
          ...restored,
          {
            role: 'tool',
            content: [
              {
                type: 'tool-result',
                toolCallId: 'call_fixture',
                toolName: 'read',
                output: { type: 'text', value: 'fixture-result' },
              },
            ],
          },
        ],
        tools,
        maxRetries: 0,
        ...providerGenerationOptions(config),
      });
      expect(second.text).toBe('OK');
      expect(service.requests).toHaveLength(2);
      const sent = service.requests[1]!.body;
      expect(sent.store).toBe(false);
      expect(sent).not.toHaveProperty('previous_response_id');
      expect(sent.input).toContainEqual(
        expect.objectContaining({
          type: 'reasoning',
          encrypted_content: 'PRIVATE_ENCRYPTED_REASONING',
        }),
      );
      expect(sent.input).toContainEqual(
        expect.objectContaining({ type: 'function_call', call_id: 'call_fixture', name: 'read' }),
      );
      expect(sent.input).toContainEqual(
        expect.objectContaining({
          type: 'function_call_output',
          call_id: 'call_fixture',
          output: 'fixture-result',
        }),
      );
    },
  );

  it('Anthropic preserves signed thinking through SDK response messages and a tool result', async () => {
    let count = 0;
    const service = await fixture((_, res) => {
      const first = count++ === 0;
      reply(res, {
        id: 'msg_fixture',
        type: 'message',
        role: 'assistant',
        model: 'ExactCase',
        content: first
          ? [
              { type: 'thinking', thinking: 'PRIVATE_THINKING', signature: 'PRIVATE_SIGNATURE' },
              { type: 'tool_use', id: 'call_fixture', name: 'read', input: { path: 'note.txt' } },
            ]
          : [{ type: 'text', text: 'OK' }],
        stop_reason: first ? 'tool_use' : 'end_turn',
        stop_sequence: null,
        usage: { input_tokens: 2, output_tokens: 1 },
      });
    });
    const model = createLanguageModel({
      provider: 'anthropic',
      model: 'ExactCase',
      apiKey: 'fixture-key',
      baseURL: service.baseURL,
    });
    const tools = {
      read: {
        inputSchema: jsonSchema({
          type: 'object',
          properties: { path: { type: 'string' } },
          required: ['path'],
        }),
      },
    };
    const first = await generateText({
      model,
      messages: [{ role: 'user', content: 'Read' }],
      tools,
      maxRetries: 0,
    });
    const restored = JSON.parse(
      JSON.stringify(first.response.messages),
    ) as typeof first.response.messages;
    expect(JSON.stringify(restored)).toContain('PRIVATE_SIGNATURE');
    const second = await generateText({
      model,
      messages: [
        { role: 'user', content: 'Read' },
        ...restored,
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: 'call_fixture',
              toolName: 'read',
              output: { type: 'text', value: 'fixture-result' },
            },
          ],
        },
      ],
      tools,
      maxRetries: 0,
    });
    expect(second.text).toBe('OK');
    expect(service.requests).toHaveLength(2);
    const messages = service.requests[1]!.body.messages as { role: string; content: unknown }[];
    expect(messages.find((message) => message.role === 'assistant')?.content).toContainEqual({
      type: 'thinking',
      thinking: 'PRIVATE_THINKING',
      signature: 'PRIVATE_SIGNATURE',
    });
  });

  it('Google preserves function-call thought signatures through SDK response messages', async () => {
    let count = 0;
    const service = await fixture((_, res) =>
      reply(res, {
        candidates: [
          {
            content: {
              role: 'model',
              parts:
                count++ === 0
                  ? [
                      {
                        functionCall: { name: 'read', args: { path: 'note.txt' } },
                        thoughtSignature: 'PRIVATE_SIGNATURE',
                      },
                    ]
                  : [{ text: 'OK' }],
            },
            finishReason: 'STOP',
          },
        ],
        usageMetadata: { promptTokenCount: 2, candidatesTokenCount: 1, totalTokenCount: 3 },
      }),
    );
    const model = createLanguageModel({
      provider: 'google',
      model: 'ExactCase',
      apiKey: 'fixture-key',
      baseURL: service.baseURL,
    });
    const tools = {
      read: {
        inputSchema: jsonSchema({
          type: 'object',
          properties: { path: { type: 'string' } },
          required: ['path'],
        }),
      },
    };
    const first = await generateText({
      model,
      messages: [{ role: 'user', content: 'Read' }],
      tools,
      maxRetries: 0,
    });
    const restored = JSON.parse(
      JSON.stringify(first.response.messages),
    ) as typeof first.response.messages;
    expect(JSON.stringify(restored)).toContain('PRIVATE_SIGNATURE');
    const call = first.toolCalls[0]!;
    const second = await generateText({
      model,
      messages: [
        { role: 'user', content: 'Read' },
        ...restored,
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: call.toolCallId,
              toolName: call.toolName,
              output: { type: 'text', value: 'fixture-result' },
            },
          ],
        },
      ],
      tools,
      maxRetries: 0,
    });
    expect(second.text).toBe('OK');
    expect(service.requests).toHaveLength(2);
    const contents = service.requests[1]!.body.contents as { role: string; parts: unknown[] }[];
    expect(contents.find((content) => content.role === 'model')?.parts).toContainEqual({
      functionCall: { id: call.toolCallId, name: 'read', args: { path: 'note.txt' } },
      thoughtSignature: 'PRIVATE_SIGNATURE',
    });
  });

  it.each([
    { provider: 'openai', model: 'gpt-6.1-sol' },
    { provider: 'anthropic', model: 'claude-sonnet-5-5' },
    { provider: 'google', model: 'gemini-4-argon' },
    { provider: 'deepseek', model: 'deepseek-v4.1-flash' },
    { provider: 'xai', model: 'grok-4.7' },
  ] as const)(
    '$provider current representative $model uses the maintained capability branch',
    async ({ provider, model }) => {
      const definition = cases.find((item) => item.provider === provider)!;
      const service = await fixture((_, res) =>
        reply(res, { ...(definition.response() as object), model }),
      );
      const config = { provider, model, apiKey: 'fixture-key', baseURL: service.baseURL };
      const result = await generateText({
        model: createLanguageModel(config),
        messages: [
          { role: 'user', content: 'Previous' },
          { role: 'assistant', content: 'Previous reply' },
          { role: 'user', content: 'Hi' },
        ],
        maxOutputTokens: 32,
        maxRetries: 0,
        ...providerGenerationOptions(config),
      });
      expect(result.text).toBe('OK');
      expect(service.requests).toHaveLength(1);
      const sent = service.requests[0]!;
      if (provider === 'google')
        expect(sent.path).toBe('/v1/models/gemini-4-argon:generateContent');
      else expect(sent.body.model).toBe(model);
      if (provider === 'deepseek')
        expect(sent.body.messages).toContainEqual({
          role: 'assistant',
          content: 'Previous reply',
          reasoning_content: '',
        });
      if (provider === 'openai' || provider === 'xai') {
        expect(sent.body.store).toBe(false);
        expect(sent.body).not.toHaveProperty('max_tokens');
        expect(sent.body).not.toHaveProperty('temperature');
      }
    },
  );

  it('DeepSeek V4.1 replays reasoning_content through a restored tool turn', async () => {
    let count = 0;
    const service = await fixture((_, res) =>
      reply(
        res,
        count++ === 0
          ? {
              ...chatResponse(),
              model: 'deepseek-v4.1-flash',
              choices: [
                {
                  index: 0,
                  message: {
                    role: 'assistant',
                    content: null,
                    reasoning_content: 'PRIVATE_DEEPSEEK_REASONING',
                    tool_calls: [
                      {
                        id: 'call_fixture',
                        type: 'function',
                        function: { name: 'read', arguments: '{"path":"note.txt"}' },
                      },
                    ],
                  },
                  finish_reason: 'tool_calls',
                },
              ],
            }
          : chatResponse(),
      ),
    );
    const model = createLanguageModel({
      provider: 'deepseek',
      model: 'deepseek-v4.1-flash',
      apiKey: 'fixture-key',
      baseURL: service.baseURL,
    });
    const tools = {
      read: {
        inputSchema: jsonSchema({
          type: 'object',
          properties: { path: { type: 'string' } },
          required: ['path'],
        }),
      },
    };
    const first = await generateText({
      model,
      messages: [{ role: 'user', content: 'Read' }],
      tools,
      maxRetries: 0,
    });
    const restored = JSON.parse(
      JSON.stringify(first.response.messages),
    ) as typeof first.response.messages;
    expect(JSON.stringify(restored)).toContain('PRIVATE_DEEPSEEK_REASONING');
    const second = await generateText({
      model,
      messages: [
        { role: 'user', content: 'Read' },
        ...restored,
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: 'call_fixture',
              toolName: 'read',
              output: { type: 'text', value: 'fixture-result' },
            },
          ],
        },
      ],
      tools,
      maxRetries: 0,
    });
    expect(second.text).toBe('OK');
    expect(service.requests).toHaveLength(2);
    expect(service.requests[1]!.body.messages).toContainEqual(
      expect.objectContaining({
        role: 'assistant',
        reasoning_content: 'PRIVATE_DEEPSEEK_REASONING',
        tool_calls: [
          {
            id: 'call_fixture',
            type: 'function',
            function: { name: 'read', arguments: '{"path":"note.txt"}' },
          },
        ],
      }),
    );
  });

  it.each([
    {
      model: 'anthropic/claude-sonnet-5.5',
      detail: {
        type: 'reasoning.text',
        id: 'reasoning_fixture',
        text: 'PRIVATE_REASONING',
        signature: 'PRIVATE_SIGNATURE',
        format: 'anthropic-claude-v1',
        index: 0,
      },
    },
    {
      model: 'openai/gpt-6.1-sol',
      detail: {
        type: 'reasoning.encrypted',
        id: 'reasoning_fixture',
        data: 'PRIVATE_ENCRYPTED_REASONING',
        format: 'openai-responses-v1',
        index: 0,
      },
    },
  ])(
    'OpenRouter preserves $model signed/encrypted reasoning_details through a restored tool turn',
    async ({ model: modelId, detail }) => {
      let count = 0;
      const service = await fixture((_, res) =>
        reply(
          res,
          count++ === 0
            ? {
                ...chatResponse(),
                model: modelId,
                choices: [
                  {
                    index: 0,
                    message: {
                      role: 'assistant',
                      content: null,
                      reasoning_details: [detail],
                      tool_calls: [
                        {
                          id: 'call_fixture',
                          type: 'function',
                          function: { name: 'read', arguments: '{"path":"note.txt"}' },
                        },
                      ],
                    },
                    finish_reason: 'tool_calls',
                  },
                ],
              }
            : chatResponse(),
        ),
      );
      const model = createLanguageModel({
        provider: 'openrouter',
        model: modelId,
        apiKey: 'fixture-key',
        baseURL: service.baseURL,
      });
      const tools = {
        read: {
          inputSchema: jsonSchema({
            type: 'object',
            properties: { path: { type: 'string' } },
            required: ['path'],
          }),
        },
      };
      const first = await generateText({
        model,
        messages: [{ role: 'user', content: 'Read' }],
        tools,
        maxRetries: 0,
      });
      const restored = JSON.parse(
        JSON.stringify(first.response.messages),
      ) as typeof first.response.messages;
      expect(JSON.stringify(restored)).toContain('PRIVATE_');
      const second = await generateText({
        model,
        messages: [
          { role: 'user', content: 'Read' },
          ...restored,
          {
            role: 'tool',
            content: [
              {
                type: 'tool-result',
                toolCallId: 'call_fixture',
                toolName: 'read',
                output: { type: 'text', value: 'fixture-result' },
              },
            ],
          },
        ],
        tools,
        maxRetries: 0,
      });
      expect(second.text).toBe('OK');
      expect(service.requests).toHaveLength(2);
      expect(service.requests[1]!.body.messages).toContainEqual(
        expect.objectContaining({ role: 'assistant', reasoning_details: [detail] }),
      );
      expect(service.requests[1]!.body.messages).toContainEqual(
        expect.objectContaining({
          role: 'tool',
          tool_call_id: 'call_fixture',
          content: 'fixture-result',
        }),
      );
    },
  );

  it('shared streaming wrapper preserves chronological trusted system messages and returns text', async () => {
    const service = await fixture((_, res) => {
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      res.end(
        `data: ${JSON.stringify({ id: 'chat_fixture', created: 1, model: 'ExactCase', choices: [{ index: 0, delta: { role: 'assistant', content: 'OK' }, finish_reason: 'stop' }] })}\n\ndata: [DONE]\n\n`,
      );
    });
    const messages = [
      { role: 'system', content: 'First trusted instruction' },
      { role: 'user', content: 'First user' },
      { role: 'system', content: 'Later trusted instruction' },
      { role: 'user', content: 'Second user' },
    ] as const;
    const result = streamChat({
      provider: 'ollama',
      model: 'ExactCase',
      baseURL: service.baseURL,
      messages: [...messages],
    });
    let text = '';
    for await (const chunk of result.textStream) text += chunk;
    expect(text).toBe('OK');
    expect(service.requests).toHaveLength(1);
    expect(service.requests[0]!.body.messages).toEqual(messages);
    expect(Object.keys(result)).toEqual(['textStream']);
  });
  it('shared failed stream emits only a fixed category and throws a safe failure without console leakage', async () => {
    const service = await fixture((_, res) =>
      reply(
        res,
        {
          error: {
            message: 'PRIVATE_SECRET PRIVATE_REASONING raw provider body',
            type: 'invalid_request_error',
            code: 'invalid_parameter',
          },
        },
        400,
      ),
    );
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warningLog = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const observed: unknown[] = [];
      const result = streamChat({
        provider: 'openai',
        model: 'gpt-6.1-sol',
        apiKey: 'fixture-key',
        baseURL: service.baseURL,
        messages: [
          { role: 'system', content: 'PRIVATE_SYSTEM_INSTRUCTION' },
          { role: 'user', content: 'PRIVATE_PROMPT' },
        ],
        onProviderError: (event) => observed.push(event),
      });
      let caught: unknown;
      try {
        for await (const chunk of result.textStream) throw new Error(`Unexpected output: ${chunk}`);
      } catch (error) {
        caught = error;
      }
      expect(caught).toBeInstanceOf(ProviderRequestError);
      expect(caught).toMatchObject({ category: 'request', statusCode: 400 });
      expect(observed).toEqual([{ category: 'request' }]);
      expect(service.requests).toHaveLength(1);
      expect(
        JSON.stringify([observed, caught, errorLog.mock.calls, warningLog.mock.calls]) +
          String(caught),
      ).not.toMatch(/PRIVATE_SECRET|PRIVATE_REASONING|PRIVATE_SYSTEM_INSTRUCTION|PRIVATE_PROMPT/);
      expect(errorLog).not.toHaveBeenCalled();
    } finally {
      errorLog.mockRestore();
      warningLog.mockRestore();
    }
  });
  it('shared stream cancellation closes the active HTTP request', async () => {
    let closed = false;
    const service = await fixture((_, res) => {
      res.on('close', () => {
        closed = true;
      });
    });
    const controller = new AbortController();
    const result = streamChat({
      provider: 'openai',
      model: 'gpt-6.1-sol',
      baseURL: service.baseURL,
      messages: [{ role: 'user', content: 'Hi' }],
      abortSignal: controller.signal,
    });
    const read = (async () => {
      for await (const chunk of result.textStream) void chunk;
    })();
    await vi.waitFor(() => expect(service.requests).toHaveLength(1));
    controller.abort();
    await read;
    await vi.waitFor(() => expect(closed).toBe(true));
    expect(service.requests).toHaveLength(1);
  });

  it('parses fragmented compatible SSE text and tool arguments without a custom serializer', async () => {
    const service = await fixture((_, res) => {
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      const delta = (value: unknown, finish: string | null = null) =>
        res.write(
          `data: ${JSON.stringify({ id: 'chat_fixture', created: 1, model: 'ExactCase', choices: [{ index: 0, delta: value, finish_reason: finish }] })}\n\n`,
        );
      delta({ role: 'assistant', content: 'O' });
      delta({ content: 'K' });
      delta({
        tool_calls: [
          {
            index: 0,
            id: 'call_fixture',
            type: 'function',
            function: { name: 'read', arguments: '{"path":' },
          },
        ],
      });
      delta({ tool_calls: [{ index: 0, function: { arguments: '"note.txt"}' } }] });
      delta({}, 'tool_calls');
      res.end('data: [DONE]\n\n');
    });
    const result = streamText({
      model: createLanguageModel({
        provider: 'ollama',
        model: 'ExactCase',
        baseURL: service.baseURL,
      }),
      messages: [{ role: 'user', content: 'Read' }],
      tools: {
        read: {
          inputSchema: jsonSchema({
            type: 'object',
            properties: { path: { type: 'string' } },
            required: ['path'],
          }),
        },
      },
      maxRetries: 0,
    });
    const parts = [];
    for await (const part of result.fullStream) parts.push(part);
    expect(
      parts
        .filter((part) => part.type === 'text-delta')
        .map((part) => part.text)
        .join(''),
    ).toBe('OK');
    expect(await result.toolCalls).toMatchObject([
      { toolCallId: 'call_fixture', toolName: 'read', input: { path: 'note.txt' } },
    ]);
    expect(service.requests).toHaveLength(1);
  });
});

describe('honest bounded probes and safe failures', () => {
  it.each([
    { status: 400, category: 'request' },
    { status: 401, category: 'authentication' },
    { status: 403, category: 'access' },
    { status: 404, category: 'access' },
    { status: 429, category: 'rate_limit' },
    { status: 500, category: 'transport' },
  ])('$status fails exactly once with safe $category', async ({ status, category }) => {
    const service = await fixture((_, res) =>
      reply(
        res,
        {
          error: {
            message: 'PRIVATE_SECRET max_tokens unsupported',
            type: 'invalid_request_error',
            code: 'invalid_parameter',
          },
        },
        status,
      ),
    );
    const result = await testModelConnection({
      provider: 'openai',
      model: 'ExactCase',
      apiKey: 'fixture-key',
      baseURL: service.baseURL,
    });
    expect(result).toMatchObject({ ok: false, category, statusCode: status });
    expect(JSON.stringify(result)).not.toMatch(/PRIVATE_SECRET|max_tokens/);
    expect(service.requests).toHaveLength(1);
  });
  it('OpenRouter HTTP402 reports insufficient credits without a financial retry', async () => {
    const service = await fixture((_, res) =>
      reply(res, { error: { code: 402, message: 'PRIVATE_ACCOUNT_BALANCE' } }, 402),
    );
    const result = await testModelConnection({
      provider: 'openrouter',
      model: 'openai/gpt-6.1-sol',
      apiKey: 'fixture-key',
      baseURL: service.baseURL,
    });
    expect(result).toMatchObject({
      ok: false,
      category: 'quota',
      statusCode: 402,
      retryable: false,
    });
    expect(service.requests).toHaveLength(1);
    expect(JSON.stringify(result)).not.toContain('PRIVATE_ACCOUNT_BALANCE');
  });
  it.each(['invalid key', 'bad\nkey', 'nonascii-é', 'control\u007Fkey'])(
    'malformed credential is rejected before HTTP without exposing it',
    async (apiKey) => {
      const service = await fixture((_, res) => reply(res, responsesResponse()));
      const result = await testModelConnection({
        provider: 'openai',
        model: 'gpt-6.1-sol',
        apiKey,
        baseURL: service.baseURL,
      });
      expect(result).toMatchObject({ ok: false, category: 'authentication', retryable: false });
      expect(service.requests).toHaveLength(0);
      expect(JSON.stringify(result)).not.toContain(apiKey);
    },
  );
  it('distinguishes quota from rate limit', async () => {
    const service = await fixture((_, res) =>
      reply(
        res,
        {
          error: {
            message: 'PRIVATE_SECRET',
            type: 'insufficient_quota',
            code: 'insufficient_quota',
          },
        },
        429,
      ),
    );
    expect(
      await testModelConnection({
        provider: 'openai',
        model: 'ExactCase',
        baseURL: service.baseURL,
      }),
    ).toMatchObject({ ok: false, category: 'quota', retryable: false });
    expect(service.requests).toHaveLength(1);
  });
  it.each(cases)(
    '$provider connection succeeds only for parsed completed output',
    async ({ provider, response }) => {
      const service = await fixture((_, res) => reply(res, response()));
      expect(
        await testModelConnection({
          provider,
          model: 'ExactCase',
          apiKey: 'fixture-key',
          baseURL: service.baseURL,
        }),
      ).toMatchObject({ ok: true });
      expect(service.requests).toHaveLength(1);
    },
  );
  it('malformed HTTP200 and empty output remain failures', async () => {
    const malformed = await fixture((_, res) => reply(res, { text: 'OK' }));
    expect(
      await testModelConnection({
        provider: 'openai',
        model: 'ExactCase',
        baseURL: malformed.baseURL,
      }),
    ).toMatchObject({ ok: false });
    const empty = await fixture((_, res) => reply(res, { ...responsesResponse(), output: [] }));
    expect(
      await testModelConnection({ provider: 'openai', model: 'ExactCase', baseURL: empty.baseURL }),
    ).toMatchObject({ ok: false, category: 'invalid_response' });
    expect(malformed.requests).toHaveLength(1);
    expect(empty.requests).toHaveLength(1);
  });
  it('reports a valid reasoning-only capped response as output-limited, without claiming usable text', async () => {
    const service = await fixture((_, res) =>
      reply(res, {
        ...responsesResponse(),
        status: 'incomplete',
        incomplete_details: { reason: 'max_output_tokens' },
        output: [
          {
            id: 'rs_fixture',
            type: 'reasoning',
            summary: [],
            encrypted_content: 'PRIVATE_REASONING',
          },
        ],
      }),
    );
    const result = await testModelConnection({
      provider: 'openai',
      model: 'gpt-6.1-sol',
      apiKey: 'fixture-key',
      baseURL: service.baseURL,
    });
    expect(result).toMatchObject({
      ok: false,
      category: 'output_limited',
      error: 'Provider accepted the request, but the test output limit prevented a visible reply.',
      retryable: false,
    });
    expect(JSON.stringify(result)).not.toContain('PRIVATE_REASONING');
    expect(service.requests).toHaveLength(1);
    expect(service.requests[0]?.body.max_output_tokens).toBe(32);
  });
  it('accepts a valid output-limited response when visible text was produced', async () => {
    const service = await fixture((_, res) =>
      reply(res, {
        ...responsesResponse(),
        status: 'incomplete',
        incomplete_details: { reason: 'max_output_tokens' },
      }),
    );
    expect(
      await testModelConnection({
        provider: 'openai',
        model: 'gpt-6.1-sol',
        baseURL: service.baseURL,
      }),
    ).toMatchObject({ ok: true });
    expect(service.requests).toHaveLength(1);
  });
  it('deadline and disconnected transport fail without retries', async () => {
    const delayed = await fixture(() => {});
    expect(
      await testModelConnection({
        provider: 'openai',
        model: 'ExactCase',
        baseURL: delayed.baseURL,
        timeoutMs: 50,
      }),
    ).toMatchObject({ ok: false, category: 'timeout' });
    expect(delayed.requests).toHaveLength(1);
    const disconnected = await fixture((_, res) => res.destroy());
    expect(
      await testModelConnection({
        provider: 'openai',
        model: 'ExactCase',
        baseURL: disconnected.baseURL,
      }),
    ).toMatchObject({ ok: false, category: 'transport' });
    expect(disconnected.requests).toHaveLength(1);
  });
  it('rejects redirects without sending saved credentials to another endpoint', async () => {
    const target = await fixture((_, res) => reply(res, responsesResponse()));
    const origin = await fixture((_, res) => {
      res.writeHead(307, { location: `${target.baseURL}/responses` });
      res.end();
    });
    expect(
      await testModelConnection({
        provider: 'openai',
        model: 'ExactCase',
        apiKey: 'PRIVATE_SECRET',
        baseURL: origin.baseURL,
      }),
    ).toMatchObject({ ok: false });
    expect(origin.requests).toHaveLength(1);
    expect(target.requests).toHaveLength(0);
  });
});

describe('endpoint and observation privacy', () => {
  it.each([
    'http://remote.example/v1',
    'ftp://localhost/v1',
    'https://user:secret@example.com',
    'https://example.com/v1?token=secret',
    'https://example.com/#secret',
    'not-url',
  ])('rejects unsafe endpoint %s', (value) =>
    expect(() => normalizeProviderEndpoint(value)).toThrow(),
  );
  it.each([
    'https://example.com/v1',
    'http://localhost:1234/v1',
    'http://127.0.0.1:1234/v1',
    'http://[::1]:1234/v1',
  ])('permits explicit safe endpoint %s', (value) =>
    expect(normalizeProviderEndpoint(value)).toBe(value),
  );
  it('preserves cancellation identity and strips raw error data', () => {
    for (const name of ['AbortError', 'RunStoppedError']) {
      const error = new Error('abort');
      error.name = name;
      expect(toProviderRequestError(error)).toBe(error);
    }
    const error = Object.assign(new Error('PRIVATE_SECRET'), {
      statusCode: 503,
      responseBody: 'PRIVATE_SECRET',
      cause: new Error('PRIVATE_SECRET'),
    });
    const safe = toProviderRequestError(error);
    expect(safe).toBeInstanceOf(ProviderRequestError);
    expect(safe).toMatchObject({ retryable: true, statusCode: 503 });
    expect(safe.message + JSON.stringify(safe)).not.toContain('PRIVATE_SECRET');
  });
  it.each([
    { name: 'AI_TypeValidationError', category: 'invalid_response' },
    { name: 'Error', status: 503, category: 'transport', retryable: true },
    { name: 'Error', statusCode: 501, category: 'transport', retryable: false },
    { name: 'Error', code: 'ECONNRESET', category: 'transport', retryable: true },
    { name: 'Error', code: 'ETIMEDOUT', category: 'timeout', retryable: true },
  ])('keeps structured safe classification: $name $category', (fields) => {
    const error = Object.assign(new Error('PRIVATE_SECRET'), fields);
    const safe = toProviderRequestError(error);
    expect(safe).toMatchObject({ category: fields.category });
    if ('retryable' in fields) expect(safe).toMatchObject({ retryable: fields.retryable });
    expect(safe.message + JSON.stringify(safe)).not.toContain('PRIVATE_SECRET');
  });
  it('does not serialize hostile error getters', () => {
    const error = Object.defineProperty({}, 'statusCode', {
      get() {
        throw new Error('PRIVATE_SECRET');
      },
    });
    expect(toProviderRequestError(error)).toMatchObject({ category: 'unknown' });
  });
  it('warning hook emits fixed categories only and tolerates a broken observer', () => {
    const seen: unknown[] = [];
    installSafeProviderWarningLogger((event) => seen.push(event));
    const hook = globalThis.AI_SDK_LOG_WARNINGS;
    expect(typeof hook).toBe('function');
    if (typeof hook !== 'function') throw new Error('hook unavailable');
    hook({
      warnings: [{ type: 'other', message: 'PRIVATE_SECRET' }],
      model: 'PRIVATE_SECRET',
      provider: 'PRIVATE_SECRET',
    });
    expect(seen).toEqual([{ category: 'other', count: 1 }]);
    installSafeProviderWarningLogger(() => {
      throw new Error('PRIVATE_SECRET');
    });
    expect(() => {
      if (typeof globalThis.AI_SDK_LOG_WARNINGS === 'function')
        globalThis.AI_SDK_LOG_WARNINGS({
          warnings: [{ type: 'other', message: 'PRIVATE_SECRET' }],
        });
    }).not.toThrow();
  });
});
