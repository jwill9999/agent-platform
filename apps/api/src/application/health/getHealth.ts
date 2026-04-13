import { HealthResponseSchema, type HealthResponse } from '@agent-platform/contracts';

export function getHealth(): HealthResponse {
  return HealthResponseSchema.parse({ ok: true });
}
