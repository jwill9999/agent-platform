import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import {
  JOURNEY_CALL_ID,
  JOURNEY_MODEL,
  startJourneyProvider,
} from '../e2e/support/providerJourney.js';

const providers: Array<Awaited<ReturnType<typeof startJourneyProvider>>> = [];
afterEach(async () => {
  for (const provider of providers.splice(0)) await provider.close();
});

async function provider(options: Parameters<typeof startJourneyProvider>[2] = {}) {
  const fixture = await startJourneyProvider('printf literal', 'finished', options);
  providers.push(fixture);
  return fixture;
}

function request(overrides: Record<string, unknown> = {}) {
  return {
    model: JOURNEY_MODEL,
    stream: true,
    messages: [{ role: 'user', content: 'Run the fixture' }],
    tools: [{ function: { name: 'sys_bash' } }],
    ...overrides,
  };
}

async function send(fixture: Awaited<ReturnType<typeof provider>>, body: unknown) {
  return fetch(`${fixture.baseURL}/chat/completions`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

function frames(text: string) {
  return text
    .split('\n\n')
    .filter((line) => line.startsWith('data: ') && line !== 'data: [DONE]')
    .map((line) => JSON.parse(line.slice(6)));
}

describe('provider journey HTTP contract', () => {
  it('preserves split tool arguments, resumed identity, completion and the third-request denial', async () => {
    const fixture = await provider();
    const first = await send(fixture, request());
    expect(first.status).toBe(200);
    const firstText = await first.text();
    const chunks = frames(firstText);
    expect(chunks[0].choices[0].delta.tool_calls[0].id).toBe(JOURNEY_CALL_ID);
    const args =
      chunks[0].choices[0].delta.tool_calls[0].function.arguments +
      chunks[1].choices[0].delta.tool_calls[0].function.arguments;
    expect(JSON.parse(args)).toEqual({ command: 'printf literal' });
    expect(chunks[2].choices[0].finish_reason).toBe('tool_calls');
    expect(firstText).toContain('data: [DONE]\n\n');
    const resumed = request({ messages: [{ role: 'tool', tool_call_id: JOURNEY_CALL_ID }] });
    const second = await send(fixture, resumed);
    expect(second.status).toBe(200);
    const completed = frames(await second.text());
    expect(completed[0].choices[0].delta.content).toBe('finished');
    expect(completed[1].choices[0].finish_reason).toBe('stop');
    expect(completed[1].usage.total_tokens).toBe(15);
    const third = await send(fixture, resumed);
    expect(third.status).toBe(400);
    await third.text();
    expect(fixture.requests).toHaveLength(3);
    expect(fixture.attempts.map((attempt) => attempt.status)).toEqual([200, 200, 200]);
    expect(fixture.errors).toEqual(['Unexpected provider request count, model or streaming mode']);
  });

  it('records a fail-first retry before accepted-request validation and preserves custom tools', async () => {
    const fixture = await provider({
      failFirst: true,
      toolCall: { name: 'sys_read_file', args: { path: 'a' } },
    });
    const unavailable = await send(fixture, request({ model: 'wrong-model' }));
    expect(unavailable.status).toBe(503);
    expect(unavailable.headers.get('retry-after')).toBe('0');
    await unavailable.text();
    expect(fixture.requests).toHaveLength(0);
    const retry = await send(
      fixture,
      request({ tools: [{ function: { name: 'sys_read_file' } }] }),
    );
    expect(retry.status).toBe(200);
    const chunks = frames(await retry.text());
    expect(chunks[0].choices[0].delta.tool_calls[0].function.name).toBe('sys_read_file');
    expect(fixture.attempts).toEqual([
      { status: 503, model: 'wrong-model' },
      { status: 200, model: JOURNEY_MODEL },
    ]);
    expect(fixture.errors).toEqual([]);
  });

  it.each([
    [
      'model',
      request({ model: 'wrong-model' }),
      'Unexpected provider request count, model or streaming mode',
    ],
    [
      'stream',
      request({ stream: false }),
      'Unexpected provider request count, model or streaming mode',
    ],
    ['tool', request({ tools: [] }), 'Real reasoning did not expose the expected tool'],
  ])('rejects an invalid %s after recording the accepted attempt', async (_name, body, message) => {
    const fixture = await provider();
    const response = await send(fixture, body);
    expect(response.status).toBe(400);
    await response.text();
    expect(fixture.requests).toHaveLength(1);
    expect(fixture.attempts).toHaveLength(1);
    expect(fixture.errors).toEqual([message]);
  });

  it('rejects substituted resumed tool-call identity', async () => {
    const fixture = await provider();
    await (await send(fixture, request())).text();
    const response = await send(
      fixture,
      request({ messages: [{ role: 'tool', tool_call_id: 'other' }] }),
    );
    expect(response.status).toBe(400);
    await response.text();
    expect(fixture.errors).toEqual(['Resume did not preserve the original tool-call identity']);
  });

  it.each(['malformed', 'oversized', 'route', 'method'])(
    'rejects %s input before recording a provider attempt',
    async (kind) => {
      const fixture = await provider();
      const endpoint =
        kind === 'route' ? `${fixture.baseURL}/other` : `${fixture.baseURL}/chat/completions`;
      let options: RequestInit = { method: 'GET' };
      if (kind !== 'method') {
        let body = JSON.stringify(request());
        if (kind === 'malformed') body = '{';
        if (kind === 'oversized') body = 'x'.repeat(250_001);
        options = { method: 'POST', body };
      }
      const response = await fetch(endpoint, options);
      expect(response.status).toBe(400);
      await response.text();
      expect(fixture.requests).toHaveLength(0);
      expect(fixture.attempts).toHaveLength(0);
      expect(fixture.errors).toHaveLength(1);
      if (kind === 'oversized')
        expect(fixture.errors[0]).toBe('Provider request exceeds fixture bound');
    },
  );
});

it('keeps loopback-only fetch enforcement and forwards each original input/init unchanged', () => {
  const guard = fileURLToPath(
    new URL('../e2e/support/provider-network-guard.cjs', import.meta.url),
  );
  const program = `
    const assert = require('node:assert/strict');
    const calls = [];
    const result = {};
    globalThis.fetch = (input, init) => { calls.push({ input, init }); return result; };
    require(process.argv[1]);
    const inputs = ['http://127.0.0.1/v1', new URL('http://localhost/v1'), new Request('http://[::1]/v1')];
    for (const input of inputs) {
      const init = { method: 'POST' };
      assert.equal(globalThis.fetch(input, init), result);
      assert.equal(calls.at(-1).input, input);
      assert.equal(calls.at(-1).init, init);
    }
    let denied = 0;
    for (const input of ['https://remote.invalid/v1', new URL('http://127.0.0.1.attacker.invalid/'), new Request('http://localhost.attacker.invalid/')]) {
      assert.throws(() => globalThis.fetch(input), /forbids non-loopback/);
      denied += 1;
    }
    assert.equal(calls.length, 3);
    process.stdout.write(JSON.stringify({ forwarded: calls.length, denied }));
  `;
  const result = execFileSync(process.execPath, ['-e', program, guard], {
    stdio: 'pipe',
    encoding: 'utf8',
  });
  expect(JSON.parse(result)).toEqual({ forwarded: 3, denied: 3 });
});
