import { createServer } from 'node:http';
import process from 'node:process';
import console from 'node:console';

// External model double inside the isolated Compose container. Application routes,
// model adapter, graph, permission policy and MCP transport are the real stack.
const [model, mode] = process.argv.slice(1);
if (
  !/^mcp-chat-[a-f0-9-]+$/.test(model ?? '') ||
  !['approve', 'reject', 'block', 'stale', 'unknown'].includes(mode)
)
  throw new Error('Invalid fixture configuration');
let count = 0;
function emit(res, delta, finishReason) {
  res.write(
    `data: ${JSON.stringify({ id: 'mcp-browser-fixture', object: 'chat.completion.chunk', created: 1, model, choices: [{ index: 0, delta, finish_reason: finishReason }] })}\n\n`,
  );
}
async function handle(req, res) {
  try {
    if (req.method !== 'POST' || req.url !== '/v1/chat/completions') throw new Error('Route');
    let raw = '';
    for await (const chunk of req) {
      raw += chunk;
      if (raw.length > 200000) throw new Error('Bound');
    }
    const body = JSON.parse(raw);
    count += 1;
    // Log only tool identities and call count, never prompt or credential content.
    console.log(
      JSON.stringify({
        kind: 'request',
        body: { tools: body.tools?.map((tool) => ({ function: { name: tool.function?.name } })) },
      }),
    );
    if (count > 2 || body.model !== model || body.stream !== true) throw new Error('Request');
    const name = body.tools?.find((tool) => tool.function?.name?.endsWith('__fixture_effect'))
      ?.function.name;
    if (!name) throw new Error('Eligible MCP tool missing');
    const tool = count === 1 || ['stale', 'unknown'].includes(mode);
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    if (tool) {
      emit(
        res,
        {
          tool_calls: [
            {
              index: 0,
              id: `mcp-browser-call-${count}`,
              type: 'function',
              function: { name, arguments: '' },
            },
          ],
        },
        null,
      );
      emit(res, { tool_calls: [{ index: 0, function: { arguments: '{}' } }] }, null);
    } else emit(res, { content: `MCP browser ${mode} settled.` }, null);
    emit(res, {}, tool ? 'tool_calls' : 'stop');
    res.end('data: [DONE]\n\n');
  } catch (error) {
    console.log(
      JSON.stringify({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Provider fixture rejected request',
      }),
    );
    if (!res.headersSent) res.writeHead(400, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: { message: 'Provider fixture rejected request' } }));
  }
}
const server = createServer((req, res) => void handle(req, res));
server.listen(11434, '127.0.0.1', () => console.log(JSON.stringify({ kind: 'ready' })));
process.stdin.resume();
process.stdin.on('end', () => {
  server.closeAllConnections();
  server.close();
});
