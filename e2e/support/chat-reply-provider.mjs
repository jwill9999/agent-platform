import { createServer } from 'node:http';
import { createInterface } from 'node:readline';
import { setTimeout, clearTimeout } from 'node:timers';
import process from 'node:process';
import console from 'node:console';

const model = process.argv[1];
if (!/^reply-browser-[a-f0-9-]+$/.test(model ?? '')) throw new Error('Invalid fixture model');
let release;
const completion = new Promise((resolve) => {
  release = resolve;
});
const commands = createInterface({ input: process.stdin });
commands.on('line', (line) => {
  if (line === 'complete') release();
});
let count = 0;
const server = createServer((req, res) => {
  void (async () => {
    try {
      if (req.method !== 'POST' || req.url !== '/v1/chat/completions') throw new Error('Route');
      let raw = '';
      for await (const chunk of req) {
        raw += chunk;
        if (raw.length > 512_000) throw new Error('Body bound');
      }
      const body = JSON.parse(raw);
      if (body.model !== model || !body.stream || ++count !== 1) throw new Error('Unexpected call');
      console.log(JSON.stringify({ kind: 'request', body }));
      let deadline;
      try {
        await Promise.race([
          completion,
          new Promise((_, reject) => {
            deadline = setTimeout(() => reject(new Error('Completion barrier expired')), 30_000);
          }),
        ]);
      } finally {
        clearTimeout(deadline);
      }
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      for (const [delta, reason] of [
        [{ content: 'Docker restored reply completed.' }, null],
        [{}, 'stop'],
      ]) {
        res.write(
          `data: ${JSON.stringify({ id: 'reply-fixture', object: 'chat.completion.chunk', created: 1, model, choices: [{ index: 0, delta, finish_reason: reason }] })}\n\n`,
        );
      }
      res.end('data: [DONE]\n\n');
    } catch {
      console.log(
        JSON.stringify({ kind: 'error', message: 'Owned provider rejected unexpected request' }),
      );
      if (!res.headersSent) res.writeHead(400);
      res.end();
    }
  })();
});
server.listen(11434, '127.0.0.1', () =>
  console.log(JSON.stringify({ kind: 'ready', pid: process.pid })),
);
commands.on('close', () => {
  release();
  server.closeAllConnections();
  server.close();
});
