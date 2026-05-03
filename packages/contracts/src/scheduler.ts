import { z } from 'zod';

const JsonValueSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(JsonValueSchema),
    z.record(JsonValueSchema),
  ]),
);

export const ScheduledJobScopeSchema = z.enum(['global', 'project', 'agent', 'session']);
export const ScheduledJobStatusSchema = z.enum(['enabled', 'paused', 'archived']);
export const ScheduledJobScheduleTypeSchema = z.enum(['one_off', 'delayed', 'recurring']);
export const ScheduledJobTargetKindSchema = z.enum(['agent_turn', 'built_in_task']);
export const ScheduledJobRunStatusSchema = z.enum([
  'queued',
  'running',
  'succeeded',
  'failed',
  'cancelled',
]);
export const ScheduledJobRunLogLevelSchema = z.enum(['debug', 'info', 'warn', 'error']);

export const ScheduledJobRetryPolicySchema = z.object({
  maxAttempts: z.number().int().min(1).max(20).default(1),
  backoffMs: z.number().int().min(0).max(86_400_000).default(0),
});

const OwnershipShape = {
  scope: ScheduledJobScopeSchema,
  scopeId: z.string().min(1).optional(),
  projectId: z.string().min(1).optional(),
  ownerAgentId: z.string().min(1).optional(),
  ownerSessionId: z.string().min(1).optional(),
  executionAgentId: z.string().min(1).optional(),
  createdFromSessionId: z.string().min(1).optional(),
};

const ScheduleShape = {
  scheduleType: ScheduledJobScheduleTypeSchema,
  runAtMs: z.number().int().nonnegative().optional(),
  intervalMs: z.number().int().positive().optional(),
  cronExpression: z.string().min(1).max(200).optional(),
  timezone: z.string().min(1).max(100).default('UTC'),
  nextRunAtMs: z.number().int().nonnegative().optional(),
};

const DefinitionShape = {
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  instructions: z.string().min(1).max(20_000),
  targetKind: ScheduledJobTargetKindSchema,
  targetPayload: z.record(JsonValueSchema).default({}),
  retryPolicy: ScheduledJobRetryPolicySchema.default({}),
  timeoutMs: z.number().int().positive().max(86_400_000).default(300_000),
  metadata: z.record(JsonValueSchema).default({}),
};

function validateOwnership(value: {
  scope: z.infer<typeof ScheduledJobScopeSchema>;
  scopeId?: string;
  projectId?: string;
  ownerAgentId?: string;
  ownerSessionId?: string;
}) {
  if (value.scope === 'global') {
    return (
      value.scopeId === undefined &&
      value.projectId === undefined &&
      value.ownerAgentId === undefined &&
      value.ownerSessionId === undefined
    );
  }
  if (value.scope === 'project') {
    return (
      value.scopeId !== undefined &&
      value.projectId !== undefined &&
      value.scopeId === value.projectId &&
      value.ownerAgentId === undefined &&
      value.ownerSessionId === undefined
    );
  }
  if (value.scope === 'agent') {
    return (
      value.scopeId !== undefined &&
      value.ownerAgentId !== undefined &&
      value.scopeId === value.ownerAgentId &&
      value.projectId === undefined &&
      value.ownerSessionId === undefined
    );
  }
  return (
    value.scopeId !== undefined &&
    value.ownerSessionId !== undefined &&
    value.scopeId === value.ownerSessionId &&
    value.projectId === undefined &&
    value.ownerAgentId === undefined
  );
}

function ownershipMessage(scope: z.infer<typeof ScheduledJobScopeSchema>): string {
  if (scope === 'global') {
    return 'global scheduled jobs must not include scopeId or owner associations';
  }
  if (scope === 'project') {
    return 'project scheduled jobs require scopeId and projectId to match';
  }
  if (scope === 'agent') {
    return 'agent scheduled jobs require scopeId and ownerAgentId to match';
  }
  return 'session scheduled jobs require scopeId and ownerSessionId to match';
}

