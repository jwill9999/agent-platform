import { Annotation } from '@langchain/langgraph';
import type { ExecutionLimits, Plan } from '@agent-platform/contracts';
import type { TraceEvent } from './trace.js';

function appendTrace(left: TraceEvent[], right: TraceEvent | TraceEvent[]): TraceEvent[] {
  const next = Array.isArray(right) ? right : [right];
  return [...left, ...next];
}

/** Harness run state: fixed plan + sequential execution with trace + limits. */
export const HarnessState = Annotation.Root({
  trace: Annotation<TraceEvent[]>({
    reducer: appendTrace,
    default: () => [],
  }),
  plan: Annotation<Plan | null>(),
  taskIndex: Annotation<number>(),
  limits: Annotation<ExecutionLimits>(),
  runId: Annotation<string>(),
  /** Set when {@link ExecutionLimits.maxSteps} would be exceeded. */
  halted: Annotation<boolean>(),
});

export type HarnessStateType = typeof HarnessState.State;
