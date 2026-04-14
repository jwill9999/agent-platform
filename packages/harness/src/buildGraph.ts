import { END, MemorySaver, START, StateGraph } from '@langchain/langgraph';
import type { Plan } from '@agent-platform/contracts';
import { HarnessState, type HarnessStateType } from './graphState.js';
import type { TraceEvent } from './trace.js';

export type ToolExecutor = (toolId: string) => Promise<{ ok: boolean; detail?: string }>;

export type BuildHarnessGraphOptions = {
  /** Stub planner: if `plan` in initial state is null, use this fixed plan. */
  stubPlan?: Plan;
  executeTool: ToolExecutor;
};

/**
 * Minimal linear graph: plan → execute tasks one step per node until done or limit.
 * Compiled with in-memory checkpointing for bring-up / tests.
 */
export function buildHarnessGraph(options: BuildHarnessGraphOptions) {
  const checkpointer = new MemorySaver();

  const resolvePlan = (state: HarnessStateType): Partial<HarnessStateType> => {
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

  const executeNode = async (state: HarnessStateType): Promise<Partial<HarnessStateType>> => {
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

  const routeAfterExecute = (state: HarnessStateType): typeof END | 'execute' => {
    if (state.halted) return END;
    if (!state.plan) return END;
    /** More tasks may remain; `maxSteps` is enforced inside `execute` (do not short-circuit here). */
    if (state.taskIndex >= state.plan.tasks.length) return END;
    return 'execute';
  };

  const graph = new StateGraph(HarnessState)
    .addNode('resolve_plan', resolvePlan)
    .addNode('execute', executeNode)
    .addEdge(START, 'resolve_plan')
    .addEdge('resolve_plan', 'execute')
    .addConditionalEdges('execute', routeAfterExecute)
    .compile({ checkpointer });

  return graph;
}