function validateSchedule(value: {
  scheduleType: z.infer<typeof ScheduledJobScheduleTypeSchema>;
  runAtMs?: number;
  intervalMs?: number;
  cronExpression?: string;
}) {
  if (value.scheduleType === 'one_off' || value.scheduleType === 'delayed') {
    return value.runAtMs !== undefined;
  }
  return value.intervalMs !== undefined || value.cronExpression !== undefined;
}

function scheduleMessage(scheduleType: z.infer<typeof ScheduledJobScheduleTypeSchema>): string {
  if (scheduleType === 'recurring') {
    return 'recurring scheduled jobs require intervalMs or cronExpression';
  }
  return 'one-off and delayed scheduled jobs require runAtMs';
}

function addOwnershipAndScheduleIssues(
  value: {
    scope: z.infer<typeof ScheduledJobScopeSchema>;
    scopeId?: string;
    projectId?: string;
    ownerAgentId?: string;
    ownerSessionId?: string;
    scheduleType: z.infer<typeof ScheduledJobScheduleTypeSchema>;
    runAtMs?: number;
    intervalMs?: number;
    cronExpression?: string;
  },
  ctx: z.RefinementCtx,
) {
  if (!validateOwnership(value)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: ownershipMessage(value.scope),
      path: ['scopeId'],
    });
  }
  if (!validateSchedule(value)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: scheduleMessage(value.scheduleType),
      path: ['scheduleType'],
    });
  }
}

export const ScheduledJobRecordSchema = z
  .object({
    id: z.string().min(1),
    ...OwnershipShape,
    ...DefinitionShape,
    ...ScheduleShape,
    status: ScheduledJobStatusSchema,
    lastRunAtMs: z.number().int().nonnegative().optional(),
    leaseOwner: z.string().min(1).optional(),
    leaseExpiresAtMs: z.number().int().nonnegative().optional(),
    createdAtMs: z.number().int().nonnegative(),
    updatedAtMs: z.number().int().nonnegative(),
  })
  .superRefine(addOwnershipAndScheduleIssues);

export const ScheduledJobCreateBodySchema = z
  .object({
    ...OwnershipShape,
    ...DefinitionShape,
    ...ScheduleShape,
    status: ScheduledJobStatusSchema.default('paused'),
    lastRunAtMs: z.number().int().nonnegative().optional(),
    leaseOwner: z.string().min(1).optional(),
    leaseExpiresAtMs: z.number().int().nonnegative().optional(),
  })
  .superRefine(addOwnershipAndScheduleIssues);

export const ScheduledJobUpdateBodySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  instructions: z.string().min(1).max(20_000).optional(),
  targetKind: ScheduledJobTargetKindSchema.optional(),
  targetPayload: z.record(JsonValueSchema).optional(),
  scheduleType: ScheduledJobScheduleTypeSchema.optional(),
  runAtMs: z.number().int().nonnegative().nullable().optional(),
  intervalMs: z.number().int().positive().nullable().optional(),
  cronExpression: z.string().min(1).max(200).nullable().optional(),
  timezone: z.string().min(1).max(100).optional(),
  nextRunAtMs: z.number().int().nonnegative().nullable().optional(),
  executionAgentId: z.string().min(1).nullable().optional(),
  createdFromSessionId: z.string().min(1).nullable().optional(),
  retryPolicy: ScheduledJobRetryPolicySchema.optional(),
  timeoutMs: z.number().int().positive().max(86_400_000).optional(),
  metadata: z.record(JsonValueSchema).optional(),
});

