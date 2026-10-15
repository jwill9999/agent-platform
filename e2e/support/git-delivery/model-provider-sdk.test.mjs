import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { URL } from 'node:url';
import { startGitDeliveryProvider } from './model-provider.mjs';
import { createLanguageModel } from '../../../packages/model-router/dist/index.js';

const require = createRequire(
  new URL('../../../packages/model-router/package.json', import.meta.url),
);
const { streamText, jsonSchema } = await import(require.resolve('ai'));

test('installed SDK reconstructs fragmented tool arguments and sends result on continuation', async (t) => {
  const model = 'git-delivery-sdk-test';
  const args = { mode: 'stage', paths: ['quoted " and\nline.txt'] };
  const fixture = await startGitDeliveryProvider({
    model,
    replies: [
      { kind: 'tool', id: 'stage-sdk-1', name: 'sys_git_stage', args },
      { kind: 'text', text: 'Operation recorded.', requiredToolResults: ['stage-sdk-1'] },
    ],
  });
  t.after(() => fixture.close());
  const languageModel = createLanguageModel({
    provider: 'ollama',
    model,
    baseURL: fixture.baseURL,
  });
  const messages = [{ role: 'user', content: 'Stage the selected synthetic file.' }];
  const tools = {
    sys_git_stage: {
      description: 'Synthetic Git action for transport verification only.',
      parameters: jsonSchema({
        type: 'object',
        properties: {
          mode: { type: 'string' },
          paths: { type: 'array', items: { type: 'string' } },
        },
        required: ['mode', 'paths'],
        additionalProperties: false,
      }),
    },
  };
  const first = streamText({ model: languageModel, messages, tools, maxRetries: 0 });
  await first.consumeStream();
  assert.deepEqual(await first.toolCalls, [
    { type: 'tool-call', toolCallId: 'stage-sdk-1', toolName: 'sys_git_stage', args },
  ]);
  assert.equal(await first.finishReason, 'tool-calls');
  const resumed = streamText({
    model: languageModel,
    tools,
    maxRetries: 0,
    messages: [
      ...messages,
      { role: 'assistant', content: await first.toolCalls },
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'stage-sdk-1',
            toolName: 'sys_git_stage',
            result: { state: 'succeeded' },
          },
        ],
      },
    ],
  });
  await resumed.consumeStream();
  assert.equal(await resumed.text, 'Operation recorded.');
  assert.equal(await resumed.finishReason, 'stop');
  assert.deepEqual(fixture.errors, []);
  assert.equal(fixture.requests.length, 2);
});
