import { createServer } from 'node:http';
import { Buffer } from 'node:buffer';

/** Inert test boundary: real SDK HTTP, scripted replies, no external forwarding. */
export async function startGitDeliveryProvider({ model, replies, port = 0 }) {
  if (!/^git-delivery-[a-zA-Z0-9-]+$/.test(model) || !Array.isArray(replies)) {
    throw new Error('Invalid Git delivery provider fixture configuration');
  }
  const script = globalThis.structuredClone(replies);
  const requests = [];
  const errors = [];
  const server = createServer((request, response) => {
    void (async () => {
      try {
        if (request.method !== 'POST' || request.url !== '/v1/chat/completions') {
          throw new Error('Unexpected method or route');
        }
        const parts = [];
        let bytes = 0;
        for await (const part of request) {
          bytes += part.length;
          if (bytes > 512_000) throw new Error('Request exceeds fixture byte bound');
          parts.push(part);
        }
        const body = JSON.parse(Buffer.concat(parts).toString('utf8'));
        const reply = script[requests.length];
        if (
          !reply ||
          body.model !== model ||
          body.stream !== true ||
          !Array.isArray(body.messages)
        ) {
          throw new Error('Unexpected request count, model or streaming mode');
        }
        for (const id of reply.requiredToolResults ?? []) {
          if (
            !body.messages.some((message) => message.role === 'tool' && message.tool_call_id === id)
          ) {
            throw new Error('Expected actual tool result missing from model continuation');
          }
        }
        const calls =
          reply.kind === 'tool' ? [reply] : reply.kind === 'tools' ? reply.calls : undefined;
        if (calls) {
          if (
            !Array.isArray(calls) ||
            calls.length < 1 ||
            calls.length > 8 ||
            new Set(calls.map((call) => call.id)).size !== calls.length
          )
            throw new Error('Invalid scripted tool batch');
          for (const call of calls) {
            if (
              typeof call.id !== 'string' ||
              !call.id ||
              typeof call.name !== 'string' ||
              !call.args ||
              typeof call.args !== 'object' ||
              Array.isArray(call.args) ||
              !body.tools?.some(
                (tool) => tool.type === 'function' && tool.function?.name === call.name,
              )
            )
              throw new Error('Expected Git tool was not offered by the actual harness');
          }
        } else if (reply.kind !== 'text') {
          throw new Error('Unsupported scripted response');
        }
        requests.push(body);
        response.writeHead(200, { 'content-type': 'text/event-stream' });
        const emit = (delta, finishReason, usage) =>
          response.write(
            `data: ${JSON.stringify({
              id: `git-fixture-${requests.length}`,
              object: 'chat.completion.chunk',
              created: 1,
              model,
              choices: [{ index: 0, delta, finish_reason: finishReason }],
              ...(usage ? { usage } : {}),
            })}\n\n`,
          );
        if (calls) {
          for (const [index, call] of calls.entries()) {
            const args = JSON.stringify(call.args);
            const middle = Math.floor(args.length / 2);
            emit(
              {
                tool_calls: [
                  {
                    index,
                    id: call.id,
                    type: 'function',
                    function: { name: call.name, arguments: args.slice(0, middle) },
                  },
                ],
              },
              null,
            );
            emit({ tool_calls: [{ index, function: { arguments: args.slice(middle) } }] }, null);
          }
        } else {
          emit({ content: reply.text }, null);
        }
        emit({}, calls ? 'tool_calls' : 'stop', {
          prompt_tokens: 20,
          completion_tokens: 10,
          total_tokens: 30,
        });
        response.end('data: [DONE]\n\n');
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
        if (!response.headersSent) response.writeHead(400, { 'content-type': 'application/json' });
        response.end(
          JSON.stringify({ error: { message: 'Owned Git provider fixture rejected request' } }),
        );
      }
    })();
  });
  server.requestTimeout = 10_000;
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  return {
    baseURL: `http://127.0.0.1:${server.address().port}/v1`,
    requests,
    errors,
    async close() {
      server.closeAllConnections();
      await new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    },
  };
}
