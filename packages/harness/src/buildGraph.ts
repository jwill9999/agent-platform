import { END, MemorySaver, START, StateGraph } from '@langchain/langgraph';
import type { RunnableConfig } from '@langchain/core/runnables';
import type { Plan } from '@agent-platform/contracts';
import type { PluginDispatcher } from '@agent-platform/plugin-sdk';
import { HarnessState, type HarnessStateType } from './graphState.js';
import type { TraceEvent } from './trace.js';
import { checkDeadline } from './deadline.js';

export type ToolExecutor = (toolId: string) => Promise<{ ok: boolean; detail?: string }>;

/**
 * Node function signature for LLM reasoning and tool dispatch.
 * These are created externally (factory) and passed in.
 * The optional `config` parameter carries runtime context like AbortSignal.
 */
export type GraphNodeFn = (
  state: HarnessStateType,
  config?: RunnableConfig,
) => Promise<Partial<HarnessStateType>>;

export type BuildHarnessGraphOptions = {
  /** Stub planner: if `plan` in initial state is null, use this fixed plan. */
  stubPlan?: Plan;
  executeTool: ToolExecutor;
  /** Optional DoD proposer node, run once before the first react llmReason. */
  dodProposeNode?: GraphNodeFn;
  /** Optional DoD check node, run after a tool-free draft answer before END. */
  dodCheckNode?: GraphNodeFn;
  /** LLM reasoning node (ReAct path). Required for mode='react'. */
  llmReasonNode?: GraphNodeFn;
  /** Tool dispatch node (ReAct path). Required for mode='react'. */
  toolDispatchNode?: GraphNodeFn;
  /**
   * Optional critic / evaluator node (ReAct path). When provided, the graph
   * routes `llmReason → critic → (END | llmReason)` instead of going straight
   * to END on a tool-free LLM response. Cap is sourced from
   * `executionLimits.maxCriticIterations` (default 3).
   */
  criticNode?: GraphNodeFn;
  /** Plan generate node (plan path). Optional — if absent, falls back to stubPlan. */
  planGenerateNode?: GraphNodeFn;
  /** Plugin dispatcher for lifecycle hooks (plan-mode task start/end). */
  dispatcher?: PluginDispatcher;
};

