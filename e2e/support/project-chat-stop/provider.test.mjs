import { test } from 'node:test';
import { setImmediate } from 'node:timers';
import { TextDecoder } from 'node:util';
const { fetch, AbortController } = globalThis;
import assert from 'node:assert/strict';
import { startStopProvider } from './provider.mjs';

const request = (baseURL, signal) =>
  fetch(`${baseURL}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'stop-unit-fixture', stream: true, messages: [] }),
    signal,
  });

test('Stop provider holds a real partial stream, observes disconnect, and closes owned resources', async () => {
  const fixture = await startStopProvider({ model: 'stop-unit-fixture' });
  try {
    fixture.enqueue({ kind: 'text', text: 'late', partial: 'earlier', hold: true });
    const controller = new AbortController();
    const response = await request(fixture.baseURL, controller.signal);
    const reader = response.body.getReader();
    assert.match(new TextDecoder().decode((await reader.read()).value), /earlier/);
    controller.abort();
    await assert.rejects(reader.read(), { name: 'AbortError' });
    await new Promise((resolve) => setImmediate(resolve));
    fixture.release(0);
    assert.equal(fixture.requests.length, 1);
    assert.equal(fixture.ledger[0].partialSent, true);
    assert.equal(fixture.ledger[0].completed, false);
    assert.deepEqual(fixture.errors, []);
  } finally {
    await fixture.close();
  }
});

test('Stop provider emits tools and genuine HTTP failure without simulating application control', async () => {
  const fixture = await startStopProvider({ model: 'stop-unit-fixture' });
  try {
    fixture.enqueue({
      kind: 'tool',
      name: 'sys_write_file',
      args: { path: 'safe.txt', content: 'safe' },
    });
    assert.match(await (await request(fixture.baseURL)).text(), /sys_write_file/);
    fixture.enqueue({ kind: 'error', status: 400 });
    assert.equal((await request(fixture.baseURL)).status, 400);
    assert.equal(fixture.requests.length, 2);
    assert.deepEqual(fixture.errors, []);
  } finally {
    await fixture.close();
  }
});
