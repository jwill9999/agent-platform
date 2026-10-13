import { createServer } from 'node:http';
import process from 'node:process';
import console from 'node:console';

// External provider double only. Runs inside the disposable compose API container;
// no application route, graph, permission or persistence layer is replaced.
const model = process.argv[1];
if (!/^context-browser-[a-f0-9-]+$/.test(model ?? '')) throw new Error('Invalid fixture model');
let requestCount = 0;
const server = createServer((req, res) => {
  void (async () => {
    try {
      if (req.method !== 'POST' || req.url !== '/v1/chat/completions') throw new Error('Route');
      let raw = '';
      for await (const chunk of req) {
        raw += chunk;
        if (raw.length > 200_000) throw new Error('Fixture request bound');
      }
      const body = JSON.parse(raw);
      if (body.model !== model || !body.stream) throw new Error('Unexpected model/stream');
      requestCount += 1;
      if (requestCount > 5) throw new Error('Fixture invocation bound');
      console.log(JSON.stringify({ kind: 'request', body }));
      const current = body.messages.findLast((message) => message.role === 'user');
      const text =
        typeof current?.content === 'string' ? current.content : JSON.stringify(current?.content);
      const last = body.messages.at(-1);
      const denial = text.includes('CONTEXT_DENIAL');
      const tool = (text.includes('CONTEXT_LONG_JOURNEY') || denial) && last?.role !== 'tool';
      const toolCalls = denial
        ? [
            {
              id: 'context-browser-denied-absolute',
              path: `/context-projects/outside-${model}.txt`,
            },
            { id: 'context-browser-denied-traversal', path: `../outside-${model}.txt` },
          ]
        : [{ id: 'context-browser-read', path: '/workspace/README.md' }];
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      const emit = (delta, finish_reason) =>
        res.write(
          `data: ${JSON.stringify({
            id: 'context-fixture-response',
            object: 'chat.completion.chunk',
            created: 1,
            model,
            choices: [{ index: 0, delta, finish_reason }],
          })}\n\n`,
        );
      if (tool) {
        emit(
          {
            tool_calls: toolCalls.map((call, index) => ({
              index,
              id: call.id,
              type: 'function',
              function: { name: 'sys_read_file', arguments: JSON.stringify({ path: call.path }) },
            })),
          },
          null,
        );
      } else {
        emit(
          {
            content: text.includes('CONTEXT_LONG_JOURNEY')
              ? 'Context journey finished.'
              : denial
                ? 'Context denials finished.'
                : 'Context recovery finished.',
          },
          null,
        );
      }
      emit({}, tool ? 'tool_calls' : 'stop');
      res.end('data: [DONE]\n\n');
    } catch {
      console.log(JSON.stringify({ kind: 'error', message: 'Provider fixture rejected request' }));
      if (!res.headersSent) res.writeHead(400, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: { message: 'Provider fixture rejected request' } }));
    }
  })();
});
server.listen(11434, '127.0.0.1', () => console.log(JSON.stringify({ kind: 'ready' })));
process.stdin.resume();
process.stdin.on('end', () => {
  server.closeAllConnections();
  server.close();
});
