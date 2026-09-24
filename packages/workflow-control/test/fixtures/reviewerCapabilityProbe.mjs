import { Buffer } from 'node:buffer';
import process from 'node:process';
import { setTimeout } from 'node:timers';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { zstdDecompressSync } from 'node:zlib';
let step = 0;
const events = [];
const calls = [
  {
    type: 'function_call',
    id: 'fc_spawn',
    call_id: 'call_spawn',
    name: 'spawn_agent',
    namespace: 'collaboration',
    arguments: JSON.stringify({
      task_name: 'negative_probe',
      message: 'Disposable offline probe.',
      fork_turns: 'none',
    }),
  },
  {
    type: 'custom_tool_call',
    id: 'ct_patch',
    call_id: 'call_patch',
    name: 'exec',
    namespace: 'functions',
    input:
      'await tools.apply_patch("*** Begin Patch\\n*** Add File: /workspace/unauthorized.txt\\n+changed\\n*** End Patch")',
  },
  {
    type: 'function_call',
    id: 'fc_shell',
    call_id: 'call_shell',
    name: 'exec_command',
    namespace: 'functions',
    arguments: JSON.stringify({ cmd: 'touch /workspace/unauthorized.txt' }),
  },
];
const server = createServer(async (req, res) => {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  let body;
  try {
    const raw = Buffer.concat(chunks);
    body = JSON.parse(
      (req.headers['content-encoding'] === 'zstd' ? zstdDecompressSync(raw) : raw).toString(),
    );
  } catch {
    /* Model discovery requests have no Responses body. */
  }
  if (!body?.input) {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end('{"models":[]}');
    return;
  }
  events.push(body);
  res.writeHead(200, { 'content-type': 'text/event-stream' });
  const item = calls[step++] ?? {
    type: 'message',
    id: 'msg_done',
    role: 'assistant',
    content: [{ type: 'output_text', text: 'Offline probe complete.' }],
  };
  for (const event of [
    { type: 'response.created', response: { id: 'resp_probe' } },
    { type: 'response.output_item.added', output_index: 0, item },
    { type: 'response.output_item.done', output_index: 0, item },
    {
      type: 'response.completed',
      response: {
        id: 'resp_probe',
        status: 'completed',
        output: [item],
        usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
      },
    },
  ])
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  res.end();
});
await new Promise((r) => server.listen(8999, '127.0.0.1', r));
const args = [
  'exec',
  '--json',
  '--skip-git-repo-check',
  '--sandbox',
  'read-only',
  '-c',
  'model_provider="inventory"',
  '-c',
  'model_providers.inventory.name="Offline inventory"',
  '-c',
  'model_providers.inventory.base_url="http://127.0.0.1:8999/v1"',
  '-c',
  'model_providers.inventory.wire_api="responses"',
  '-c',
  'model_providers.inventory.request_max_retries=0',
  '-c',
  'model_providers.inventory.stream_max_retries=0',
  'Read supplied evidence only.',
];
const child = spawn('codex', args, { stdio: ['ignore', 'pipe', 'pipe'] });
child.stdout.on('data', (d) => process.stderr.write(d));
child.stderr.on('data', (d) => process.stderr.write(d));
child.on('exit', () => {
  const inventories = events
    .flatMap((e) => e.input ?? [])
    .filter((i) => i.type === 'additional_tools')
    .map((i) => i.tools)
    .concat(events.map((e) => e.tools ?? []));
  const outputs = events
    .flatMap((e) => e.input ?? [])
    .filter((i) => ['function_call_output', 'custom_tool_call_output'].includes(i.type));
  process.stdout.write(
    JSON.stringify({
      inventories,
      outputs: [...new Map(outputs.map((i) => [i.call_id, i])).values()],
      requestCount: events.length,
    }) + '\n',
  );
  server.closeAllConnections();
  server.close();
});
setTimeout(() => child.kill(), 20000).unref();
