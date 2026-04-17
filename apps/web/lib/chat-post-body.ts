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

export function parseChatPostBody(
  body: unknown,
): { ok: true; value: ChatPostBody } | { ok: false; message: string } {
  const standard = StandardChatPostBodySchema.safeParse(body);
  if (standard.success) {
    return { ok: true, value: standard.data };
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
    };
  }

  return {
    ok: false,
    message:
      'Invalid body: expected { messages, model?, context? } or { message, sessionId?, model?, context? }',
  };
}
