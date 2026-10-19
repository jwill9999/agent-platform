import test from 'node:test';
import { URL } from 'node:url';
import assert from 'node:assert/strict';
import { SDK_FIXTURE_KEY, SDK_PROVIDERS, startProviderSdkFixture } from './provider-sdk.mjs';
const { fetch, AbortSignal } = globalThis;

async function request(service, provider, stream = false, rejected = false) {
  const model = `SdkCase${rejected ? 'Rejected' : ''}-${provider}`;
  const path = ['openai', 'xai'].includes(provider)
    ? 'responses'
    : provider === 'anthropic'
      ? 'messages'
      : provider === 'google'
        ? `models/${model}:${stream ? 'streamGenerateContent?alt=sse' : 'generateContent'}`
        : 'chat/completions';
  const credential =
    provider === 'google'
      ? { 'x-goog-api-key': SDK_FIXTURE_KEY }
      : provider === 'anthropic'
        ? { 'x-api-key': SDK_FIXTURE_KEY }
        : { authorization: `Bearer ${SDK_FIXTURE_KEY}` };
  return fetch(`${service.baseURL}/${provider}/v1/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...credential },
    body: JSON.stringify({ model, stream, max_output_tokens: 5 }),
    signal: AbortSignal.timeout(2000),
  });
}
test('all eight native boundary doubles emit complete JSON and protocol-specific streams and retain safe evidence', async () => {
  const service = await startProviderSdkFixture();
  try {
    for (const provider of SDK_PROVIDERS) {
      assert.equal((await request(service, provider)).status, 200);
      const response = await request(service, provider, true);
      assert.equal(response.status, 200);
      assert.match(response.headers.get('content-type'), /text\/event-stream/);
      const stream = await response.text();
      assert.match(stream, /SDK/);
      if (['openai', 'xai'].includes(provider)) assert.match(stream, /response.completed/);
      if (provider === 'anthropic') assert.match(stream, /message_stop/);
      if (provider === 'google') assert.match(stream, /finishReason/);
    }
    assert.equal(service.requests.length, 16);
    assert.deepEqual(service.errors, []);
    assert.ok(service.requests.every((row) => row.credentialMatched));
    assert.ok(!JSON.stringify(service.requests).includes(SDK_FIXTURE_KEY));
  } finally {
    await service.close();
  }
});
test('fixture records one real rejected-parameter response and rejects unknown routes or credentials', async () => {
  const service = await startProviderSdkFixture();
  try {
    const denied = await request(service, 'openai', false, true);
    assert.equal(denied.status, 400);
    assert.match(await denied.text(), /max_tokens/);
    assert.equal(service.requests.length, 1);
    assert.equal(
      (await fetch(`${service.baseURL}/unknown/v1/responses`, { method: 'POST' })).status,
      400,
    );
    assert.equal(
      (
        await fetch(`${service.baseURL}/openai/v1/responses`, {
          method: 'POST',
          body: JSON.stringify({ model: 'SdkCase-openai' }),
        })
      ).status,
      400,
    );
    assert.equal(service.requests.length, 1);
    assert.equal(service.errors.length, 2);
  } finally {
    await service.close();
  }
});

test('researched native SSE fixtures are accepted by all installed SDK parsers', async () => {
  const { createRequire } = await import('node:module');
  const require = createRequire(
    new URL('../../packages/model-router/package.json', import.meta.url),
  );
  const { streamText } = require('ai');
  const factories = {
    openai: (settings) =>
      require('@ai-sdk/openai').createOpenAI(settings).responses('SdkCase-openai'),
    anthropic: (settings) =>
      require('@ai-sdk/anthropic').createAnthropic(settings)('SdkCase-anthropic'),
    google: (settings) =>
      require('@ai-sdk/google').createGoogleGenerativeAI(settings)('SdkCase-google'),
    deepseek: (settings) =>
      require('@ai-sdk/deepseek').createDeepSeek(settings)('SdkCase-deepseek'),
    xai: (settings) => require('@ai-sdk/xai').createXai(settings).responses('SdkCase-xai'),
    openrouter: (settings) =>
      require('@openrouter/ai-sdk-provider').createOpenRouter(settings).chat('SdkCase-openrouter'),
    ollama: (settings) =>
      require('@ai-sdk/openai-compatible').createOpenAICompatible({ ...settings, name: 'ollama' })(
        'SdkCase-ollama',
      ),
    'openai-compatible': (settings) =>
      require('@ai-sdk/openai-compatible').createOpenAICompatible({
        ...settings,
        name: 'openai-compatible',
      })('SdkCase-openai-compatible'),
  };
  const service = await startProviderSdkFixture();
  try {
    for (const provider of SDK_PROVIDERS) {
      const model = factories[provider]({
        apiKey: SDK_FIXTURE_KEY,
        baseURL: `${service.baseURL}/${provider}/v1`,
      });
      const result = streamText({
        model,
        messages: [{ role: 'user', content: 'Synthetic SDK parser check' }],
        maxRetries: 0,
        maxOutputTokens: 5,
        providerOptions: ['openai', 'xai'].includes(provider)
          ? { [provider]: { store: false, include: ['reasoning.encrypted_content'] } }
          : {},
      });
      const errors = [];
      for await (const part of result.fullStream)
        if (part.type === 'error') errors.push(part.error);
      assert.deepEqual(errors, []);
      assert.equal(await result.text, `SDK ${provider} completed.`);
      assert.equal((await result.usage).inputTokens, 2);
    }
    assert.equal(service.requests.length, 8);
    assert.deepEqual(service.errors, []);
  } finally {
    await service.close();
  }
});

test('actual Responses parser retains opaque reasoning across a fragmented tool call and stateless continuation', async () => {
  const { createRequire } = await import('node:module');
  const require = createRequire(
    new URL('../../packages/model-router/package.json', import.meta.url),
  );
  const { streamText, jsonSchema } = require('ai');
  const { createOpenAI } = require('@ai-sdk/openai');
  const service = await startProviderSdkFixture();
  try {
    service.enqueueTool({ path: 'safe.txt', content: 'Synthetic fixture contents' });
    const options = {
      model: createOpenAI({
        apiKey: SDK_FIXTURE_KEY,
        baseURL: `${service.baseURL}/openai/v1`,
      }).responses('SdkCase-openai'),
      maxRetries: 0,
      providerOptions: { openai: { store: false, include: ['reasoning.encrypted_content'] } },
      tools: {
        sys_write_file: {
          inputSchema: jsonSchema({
            type: 'object',
            properties: { path: { type: 'string' }, content: { type: 'string' } },
            required: ['path', 'content'],
          }),
        },
      },
    };
    const first = streamText({
      ...options,
      messages: [{ role: 'user', content: 'Synthetic write' }],
    });
    const errors = [];
    for await (const part of first.fullStream) if (part.type === 'error') errors.push(part.error);
    assert.deepEqual(errors, []);
    assert.match(JSON.stringify(await first.reasoning), /PRIVATE_SDK_REASONING_CANARY_TEXT/);
    const calls = await first.toolCalls;
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].input, { path: 'safe.txt', content: 'Synthetic fixture contents' });
    const messages = (await first.response).messages;
    assert.match(JSON.stringify(messages), /PRIVATE_SDK_REASONING_CANARY/);
    const second = streamText({
      ...options,
      messages: [
        { role: 'user', content: 'Synthetic write' },
        ...messages,
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: calls[0].toolCallId,
              toolName: 'sys_write_file',
              output: { type: 'json', value: { ok: true } },
            },
          ],
        },
      ],
    });
    for await (const part of second.fullStream) if (part.type === 'error') errors.push(part.error);
    assert.deepEqual(errors, []);
    assert.equal(await second.text, 'SDK openai completed.');
    assert.equal(service.requests[1].resumedTool, true);
    assert.equal(service.requests[1].continuationMatched, true);
    assert.deepEqual(service.errors, []);
  } finally {
    await service.close();
  }
});

test('the exact Docker runner emits two newline-delimited records without Docker or network', async () => {
  const { providerSdkRunnerSource } = await import('./provider-sdk-docker.ts');
  const { spawnSync } = await import('node:child_process');
  const { execPath } = await import('node:process');
  // Run only the generated emit definition; no Docker invocation or HTTP listener.
  const emit = providerSdkRunnerSource().split('process.stdin.resume();')[0];
  const emitTwo = "\nemit({kind:'ready'});emit({kind:'closed'});";
  const actual = spawnSync(execPath, ['--input-type=module', '-e', emit + emitTwo], {
    encoding: 'utf8',
    timeout: 2000,
  });
  assert.equal(actual.status, 0, actual.stderr);
  assert.equal(actual.stdout, '{"kind":"ready"}\n{"kind":"closed"}\n');
  assert.deepEqual(
    actual.stdout
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line).kind),
    ['ready', 'closed'],
  );
  // A double-escaped separator would never deliver readline's ready event.
  const mutant = spawnSync(
    execPath,
    ['--input-type=module', '-e', emit.replaceAll('\\n', '\\\\n') + emitTwo],
    { encoding: 'utf8', timeout: 2000 },
  );
  assert.equal(mutant.status, 0, mutant.stderr);
  assert.equal(mutant.stdout.includes('\n'), false);
  assert.notEqual(mutant.stdout, actual.stdout);
});
