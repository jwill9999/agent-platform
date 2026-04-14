import { z } from 'zod';

/** Persisted chat/session row (API + DB). */
export const SessionRecordSchema = z.object({
  id: z.string().min(1),
  agentId: z.string().min(1),
  createdAtMs: z.number().int().nonnegative(),
  updatedAtMs: z.number().int().nonnegative(),
});

export type SessionRecord = z.infer<typeof SessionRecordSchema>;

/** POST /v1/sessions body — `id` optional (server generates if omitted). */
export const SessionCreateBodySchema = z.object({
  agentId: z.string().min(1),
  id: z.string().min(1).optional(),
});

export type SessionCreateBody = z.infer<typeof SessionCreateBodySchema>;
