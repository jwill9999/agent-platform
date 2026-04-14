import { describe, expect, it } from 'vitest';
import type { Agent } from '@agent-platform/contracts';
import { createPluginDispatcher } from '@agent-platform/plugin-sdk';
import { resolveEffectivePluginHooks, type RegisteredPlugin } from '@agent-platform/plugin-session';

const base = (): Agent => ({
  id: 'agent',
  name: 'Agent',
  allowedSkillIds: [],
  allowedToolIds: [],
  allowedMcpServerIds: [],
  executionLimits: { maxSteps: 8, maxParallelTasks: 2, timeoutMs: 60_000 },
});

describe('plugin-session integration', () => {
  it('resolves different effective stacks for two agents (allowlist)', async () => {
    const seen: string[] = [];
    const p1: RegisteredPlugin = {
      id: 'memory',
      hooks: {
        onSessionStart: () => seen.push('memory'),
      },
    };
    const p2: RegisteredPlugin = {
      id: 'observability',
      hooks: {
        onSessionStart: () => seen.push('observability'),
      },
    };

    const strictAgent: Agent = { ...base(), id: 'strict', pluginAllowlist: ['memory'] };
    const openAgent: Agent = { ...base(), id: 'open' };

    const dStrict = createPluginDispatcher(
      resolveEffectivePluginHooks({
        global: [p1, p2],
        user: [],
        agent: strictAgent,
      }),
    );
    const dOpen = createPluginDispatcher(
      resolveEffectivePluginHooks({
        global: [p1, p2],
        user: [],
        agent: openAgent,
      }),
    );

    seen.length = 0;
    await dStrict.onSessionStart({
      sessionId: 's1',
      agentId: strictAgent.id,
      agent: strictAgent,
    });
    expect(seen).toEqual(['memory']);

    seen.length = 0;
    await dOpen.onSessionStart({
      sessionId: 's2',
      agentId: openAgent.id,
      agent: openAgent,
    });
    expect(seen).toEqual(['memory', 'observability']);
  });
});
