import { z } from 'zod';
import { RiskTierSchema } from './tool.js';

export const CapabilityRecoveryOptionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  action: z.enum(['approve', 'connect', 'sandbox', 'manual', 'cancel']),
});

export const CapabilityRecoverySchema = z.object({
  status: z.enum([
    'capability_missing',
    'provider_required',
    'approval_escalation',
    'sandbox_available',
  ]),
  summary: z.string().min(1),
  options: z.array(CapabilityRecoveryOptionSchema).default([]),
});

export type CapabilityRecoveryOption = z.infer<typeof CapabilityRecoveryOptionSchema>;
export type CapabilityRecovery = z.infer<typeof CapabilityRecoverySchema>;

/** Stream / API payload union for chat and tool events. */
export const OutputSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('text'),
    content: z.string(),
  }),
  z.object({
    type: z.literal('code'),
    language: z.string(),
    content: z.string(),
  }),
  z.object({
    type: z.literal('tool_result'),
    toolId: z.string(),
    data: z.unknown(),
  }),
  z.object({
    type: z.literal('image'),
    toolId: z.string(),
    mimeType: z.string(),
    data: z.string(),
  }),
  z.object({
    type: z.literal('error'),
    message: z.string(),
    code: z.string().optional(),
    recovery: CapabilityRecoverySchema.optional(),
  }),
  z.object({
    type: z.literal('thinking'),
    content: z.string(),
  }),
  z.object({
    type: z.literal('approval_required'),
    approvalRequestId: z.string().min(1),
    toolName: z.string().min(1),
    riskTier: RiskTierSchema.optional(),
    argsPreview: z.unknown(),
    message: z.string().optional(),
  }),
]);

export type Output = z.infer<typeof OutputSchema>;
