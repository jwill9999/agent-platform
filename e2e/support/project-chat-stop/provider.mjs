import { createServer } from 'node:http';
import { setTimeout, clearTimeout } from 'node:timers';
import { Buffer } from 'node:buffer';

/** Inert external model boundary. Application routes, control and storage remain real. */
export async function startStopProvider({ model, port = 0, observe = () => {} }) {
  const replies = [];
  const requests = [];
  const errors = [];
  const ledger = [];
  const releases = new Map();
  const released = new Set();
  let closing = false;
  const release = (index) => {
    released.add(index);
    releases.get(index)?.();
  };
  const wait = async (index) => {
    if (released.has(index) || closing) return;
    let timer;
    try {
      await Promise.race([
        new Promise((resolve) => releases.set(index, resolve)),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error('Stop fixture barrier expired')), 45_000);
        }),
      ]);
    } finally {
      clearTimeout(timer);
      releases.delete(index);
    }
  };
  const readRequest = async (req) => {
    if (req.method !== 'POST' || req.url !== '/v1/chat/completions')
      throw new Error('Unexpected Stop provider route');
    let bytes = 0;
    const chunks = [];
    for await (const chunk of req) {
      bytes += chunk.length;
      if (bytes > 512_000) throw new Error('Stop provider body exceeds limit');
      chunks.push(chunk);
    }
    const body = JSON.parse(Buffer.concat(chunks).toString());
    if (body.model !== model || body.stream !== true || !Array.isArray(body.messages))
      throw new Error('Unexpected Stop provider model/mode');
    return body;
  };
  const server = createServer((req, res) => {
    void (async () => {
      try {
        const body = await readRequest(req);
        const index = requests.length;
        requests.push(body);
        observe({ kind: 'request', body });
        const reply = replies[index];
        if (!reply) throw new Error('Unexpected Stop provider call');
        const entry = {
          index,
          received: true,
          partialSent: false,
          completed: false,
          disconnected: false,
        };
        ledger.push(entry);
        const emit = () => observe({ kind: 'ledger', value: { ...entry } });
        emit();
        res.once('close', () => {
          if (!entry.completed) entry.disconnected = true;
          emit();
        });
        const chunk = (delta, finishReason = null) =>
          res.write(
            `data: ${JSON.stringify({
              id: `stop-fixture-${index}`,
              object: 'chat.completion.chunk',
              created: 1,
              model,
              choices: [{ index: 0, delta, finish_reason: finishReason }],
            })}\n\n`,
          );
        if (reply.kind === 'error') {
          res.writeHead(reply.status, { 'content-type': 'application/json', 'retry-after': '0' });
          entry.completed = true;
          res.end(JSON.stringify({ error: { message: 'Controlled Stop provider failure' } }));
          emit();
          return;
        }
        if (reply.partial) {
          res.writeHead(200, { 'content-type': 'text/event-stream' });
          chunk({ content: reply.partial });
          entry.partialSent = true;
          emit();
        }
        if (reply.hold) await wait(index);
        if (res.destroyed) return;
        if (!res.headersSent) res.writeHead(200, { 'content-type': 'text/event-stream' });
        if (reply.kind === 'tool') {
          chunk({
            tool_calls: [
              {
                index: 0,
                id: `stop-call-${index}`,
                type: 'function',
                function: { name: reply.name, arguments: JSON.stringify(reply.args) },
              },
            ],
          });
          chunk({}, 'tool_calls');
        } else {
          chunk({ content: reply.text });
          chunk({}, 'stop');
        }
        entry.completed = true;
        res.end('data: [DONE]\n\n');
        emit();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Stop provider failure';
        errors.push(message);
        observe({ kind: 'error', message });
        if (!res.headersSent) res.writeHead(400);
        res.end();
      }
    })();
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  let closed;
  return {
    baseURL: `http://127.0.0.1:${server.address().port}/v1`,
    requests,
    errors,
    ledger,
    enqueue: (reply) => replies.push(reply),
    release,
    close: () =>
      (closed ??= (async () => {
        closing = true;
        for (const unblock of releases.values()) unblock();
        server.closeAllConnections();
        await new Promise((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve())),
        );
      })()),
  };
}
