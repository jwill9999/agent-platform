import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

export const CONTEXT_TOKEN_MODEL = 'fixture-context-token-model';
export type ContextTokenWireMessage = {
  role: string;
  content?: unknown;
  tool_call_id?: string;
  tool_calls?: Array<{ id: string; type: string; function: { name: string; arguments: string } }>;
};
export type ContextTokenProviderRequest = {
  model: string;
  stream: boolean;
  messages: ContextTokenWireMessage[];
  tools?: Array<{
    type: string;
    function: { name: string; description?: string; parameters: unknown };
  }>;
  max_tokens?: number;
  max_completion_tokens?: number;
};
export type ContextTokenProviderReply =
  | { kind: 'text'; text: string; finishReason?: 'stop' | 'length' }
  | { kind: 'tools'; calls: Array<{ id: string; name: string; args: Record<string, unknown> }> }
  | { kind: 'error'; status: 400 | 429 | 503 };

async function readRequest(req: IncomingMessage): Promise<ContextTokenProviderRequest> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of req) {
    const part = Buffer.from(chunk as Uint8Array);
    bytes += part.length;
    if (bytes > 512_000) throw new Error('Synthetic provider request exceeds fixture byte bound');
    chunks.push(part);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as ContextTokenProviderRequest;
}

/** Actual installed SDK wire protocol; only the external model endpoint is deterministic. */
export async function startContextTokenProvider(replies: readonly ContextTokenProviderReply[]) {
  const requests: ContextTokenProviderRequest[] = [];
  const errors: string[] = [];
  const server = createServer((req, res) => {
    void (async () => {
      try {
        if (req.method !== 'POST' || req.url !== '/v1/chat/completions')
          throw new Error('Unexpected provider method or route');
        const body = await readRequest(req);
        requests.push(body);
        const reply = replies[requests.length - 1];
        if (
          !reply ||
          body.model !== CONTEXT_TOKEN_MODEL ||
          body.stream !== true ||
          !Array.isArray(body.messages)
        )
          throw new Error('Unexpected provider request count/model/mode');
        if (reply.kind === 'error') {
          res.writeHead(reply.status, { 'content-type': 'application/json', 'retry-after': '0' });
          res.end(JSON.stringify({ error: { message: 'Synthetic provider capacity response' } }));
          return;
        }
        res.writeHead(200, { 'content-type': 'text/event-stream' });
        emitContextTokenReply(res, reply);
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
        if (!res.headersSent) res.writeHead(400, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: { message: 'Synthetic provider rejected request' } }));
      }
    })();
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return {
    baseURL: `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`,
    requests,
    errors,
    close: async () => {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    },
  };
}

export function emitContextTokenReply(
  res: ServerResponse,
  reply: Exclude<ContextTokenProviderReply, { kind: 'error' }>,
) {
  const emit = (delta: unknown, finishReason: string | null, usage?: unknown) =>
    res.write(
      `data: ${JSON.stringify({
        id: 'context-token-fixture-response',
        object: 'chat.completion.chunk',
        created: 1,
        model: CONTEXT_TOKEN_MODEL,
        choices: [{ index: 0, delta, finish_reason: finishReason }],
        ...(usage ? { usage } : {}),
      })}\n\n`,
    );
  if (reply.kind === 'text') emit({ content: reply.text }, null);
  else
    for (const [index, call] of reply.calls.entries()) {
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
  emit({}, reply.kind === 'text' ? (reply.finishReason ?? 'stop') : 'tool_calls', {
    prompt_tokens: 10,
    completion_tokens: 5,
    total_tokens: 15,
  });
  res.end('data: [DONE]\n\n');
}
