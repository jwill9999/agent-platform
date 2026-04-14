import { streamOpenAiChat, type ChatMessage } from '@agent-platform/model-router';
import { convertToCoreMessages, type UIMessage } from 'ai';
import { z } from 'zod';

export const runtime = 'nodejs';

const ChatPostBodySchema = z.object({
  messages: z.array(z.any()),
  model: z.string().optional(),
});

function resolveOpenAiApiKeyFromEnv(): string | null {
  const preferred = process.env.NEXT_OPENAI_API_KEY?.trim();
  if (preferred) return preferred;

  const legacy = process.env.OPENAI_API_KEY?.trim();
  if (!legacy) return null;

  const allowLegacy = process.env.OPENAI_ALLOW_LEGACY_ENV === '1';
  if (!allowLegacy) {
    throw new Error(
      'OPENAI_API_KEY is set but blocked. Use NEXT_OPENAI_API_KEY, or set OPENAI_ALLOW_LEGACY_ENV=1 to allow legacy env fallback.',
    );
  }
  return legacy;
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
  let apiKey: string | null = null;
  try {
    apiKey = resolveOpenAiApiKeyFromEnv();
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'NEXT_OPENAI_API_KEY is not set' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const parsed = ChatPostBodySchema.safeParse(body);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: 'Invalid body: expected { messages, model? }' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const model = parsed.data.model ?? 'gpt-4o-mini';

  const core = convertToCoreMessages(parsed.data.messages as UIMessage[]);
  const messages = coreMessagesToChatMessages(core);
  const result = streamOpenAiChat({ apiKey, model, messages });
  return result.toDataStreamResponse();
}
