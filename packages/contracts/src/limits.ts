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
  /** Max calls per tool per sliding window (default 30/min). */
  toolRateLimitPerMinute: z.number().int().positive().optional(),
  /**
   * Max number of evaluator (critic) revise iterations before the harness
   * forcibly accepts the latest answer and ends the run. Default `3` when
   * unset; resolved by the harness so this remains optional on the wire.
   */
  maxCriticIterations: z.number().int().positive().optional(),
});

export type ExecutionLimits = z.infer<typeof ExecutionLimitsSchema>;
