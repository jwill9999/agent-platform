import { z } from 'zod';
import { ProjectModeSchema } from './project.js';

/** Persisted chat/session row (API + DB). */
export const SessionRecordSchema = z.object({
  id: z.string().min(1),
  agentId: z.string().min(1),
  mode: ProjectModeSchema.default('chat'),
  projectId: z.string().min(1).nullish(),
  title: z.string().nullish(),
  createdAtMs: z.number().int().nonnegative(),
  updatedAtMs: z.number().int().nonnegative(),
});

export type SessionRecord = z.infer<typeof SessionRecordSchema>;

/** POST /v1/sessions body — id is always system-generated. */
export const SessionCreateBodySchema = z.object({
  agentId: z.string().min(1),
  mode: ProjectModeSchema.default('chat'),
  projectId: z.string().min(1).optional(),
});

export type SessionCreateBody = z.infer<typeof SessionCreateBodySchema>;

export const SessionProjectBindingBodySchema = z.object({
  agentId: z.string().min(1),
  projectId: z.string().min(1),
});
export type SessionProjectBindingBody = z.infer<typeof SessionProjectBindingBodySchema>;

export const SessionProjectBindingResultSchema = z.object({
  created: z.boolean(),
  session: SessionRecordSchema,
});
export type SessionProjectBindingResult = z.infer<typeof SessionProjectBindingResultSchema>;

/** POST /v1/sessions/:id/resume body. */
export const SessionResumeBodySchema = z.object({
  approvalRequestId: z.string().min(1),
});

export type SessionResumeBody = z.infer<typeof SessionResumeBodySchema>;
