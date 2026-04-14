import { describe, expect, it } from 'vitest';
import type { Agent } from '@agent-platform/contracts';
import { createPluginDispatcher } from '@agent-platform/plugin-sdk';
import {
  isPluginAllowedForAgent,
  resolveEffectivePluginHooks,
  type RegisteredPlugin,
} from '../src/resolve.js';

const baseAgent = (over: Partial<Agent> = {}): Agent => ({
  id: 'ag',
  name: 'A',
  allowedSkillIds: [],
  allowedToolIds: [],
  allowedMcpServerIds: [],
  executionLimits: { maxSteps: 8, maxParallelTasks: 2, timeoutMs: 60_000 },
  ...over,
});

let marks: string[] = [];

const mark = (id: string, tag: string): RegisteredPlugin => ({
  id,
  hooks: {
    onTaskEnd: () => {
      marks.push(tag);
    },
  },
});

describe('isPluginAllowedForAgent', () => {
  it('applies denylist', () => {
    const agent = baseAgent({ pluginDenylist: ['bad'] });
    expect(isPluginAllowedForAgent('bad', agent)).toBe(false);
    expect(isPluginAllowedForAgent('good', agent)).toBe(true);
  });

  it('applies allowlist when non-empty', () => {
    const agent = baseAgent({ pluginAllowlist: ['a', 'b'] });
    expect(isPluginAllowedForAgent('a', agent)).toBe(true);
    expect(isPluginAllowedForAgent('c', agent)).toBe(false);
  });

  it('skips allowlist when null or undefined', () => {
    expect(isPluginAllowedForAgent('x', baseAgent({ pluginAllowlist: null }))).toBe(true);
    expect(isPluginAllowedForAgent('x', baseAgent({}))).toBe(true);
  });

  it('denies all when allowlist is empty array', () => {
    const agent = baseAgent({ pluginAllowlist: [] });
    expect(isPluginAllowedForAgent('a', agent)).toBe(false);
  });
});

describe('resolveEffectivePluginHooks', () => {
  it('orders global then user', async () => {
    marks = [];
    const g = mark('g1', 'g');
    const u = mark('u1', 'u');
    const hooks = resolveEffectivePluginHooks({
      global: [g],
      user: [u],
      agent: baseAgent(),
    });
    const d = createPluginDispatcher(hooks);
    await d.onTaskEnd({
      sessionId: 's',
      runId: 'r',
      taskId: 't',
      ok: true,
    });
    expect(marks).toEqual(['g', 'u']);
  });

  it('filters differently for two agents', () => {
    const mem = mark('memory', 'm');
    const obs = mark('obs', 'o');
    const global = [mem, obs];

    const open = baseAgent();
    const locked = baseAgent({ pluginAllowlist: ['memory'] });

    const hOpen = resolveEffectivePluginHooks({ global, user: [], agent: open });
    const hLocked = resolveEffectivePluginHooks({ global, user: [], agent: locked });

    expect(hOpen).toHaveLength(2);
    expect(hLocked).toHaveLength(1);
  });
});
