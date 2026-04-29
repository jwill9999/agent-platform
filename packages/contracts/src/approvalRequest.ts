import { z } from 'zod';
import { RiskTierSchema } from './tool.js';

export const ApprovalRequestStatusSchema = z.enum(['pending', 'approved', 'rejected', 'expired']);
export type ApprovalRequestStatus = z.infer<typeof ApprovalRequestStatusSchema>;

export const ApprovalRequestSchema = z.object({
  id: z.string().min(1),
  sessionId: z.string().min(1),
  runId: z.string().min(1),
  agentId: z.string().min(1),
  toolName: z.string().min(1),
  argsJson: z.string(),
  executionPayloadJson: z.string().optional(),
  riskTier: RiskTierSchema,
  status: ApprovalRequestStatusSchema,
  createdAtMs: z.number(),
  decidedAtMs: z.number().optional(),
  resumedAtMs: z.number().optional(),
  expiresAtMs: z.number().optional(),
  decisionReason: z.string().optional(),
});
export type ApprovalRequest = z.infer<typeof ApprovalRequestSchema>;

export const ApprovalRequestQuerySchema = z.object({
  sessionId: z.string().optional(),
  runId: z.string().optional(),
  agentId: z.string().optional(),
  toolName: z.string().optional(),
  riskTier: RiskTierSchema.optional(),
  status: ApprovalRequestStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(1000).optional().default(100),
  offset: z.coerce.number().int().min(0).optional().default(0),
});
export type ApprovalRequestQuery = z.infer<typeof ApprovalRequestQuerySchema>;

export const ApprovalRequestDecisionBodySchema = z.object({
  reason: z.string().max(1000).optional(),
});
export type ApprovalRequestDecisionBody = z.infer<typeof ApprovalRequestDecisionBodySchema>;
