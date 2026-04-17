import {
  getOpenAiKeyOrNextJsonResponse,
  resolveGatedOpenAiKeyForRequest,
  streamChat,
  type ChatMessage,
} from '@agent-platform/model-router';
import { convertToCoreMessages, type UIMessage } from 'ai';

import { parseChatPostBody } from '@/lib/chat-post-body';
import { sanitiseFileContext, formatFileContext, type FileContextEntry } from '@/lib/file-context';

export const runtime = 'nodejs';

/** Set `CHAT_ROUTE_DEBUG=1` on the Next.js server to log request flow (no API keys, no message text). */
function chatRouteDebugEnabled(): boolean {
  return process.env.CHAT_ROUTE_DEBUG === '1';
}

function chatRouteLog(payload: Record<string, unknown>): void {
  if (!chatRouteDebugEnabled()) return;
  console.log('[api/chat]', JSON.stringify({ ts: new Date().toISOString(), ...payload }));
}

function jsonError(status: number, code: string, message: string, details?: unknown): Response {
  return new Response(
    JSON.stringify({
      error: {
        code,
        message,
        ...(details === undefined ? {} : { details }),
      },
    }),
    {
      status,
      headers: { 'Content-Type': 'application/json' },
    },
  );
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return 'Chat request failed';
  }
}

function coreMessagesToChatMessages(core: ReturnType<typeof convertToCoreMessages>): ChatMessage[] {
  return core.map((m) => {
    const role = m.role;
    if (role !== 'user' && role !== 'assistant' && role !== 'system') {
      throw new Error(`Unsupported message role: ${String(role)}`);
    }
    let content = '';
    if (typeof m.content === 'string') {
      content = m.content;
    } else if (Array.isArray(m.content)) {
      content = m.content
        .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
        .map((p) => p.text)
        .join('');
    }
    return { role, content };
  });
}

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();
  chatRouteLog({ event: 'request_start', requestId });

  const gated = resolveGatedOpenAiKeyForRequest({ preferredEnvVar: 'NEXT_OPENAI_API_KEY' });
  const keyOrError = getOpenAiKeyOrNextJsonResponse(gated);
  if (keyOrError instanceof Response) {
    const status = keyOrError.status;
    chatRouteLog({
      event: 'openai_key_gate',
      requestId,
      outcome: gated.outcome,
      responseStatus: status,
    });
    return keyOrError;
  }
  const apiKey = keyOrError;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    chatRouteLog({ event: 'invalid_json', requestId });
    return jsonError(400, 'INVALID_JSON', 'Invalid JSON');
  }

  const parsed = parseChatPostBody(body);
  if (!parsed.ok) {
    chatRouteLog({
      event: 'invalid_body',
      requestId,
      bodyShape: parsed.bodyShape,
    });
    return jsonError(400, 'INVALID_BODY', parsed.message);
  }

  chatRouteLog({
    event: 'body_parsed',
    requestId,
    bodyShape: parsed.bodyShape,
    messageCount: parsed.value.messages.length,
    hasContextFiles: Boolean(parsed.value.context?.files?.length),
  });

  const model = parsed.value.model ?? 'gpt-4o-mini';

  try {
    const core = convertToCoreMessages(parsed.value.messages as UIMessage[]);
    const messages = coreMessagesToChatMessages(core);

    // Inject file context into the last user message if present
    if (parsed.value.context?.files?.length) {
      const { files } = sanitiseFileContext(parsed.value.context.files as FileContextEntry[]);
      if (files.length > 0) {
        const contextBlock = formatFileContext(files);
        let lastUserIdx = -1;
        for (let i = messages.length - 1; i >= 0; i--) {
          if (messages[i]!.role === 'user') {
            lastUserIdx = i;
            break;
          }
        }
        if (lastUserIdx >= 0) {
          const target = messages[lastUserIdx]!;
          messages[lastUserIdx] = {
            role: target.role,
            content: contextBlock + target.content,
          };
        }
      }
    }

    const result = streamChat({ provider: 'openai', apiKey, model, messages });
    chatRouteLog({
      event: 'stream_start',
      requestId,
      model,
      coreRoleCount: messages.length,
    });
    return result.toDataStreamResponse({
      getErrorMessage: (error) => `CHAT_STREAM_ERROR: ${getErrorMessage(error)}`,
    });
  } catch (error) {
    const message = getErrorMessage(error);
    chatRouteLog({
      event: 'handler_error',
      requestId,
      error: message,
    });
    return jsonError(502, 'CHAT_STREAM_ERROR', message);
  }
}
