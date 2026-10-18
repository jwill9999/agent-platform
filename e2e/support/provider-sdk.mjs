import { createServer } from 'node:http';
import { Buffer } from 'node:buffer';
import { URL } from 'node:url';

// Wire shapes are pinned to the researched SDK cohort's providerProtocols.test.ts:
// OpenAI/xAI Responses, Anthropic Messages, Google GenerateContent and Chat Completions.
// This is only an external boundary double; the app, SDK parsers and persistence stay real.
export const SDK_FIXTURE_KEY = 'provider-sdk-synthetic-key';
export const SDK_PRIVATE_MARKER = 'PRIVATE_SDK_REASONING_CANARY';
export const SDK_PROVIDERS = [
  'openai',
  'anthropic',
  'google',
  'deepseek',
  'xai',
  'openrouter',
  'ollama',
  'openai-compatible',
];

function complete(provider, model, text) {
  const usage = {
    input_tokens: 2,
    output_tokens: 1,
    total_tokens: 3,
    input_tokens_details: { cached_tokens: 0 },
    output_tokens_details: { reasoning_tokens: 0 },
  };
  if (['openai', 'xai'].includes(provider))
    return {
      id: 'resp_sdk',
      object: 'response',
      created_at: 1,
      model,
      status: 'completed',
      output: [
        {
          id: 'msg_sdk',
          type: 'message',
          status: 'completed',
          role: 'assistant',
          content: [{ type: 'output_text', text, annotations: [], logprobs: [] }],
        },
      ],
      usage,
    };
  if (provider === 'anthropic')
    return {
      id: 'msg_sdk',
      type: 'message',
      role: 'assistant',
      model,
      content: [{ type: 'text', text }],
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: { input_tokens: 2, output_tokens: 1 },
    };
  if (provider === 'google')
    return {
      candidates: [{ content: { role: 'model', parts: [{ text }] }, finishReason: 'STOP' }],
      usageMetadata: { promptTokenCount: 2, candidatesTokenCount: 1, totalTokenCount: 3 },
    };
  return {
    id: 'chat_sdk',
    object: 'chat.completion',
    created: 1,
    model,
    choices: [{ index: 0, message: { role: 'assistant', content: text }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 2, completion_tokens: 1, total_tokens: 3 },
  };
}
function emitStream(res, provider, model, text) {
  res.writeHead(200, { 'content-type': 'text/event-stream' });
  const send = (value) => res.write(`data: ${JSON.stringify(value)}\n\n`);
  const response = complete(provider, model, text);
  if (['openai', 'xai'].includes(provider)) {
    send({ type: 'response.created', response: { ...response, output: [] } });
    send({
      type: 'response.output_item.added',
      output_index: 0,
      item: {
        id: 'msg_sdk',
        type: 'message',
        status: 'in_progress',
        role: 'assistant',
        content: [],
      },
    });
    send({
      type: 'response.content_part.added',
      item_id: 'msg_sdk',
      output_index: 0,
      content_index: 0,
      part: { type: 'output_text', text: '', annotations: [], logprobs: [] },
    });
    const split = Math.floor(text.length / 2);
    for (const delta of [text.slice(0, split), text.slice(split)])
      send({
        type: 'response.output_text.delta',
        item_id: 'msg_sdk',
        output_index: 0,
        content_index: 0,
        delta,
      });
    send({
      type: 'response.output_text.done',
      item_id: 'msg_sdk',
      output_index: 0,
      content_index: 0,
      text,
    });
    send({ type: 'response.output_item.done', output_index: 0, item: response.output[0] });
    send({ type: 'response.completed', response });
  } else if (provider === 'anthropic') {
    send({
      type: 'message_start',
      message: {
        ...response,
        content: [],
        stop_reason: null,
        usage: { input_tokens: 2, output_tokens: 0 },
      },
    });
    send({ type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } });
    send({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } });
    send({ type: 'content_block_stop', index: 0 });
    send({
      type: 'message_delta',
      delta: { stop_reason: 'end_turn', stop_sequence: null },
      usage: { output_tokens: 1 },
    });
    send({ type: 'message_stop' });
  } else if (provider === 'google') send(response);
  else {
    send({
      id: 'chat_sdk',
      created: 1,
      model,
      choices: [{ index: 0, delta: { role: 'assistant', content: text }, finish_reason: null }],
    });
    send({
      id: 'chat_sdk',
      created: 1,
      model,
      choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
      usage: response.usage,
    });
    res.write('data: [DONE]\n\n');
  }
  res.end();
}
function emitTool(res, provider, model, tool) {
  res.writeHead(200, { 'content-type': 'text/event-stream' });
  const send = (value) => res.write(`data: ${JSON.stringify(value)}\n\n`);
  const reasoning = {
    id: `reason_${tool.id}`,
    type: 'reasoning',
    summary: [{ type: 'summary_text', text: SDK_PRIVATE_MARKER + '_TEXT' }],
    encrypted_content: SDK_PRIVATE_MARKER,
  };
  const call = {
    id: `fc_${tool.id}`,
    type: 'function_call',
    call_id: tool.id,
    name: 'sys_write_file',
    arguments: JSON.stringify({ path: tool.path, content: tool.content }),
    status: 'completed',
  };
  const response = { ...complete(provider, model, ''), output: [reasoning, call] };
  send({ type: 'response.created', response: { ...response, output: [] } });
  send({ type: 'response.output_item.added', output_index: 0, item: reasoning });
  send({
    type: 'response.reasoning_summary_part.added',
    item_id: reasoning.id,
    output_index: 0,
    summary_index: 0,
  });
  send({
    type: 'response.reasoning_summary_text.delta',
    item_id: reasoning.id,
    output_index: 0,
    summary_index: 0,
    delta: SDK_PRIVATE_MARKER + '_TEXT',
  });
  send({
    type: 'response.reasoning_summary_part.done',
    item_id: reasoning.id,
    output_index: 0,
    summary_index: 0,
  });
  send({ type: 'response.output_item.done', output_index: 0, item: reasoning });
  send({
    type: 'response.output_item.added',
    output_index: 1,
    item: { ...call, arguments: '', status: 'in_progress' },
  });
  const middle = Math.floor(call.arguments.length / 2);
  for (const delta of [call.arguments.slice(0, middle), call.arguments.slice(middle)])
    send({
      type: 'response.function_call_arguments.delta',
      item_id: call.id,
      output_index: 1,
      delta,
    });
  send({
    type: 'response.function_call_arguments.done',
    item_id: call.id,
    output_index: 1,
    arguments: call.arguments,
  });
  send({ type: 'response.output_item.done', output_index: 1, item: call });
  send({ type: 'response.completed', response });
  res.end();
}
function credentialMatches(headers, provider) {
  switch (provider) {
    case 'google':
      return headers['x-goog-api-key'] === SDK_FIXTURE_KEY;
    case 'anthropic':
      return headers['x-api-key'] === SDK_FIXTURE_KEY;
    default:
      return headers.authorization === `Bearer ${SDK_FIXTURE_KEY}`;
  }
}

