import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startGitDeliveryProvider } from './model-provider.mjs';

const model = 'git-delivery-self-test';
const call = {
  kind: 'tool',
  id: 'stage-1',
  name: 'sys_git_stage',
  args: { mode: 'stage', paths: ['quoted " and\nline.txt'] },
};
const body = () => ({
  model,
  stream: true,
  messages: [{ role: 'user', content: 'Synthetic delivery' }],
  tools: [{ type: 'function', function: { name: call.name } }],
});
const post = (fixture, input) =>
  globalThis.fetch(`${fixture.baseURL}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });

test('streams fragmented arguments then requires actual tool result before continuation', async (t) => {
  const fixture = await startGitDeliveryProvider({
    model,
    replies: [call, { kind: 'text', text: 'Result recorded.', requiredToolResults: [call.id] }],
  });
  t.after(() => fixture.close());
  const response = await post(fixture, body());
  assert.equal(response.status, 200);
  const chunks = (await response.text())
    .split('\n\n')
    .filter((line) => line.startsWith('data: {'))
    .map((line) => JSON.parse(line.slice(6)));
  const argumentsText = chunks
    .flatMap((chunk) => chunk.choices[0].delta.tool_calls ?? [])
    .map((entry) => entry.function.arguments ?? '')
    .join('');
  assert.deepEqual(JSON.parse(argumentsText), call.args);
  assert.equal(chunks.at(-1).choices[0].finish_reason, 'tool_calls');
  assert.equal((await post(fixture, body())).status, 400);
  const resumed = body();
  resumed.messages.push({ role: 'tool', tool_call_id: call.id, content: '{"state":"succeeded"}' });
  assert.match(await (await post(fixture, resumed)).text(), /Result recorded/);
  assert.equal(fixture.requests.length, 2);
  assert.equal((await post(fixture, resumed)).status, 400);
});

test('rejects absent tool, wrong model and nonstream requests without consuming script', async (t) => {
  const fixture = await startGitDeliveryProvider({ model, replies: [call] });
  t.after(() => fixture.close());
  for (const input of [
    { ...body(), tools: [] },
    { ...body(), model: 'other' },
    { ...body(), stream: false },
  ]) {
    assert.equal((await post(fixture, input)).status, 400);
  }
  assert.equal(fixture.requests.length, 0);
  assert.equal((await post(fixture, body())).status, 200);
  assert.equal(fixture.errors.length, 3);
});

test('bounds request size and owns a loopback listener with explicit cleanup', async () => {
  const fixture = await startGitDeliveryProvider({ model, replies: [call] });
  try {
    assert.match(fixture.baseURL, /^http:\/\/127\.0\.0\.1:/);
    assert.equal((await post(fixture, { ...body(), padding: 'x'.repeat(512_000) })).status, 400);
    assert.equal(fixture.requests.length, 0);
    assert.equal((await globalThis.fetch(fixture.baseURL)).status, 400);
  } finally {
    await fixture.close();
  }
  await assert.rejects(globalThis.fetch(fixture.baseURL));
});

test('streams distinct fragmented tool calls and requires every abandoned or completed result', async (t) => {
  const second = {
    ...call,
    id: 'commit-1',
    name: 'sys_git_commit',
    args: { message: 'Reviewed later' },
  };
  const fixture = await startGitDeliveryProvider({
    model,
    replies: [
      { kind: 'tools', calls: [call, second] },
      { kind: 'text', text: 'Batch accounted for.', requiredToolResults: [call.id, second.id] },
    ],
  });
  t.after(() => fixture.close());
  const input = body();
  input.tools.push({ type: 'function', function: { name: second.name } });
  const response = await post(fixture, input);
  assert.equal(response.status, 200);
  const chunks = (await response.text())
    .split('\n\n')
    .filter((line) => line.startsWith('data: {'))
    .map((line) => JSON.parse(line.slice(6)));
  const argumentsByIndex = new Map();
  for (const entry of chunks.flatMap((chunk) => chunk.choices[0].delta.tool_calls ?? []))
    argumentsByIndex.set(
      entry.index,
      (argumentsByIndex.get(entry.index) ?? '') + (entry.function.arguments ?? ''),
    );
  assert.deepEqual(
    [...argumentsByIndex.values()].map((value) => JSON.parse(value)),
    [call.args, second.args],
  );
  input.messages.push({ role: 'tool', tool_call_id: call.id, content: 'completed' });
  assert.equal((await post(fixture, input)).status, 400);
  input.messages.push({ role: 'tool', tool_call_id: second.id, content: 'not executed' });
  assert.match(await (await post(fixture, input)).text(), /Batch accounted for/);
});
