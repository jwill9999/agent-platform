import { describe, expect, it } from 'vitest';
import type { Agent, DodContract } from '@agent-platform/contracts';
import { createPluginDispatcher } from '@agent-platform/plugin-sdk';
import { createObservabilityPlugin } from '../src/observability.js';
import type { ObservabilityEvent } from '../src/events.js';
import { createObservabilityStore } from '../src/store.js';

const agent: Agent = {
  id: 'a1',
  name: 'A',
  systemPrompt: 'Test agent',
  allowedSkillIds: [],
  allowedToolIds: ['t'],
  allowedMcpServerIds: [],
  executionLimits: { maxSteps: 8, maxParallelTasks: 2, timeoutMs: 60_000 },
};

describe('createObservabilityPlugin', () => {
  it('emits structured events to sink (no tool args by default)', async () => {
    const events: ObservabilityEvent[] = [];
    const dodContract: DodContract = {
      criteria: ['Answer the user'],
      evidence: ['Final answer did'],
      passed: true,
      failedCriteria: [],
    };
    const obs = createObservabilityPlugin({ log: (e) => events.push(e) });
    const d = createPluginDispatcher([obs]);

    await d.onSessionStart({ sessionId: 's1', agentId: 'a1', agent });
    await d.onTaskStart({
      sessionId: 's1',
      runId: 'r1',
      planId: 'p1',
      taskId: 'k1',
      toolIds: ['t'],
    });
    await d.onPromptBuild({
      sessionId: 's1',
      runId: 'r1',
      plan: { id: 'p1', tasks: [] },
      messages: [{ role: 'user', content: 'secret user text' }],
    });
    await d.onToolCall({ sessionId: 's1', runId: 'r1', toolId: 't', args: { path: '/secret' } });
    await d.onTaskEnd({ sessionId: 's1', runId: 'r1', taskId: 'k1', ok: true });
    await d.onDodCheck({ sessionId: 's1', runId: 'r1', contract: dodContract });
    await d.onError({
      sessionId: 's1',
      runId: 'r1',
      phase: 'tool',
      error: new Error('boom'),
    });

    expect(events.map((e) => e.kind)).toEqual([
      'session_start',
      'task_start',
      'prompt_build',
      'tool_call',
      'task_end',
      'dod_check',
      'error',
    ]);

    const prompt = events.find((e) => e.kind === 'prompt_build');
    expect(prompt?.kind === 'prompt_build' && prompt.messageCount).toBe(1);

    const tool = events.find((e) => e.kind === 'tool_call');
    expect(tool?.kind === 'tool_call' && !('args' in tool)).toBe(true);

    const dod = events.find((e) => e.kind === 'dod_check');
    expect(dod?.kind === 'dod_check' && dod.criteriaCount).toBe(1);

    const err = events.find((e) => e.kind === 'error');
    expect(err?.kind === 'error' && err.message).toBe('boom');
  });

  it('includes tool args when includeToolArgs is true', async () => {
    const events: ObservabilityEvent[] = [];
    const obs = createObservabilityPlugin({
      log: (e) => events.push(e),
      includeToolArgs: true,
    });
    const d = createPluginDispatcher([obs]);
    await d.onToolCall({
      sessionId: 's',
      runId: 'r',
      toolId: 't',
      args: { x: 1 },
    });
    const tool = events[0];
    expect(tool?.kind).toBe('tool_call');
    if (tool?.kind === 'tool_call') {
      expect(tool.args).toEqual({ x: 1 });
    }
  });

  it('records events in the in-memory store when configured', async () => {
    const store = createObservabilityStore();
    const obs = createObservabilityPlugin({ store });
    const d = createPluginDispatcher([obs]);

    await d.onSessionStart({ sessionId: 's1', agentId: 'a1', agent });
    await d.onError({
      sessionId: 's1',
      runId: 'r1',
      phase: 'tool',
      error: new Error('store boom'),
    });

    expect(store.getLogs({ sessionId: 's1', limit: 10 })).toHaveLength(2);
    expect(store.getErrors({ sessionId: 's1', limit: 10 })[0]?.event).toMatchObject({
      kind: 'error',
      message: 'store boom',
    });
  });
});