/** Number of consecutive identical tool calls before loop detection triggers. */
const LOOP_DETECTION_THRESHOLD = 3;

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function hashToolCall(name: string, args: Record<string, unknown>): string {
  return `${name}:${JSON.stringify(
    args,
    Object.keys(args).sort((a, b) => a.localeCompare(b)),
  )}`;
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
    const { plan } = state;
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

    // Fire onTaskStart plugin hook
    if (options.dispatcher) {
      try {
        await options.dispatcher.onTaskStart({
          sessionId: state.sessionId ?? '',
          runId: state.runId ?? '',
          planId: plan.id,
          taskId: task.id,
          toolIds: task.toolIds ?? [],
        });
      } catch {
        /* plugin errors must not crash the graph */
      }
    }

    const result = await options.executeTool(toolId);
    tr.push({ type: 'task_done', taskId: task.id, step: state.taskIndex, ok: result.ok });

    // Fire onTaskEnd plugin hook
    if (options.dispatcher) {
      try {
        await options.dispatcher.onTaskEnd({
          sessionId: state.sessionId ?? '',
          runId: state.runId ?? '',
          taskId: task.id,
          ok: result.ok,
          detail: result.detail,
        });
      } catch {
        /* plugin errors must not crash the graph */
      }
    }

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
  if (checkDeadline(state).expired) return END;
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
 * - Forward RunnableConfig (carries AbortSignal) to the inner node
 */
function createReactLlmWrapper(llmReasonNode: GraphNodeFn) {
  return async (
    state: HarnessStateType,
    config?: RunnableConfig,
  ): Promise<Partial<HarnessStateType>> => {
    const stepCount = (state.stepCount ?? 0) + 1;
    const result = await llmReasonNode(state, config);

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
 * Forwards RunnableConfig (carries AbortSignal) to the inner node.
 */
function createReactToolWrapper(toolDispatchNode: GraphNodeFn) {
  return async (
    state: HarnessStateType,
    config?: RunnableConfig,
  ): Promise<Partial<HarnessStateType>> => {
    const result = await toolDispatchNode(state, config);

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
      let trace: TraceEvent[];
      if (!result.trace) {
        trace = [];
      } else if (Array.isArray(result.trace)) {
        trace = result.trace;
      } else {
        trace = [result.trace];
      }
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

function routeAfterLlmWithCritic(
  state: HarnessStateType,
): 'react_tool_dispatch' | 'react_critic' | typeof END {
  if (state.halted) return END;
  if (state.llmOutput?.kind === 'tool_calls') return 'react_tool_dispatch';
  return 'react_critic';
}

function routeAfterLlmWithDod(
  state: HarnessStateType,
): 'react_tool_dispatch' | 'react_dod_check' | typeof END {
  if (state.halted) return END;
  if (state.llmOutput?.kind === 'tool_calls') return 'react_tool_dispatch';
  return 'react_dod_check';
}

/** Default cap for critic iterations when not configured on executionLimits. */
const DEFAULT_MAX_CRITIC_ITERATIONS = 3;

function routeAfterCritic(state: HarnessStateType): 'react_llm_reason' | typeof END {
  if (state.halted) return END;
  if (checkDeadline(state).expired) return END;
  const cap = state.limits?.maxCriticIterations ?? DEFAULT_MAX_CRITIC_ITERATIONS;
  const iterations = state.iterations ?? 0;
  // Critic clears `critique` on accept; otherwise it sets a non-empty value.
  const accepted = !state.critique;
  if (accepted) return END;
  if (iterations >= cap) return END;
  return 'react_llm_reason';
}

function routeAfterCriticWithDod(
  state: HarnessStateType,
): 'react_llm_reason' | 'react_dod_check' | typeof END {
  if (state.halted) return END;
  if (checkDeadline(state).expired) return END;
  const cap = state.limits?.maxCriticIterations ?? DEFAULT_MAX_CRITIC_ITERATIONS;
  const iterations = state.iterations ?? 0;
  const accepted = !state.critique;
  if (!accepted && iterations >= cap) return END;
  if (!accepted) return 'react_llm_reason';
  return 'react_dod_check';
}

function routeAfterDodCheck(state: HarnessStateType): 'react_llm_reason' | typeof END {
  if (state.halted) return END;
  if (checkDeadline(state).expired) return END;
  if (state.dodContract?.passed) return END;
  const cap = state.limits?.maxCriticIterations ?? DEFAULT_MAX_CRITIC_ITERATIONS;
  if ((state.iterations ?? 0) >= cap) return END;
  return 'react_llm_reason';
}

function routeAfterReactDispatch(state: HarnessStateType): 'react_llm_reason' | typeof END {
  if (state.halted) return END;
  if (checkDeadline(state).expired) return END;
  const maxSteps = state.limits?.maxSteps ?? Infinity;
  if ((state.stepCount ?? 0) >= maxSteps) {
    return END;
  }
  return 'react_llm_reason';
}

// ---------------------------------------------------------------------------
// Mode router
// ---------------------------------------------------------------------------

/**
 * Route after plan_generate: if planning halted (failed), go to END;
 * otherwise forward to resolve_plan which sets up taskIndex etc.
 */
function routeAfterPlanGenerate(state: HarnessStateType): 'resolve_plan' | typeof END {
  if (state.halted) return END;
  return 'resolve_plan';
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

  // Determine plan-mode routing based on whether planGenerateNode is provided
  const planGenNode: GraphNodeFn = options.planGenerateNode ?? (async () => ({}));

  if (options.llmReasonNode && options.toolDispatchNode) {
    // Full graph with mode router → (react | plan) paths
    if (options.dodProposeNode && options.dodCheckNode && options.criticNode) {
      const routeByMode = (state: HarnessStateType): 'react_dod_propose' | 'plan_generate' => {
        if (state.mode === 'plan') return 'plan_generate';
        return 'react_dod_propose';
      };
      const graph = new StateGraph(HarnessState)
        .addNode('plan_generate', planGenNode)
        .addNode('resolve_plan', createResolvePlanNode(options))
        .addNode('execute', createExecuteNode(options))
        .addNode('react_dod_propose', options.dodProposeNode)
        .addNode('react_llm_reason', createReactLlmWrapper(options.llmReasonNode))
        .addNode('react_tool_dispatch', createReactToolWrapper(options.toolDispatchNode))
        .addNode('react_critic', options.criticNode)
        .addNode('react_dod_check', options.dodCheckNode)
        .addConditionalEdges(START, routeByMode)
        .addConditionalEdges('plan_generate', routeAfterPlanGenerate)
        .addEdge('resolve_plan', 'execute')
        .addConditionalEdges('execute', routeAfterExecute)
        .addEdge('react_dod_propose', 'react_llm_reason')
        .addConditionalEdges('react_llm_reason', routeAfterLlmWithCritic)
        .addConditionalEdges('react_tool_dispatch', routeAfterReactDispatch)
        .addConditionalEdges('react_critic', routeAfterCriticWithDod)
        .addConditionalEdges('react_dod_check', routeAfterDodCheck);
      return graph.compile({ checkpointer });
    }

    if (options.dodProposeNode && options.dodCheckNode) {
      const routeByMode = (state: HarnessStateType): 'react_dod_propose' | 'plan_generate' => {
        if (state.mode === 'plan') return 'plan_generate';
        return 'react_dod_propose';
      };
      const graph = new StateGraph(HarnessState)
        .addNode('plan_generate', planGenNode)
        .addNode('resolve_plan', createResolvePlanNode(options))
        .addNode('execute', createExecuteNode(options))
        .addNode('react_dod_propose', options.dodProposeNode)
        .addNode('react_llm_reason', createReactLlmWrapper(options.llmReasonNode))
        .addNode('react_tool_dispatch', createReactToolWrapper(options.toolDispatchNode))
        .addNode('react_dod_check', options.dodCheckNode)
        .addConditionalEdges(START, routeByMode)
        .addConditionalEdges('plan_generate', routeAfterPlanGenerate)
        .addEdge('resolve_plan', 'execute')
        .addConditionalEdges('execute', routeAfterExecute)
        .addEdge('react_dod_propose', 'react_llm_reason')
        .addConditionalEdges('react_llm_reason', routeAfterLlmWithDod)
        .addConditionalEdges('react_tool_dispatch', routeAfterReactDispatch)
        .addConditionalEdges('react_dod_check', routeAfterDodCheck);
      return graph.compile({ checkpointer });
    }

    if (options.criticNode) {
      const routeByMode = (state: HarnessStateType): 'react_llm_reason' | 'plan_generate' => {
        if (state.mode === 'plan') return 'plan_generate';
        return 'react_llm_reason';
      };
      const llmRouter = routeAfterLlmWithCritic;
      const graph = new StateGraph(HarnessState)
        .addNode('plan_generate', planGenNode)
        .addNode('resolve_plan', createResolvePlanNode(options))
        .addNode('execute', createExecuteNode(options))
        .addNode('react_llm_reason', createReactLlmWrapper(options.llmReasonNode))
        .addNode('react_tool_dispatch', createReactToolWrapper(options.toolDispatchNode))
        .addNode('react_critic', options.criticNode)
        .addConditionalEdges(START, routeByMode)
        .addConditionalEdges('plan_generate', routeAfterPlanGenerate)
        .addEdge('resolve_plan', 'execute')
        .addConditionalEdges('execute', routeAfterExecute)
        .addConditionalEdges('react_llm_reason', llmRouter)
        .addConditionalEdges('react_tool_dispatch', routeAfterReactDispatch)
        .addConditionalEdges('react_critic', routeAfterCritic);
      return graph.compile({ checkpointer });
    }

    const routeByMode = (state: HarnessStateType): 'react_llm_reason' | 'plan_generate' => {
      if (state.mode === 'plan') return 'plan_generate';
      return 'react_llm_reason';
    };
    const graph = new StateGraph(HarnessState)
      .addNode('plan_generate', planGenNode)
      .addNode('resolve_plan', createResolvePlanNode(options))
      .addNode('execute', createExecuteNode(options))
      .addNode('react_llm_reason', createReactLlmWrapper(options.llmReasonNode))
      .addNode('react_tool_dispatch', createReactToolWrapper(options.toolDispatchNode))
      .addConditionalEdges(START, routeByMode)
      .addConditionalEdges('plan_generate', routeAfterPlanGenerate)
      .addEdge('resolve_plan', 'execute')
      .addConditionalEdges('execute', routeAfterExecute)
      .addConditionalEdges('react_llm_reason', routeAfterLlm)
      .addConditionalEdges('react_tool_dispatch', routeAfterReactDispatch);

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
