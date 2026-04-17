import { z } from 'zod';

/**
 * BFF: proxies to the API harness `POST /v1/chat` (NDJSON).
 * The browser sends `{ sessionId, message }`; execution uses the agent bound to that session
 * (prompt, skills, MCP tools, limits) on the API host.
 */
export const runtime = 'nodejs';

const TARGET = process.env.API_PROXY_URL ?? 'http://127.0.0.1:3000';

const HarnessChatBodySchema = z.object({
  sessionId: z.string().min(1),
  message: z.string().min(1),
});

function jsonError(status: number, code: string, message: string): Response {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * OpenAI key forwarded to the API as `x-openai-key` (same as calling /v1/chat directly).
 * Precedence: browser header → server AGENT_OPENAI_API_KEY → NEXT_OPENAI_API_KEY (local convenience).
 * The API does not read Next's env; without one of these, POST /v1/chat returns MISSING_KEY.
 */
function resolveUpstreamOpenAiKey(req: Request): string | undefined {
  const fromHeader = req.headers.get('x-openai-key')?.trim();
  if (fromHeader) return fromHeader;
  const agent = process.env.AGENT_OPENAI_API_KEY?.trim();
  if (agent) return agent;
  return process.env.NEXT_OPENAI_API_KEY?.trim();
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, 'INVALID_JSON', 'Invalid JSON');
  }

  const parsed = HarnessChatBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, 'INVALID_BODY', 'Expected { sessionId, message } for harness chat');
  }

  const openAiKey = resolveUpstreamOpenAiKey(req);
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(openAiKey ? { 'x-openai-key': openAiKey } : {}),
  };

  let res: Response;
  try {
    res = await fetch(`${TARGET}/v1/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        sessionId: parsed.data.sessionId,
        message: parsed.data.message,
      }),
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return jsonError(
      502,
      'UPSTREAM_UNREACHABLE',
      `Could not reach API at ${TARGET} (${detail}). Is the API running on port 3000?`,
    );
  }

  const outHeaders = new Headers();
  const ct = res.headers.get('content-type');
  if (ct) outHeaders.set('Content-Type', ct);
  outHeaders.set('Cache-Control', 'no-cache');
  outHeaders.set('Connection', 'keep-alive');

  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers: outHeaders,
  });
}