function expectedPath(provider, model, stream) {
  switch (provider) {
    case 'openai':
    case 'xai':
      return '/v1/responses';
    case 'anthropic':
      return '/v1/messages';
    case 'google':
      return `/v1/models/${encodeURIComponent(model)}:${stream ? 'streamGenerateContent?alt=sse' : 'generateContent'}`;
    default:
      return '/v1/chat/completions';
  }
}
function googleModel(segments) {
  return decodeURIComponent(
    segments.join('/').match(/models\/(.*):(?:streamGenerateContent|generateContent)/)?.[1] ?? '',
  );
}
async function parseWireRequest(req) {
  const url = new URL(req.url ?? '', 'http://localhost');
  const [, provider, ...segments] = url.pathname.split('/');
  if (req.method !== 'POST' || !SDK_PROVIDERS.includes(provider))
    throw new Error('Unexpected fixture route');
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (Buffer.byteLength(raw) > 1_000_000) throw new Error('Fixture request bound');
  }
  const body = JSON.parse(raw);
  const path = `/${segments.join('/')}${url.search}`;
  const model = provider === 'google' ? googleModel(segments) : body.model;
  const stream =
    provider === 'google' ? path.includes(':streamGenerateContent?alt=sse') : body.stream === true;
  if (
    typeof model !== 'string' ||
    !model.startsWith('SdkCase') ||
    path !== expectedPath(provider, model, stream)
  )
    throw new Error('Unexpected fixture protocol/model');
  const credentialMatched = credentialMatches(req.headers, provider);
  if (!credentialMatched) throw new Error('Synthetic credential missing or routed incorrectly');
  return { body, path, provider, model, stream, credentialMatched };
}
function continuationState(body, pendingTool) {
  const input = Array.isArray(body.input) ? body.input : [];
  const continuationMatched = input.some(
    (item) => item.type === 'reasoning' && item.encrypted_content === SDK_PRIVATE_MARKER,
  );
  const resumed = Boolean(
    pendingTool &&
    input.some((item) => item.type === 'function_call_output' && item.call_id === pendingTool.id),
  );
  if (resumed && !continuationMatched) throw new Error('Required private continuation missing');
  return { continuationMatched, resumed };
}
function writeJson(res, value, status = 200) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(value));
}
function rejectParameter(res) {
  writeJson(
    res,
    {
      error: {
        message: 'PRIVATE_SDK_ERROR_CANARY Unsupported parameter: max_tokens',
        type: 'invalid_request_error',
        code: 'unsupported_parameter',
      },
    },
    400,
  );
}

