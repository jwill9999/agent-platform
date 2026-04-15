import { END, MemorySaver, START, StateGraph } from '@langchain/langgraph';
import type { Plan } from '@agent-platform/contracts';
import { HarnessState, type HarnessStateType } from './graphState.js';
import type { TraceEvent } from './trace.js';

export type ToolExecutor = (toolId: string) => Promise<{ ok: boolean; detail?: string }>;

/**
 * Node function signature for LLM reasoning and tool dispatch.
 * These are created externally (factory) and passed in.
 */
export type GraphNodeFn = (state: HarnessStateType) => Promise<Partial<HarnessStateType>>;

export type BuildHarnessGraphOptions = {
  /** Stub planner: if `plan` in initial state is null, use this fixed plan. */
  stubPlan?: Plan;
  executeTool: ToolExecutor;
  /** LLM reasoning node (ReAct path). Required for mode='react'. */
  llmReasonNode?: GraphNodeFn;
  /** Tool dispatch node (ReAct path). Required for mode='react'. */
  toolDispatchNode?: GraphNodeFn;
};

/** Number of consecutive identical tool calls before loop detection triggers. */
const LOOP_DETECTION_THRESHOLD = 3;

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function hashToolCall(name: string, args: Record<string, unknown>): string {
  return `${name}:${JSON.stringify(args, Object.keys(args).sort())}`;
}

// ---------------------------------------------------------------------------
// Plan path nodes (existing)
// ---------------------------------------------------------------------------

function createResolvePlanNode(options: BuildHarnessGraphOptions) {
  return (state: HarnessStateType): Partial<HarnessStateType> => {
    const plan = state.plan ?? options.stubPlan ?? null;
    if (!plan) {
      const tr: TraceEvent[] = [{ type: 'graph_start', runId: state.runId }, { type: 'graph_end' }];
      return { plan: null, trace: tr, halted: true };
    }
    const tr: TraceEvent[] = [
      { type: 'graph_start', runId: state.runId },
      { type: 'plan_ready', planId: plan.id, taskCount: plan.tasks.length },
    ];
    if (plan.tasks.length === 0) {
      tr.push({ type: 'graph_end' });
    }
    return { plan, trace: tr, taskIndex: 0, halted: false };
  };
}

function createExecuteNode(options: BuildHarnessGraphOptions) {
  return async (state: HarnessStateType): Promise<Partial<HarnessStateType>> => {
    if (state.halted) {
      return {};
    }
    const plan = state.plan;
    if (!plan) {
      return { trace: [{ type: 'graph_end' }] };
    }

    if (state.taskIndex >= plan.tasks.length) {
      return {};
    }

    if (state.taskIndex >= state.limits.maxSteps) {
      return {
        halted: true,
        trace: [{ type: 'limit_hit', kind: 'max_steps' }],
      };
    }

    const task = plan.tasks[state.taskIndex];
    if (!task) {
      return { trace: [{ type: 'graph_end' }] };
    }

    const toolId = task.toolIds?.[0] ?? 'noop';
    const tr: TraceEvent[] = [{ type: 'task_start', taskId: task.id, step: state.taskIndex }];
    const result = await options.executeTool(toolId);
    tr.push({ type: 'task_done', taskId: task.id, step: state.taskIndex, ok: result.ok });

    const nextIndex = state.taskIndex + 1;
    if (nextIndex >= plan.tasks.length) {
      tr.push({ type: 'graph_end' });
    }

    return {
      trace: tr,
      taskIndex: nextIndex,
    };
  };
}

function routeAfterExecute(state: HarnessStateType): typeof END | 'execute' {
  if (state.halted) return END;
  if (!state.plan) return END;
  if (state.taskIndex >= state.plan.tasks.length) return END;
  return 'execute';
}

// ---------------------------------------------------------------------------
// ReAct path nodes and routing
// ---------------------------------------------------------------------------

/**
 * Wraps the external llmReasonNode to:
 * - Increment stepCount
 * - Emit graph_start on first step
 */
function createReactLlmWrapper(llmReasonNode: GraphNodeFn) {
  return async (state: HarnessStateType): Promise<Partial<HarnessStateType>> => {
    const stepCount = (state.stepCount ?? 0) + 1;
    const result = await llmReasonNode(state);

    const trace: TraceEvent[] = [];
    if ((state.stepCount ?? 0) === 0) {
      trace.push({ type: 'graph_start', runId: state.runId });
    }
    if (result.trace) {
      trace.push(...(Array.isArray(result.trace) ? result.trace : [result.trace]));
    }

    return {
      ...result,
      stepCount,
      trace,
    };
  };
}

