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
    expect(trace.some((e) => e.type === 'graph_start' && e.runId === 'run-1')).toBe(true);
    expect(trace.some((e) => e.type === 'plan_ready' && e.planId === 'p1')).toBe(true);
    expect(trace.filter((e) => e.type === 'task_done').length).toBe(2);
    expect(trace.some((e) => e.type === 'graph_end')).toBe(true);
  });

  it('uses stubPlan when initial state has no plan', async () => {
    const stubPlan: Plan = {
      id: 'stub-plan',
      tasks: [
        { id: 's1', description: 'stub 1', toolIds: ['a'] },
        { id: 's2', description: 'stub 2', toolIds: ['b'] },
      ],
    };
    const exec = vi.fn(async () => ({ ok: true }));

    const graph = buildHarnessGraph({ executeTool: exec, stubPlan });

    const out = await graph.invoke(
      {
        trace: [],
        plan: null,
        taskIndex: 0,
        limits,
        runId: 'run-stub',
        halted: false,
      },
      { configurable: { thread_id: 'test-thread-stub' } },
    );

    expect(out.halted).toBe(false);
    expect(exec).toHaveBeenCalledTimes(2);
    expect(out.trace.some((e) => e.type === 'plan_ready' && e.planId === 'stub-plan')).toBe(true);
  });

  it('halts with no tasks when plan and stubPlan are missing', async () => {
    const exec = vi.fn(async () => ({ ok: true }));

    const graph = buildHarnessGraph({ executeTool: exec });

    const out = await graph.invoke(
      {
        trace: [],
        plan: null,
        taskIndex: 0,
        limits,
        runId: 'run-halt',
        halted: false,
      },
      { configurable: { thread_id: 'test-thread-halt' } },
    );

    expect(out.halted).toBe(true);
    expect(exec).not.toHaveBeenCalled();
    const types = out.trace.map((e) => e.type);
    expect(types).toEqual(['graph_start', 'graph_end']);
  });

  it('emits plan_ready and graph_end for an empty plan without tasks', async () => {
    const emptyPlan: Plan = { id: 'empty-plan', tasks: [] };
    const exec = vi.fn(async () => ({ ok: true }));

    const graph = buildHarnessGraph({ executeTool: exec });

    const out = await graph.invoke(
      {
        trace: [],
        plan: emptyPlan,
        taskIndex: 0,
        limits,
        runId: 'run-empty',
        halted: false,
      },
      { configurable: { thread_id: 'test-thread-empty' } },
    );

    expect(out.halted).toBe(false);
    expect(exec).not.toHaveBeenCalled();
    const planReady = out.trace.find((e) => e.type === 'plan_ready');
    expect(planReady).toMatchObject({ type: 'plan_ready', planId: 'empty-plan', taskCount: 0 });
    const types = out.trace.map((e) => e.type);
    expect(types).toContain('graph_end');
    expect(types).not.toContain('task_start');
    expect(types).not.toContain('task_done');
  });

  it('calls noop when task has no toolIds', async () => {
    const plan: Plan = {
      id: 'p-noop',
      tasks: [{ id: 't1', description: 'no tools' }],
    };
    const exec = vi.fn(async (toolId: string) => ({ ok: toolId === 'noop' }));

    const graph = buildHarnessGraph({ executeTool: exec });

    await graph.invoke(
      {
        trace: [],
        plan,
        taskIndex: 0,
        limits,
        runId: 'run-noop',
        halted: false,
      },
      { configurable: { thread_id: 'test-thread-noop' } },
    );

    expect(exec).toHaveBeenCalledTimes(1);
    expect(exec).toHaveBeenCalledWith('noop');
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

    expect(out.trace.some((e) => e.type === 'graph_start' && e.runId === 'run-2')).toBe(true);
    expect(out.trace.some((e) => e.type === 'limit_hit' && e.kind === 'max_steps')).toBe(true);
    expect(out.halted).toBe(true);
  });
});
