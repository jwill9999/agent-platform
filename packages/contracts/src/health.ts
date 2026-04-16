import { z } from 'zod';

/** Shared shape for HTTP liveness/readiness responses. */
export const HealthResponseSchema = z.object({
  ok: z.literal(true),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;

// ---------------------------------------------------------------------------
// Deep readiness check
// ---------------------------------------------------------------------------

export const SubsystemCheckSchema = z.object({
  status: z.enum(['healthy', 'degraded', 'unhealthy']),
  latencyMs: z.number().optional(),
  details: z.record(z.string()).optional(),
  error: z.string().optional(),
});

export type SubsystemCheck = z.infer<typeof SubsystemCheckSchema>;

export const ReadinessResponseSchema = z.object({
  status: z.enum(['healthy', 'degraded', 'unhealthy']),
  checks: z.record(SubsystemCheckSchema),
  timestamp: z.string().datetime(),
});

export type ReadinessResponse = z.infer<typeof ReadinessResponseSchema>;
