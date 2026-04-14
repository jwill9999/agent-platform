import { describe, expect, it } from 'vitest';

import type { Agent } from '@agent-platform/contracts';
import { isToolExecutionAllowed } from '@agent-platform/agent-validation';
import { buildHarnessGraph } from '@agent-platform/harness';

/**
 * End-to-end wiring: LangGraph harness tool executor consults the same allowlist
 * rules as runtime policy (2tw.2) — disallowed MCP server ids fail the tool step.
 */
describe('Harness + validation path', () => {
  const agent: Agent = {
    id: 'agent-test',
    name: 'Policy test',
    allowedSkillIds: [],
    allowedToolIds: ['plain-t'],
    allowedMcpServerIds: ['mcp-ok'],
    executionLimits: {
      maxSteps: 10,
      maxParallelTasks: 2,
      timeoutMs: 60_000,
    },
  };

  it('runs tasks with executor gated by isToolExecutionAllowed', async () => {
    const graph = buildHarnessGraph({
      executeTool: async (toolId) => {
        const ok = isToolExecutionAllowed(agent, toolId);
        return { ok };
      },
    });

    const out = await graph.invoke(
      {
        trace: [],
        plan: {
          id: 'plan-e2e',
          tasks: [
            { id: 'u1', description: 'allowed', toolIds: ['mcp-ok:echo'] },
            { id: 'u2', description: 'blocked', toolIds: ['bad-server:echo'] },
          ],
        },
        taskIndex: 0,
        limits: agent.executionLimits,
        runId: 'run-e2e',
        halted: false,
      },
      { configurable: { thread_id: 'harness-path-1' } },
    );

    const dones = out.trace.filter((e): e is Extract<typeof e, { type: 'task_done' }> => e.type === 'task_done');
    expect(dones).toHaveLength(2);
    expect(dones[0]?.ok).toBe(true);
    expect(dones[1]?.ok).toBe(false);
  });
});
