import { z } from 'zod';

const FileContextSchema = z.object({
  files: z.array(
    z.object({
      file: z.string(),
      code: z.string(),
    }),
  ),
});

/** Body shape sent by `@ai-sdk/react` `useChat` (and compatible clients). */
const StandardChatPostBodySchema = z.object({
  messages: z.array(z.any()),
  model: z.string().optional(),
  context: FileContextSchema.optional(),
});

/**
 * Minimal alternate shape for manual tests / older clients (`sessionId` is ignored).
 */
const LegacySingleMessageBodySchema = z.object({
  sessionId: z.string().optional(),
  message: z.string().min(1),
  model: z.string().optional(),
  context: FileContextSchema.optional(),
});

export type ChatPostBody = z.infer<typeof StandardChatPostBodySchema>;

/** How the request body was interpreted (for metrics / opt-in debug logs only). */
export type ChatPostBodyShape = 'messages' | 'legacy_message' | 'invalid';

export type ParseChatPostBodyResult =
  | { ok: true; value: ChatPostBody; bodyShape: Exclude<ChatPostBodyShape, 'invalid'> }
  | { ok: false; message: string; bodyShape: 'invalid' };

export function parseChatPostBody(body: unknown): ParseChatPostBodyResult {
  const standard = StandardChatPostBodySchema.safeParse(body);
  if (standard.success) {
    return { ok: true, value: standard.data, bodyShape: 'messages' };
  }

  const legacy = LegacySingleMessageBodySchema.safeParse(body);
  if (legacy.success) {
    return {
      ok: true,
      value: {
        messages: [{ role: 'user', content: legacy.data.message }],
        model: legacy.data.model,
        context: legacy.data.context,
      },
      bodyShape: 'legacy_message',
    };
  }

  return {
    ok: false,
    bodyShape: 'invalid',
    message:
      'Invalid body: expected { messages, model?, context? } or { message, sessionId?, model?, context? }',
  };
}
