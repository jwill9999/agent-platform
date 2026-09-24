import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

export const JOURNEY_MODEL = 'fixture-journey-model';
export const JOURNEY_CALL_ID = 'fixture-journey-call';

type WireMessage = {
  role: string;
  content?: unknown;
  tool_call_id?: string;
  tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }>;
};
export type ProviderRequest = {
  model: string;
  stream: boolean;
  messages: WireMessage[];
  tools?: Array<{ function: { name: string } }>;
};

/** Only the external provider is scripted; no reasoning/graph/approval code is replaced. */
export async function startJourneyProvider(
  command: string,
  finalText: string,
  options: { failFirst?: boolean; toolCall?: { name: string; args: Record<string, unknown> } } = {},
) {
  const toolCall = options.toolCall ?? { name: 'sys_bash', args: { command } };
  const requests: ProviderRequest[] = [];
  const errors: string[] = [];
  const attempts: Array<{ status: number; model: string }> = [];
  const server = createServer((req, res) => {
    void (async () => {
      try {
        if (req.method !== 'POST' || req.url !== '/v1/chat/completions') {
          throw new Error(`Unexpected provider route: ${req.method} ${req.url}`);
        }
        let raw = '';
        for await (const chunk of req) {
          raw += String(chunk);
          if (raw.length > 250_000) throw new Error('Provider request exceeds fixture bound');
        }
        const body = JSON.parse(raw) as ProviderRequest;
        if (options.failFirst && attempts.length === 0) {
          attempts.push({ status: 503, model: body.model });
          res.writeHead(503, { 'content-type': 'application/json', 'retry-after': '0' });
          res.end(JSON.stringify({ error: { message: 'Fixture temporarily unavailable' } }));
          return;
        }
        attempts.push({ status: 200, model: body.model });
        requests.push(body);
        if (requests.length > 2 || body.model !== JOURNEY_MODEL || !body.stream) {
          throw new Error('Unexpected provider request count, model or streaming mode');
        }
        const resumed = requests.length === 2;
        if (
          resumed &&
          !body.messages.some((m) => m.role === 'tool' && m.tool_call_id === JOURNEY_CALL_ID)
        ) {
          throw new Error('Resume did not preserve the original tool-call identity');
        }
        if (!resumed && !body.tools?.some((tool) => tool.function.name === toolCall.name)) {
          throw new Error('Real reasoning did not expose the expected tool');
        }
        res.writeHead(200, { 'content-type': 'text/event-stream' });
        const emit = (delta: unknown, finishReason: string | null, usage?: unknown) => {
          res.write(
            `data: ${JSON.stringify({
              id: 'fixture-response',
              object: 'chat.completion.chunk',
              created: 1,
              model: JOURNEY_MODEL,
              choices: [{ index: 0, delta, finish_reason: finishReason }],
              ...(usage ? { usage } : {}),
            })}\n\n`,
          );
        };
        if (resumed) {
          emit({ content: finalText }, null);
        } else {
          // Split arguments across SSE frames to exercise the actual SDK stream parser.
          const args = JSON.stringify(toolCall.args);
          const middle = Math.floor(args.length / 2);
          emit(
            {
              tool_calls: [
                {
                  index: 0,
                  id: JOURNEY_CALL_ID,
                  type: 'function',
                  function: { name: toolCall.name, arguments: args.slice(0, middle) },
                },
              ],
            },
            null,
          );
          emit({ tool_calls: [{ index: 0, function: { arguments: args.slice(middle) } }] }, null);
        }
        emit({}, resumed ? 'stop' : 'tool_calls', {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15,
        });
        res.end('data: [DONE]\n\n');
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
        if (!res.headersSent) res.writeHead(400, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: { message: 'Provider fixture rejected request' } }));
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
    attempts,
    errors,
    close: async () => {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    },
  };
}