export async function startProviderSdkFixture(options = {}) {
  const requests = [];
  const errors = [];
  const tools = [];
  let pendingTool;
  let toolSequence = 0;
  async function handle(req, res) {
    try {
      if (requests.length >= 100) throw new Error('Fixture request count bound');
      const { body, path, provider, model, stream, credentialMatched } =
        await parseWireRequest(req);
      const { continuationMatched, resumed } = continuationState(body, pendingTool);
      if (resumed) pendingTool = undefined;
      const record = {
        provider,
        path,
        model,
        stream,
        credentialMatched,
        continuationMatched,
        resumedTool: Boolean(resumed),
        outputCap:
          body.max_output_tokens ??
          body.max_completion_tokens ??
          body.max_tokens ??
          body.generationConfig?.maxOutputTokens,
        legacyMaxTokens: Object.hasOwn(body, 'max_tokens'),
        ...(Object.hasOwn(body, 'store') ? { store: body.store } : {}),
      };
      requests.push(record);
      options.onRecord?.(record);
      if (model.includes('Rejected')) {
        rejectParameter(res);
        return;
      }
      const text = `SDK ${provider} completed.`;
      if (stream && provider === 'openai' && tools.length && !resumed) {
        pendingTool = { ...tools.shift(), id: `call_sdk_${++toolSequence}` };
        emitTool(res, provider, model, pendingTool);
      } else if (stream) emitStream(res, provider, model, text);
      else writeJson(res, complete(provider, model, text));
    } catch {
      errors.push('Fixture rejected unexpected request');
      options.onError?.('Fixture rejected unexpected request');
      if (!res.headersSent) res.writeHead(400, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: { message: 'Fixture rejected request' } }));
    }
  }
  const server = createServer((req, res) => void handle(req, res));
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return {
    baseURL: `http://127.0.0.1:${server.address().port}`,
    requests,
    errors,
    enqueueTool: (tool) => tools.push(tool),
    close: async () => {
      server.closeAllConnections();
      await new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    },
  };
}
