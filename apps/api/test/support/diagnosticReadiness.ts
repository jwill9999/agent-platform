import { setTimeout as delay } from 'node:timers/promises';
import { DiagnosticHealthSchema } from '@agent-platform/contracts';

/** HTTP listening intentionally precedes diagnostic storage readiness. */
export async function waitForDiagnosticReadiness(
  origin: string,
  capability: string,
  hasExited: () => boolean,
  timeoutMs = 5000,
): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const { signal } = controller;
  async function probe(): Promise<void> {
    signal.throwIfAborted();
    if (hasExited()) throw new Error('API fixture exited before diagnostics readiness');
    const response = await fetch(`${origin}/v1/diagnostics/list`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-diagnostics-capability': capability },
      body: JSON.stringify({ limit: 1 }),
      signal,
    }).catch((error: unknown) => {
      // Connection refusal is expected only while the child starts listening.
      if (error instanceof TypeError && (error.cause as { code?: string })?.code === 'ECONNREFUSED')
        return undefined;
      throw error;
    });
    if (response) {
      const body = await response.json();
      if (response.ok) {
        const health = DiagnosticHealthSchema.parse(body.health);
        if (health.state === 'ready' && health.pending === 0) return;
        if (health.state !== 'starting' && health.state !== 'ready')
          throw new Error(`Unexpected diagnostic fixture state: ${health.state}`);
      } else if (response.status !== 503 || body.error?.code !== 'DIAGNOSTICS_UNAVAILABLE') {
        throw new Error(`Unexpected diagnostic readiness response: HTTP ${response.status}`);
      }
    }
    await delay(50, undefined, { signal });
    return probe();
  }
  try {
    await probe();
  } catch (error) {
    if (signal.aborted)
      throw new Error('API fixture diagnostics did not become ready within deadline');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
