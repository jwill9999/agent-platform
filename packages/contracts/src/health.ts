import { z } from 'zod';

/** Shared shape for HTTP liveness/readiness responses. */
export const HealthResponseSchema = z.object({
  ok: z.literal(true),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;
