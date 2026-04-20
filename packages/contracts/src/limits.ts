import { z } from 'zod';

/** Hard caps for a single agent run (harness enforces). */
export const ExecutionLimitsSchema = z.object({
  maxSteps: z.number().int().positive(),
  maxParallelTasks: z.number().int().positive(),
  timeoutMs: z.number().int().positive(),
  toolTimeoutMs: z.number().int().positive().optional(),
  maxTokens: z.number().int().positive().optional(),
  maxCostUnits: z.number().nonnegative().optional(),
  maxToolCallsTotal: z.number().int().positive().optional(),
});

export type ExecutionLimits = z.infer<typeof ExecutionLimitsSchema>;
