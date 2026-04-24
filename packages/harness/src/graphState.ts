import { Annotation } from '@langchain/langgraph';
import type { DodContract, ExecutionLimits, Plan } from '@agent-platform/contracts';
import type { TraceEvent } from './trace.js';
import type { ChatMessage, LlmModelConfig, LlmOutput, ToolDefinition } from './types.js';

function appendTrace(left: TraceEvent[], right: TraceEvent | TraceEvent[]): TraceEvent[] {
  const next = Array.isArray(right) ? right : [right];
  return [...left, ...next];
}

function appendMessages(left: ChatMessage[], right: ChatMessage | ChatMessage[]): ChatMessage[] {
  const next = Array.isArray(right) ? right : [right];
  return [...left, ...next];
}

/** Graph execution mode: ReAct (LLM↔tool loop) or plan (plan-execute). */
export type GraphMode = 'react' | 'plan';

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
  sessionId: Annotation<string>(),
  /** Set when {@link ExecutionLimits.maxSteps} would be exceeded. */
  halted: Annotation<boolean>(),

  // -- Graph mode (task n0l.3) --
  /** Determines which path the graph takes from START. Defaults to 'react'. */
  mode: Annotation<GraphMode>(),

  // -- LLM reasoning fields (task n0l.1) --
  messages: Annotation<ChatMessage[]>({
    reducer: appendMessages,
    default: () => [],
  }),
  toolDefinitions: Annotation<ToolDefinition[]>(),
  llmOutput: Annotation<LlmOutput | null>(),
  modelConfig: Annotation<LlmModelConfig | null>(),

  // -- ReAct loop tracking (task n0l.3) --
  /** Number of LLM reasoning steps in the current ReAct loop. */
  stepCount: Annotation<number>(),
  /** Rolling window of recent tool call signatures for loop detection. */
  recentToolCalls: Annotation<string[]>(),

  // -- Pre-allocated for limits enforcement (task qlp.2) --
  totalTokensUsed: Annotation<number>(),
  totalCostUnits: Annotation<number>(),

  // -- Cumulative tool call counter (security) --
  /** Total tool calls dispatched across all steps in this run. */
  totalToolCalls: Annotation<number>(),

  // -- Lazy skill loading --
  /** Skill IDs loaded via sys_get_skill_detail in this run (for governor). */
  loadedSkillIds: Annotation<string[]>({
    reducer: (left: string[], right: string | string[]) => {
      const next = Array.isArray(right) ? right : [right];
      return [...left, ...next];
    },
    default: () => [],
  }),

  // -- Retry budget (task 426) --
  /** Total retries consumed across all operations in this run. */
  totalRetries: Annotation<number>(),

  // -- Wall-time deadline propagation --
  /** Epoch millis when this run started (set once in initial state). */
  startedAtMs: Annotation<number>(),
  /** Maximum wall-time budget in ms for the entire run (from executionLimits.timeoutMs). */
  deadlineMs: Annotation<number>(),

  // -- Critic / evaluator loop (task agent-platform-7ga) --
  /**
   * Number of critic→revise→llmReason iterations performed in the current run.
   * Increments by the delta returned from `criticNode`; capped via
   * `executionLimits.maxCriticIterations` or the shared harness default by the graph router.
   */
  iterations: Annotation<number>({
    reducer: (left: number, right: number) => (left ?? 0) + (right ?? 0),
    default: () => 0,
  }),
  /**
   * Last critique text produced by the evaluator. Last-write-wins; the
   * critic node sets this on `revise` and clears it (empty string) on
   * `accept` so a subsequent run does not see stale critique.
   */
  critique: Annotation<string | undefined>(),

  // -- Definition-of-Done contract (task agent-platform-fc8) --
  /** Current DoD contract for the run; last-write-wins across propose/check phases. */
  dodContract: Annotation<DodContract | undefined>(),
});

export type HarnessStateType = typeof HarnessState.State;
