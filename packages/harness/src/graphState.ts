import { Annotation } from '@langchain/langgraph';
import type { ExecutionLimits, Plan } from '@agent-platform/contracts';
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

  // -- LLM reasoning fields (task n0l.1) --
  messages: Annotation<ChatMessage[]>({
    reducer: appendMessages,
    default: () => [],
  }),
  toolDefinitions: Annotation<ToolDefinition[]>(),
  llmOutput: Annotation<LlmOutput | null>(),
  modelConfig: Annotation<LlmModelConfig | null>(),

  // -- Pre-allocated for limits enforcement (task qlp.2) --
  totalTokensUsed: Annotation<number>(),
  totalCostUnits: Annotation<number>(),
});

export type HarnessStateType = typeof HarnessState.State;
