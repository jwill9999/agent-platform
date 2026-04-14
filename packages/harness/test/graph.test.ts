import { describe, expect, it, vi } from 'vitest';
import type { ExecutionLimits, Plan } from '@agent-platform/contracts';
import { buildHarnessGraph } from '../src/buildGraph.js';

const limits: ExecutionLimits = {
  maxSteps: 8,
  maxParallelTasks: 2,
  timeoutMs: 60_000,
};

describe('buildHarnessGraph', () => {
  it('runs stub plan with mock tools and captures trace', async () => {
    const plan: Plan = {
      id: 'p1',
      tasks: [
        { id: 't1', description: 'one', toolIds: ['a'] },
        { id: 't2', description: 'two', toolIds: ['b'] },
      ],
    };
    const exec = vi.fn(async (toolId: string) => ({ ok: toolId === 'a' || toolId === 'b' }));

    const graph = buildHarnessGraph({
      executeTool: exec,
    });

    const out = await graph.invoke(
      {
        trace: [],
        plan,
        taskIndex: 0,
        limits,
        runId: 'run-1',
        halted: false,
      },
      { configurable: { thread_id: 'test-thread-1' } },
    );

    expect(exec).toHaveBeenCalledTimes(2);
    expect(exec).toHaveBeenCalledWith('a');
    expect(exec).toHaveBeenCalledWith('b');

    const trace = out.trace;
    expect(trace.some((e) => e.type === 'plan_ready' && e.planId === 'p1')).toBe(true);
    expect(trace.filter((e) => e.type === 'task_done').length).toBe(2);
    expect(trace.some((e) => e.type === 'graph_end')).toBe(true);
  });

  it('stops when maxSteps exceeded', async () => {
    const plan: Plan = {
      id: 'p2',
      tasks: [
        { id: 't1', description: 'one', toolIds: ['x'] },
        { id: 't2', description: 'two', toolIds: ['y'] },
        { id: 't3', description: 'three', toolIds: ['z'] },
      ],
    };
    const tightLimits: ExecutionLimits = { ...limits, maxSteps: 2 };

    const graph = buildHarnessGraph({
      executeTool: async () => ({ ok: true }),
    });

    const out = await graph.invoke(
      {
        trace: [],
        plan,
        taskIndex: 0,
        limits: tightLimits,
        runId: 'run-2',
        halted: false,
      },
      { configurable: { thread_id: 'test-thread-2' } },
    );

    expect(out.trace.some((e) => e.type === 'limit_hit' && e.kind === 'max_steps')).toBe(true);
    expect(out.halted).toBe(true);
  });
});
