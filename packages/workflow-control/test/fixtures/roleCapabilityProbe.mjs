import fs from 'node:fs';
import { Buffer } from 'node:buffer';
import process from 'node:process';
import { setTimeout, clearTimeout } from 'node:timers';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { zstdDecompressSync } from 'node:zlib';
let step = 0;
const events = [];
const patch =
  '*** Begin Patch\n*** Add File: /workspace/unauthorized.txt\n+changed\n*** Update File: /workspace/source.txt\n@@\n-original\n+modified\n*** End Patch';
const securityCommand =
  "node -e 'const fs=require('\\''fs'\\''),net=require('\\''net'\\''); const write=p=>{try{fs.writeFileSync(p,'\\''attempt'\\'');return true}catch(e){if(!['\\''EROFS'\\'','\\''EACCES'\\'','\\''EPERM'\\''].includes(e.code))throw e;return false}}; const r={sourceRead:fs.readFileSync('\\''/workspace/source.txt'\\'','\\''utf8'\\''),sourceWrite:write('\\''/workspace/shell-source.txt'\\''),configWrite:write('\\''/codex-home/config.toml'\\''),authWrite:write('\\''/codex-home/auth.json'\\''),rootWrite:write('\\''/etc/role-probe'\\''),dockerSocket:fs.existsSync('\\''/var/run/docker.sock'\\'')}; const socket=net.createConnection({host:'\\''127.0.0.1'\\'',port:8999}); const done=allowed=>{r.network=allowed;fs.writeFileSync('\\''/scratch/security-result.json'\\'',JSON.stringify(r));socket.destroy()};socket.once('\\''connect'\\'',()=>done(true));socket.once('\\''error'\\'',()=>done(false));socket.setTimeout(1000,()=>done(true));'";
const calls = [
  {
    type: 'custom_tool_call',
    id: 'ct_direct_patch',
    call_id: 'call_direct_patch',
    name: 'apply_patch',
    namespace: 'functions',
    input: '*** Begin Patch\n*** Add File: /workspace/direct-patch.txt\n+direct\n*** End Patch',
  },
  {
    type: 'custom_tool_call',
    id: 'ct_patch',
    call_id: 'call_patch',
    name: 'exec',
    namespace: 'functions',
    input: 'await tools.apply_patch(' + JSON.stringify(patch) + ')',
  },
  {
    type: 'custom_tool_call',
    id: 'ct_shell',
    call_id: 'call_shell',
    name: 'exec',
    namespace: 'functions',
    input:
      'const r = await tools.exec_command({cmd:"printf test > /scratch/tool-output; printf artifact > /evidence/tool-result; cat /workspace/source.txt"}); text(r);',
  },
  {
    type: 'custom_tool_call',
    id: 'ct_security',
    call_id: 'call_security',
    name: 'exec',
    namespace: 'functions',
    input: 'text(await tools.exec_command({cmd:' + JSON.stringify(securityCommand) + '}));',
  },
  {
    type: 'custom_tool_call',
    id: 'ct_evidence',
    call_id: 'call_evidence',
    name: 'exec',
    namespace: 'functions',
    input:
      'await tools.apply_patch(' +
      JSON.stringify(
        '*** Begin Patch\n*** Add File: /evidence/patch-result.txt\n+evidence\n*** End Patch',
      ) +
      ')',
  },
  {
    type: 'function_call',
    id: 'fc_direct',
    call_id: 'call_direct',
    name: 'exec_command',
    namespace: 'functions',
    arguments: JSON.stringify({ cmd: 'touch /scratch/direct-tool' }),
  },
  {
    type: 'function_call',
    id: 'fc_spawn',
    call_id: 'call_spawn',
    name: 'spawn_agent',
    namespace: 'collaboration',
    arguments: JSON.stringify({ task_name: 'probe', message: 'read only', fork_turns: 'none' }),
  },
  {
    type: 'custom_tool_call',
    id: 'ct_mcp',
    call_id: 'call_mcp',
    name: 'exec',
    namespace: 'functions',
    input: 'await tools.mcp__unapproved__write({});',
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
  fs.readFileSync('/run/specialist/prompt.txt', 'utf8'),
];
const child = spawn('/usr/local/bin/codex', args, { stdio: ['ignore', 'pipe', 'pipe'] });
let completed = false;
let buffered = '';
child.stdout.on('data', (d) => {
  process.stderr.write(d);
  buffered += d.toString();
  const lines = buffered.split('\n');
  buffered = lines.pop() ?? '';
  for (const line of lines)
    if (line.trim() && JSON.parse(line).type === 'turn.completed') completed = true;
});
child.stderr.on('data', (d) => process.stderr.write(d));
child.on('exit', () => {
  clearTimeout(deadline);
});
child.on('close', (code, signal) => {
  if (buffered.trim() && JSON.parse(buffered).type === 'turn.completed') completed = true;
  if (!completed || code !== 0 || signal) process.exitCode = 1;
  const inventories = events
    .flatMap((e) => e.input ?? [])
    .filter((i) => i.type === 'additional_tools')
    .map((i) => i.tools)
    .concat(events.map((e) => e.tools ?? []));
  const outputs = events
    .flatMap((e) => e.input ?? [])
    .filter((i) => ['function_call_output', 'custom_tool_call_output'].includes(i.type));
  const deliveredSource =
    (events[0]?.input ?? [])
      .filter((i) => i.role === 'user')
      .flatMap((i) => i.content ?? [])
      .flatMap((part) => {
        try {
          return JSON.parse(part.text).sourceEvidence ?? [];
        } catch {
          return [];
        }
      })
      .find((entry) => entry.path === 'source.txt') ?? null;
  process.stdout.write(
    JSON.stringify({
      inventories,
      outputs: [...new Map(outputs.map((i) => [i.call_id, i])).values()],
      security: fs.existsSync('/scratch/security-result.json')
        ? JSON.parse(fs.readFileSync('/scratch/security-result.json', 'utf8'))
        : null,
      deliveredSource,
      sourceEvidenceSeen: deliveredSource !== null,
      clientExit: { code, signal },
      completed,
      requestCount: events.length,
      effects: {
        patch: fs.existsSync('/workspace/unauthorized.txt'),
        directPatch: fs.existsSync('/workspace/direct-patch.txt'),
        evidencePatch: fs.existsSync('/evidence/patch-result.txt'),
        direct: fs.existsSync('/scratch/direct-tool'),
        scratch: fs.existsSync('/scratch/tool-output'),
        artifact: fs.existsSync('/evidence/tool-result'),
      },
    }) + '\n',
  );
  server.closeAllConnections();
  server.close();
});
const deadline = setTimeout(() => {
  process.exitCode = 1;
  child.kill();
}, 60000).unref();
