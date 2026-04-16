import {
  getOpenAiKeyOrNextJsonResponse,
  resolveGatedOpenAiKeyForRequest,
  streamChat,
  type ChatMessage,
} from '@agent-platform/model-router';
import { convertToCoreMessages, type UIMessage } from 'ai';
import { z } from 'zod';

export const runtime = 'nodejs';

const ChatPostBodySchema = z.object({
  messages: z.array(z.any()),
  model: z.string().optional(),
});

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

  const parsed = ChatPostBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, 'INVALID_BODY', 'Invalid body: expected { messages, model? }');
  }

  const model = parsed.data.model ?? 'gpt-4o-mini';

  try {
    const core = convertToCoreMessages(parsed.data.messages as UIMessage[]);
    const messages = coreMessagesToChatMessages(core);
    const result = streamChat({ provider: 'openai', apiKey, model, messages });
    return result.toDataStreamResponse({
      getErrorMessage: (error) => `CHAT_STREAM_ERROR: ${getErrorMessage(error)}`,
    });
  } catch (error) {
    const message = getErrorMessage(error);
    return jsonError(502, 'CHAT_STREAM_ERROR', message);
  }
}
