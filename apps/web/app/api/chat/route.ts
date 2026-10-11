import { localDiagnosticConnection } from '@/lib/local-diagnostics-server';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';

/**
 * BFF: proxies to the API harness `POST /v1/chat` (NDJSON).
 * The browser sends `{ sessionId, message }`; execution uses the agent bound to that session
 * (prompt, skills, MCP tools, limits) on the API host.
 */
export const runtime = 'nodejs';

const TARGET = process.env.API_PROXY_URL ?? 'http://127.0.0.1:3000';

/** Max wait for the API to return *response headers* (TLS + MCP + lock + DB). Body may stream much longer. */
function upstreamHeaderTimeoutMs(): number {
  const raw = process.env.CHAT_PROXY_HEADER_TIMEOUT_MS?.trim();
  if (!raw) return 90_000;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 90_000;
}

const HarnessChatBodySchema = z.object({
  sessionId: z.string().min(1),
  message: z.string().min(1),
  /** Optional per-request model config override (ID from /v1/model-configs). */
  modelConfigId: z.string().min(1).optional(),
});

function jsonError(status: number, code: string, message: string, requestId: string): Response {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'x-request-id': requestId,
      'x-bff-request-id': requestId,
      'Cache-Control': 'no-store',
    },
  });
}

/**
 * Forward only an explicit caller-provided OpenAI key.
 *
 * The API host owns default model/key resolution. Injecting the Next.js process env
 * here turns every chat into an explicit per-request key override, which bypasses
 * API-side defaults and saved model config precedence.
 */
function resolveUpstreamOpenAiKey(req: Request): string | undefined {
  const fromHeader = req.headers.get('x-openai-key')?.trim();
  if (fromHeader) return fromHeader;
  return undefined;
}

export async function POST(req: Request) {
  const requestId = randomUUID();
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, 'INVALID_JSON', 'Invalid JSON', requestId);
  }

  const parsed = HarnessChatBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      400,
      'INVALID_BODY',
      'Expected { sessionId, message } for harness chat',
      requestId,
    );
  }

  const openAiKey = resolveUpstreamOpenAiKey(req);
  const local = localDiagnosticConnection(req);
  const target = local?.api.origin ?? TARGET;
  const headers: HeadersInit = {
    ...(local ? { 'x-diagnostics-capability': local.capability } : {}),
    'x-bff-request-id': requestId,
    'Content-Type': 'application/json',
    ...(openAiKey ? { 'x-openai-key': openAiKey } : {}),
    ...(parsed.data.modelConfigId ? { 'x-model-config-id': parsed.data.modelConfigId } : {}),
  };

  let res: Response;
  const headerDeadlineMs = upstreamHeaderTimeoutMs();
  const headerAbort = new AbortController();
  const headerTimer = setTimeout(() => headerAbort.abort(), headerDeadlineMs);
  try {
    res = await fetch(`${target}/v1/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        sessionId: parsed.data.sessionId,
        message: parsed.data.message,
      }),
      signal: headerAbort.signal,
    });
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError';
    if (aborted) {
      return jsonError(
        504,
        'UPSTREAM_HEADER_TIMEOUT',
        'The local API did not respond in time. Retry or export a diagnostic report.',
        requestId,
      );
    }
    return jsonError(
      502,
      'UPSTREAM_UNREACHABLE',
      'The local API could not be reached. Check that it is running or export a diagnostic report.',
      requestId,
    );
  } finally {
    clearTimeout(headerTimer);
  }

  const outHeaders = new Headers();
  const ct = res.headers.get('content-type');
  if (ct) outHeaders.set('Content-Type', ct);
  const apiRequestId = z.string().uuid().safeParse(res.headers.get('x-request-id'));
  outHeaders.set('x-request-id', apiRequestId.success ? apiRequestId.data : requestId);
  outHeaders.set('x-bff-request-id', requestId);
  if (apiRequestId.success) outHeaders.set('x-diagnostics-api-observed', '1');
  outHeaders.set('Cache-Control', 'no-store');
  outHeaders.set('Connection', 'keep-alive');

  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers: outHeaders,
  });
}
