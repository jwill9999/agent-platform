import { describe, expect, it, vi } from 'vitest';
import type { PluginHooks } from '@agent-platform/plugin-sdk';
import { createPluginDispatcher } from '@agent-platform/plugin-sdk';
import { mergeOrderedPluginLayers } from '../src/order.js';

describe('mergeOrderedPluginLayers', () => {
  it('orders global → user → agent for onSessionStart', async () => {
    const order: string[] = [];
    const global: PluginHooks = {
      onSessionStart: async () => order.push('g'),
    };
    const user: PluginHooks = {
      onSessionStart: async () => order.push('u'),
    };
    const agent: PluginHooks = {
      onSessionStart: async () => order.push('a'),
    };
    const chain = mergeOrderedPluginLayers({ global, user, agent });
    const d = createPluginDispatcher(chain);
    await d.onSessionStart({
      sessionId: 's',
      agentId: 'x',
      agent: {
        id: 'x',
        name: 'n',
        allowedSkillIds: [],
        allowedToolIds: [],
        allowedMcpServerIds: [],
        executionLimits: { maxSteps: 1, maxParallelTasks: 1, timeoutMs: 1 },
      },
    });
    expect(order).toEqual(['g', 'u', 'a']);
  });

  it('omits undefined layers', () => {
    const g: PluginHooks = { onError: vi.fn() };
    const chain = mergeOrderedPluginLayers({ global: g });
    expect(chain).toHaveLength(1);
    expect(chain[0]).toBe(g);
  });
});
