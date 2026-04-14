import { describe, expect, it } from 'vitest';
import type { Agent } from '@agent-platform/contracts';
import { createPluginDispatcher } from '@agent-platform/plugin-sdk';
import { SessionMemoryStore, createSessionMemoryPlugin } from '../src/index.js';

const agent: Agent = {
  id: 'a1',
  name: 'A',
  allowedSkillIds: [],
  allowedToolIds: [],
  allowedMcpServerIds: [],
  executionLimits: { maxSteps: 8, maxParallelTasks: 2, timeoutMs: 60_000 },
};

describe('createSessionMemoryPlugin', () => {
  it('stores task outcomes', async () => {
    const store = new SessionMemoryStore();
    const d = createPluginDispatcher([createSessionMemoryPlugin({ store })]);

    await d.onTaskEnd({
      sessionId: 's',
      runId: 'r',
      taskId: 't1',
      ok: true,
      detail: 'done',
    });

    expect(JSON.parse(store.get('task:t1') ?? '{}')).toEqual({ ok: true, detail: 'done' });
  });

  it('clears store when clearOnSessionStart is true', async () => {
    const store = new SessionMemoryStore();
    store.set('task:t0', '{}');
    const d = createPluginDispatcher([
      createSessionMemoryPlugin({ store, clearOnSessionStart: true }),
    ]);

    await d.onSessionStart({ sessionId: 's', agentId: 'a1', agent });
    expect(store.toJSON()).toEqual({});
  });
});
