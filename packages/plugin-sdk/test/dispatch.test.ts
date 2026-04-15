import { describe, expect, it, vi } from 'vitest';
import type { Agent } from '@agent-platform/contracts';
import type { PluginHooks } from '../src/hooks.js';
import { createPluginDispatcher } from '../src/dispatch.js';

const agent: Agent = {
  id: 'a1',
  name: 'Test',
  systemPrompt: 'Test agent',
  allowedSkillIds: [],
  allowedToolIds: [],
  allowedMcpServerIds: [],
  executionLimits: { maxSteps: 8, maxParallelTasks: 2, timeoutMs: 60_000 },
};

describe('createPluginDispatcher', () => {
  it('invokes each hook in registration order for onSessionStart', async () => {
    const order: string[] = [];
    const a = {
      onSessionStart: vi.fn(async () => {
        order.push('a');
      }),
    };
    const b = {
      onSessionStart: vi.fn(async () => {
        order.push('b');
      }),
    };
    const d = createPluginDispatcher([a, b]);
    await d.onSessionStart({ sessionId: 's', agentId: agent.id, agent });
    expect(order).toEqual(['a', 'b']);
    expect(a.onSessionStart).toHaveBeenCalledTimes(1);
    expect(b.onSessionStart).toHaveBeenCalledTimes(1);
  });

  it('runs all six hook kinds in order across two plugins', async () => {
    const log: string[] = [];
    const p1: PluginHooks = {
      onSessionStart: async () => log.push('1:session'),
      onTaskStart: async () => log.push('1:taskStart'),
      onPromptBuild: async () => log.push('1:prompt'),
      onToolCall: async () => log.push('1:tool'),
      onTaskEnd: async () => log.push('1:taskEnd'),
      onError: async () => log.push('1:error'),
    };
    const p2: PluginHooks = {
      onSessionStart: async () => log.push('2:session'),
      onTaskStart: async () => log.push('2:taskStart'),
      onPromptBuild: async () => log.push('2:prompt'),
      onToolCall: async () => log.push('2:tool'),
      onTaskEnd: async () => log.push('2:taskEnd'),
      onError: async () => log.push('2:error'),
    };
    const d = createPluginDispatcher([p1, p2]);

    await d.onSessionStart({ sessionId: 's', agentId: 'a', agent });
    await d.onTaskStart({
      sessionId: 's',
      runId: 'r',
      planId: 'p',
      taskId: 't',
      toolIds: ['x'],
    });
    await d.onPromptBuild({
      sessionId: 's',
      runId: 'r',
      plan: null,
      messages: [],
    });
    await d.onToolCall({ sessionId: 's', runId: 'r', toolId: 'x', args: {} });
    await d.onTaskEnd({ sessionId: 's', runId: 'r', taskId: 't', ok: true });
    await d.onError({ sessionId: 's', runId: 'r', phase: 'unknown', error: new Error('x') });

    expect(log).toEqual([
      '1:session',
      '2:session',
      '1:taskStart',
      '2:taskStart',
      '1:prompt',
      '2:prompt',
      '1:tool',
      '2:tool',
      '1:taskEnd',
      '2:taskEnd',
      '1:error',
      '2:error',
    ]);
  });

  it('skips plugins that omit a hook', async () => {
    const seen: string[] = [];
    const empty: PluginHooks = {};
    const d = createPluginDispatcher([
      empty,
      {
        onSessionStart: async () => seen.push('only'),
      },
    ]);
    await d.onSessionStart({ sessionId: 's', agentId: 'a', agent });
    expect(seen).toEqual(['only']);
  });
});