/**
 * Wraps the external toolDispatchNode to add loop detection.
 * After dispatch, checks recentToolCalls for consecutive identical signatures.
 */
function createReactToolWrapper(toolDispatchNode: GraphNodeFn) {
  return async (state: HarnessStateType): Promise<Partial<HarnessStateType>> => {
    const result = await toolDispatchNode(state);

    // Build tool call signatures from the current llmOutput
    const newSignatures: string[] = [];
    if (state.llmOutput?.kind === 'tool_calls') {
      for (const call of state.llmOutput.calls) {
        newSignatures.push(hashToolCall(call.name, call.args));
      }
    }

    // Append to recent calls window
    const recent = [...(state.recentToolCalls ?? []), ...newSignatures];
    // Keep only the last LOOP_DETECTION_THRESHOLD entries
    const window = recent.slice(-LOOP_DETECTION_THRESHOLD);

    // Check if all entries in the window are identical and we have enough
    const isLoop =
      window.length >= LOOP_DETECTION_THRESHOLD && window.every((sig) => sig === window[0]);

    if (isLoop) {
      const trace: TraceEvent[] = result.trace
        ? Array.isArray(result.trace)
          ? result.trace
          : [result.trace]
        : [];
      trace.push({
        type: 'loop_detected',
        toolSignature: window[0]!,
        repeats: LOOP_DETECTION_THRESHOLD,
      });

      return {
        ...result,
        recentToolCalls: window,
        halted: true,
        trace,
      };
    }

    return {
      ...result,
      recentToolCalls: window,
    };
  };
}

function routeAfterLlm(state: HarnessStateType): 'react_tool_dispatch' | typeof END {
  if (state.halted) return END;
  if (state.llmOutput?.kind === 'tool_calls') return 'react_tool_dispatch';
  return END;
}

function routeAfterReactDispatch(state: HarnessStateType): 'react_llm_reason' | typeof END {
  if (state.halted) return END;
  const maxSteps = state.limits?.maxSteps ?? Infinity;
  if ((state.stepCount ?? 0) >= maxSteps) {
    return END;
  }
  return 'react_llm_reason';
}

// ---------------------------------------------------------------------------
// Mode router
// ---------------------------------------------------------------------------

function routeByMode(state: HarnessStateType): 'resolve_plan' | 'react_llm_reason' {
  if (state.mode === 'plan') return 'resolve_plan';
  return 'react_llm_reason';
}

// ---------------------------------------------------------------------------
// Graph builder
// ---------------------------------------------------------------------------

/**
 * Builds the full harness graph with two execution paths:
 * - **react** (default): LLM ↔ tool dispatch ReAct loop
 * - **plan**: existing plan → execute linear path
 *
 * The `mode` field in initial state determines the path.
 * Compiled with in-memory checkpointing for bring-up / tests.
 */
export function buildHarnessGraph(options: BuildHarnessGraphOptions) {
  const checkpointer = new MemorySaver();

  if (options.llmReasonNode && options.toolDispatchNode) {
    // Full graph with mode router → (react | plan) paths
    const graph = new StateGraph(HarnessState)
      .addNode('resolve_plan', createResolvePlanNode(options))
      .addNode('execute', createExecuteNode(options))
      .addNode('react_llm_reason', createReactLlmWrapper(options.llmReasonNode))
      .addNode('react_tool_dispatch', createReactToolWrapper(options.toolDispatchNode))
      .addEdge('resolve_plan', 'execute')
      .addConditionalEdges('execute', routeAfterExecute)
      .addConditionalEdges('react_llm_reason', routeAfterLlm)
      .addConditionalEdges('react_tool_dispatch', routeAfterReactDispatch)
      .addConditionalEdges(START, routeByMode);

    return graph.compile({ checkpointer });
  }

  // No ReAct nodes → plan-only path (backwards compatible)
  const graph = new StateGraph(HarnessState)
    .addNode('resolve_plan', createResolvePlanNode(options))
    .addNode('execute', createExecuteNode(options))
    .addEdge(START, 'resolve_plan')
    .addEdge('resolve_plan', 'execute')
    .addConditionalEdges('execute', routeAfterExecute);

  return graph.compile({ checkpointer });
}
