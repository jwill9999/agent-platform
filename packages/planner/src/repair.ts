import type { Agent } from '@agent-platform/contracts';
import type { PlannerFailure, PlannerResult, PlannerSuccess } from './planner.js';
import { parseLlmPlanJson } from './planner.js';

export type PlannerRepairOptions = Readonly<{
  agent: Agent;
  /** Invoked once per attempt; return fresh model output (JSON text). */
  generate: (attempt: number) => Promise<string>;
  maxAttempts: number;
}>;

/**
 * Retry policy: call `generate` up to `maxAttempts` times until {@link parseLlmPlanJson} succeeds.
 * Returns the last failure if all attempts fail. Does not execute tools.
 */
export async function runPlannerRepairLoop(
  options: PlannerRepairOptions,
): Promise<PlannerSuccess | PlannerFailure> {
  let last: PlannerFailure | undefined;
  const n = Math.max(0, options.maxAttempts);
  for (let attempt = 1; attempt <= n; attempt++) {
    const raw = await options.generate(attempt);
    const r: PlannerResult = parseLlmPlanJson(raw, options.agent);
    if (r.ok) {
      return r;
    }
    last = r;
  }
  return last ?? { ok: false, phase: 'json', error: 'no attempts' };
}
