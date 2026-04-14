import type { Agent, Plan } from '@agent-platform/contracts';
import { PlanSchema } from '@agent-platform/contracts';
import { isToolExecutionAllowed } from '@agent-platform/agent-validation';
import type { ZodIssue } from 'zod';

export type PlannerSuccess = Readonly<{
  ok: true;
  plan: Plan;
}>;

export type PlannerFailure = Readonly<
  | { ok: false; phase: 'json'; error: string }
  | { ok: false; phase: 'schema'; message: string; issues: ZodIssue[] }
  | { ok: false; phase: 'policy'; disallowedToolIds: string[] }
>;

export type PlannerResult = PlannerSuccess | PlannerFailure;

/**
 * Collect every tool id referenced by tasks (including composite MCP ids).
 */
export function collectToolIdsFromPlan(plan: Plan): string[] {
  const ids: string[] = [];
  for (const task of plan.tasks) {
    for (const toolId of task.toolIds ?? []) {
      ids.push(toolId);
    }
  }
  return ids;
}

/**
 * Ensure every tool id in the plan is allowed for this agent. No side effects; no execution.
 */
export function validatePlanToolsForAgent(plan: Plan, agent: Agent): PlannerResult {
  const disallowed: string[] = [];
  for (const toolId of collectToolIdsFromPlan(plan)) {
    if (!isToolExecutionAllowed(agent, toolId)) {
      disallowed.push(toolId);
    }
  }
  if (disallowed.length > 0) {
    return { ok: false, phase: 'policy', disallowedToolIds: disallowed };
  }
  return { ok: true, plan };
}

/**
 * Parse LLM-produced JSON text into a {@link Plan}, then enforce agent allowlists.
 * Does not call tools or the network.
 */
export function parseLlmPlanJson(raw: string, agent: Agent): PlannerResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch (e) {
    return { ok: false, phase: 'json', error: e instanceof Error ? e.message : String(e) };
  }

  const shape = PlanSchema.safeParse(parsed);
  if (!shape.success) {
    return {
      ok: false,
      phase: 'schema',
      message: shape.error.message,
      issues: shape.error.issues,
    };
  }

  return validatePlanToolsForAgent(shape.data, agent);
}
