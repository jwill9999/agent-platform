import { createServer } from 'node:http';
import { createInterface } from 'node:readline';
import process from 'node:process';
import console from 'node:console';

const model = process.argv[1];
if (!/^github-read-[a-f0-9-]+$/.test(model ?? '')) throw new Error('Invalid fixture model');
let count = 0;
const server = createServer((req, res) => {
  void (async () => {
    try {
      if (req.method !== 'POST' || req.url !== '/v1/chat/completions') throw new Error('Route');
      let raw = '';
      for await (const chunk of req) {
        raw += chunk;
        if (raw.length > 512_000) throw new Error('Bound');
      }
      const body = JSON.parse(raw);
      if (body.model !== model || !body.stream || ++count > 2) throw new Error('Request');
      console.log(JSON.stringify({ kind: 'request', body }));
      const tool = count === 1;
      const delta = tool
        ? {
            tool_calls: [
              {
                index: 0,
                id: 'github-read-write',
                type: 'function',
                function: {
                  name: 'sys_write_file',
                  arguments: JSON.stringify({
                    path: '/workspace/gh-effect.txt',
                    content: 'GH_DOCKER_EFFECT_CANARY',
                  }),
                },
              },
            ],
          }
        : { content: 'Docker write completed while GitHub waits.' };
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      for (const [part, finish] of [
        [delta, null],
        [{}, tool ? 'tool_calls' : 'stop'],
      ]) {
        res.write(
          `data: ${JSON.stringify({ id: 'github-read-fixture', object: 'chat.completion.chunk', created: 1, model, choices: [{ index: 0, delta: part, finish_reason: finish }] })}\n\n`,
        );
      }
      res.end('data: [DONE]\n\n');
    } catch {
      console.log(JSON.stringify({ kind: 'error', message: 'Owned provider rejected request' }));
      if (!res.headersSent) res.writeHead(400);
      res.end();
    }
  })();
});
server.listen(11434, '127.0.0.1', () =>
  console.log(JSON.stringify({ kind: 'ready', pid: process.pid })),
);
createInterface({ input: process.stdin }).on('close', () => {
  server.closeAllConnections();
  server.close();
});
