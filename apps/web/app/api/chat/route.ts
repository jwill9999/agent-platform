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
  const gated = resolveGatedOpenAiKeyForRequest({ preferredEnvVar: 'NEXT_OPENAI_API_KEY' });
  const keyOrError = getOpenAiKeyOrNextJsonResponse(gated);
  if (keyOrError instanceof Response) return keyOrError;
  const apiKey = keyOrError;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, 'INVALID_JSON', 'Invalid JSON');
  }

  const parsed = parseChatPostBody(body);
  if (!parsed.ok) {
    return jsonError(400, 'INVALID_BODY', parsed.message);
  }

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
    return result.toDataStreamResponse({
      getErrorMessage: (error) => `CHAT_STREAM_ERROR: ${getErrorMessage(error)}`,
    });
  } catch (error) {
    const message = getErrorMessage(error);
    return jsonError(502, 'CHAT_STREAM_ERROR', message);
  }
}
