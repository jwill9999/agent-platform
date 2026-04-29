import { z } from 'zod';

/** Roles valid for persisted conversation messages. */
export const MessageRoleSchema = z.enum(['user', 'assistant', 'system', 'tool']);
export type MessageRole = z.infer<typeof MessageRoleSchema>;

export const PersistedToolCallSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  args: z.record(z.string(), z.unknown()),
});
export type PersistedToolCall = z.infer<typeof PersistedToolCallSchema>;

/** A single message in a conversation history. */
export const MessageRecordSchema = z.object({
  id: z.string().min(1),
  sessionId: z.string().min(1),
  role: MessageRoleSchema,
  content: z.string(),
  toolCallId: z.string().nullish(),
  toolCalls: z.array(PersistedToolCallSchema).optional(),
  createdAtMs: z.number().int().nonnegative(),
});

export type MessageRecord = z.infer<typeof MessageRecordSchema>;

/** Body for appending a message to a session. */
export const MessageCreateBodySchema = z.object({
  role: MessageRoleSchema,
  content: z.string().min(1),
  toolCallId: z.string().optional(),
});

export type MessageCreateBody = z.infer<typeof MessageCreateBodySchema>;
