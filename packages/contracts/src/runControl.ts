import { z } from 'zod';

export const RunControlStateSchema = z.enum([
  'running',
  'waiting_for_approval',
  'stop_requested',
  'cancelled',
  'completed',
  'failed',
  'interrupted',
  'outcome_unknown',
]);
export const RunControlReasonSchema = z.enum([
  'none',
  'user_stop',
  'timeout',
  'client_disconnect',
  'process_interrupted',
  'execution_failed',
]);
const identifier = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/);
const timestamp = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
/** Mandatory execution authority; contains no request content, paths or raw failures. */
export const RunControlRecordSchema = z
  .object({
    id: z.string().uuid(),
    sessionId: identifier,
    projectId: identifier.optional(),
    processInstanceId: z.string().uuid(),
    state: RunControlStateSchema,
    version: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    createdAtMs: timestamp,
    updatedAtMs: timestamp,
    stopRequestedAtMs: timestamp.optional(),
    stopAcknowledgedAtMs: timestamp.optional(),
    settledAtMs: timestamp.optional(),
    reason: RunControlReasonSchema,
    inFlight: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  })
  .strict();
export type RunControlState = z.infer<typeof RunControlStateSchema>;
export type RunControlReason = z.infer<typeof RunControlReasonSchema>;
export type RunControlRecord = z.infer<typeof RunControlRecordSchema>;
