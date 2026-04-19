import { z } from 'zod';
import { RiskTierSchema } from './tool.js';

export const ToolExecutionStatusSchema = z.enum(['pending', 'success', 'error', 'denied']);
export type ToolExecutionStatus = z.infer<typeof ToolExecutionStatusSchema>;

export const ToolExecutionSchema = z.object({
  id: z.string(),
  toolName: z.string(),
  agentId: z.string(),
  sessionId: z.string(),
  argsJson: z.string(),
  resultJson: z.string().optional(),
  riskTier: RiskTierSchema.optional(),
  status: ToolExecutionStatusSchema,
  startedAtMs: z.number(),
  completedAtMs: z.number().optional(),
  durationMs: z.number().optional(),
});

export type ToolExecution = z.infer<typeof ToolExecutionSchema>;

export const ToolExecutionQuerySchema = z.object({
  agentId: z.string().optional(),
  sessionId: z.string().optional(),
  toolName: z.string().optional(),
  riskTier: RiskTierSchema.optional(),
  status: ToolExecutionStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(1000).optional().default(100),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export type ToolExecutionQuery = z.infer<typeof ToolExecutionQuerySchema>;
