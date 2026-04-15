import { describe, expect, it, vi } from 'vitest';
import type { Agent } from '@agent-platform/contracts';
import { runPlannerRepairLoop } from '../src/repair.js';

const agent: Agent = {
  id: 'ag1',
  name: 'Agent',
  systemPrompt: 'Test agent',
  allowedSkillIds: [],
  allowedToolIds: ['ok'],
  allowedMcpServerIds: [],
  executionLimits: { maxSteps: 8, maxParallelTasks: 2, timeoutMs: 60_000 },
};

const goodPlan = JSON.stringify({
  id: 'p',
  tasks: [{ id: 't', description: 'x', toolIds: ['ok'] }],
});

describe('runPlannerRepairLoop', () => {
  it('returns success on first valid generation', async () => {
    const generate = vi.fn(async () => goodPlan);
    const r = await runPlannerRepairLoop({ agent, generate, maxAttempts: 3 });
    expect(r.ok).toBe(true);
    expect(generate).toHaveBeenCalledTimes(1);
    expect(generate).toHaveBeenCalledWith(1);
  });

  it('retries until a valid plan is produced', async () => {
    const bad = JSON.stringify({
      id: 'p',
      tasks: [{ id: 't', description: 'x', toolIds: ['nope'] }],
    });
    let n = 0;
    const generate = vi.fn(async () => {
      n += 1;
      return n < 2 ? bad : goodPlan;
    });
    const r = await runPlannerRepairLoop({ agent, generate, maxAttempts: 3 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.plan.id).toBe('p');
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it('returns last failure when max attempts exhausted', async () => {
    const bad = JSON.stringify({
      id: 'p',
      tasks: [{ id: 't', description: 'x', toolIds: ['nope'] }],
    });
    const generate = vi.fn(async () => bad);
    const r = await runPlannerRepairLoop({ agent, generate, maxAttempts: 2 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.phase).toBe('policy');
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it('returns json failure when maxAttempts is 0', async () => {
    const generate = vi.fn(async () => goodPlan);
    const r = await runPlannerRepairLoop({ agent, generate, maxAttempts: 0 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.phase).toBe('json');
    expect(generate).not.toHaveBeenCalled();
  });
});
