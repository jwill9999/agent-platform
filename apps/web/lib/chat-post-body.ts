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
const ChatPostBodySchema = z.object({
  messages: z.array(z.any()),
  model: z.string().optional(),
  context: FileContextSchema.optional(),
});

export type ChatPostBody = z.infer<typeof ChatPostBodySchema>;

export type ParseChatPostBodyResult =
  | { ok: true; value: ChatPostBody }
  | { ok: false; message: string };

export function parseChatPostBody(body: unknown): ParseChatPostBodyResult {
  const parsed = ChatPostBodySchema.safeParse(body);
  if (parsed.success) {
    return { ok: true, value: parsed.data };
  }
  return {
    ok: false,
    message: 'Invalid body: expected { messages, model?, context? }',
  };
}
