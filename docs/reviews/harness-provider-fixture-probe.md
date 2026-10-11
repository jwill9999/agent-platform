# Local provider feasibility probe

Temporary read-only assessment experiment, September 15, 2026. Run after `pnpm build`, with Node 24, from the repository root. Save the following source to a temporary `.mjs` file and run it with Node. The source below replaces the original absolute import with a repository-root-relative URL for portability. No model or tool actually executes outside the local fixture; no production files are changed. This is feasibility evidence, not a reusable E2E suite.

```javascript
import http from 'node:http';
import assert from 'node:assert/strict';
const seen = [];
const server = http.createServer(async (req, res) => {
  let raw = '';
  for await (const b of req) raw += b;
  const body = JSON.parse(raw);
  seen.push({ path: req.url, body });
  res.writeHead(200, { 'content-type': 'text/event-stream' });
  const delta =
    seen.length === 1
      ? {
          tool_calls: [
            {
              index: 0,
              id: 'fixture-call',
              type: 'function',
              function: { name: 'read_sample', arguments: '{"path":"sample.txt"}' },
            },
          ],
        }
      : { content: 'Fixture round trip complete' };
  res.write(
    'data: ' +
      JSON.stringify({
        id: 'fixture',
        object: 'chat.completion.chunk',
        created: 1,
        model: 'fixture-model',
        choices: [{ index: 0, delta, finish_reason: null }],
      }) +
      '\n\n',
  );
  res.write(
    'data: ' +
      JSON.stringify({
        id: 'fixture',
        object: 'chat.completion.chunk',
        created: 1,
        model: 'fixture-model',
        choices: [
          { index: 0, delta: {}, finish_reason: seen.length === 1 ? 'tool_calls' : 'stop' },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      }) +
      '\n\n',
  );
  res.end('data: [DONE]\n\n');
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;
process.env.OLLAMA_BASE_URL = origin + '/v1';
const originalFetch = globalThis.fetch;
globalThis.fetch = (input, init) => {
  const url = new URL(typeof input === 'string' ? input : (input.url ?? input));
  assert.equal(url.origin, origin, 'Only local fixture network allowed');
  return originalFetch(input, init);
};
try {
  const { createLlmReasonNode } = await import(
    new URL('./packages/harness/dist/nodes/llmReason.js', `file://${process.cwd()}/`).href
  );
  const emitted = [];
  const node = createLlmReasonNode({ emitter: { emit: async (e) => emitted.push(e) } });
  const state = {
    trace: [],
    plan: null,
    taskIndex: 0,
    limits: { maxSteps: 10, maxParallelTasks: 1, timeoutMs: 60000 },
    runId: 'fixture-run',
    halted: false,
    messages: [{ role: 'user', content: 'Read sample.txt' }],
    toolDefinitions: [
      {
        name: 'read_sample',
        description: 'Read sample file',
        parameters: {
          type: 'object',
          properties: { path: { type: 'string' } },
          required: ['path'],
        },
      },
    ],
    llmOutput: null,
    modelConfig: { provider: 'ollama', model: 'fixture-model' },
    totalTokensUsed: 0,
    totalCostUnits: 0,
  };
  const first = await node(state);
  assert.equal(first.llmOutput.kind, 'tool_calls');
  const call = first.llmOutput.calls[0];
  assert.equal(call.name, 'read_sample');
  assert.deepEqual(call.args, { path: 'sample.txt' });
  const second = await node({
    ...state,
    messages: [
      ...state.messages,
      ...first.messages,
      { role: 'tool', toolCallId: call.id, toolName: call.name, content: 'fixture file contents' },
    ],
  });
  assert.equal(second.llmOutput.content, 'Fixture round trip complete');
  assert.equal(seen.length, 2);
  assert.ok(seen[0].body.tools.length);
  assert.ok(
    seen[1].body.messages.some((m) => m.role === 'tool' && m.tool_call_id === 'fixture-call'),
  );
  assert.ok(seen.every((r) => r.path === '/v1/chat/completions'));
  console.log(
    JSON.stringify(
      {
        result: 'PASS',
        requests: seen.length,
        transport: 'ollama OpenAI-compatible via OLLAMA_BASE_URL',
        realLayers: ['provider factory', 'AI SDK parser', 'llmReason node'],
        fixtureLayers: ['provider HTTP', 'manually supplied tool result'],
        toolName: call.name,
        callIdPreserved: true,
        finalText: second.llmOutput.content,
        emittedTypes: emitted.map((e) => e.type),
        limitations: ['No graph dispatch, approval, persistence, UI or real model exercised'],
      },
      null,
      2,
    ),
  );
} finally {
  server.closeAllConnections();
  await new Promise((r) => server.close(r));
}
```

Observed result:

```json
{
  "result": "PASS",
  "requests": 2,
  "transport": "ollama OpenAI-compatible via OLLAMA_BASE_URL",
  "realLayers": ["provider factory", "AI SDK parser", "llmReason node"],
  "fixtureLayers": ["provider HTTP", "manually supplied tool result"],
  "toolName": "read_sample",
  "callIdPreserved": true,
  "finalText": "Fixture round trip complete",
  "emittedTypes": ["text", "text"],
  "limitations": ["No graph dispatch, approval, persistence, UI or real model exercised"]
}
```
