import { z } from 'zod';

const boundedNumber = z.number().finite().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const CaptureStoreKindSchema = z.enum(['diagnostics', 'monitoring']);
export type CaptureStoreKind = z.infer<typeof CaptureStoreKindSchema>;
/** Fixed metadata only: neither exceptions nor captured application data belong here. */
export const CaptureFailureSchema = z
  .object({
    schemaVersion: z.literal(1),
    processInstanceId: z.string().uuid(),
    store: CaptureStoreKindSchema,
    operation: z.enum([
      'configuration',
      'startup',
      'append',
      'read',
      'preference',
      'maintenance',
      'close',
      'worker',
    ]),
    cause: z.enum([
      'invalid_configuration',
      'timeout',
      'worker_construction',
      'worker_error',
      'worker_exit',
      'worker_reply',
      'post_message',
      'rpc_unavailable',
      'unknown',
    ]),
    observedAtMs: boundedNumber.int(),
    elapsedMs: boundedNumber,
    deadlineMs: z.union([
      z.literal(200),
      z.literal(1000),
      z.literal(2000),
      z.literal(3000),
      z.null(),
    ]),
    exitCode: z.number().int().min(-2147483648).max(2147483647).optional(),
  })
  .strict();
export type CaptureFailure = z.infer<typeof CaptureFailureSchema>;
/** Undefined means a terminal failure could not be bound to a valid process identity. */
export type CaptureFailureObserver = (failure: CaptureFailure | undefined) => void;
export const CaptureFailureRetentionSchema = z
  .object({
    previousFailureState: z.enum(['loading', 'missing', 'available', 'invalid', 'unavailable']),
    previousFailure: CaptureFailureSchema.optional(),
    publication: z.enum(['idle', 'pending', 'stored', 'unavailable']),
  })
  .strict();
export const CaptureFailureArtifactsSchema = z
  .object({
    diagnostics: CaptureFailureRetentionSchema,
    monitoring: CaptureFailureRetentionSchema,
  })
  .strict();
export type CaptureFailureRetention = z.infer<typeof CaptureFailureRetentionSchema>;
export type CaptureFailureArtifacts = z.infer<typeof CaptureFailureArtifactsSchema>;