export const ScheduledJobQuerySchema = z.object({
  scope: ScheduledJobScopeSchema.optional(),
  scopeId: z.string().min(1).optional(),
  projectId: z.string().min(1).optional(),
  ownerAgentId: z.string().min(1).optional(),
  ownerSessionId: z.string().min(1).optional(),
  executionAgentId: z.string().min(1).optional(),
  status: ScheduledJobStatusSchema.optional(),
  scheduleType: ScheduledJobScheduleTypeSchema.optional(),
  dueBeforeMs: z.coerce.number().int().nonnegative().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

export const ScheduledJobRunRecordSchema = z.object({
  id: z.string().min(1),
  jobId: z.string().min(1),
  status: ScheduledJobRunStatusSchema,
  attempt: z.number().int().min(1),
  queuedAtMs: z.number().int().nonnegative(),
  startedAtMs: z.number().int().nonnegative().optional(),
  completedAtMs: z.number().int().nonnegative().optional(),
  leaseOwner: z.string().min(1).optional(),
  leaseExpiresAtMs: z.number().int().nonnegative().optional(),
  cancelRequestedAtMs: z.number().int().nonnegative().optional(),
  resultSummary: z.string().max(4000).optional(),
  errorCode: z.string().min(1).max(200).optional(),
  errorMessage: z.string().min(1).max(4000).optional(),
  metadata: z.record(JsonValueSchema).default({}),
  createdAtMs: z.number().int().nonnegative(),
  updatedAtMs: z.number().int().nonnegative(),
});

export const ScheduledJobRunCreateBodySchema = z.object({
  jobId: z.string().min(1),
  status: ScheduledJobRunStatusSchema.default('queued'),
  attempt: z.number().int().min(1).default(1),
  leaseOwner: z.string().min(1).optional(),
  leaseExpiresAtMs: z.number().int().nonnegative().optional(),
  metadata: z.record(JsonValueSchema).default({}),
});

export const ScheduledJobRunQuerySchema = z.object({
  jobId: z.string().min(1).optional(),
  status: ScheduledJobRunStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

export const ScheduledJobRunLogRecordSchema = z.object({
  id: z.string().min(1),
  runId: z.string().min(1),
  jobId: z.string().min(1),
  sequence: z.number().int().nonnegative(),
  level: ScheduledJobRunLogLevelSchema,
  message: z.string().min(1).max(4000),
  data: z.record(JsonValueSchema).default({}),
  truncated: z.boolean().default(false),
  createdAtMs: z.number().int().nonnegative(),
});

export const ScheduledJobRunLogCreateBodySchema = z.object({
  runId: z.string().min(1),
  level: ScheduledJobRunLogLevelSchema.default('info'),
  message: z.string().min(1).max(4000),
  data: z.record(JsonValueSchema).default({}),
  truncated: z.boolean().default(false),
});

export type ScheduledJobScope = z.infer<typeof ScheduledJobScopeSchema>;
export type ScheduledJobStatus = z.infer<typeof ScheduledJobStatusSchema>;
export type ScheduledJobScheduleType = z.infer<typeof ScheduledJobScheduleTypeSchema>;
export type ScheduledJobTargetKind = z.infer<typeof ScheduledJobTargetKindSchema>;
export type ScheduledJobRetryPolicy = z.infer<typeof ScheduledJobRetryPolicySchema>;
export type ScheduledJobRecord = z.infer<typeof ScheduledJobRecordSchema>;
export type ScheduledJobCreateBody = z.infer<typeof ScheduledJobCreateBodySchema>;
export type ScheduledJobUpdateBody = z.infer<typeof ScheduledJobUpdateBodySchema>;
export type ScheduledJobQuery = z.infer<typeof ScheduledJobQuerySchema>;
export type ScheduledJobRunStatus = z.infer<typeof ScheduledJobRunStatusSchema>;
export type ScheduledJobRunRecord = z.infer<typeof ScheduledJobRunRecordSchema>;
export type ScheduledJobRunCreateBody = z.infer<typeof ScheduledJobRunCreateBodySchema>;
export type ScheduledJobRunQuery = z.infer<typeof ScheduledJobRunQuerySchema>;
export type ScheduledJobRunLogLevel = z.infer<typeof ScheduledJobRunLogLevelSchema>;
export type ScheduledJobRunLogRecord = z.infer<typeof ScheduledJobRunLogRecordSchema>;
export type ScheduledJobRunLogCreateBody = z.infer<typeof ScheduledJobRunLogCreateBodySchema>;
