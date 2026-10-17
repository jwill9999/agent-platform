import { z } from 'zod';
import { RunControlStateSchema, RunControlReasonSchema } from './runControl.js';

const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const duration = z.number().finite().nonnegative().max(Number.MAX_SAFE_INTEGER);
const id = z.string().uuid();
/** Versioned estimates and fixed decisions only; never provider usage or prompt content. */
export const ContextDecisionMetadataSchema = z
  .object({
    estimatorVersion: z.literal('serialized_request_chars_v1'),
    effectivePolicy: z.literal('group_window_working_memory_v1'),
    requestedStrategy: z.enum(['truncate', 'summarize']),
    configuredInputTokens: count.min(1),
    effectiveInputTokens: count,
    estimatedInputBefore: count,
    estimatedInputAfter: count,
    schemaEstimate: count,
    includedGroups: count,
    omittedGroups: count,
    outputCap: count.min(1),
    reason: z.enum(['unchanged', 'windowed', 'required_overflow', 'invalid_history']),
  })
  .strict();
export type ContextDecisionMetadata = z.infer<typeof ContextDecisionMetadataSchema>;

export const DiagnosticPhaseSchema = z.enum([
  'ingress',
  'request',
  'model',
  'context',
  'tool',
  'approval',
  'connection',
  'storage',
  'control',
]);
export const DiagnosticOutcomeSchema = z.enum([
  'started',
  'succeeded',
  'failed',
  'waiting',
  'retrying',
  'cancelled',
  'disconnected',
  'unknown',
]);
export const DiagnosticErrorCodeSchema = z.enum([
  'invalid_request',
  'backend_unavailable',
  'timeout',
  'connection_lost',
  'provider_error',
  'tool_error',
  'permission_denied',
  'cancelled',
  'internal_error',
  'storage_unavailable',
  'context_budget_exceeded',
  'context_invalid_history',
  'model_output_incomplete',
]);
/** Metadata only. Unknown keys fail closed; no free-form payload or error text. */
export const DiagnosticEventSchema = z
  .object({
    schemaVersion: z.literal(1),
    eventId: id,
    processInstanceId: id,
    requestId: id,
    bffRequestId: id.optional(),
    sessionId: id.optional(),
    runId: id.optional(),
    linkedRunId: id.optional(),
    operationId: id.optional(),
    parentOperationId: id.optional(),
    toolExecutionId: id.optional(),
    approvalRequestId: id.optional(),
    modelConfigId: id.optional(),
    phase: DiagnosticPhaseSchema,
    outcome: DiagnosticOutcomeSchema,
    observedAtMs: count,
    durationMs: duration.optional(),
    attempt: count.min(1).optional(),
    provider: z.enum(['openai', 'anthropic', 'google', 'azure', 'ollama', 'other']).optional(),
    // Fixed tool family, never arbitrary registry labels, shell commands or MCP names.
    toolId: z.enum(['read', 'write', 'command', 'search', 'http', 'mcp', 'other']).optional(),
    errorCode: DiagnosticErrorCodeSchema.optional(),
    inputTokens: count.optional(),
    outputTokens: count.optional(),
    contextDecision: ContextDecisionMetadataSchema.optional(),
    control: z
      .object({
        logicalRunId: id,
        state: RunControlStateSchema,
        reason: RunControlReasonSchema,
        stage: z.enum(['requested', 'acknowledged', 'admitted', 'settled', 'state']),
        version: count.min(1),
        inFlight: count,
        kind: z.enum(['model', 'tool', 'sensor', 'setup']).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();
export type DiagnosticEvent = z.infer<typeof DiagnosticEventSchema>;
export const DiagnosticScopeSchema = z.union([
  z.object({ sessionId: id, runId: id.optional() }).strict(),
  z.object({ requestId: id }).strict(),
]);
export type DiagnosticScope = z.infer<typeof DiagnosticScopeSchema>;
export const DiagnosticPartialFailureSchema = z
  .object({
    requestId: id,
    observedAtMs: count,
    durationMs: duration.optional(),
    phase: z.enum(['ingress', 'connection']),
    errorCode: z.enum(['invalid_request', 'backend_unavailable', 'timeout', 'connection_lost']),
  })
  .strict();
export type DiagnosticPartialFailure = z.infer<typeof DiagnosticPartialFailureSchema>;
export const DiagnosticHealthSchema = z
  .object({
    state: z.enum(['starting', 'ready', 'degraded', 'disabled', 'closed']),
    reason: z.enum([
      'none',
      'invalid_configuration',
      'storage_unavailable',
      'schema_incompatible',
      'queue_full',
      'conflict',
      'invalid_event',
      'read_timeout',
      'storage_limited',
      'shutdown_timeout',
    ]),
    pending: count,
    dropped: count,
    conflicts: count,
    pruned: count,
    acknowledgedSequence: count,
    lastAcknowledgedAtMs: count.nullable(),
    processInstanceId: id,
    previousShutdownUnclean: z.boolean(),
  })
  .strict();
export type DiagnosticHealth = z.infer<typeof DiagnosticHealthSchema>;
export const DiagnosticStoredEventSchema = z
  .object({ sequence: count.min(1), event: DiagnosticEventSchema })
  .strict();
export type DiagnosticStoredEvent = z.infer<typeof DiagnosticStoredEventSchema>;
export const DiagnosticPageSchema = z
  .object({
    scope: DiagnosticScopeSchema,
    events: z.array(DiagnosticStoredEventSchema).max(1000),
    snapshotSequence: count,
    earliestSequence: count,
    nextCursor: z.string().max(2048).optional(),
    truncated: z.boolean(),
    health: DiagnosticHealthSchema,
  })
  .strict();
export type DiagnosticPage = z.infer<typeof DiagnosticPageSchema>;
export const DiagnosticReportSchema = z
  .object({
    schemaVersion: z.literal(1),
    source: z.enum(['local-store', 'current-view']),
    scope: DiagnosticScopeSchema,
    summary: z.string().max(500000),
    partialFailure: DiagnosticPartialFailureSchema.optional(),
    events: z.array(DiagnosticStoredEventSchema).max(1000),
    generatedAtMs: count,
    appVersion: z
      .string()
      .regex(/^\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/)
      .max(64)
      .optional(),
    platform: z.enum(['darwin', 'linux', 'win32', 'unknown']).optional(),
    coverage: z
      .object({
        durable: z.boolean(),
        verified: z.boolean(),
        truncated: z.boolean(),
        snapshotSequence: count,
        earliestSequence: count,
        dropped: count,
        conflicts: count,
        pruned: count,
        pending: count,
        previousShutdownUnclean: z.boolean(),
        state: DiagnosticHealthSchema.shape.state,
        reason: DiagnosticHealthSchema.shape.reason,
        lastAcknowledgedAtMs: count.nullable(),
        unfinishedPriorProcess: z.boolean(),
      })
      .strict(),
  })
  .strict();
export type DiagnosticReport = z.infer<typeof DiagnosticReportSchema>;

export const DiagnosticWindowSchema = z
  .object({ fromMs: count, toMs: count, sessionId: id.optional() })
  .strict()
  .refine(
    (window) => window.toMs > window.fromMs && window.toMs - window.fromMs <= 90 * 86400000,
    'Window must be positive and at most 90 days.',
  );
export type DiagnosticWindow = z.infer<typeof DiagnosticWindowSchema>;
export const DiagnosticWindowPageSchema = z
  .object({
    window: DiagnosticWindowSchema,
    events: z.array(DiagnosticStoredEventSchema).max(1000),
    snapshotSequence: count,
    earliestSequence: count,
    nextCursor: z.string().min(1).max(2048).optional(),
    completedCursor: z.string().min(1).max(2048).optional(),
    truncated: z.boolean(),
    health: DiagnosticHealthSchema,
    coverage: z
      .object({
        oldestObservedAtMs: count.nullable(),
        newestObservedAtMs: count.nullable(),
        historyMayBeMissing: z.boolean(),
        gaps: count,
      })
      .strict(),
  })
  .strict();
export type DiagnosticWindowPage = z.infer<typeof DiagnosticWindowPageSchema>;

/**
 * Implementations are observational and must never participate in execution admission.
 * Idempotence/conflict detection covers retained events only. After pruning, an event ID
 * may be recorded again with a new sequence; this is not execution deduplication.
 */
export interface DiagnosticStore {
  readonly ready: Promise<void>;
  record(event: unknown): boolean;
  flush(): Promise<void>;
  query(
    scope: DiagnosticScope,
    options?: { cursor?: string; limit?: number },
  ): Promise<DiagnosticPage>;
  queryWindow(
    window: DiagnosticWindow,
    options?: { cursor?: string; limit?: number },
  ): Promise<DiagnosticWindowPage>;
  listRecent(options?: { limit?: number }): Promise<DiagnosticStoredEvent[]>;
  prune(): Promise<void>;
  health(): DiagnosticHealth;
  close(): Promise<void>;
}
