import { describe, expect, it } from 'vitest';
import type { Agent } from '@agent-platform/contracts';
import {
  collectToolIdsFromPlan,
  parseLlmPlanJson,
  validatePlanToolsForAgent,
} from '../src/planner.js';

const baseAgent = (): Agent => ({
  id: 'ag1',
  name: 'Agent',
  systemPrompt: 'Test agent',
  allowedSkillIds: [],
  allowedToolIds: ['grep', 'lint'],
  allowedMcpServerIds: ['files'],
  executionLimits: { maxSteps: 8, maxParallelTasks: 2, timeoutMs: 60_000 },
});

describe('parseLlmPlanJson', () => {
  it('accepts valid JSON and allowed tools', () => {
    const agent = baseAgent();
    const raw = JSON.stringify({
      id: 'plan-1',
      tasks: [
        { id: 'a', description: 'run grep', toolIds: ['grep'] },
        { id: 'b', description: 'MCP read', toolIds: ['files:readFile'] },
      ],
    });
    const r = parseLlmPlanJson(raw, agent);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.plan.id).toBe('plan-1');
      expect(r.plan.tasks).toHaveLength(2);
    }
  });

  it('rejects malformed JSON', () => {
    const r = parseLlmPlanJson('not json', baseAgent());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.phase).toBe('json');
  });

  it('rejects schema-invalid payload', () => {
    const r = parseLlmPlanJson(JSON.stringify({ tasks: [] }), baseAgent());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.phase).toBe('schema');
  });

  it('rejects disallowed plain tool ids', () => {
    const agent = baseAgent();
    const raw = JSON.stringify({
      id: 'p',
      tasks: [{ id: 't1', description: 'x', toolIds: ['rm', 'grep'] }],
    });
    const r = parseLlmPlanJson(raw, agent);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.phase).toBe('policy');
      expect(r.disallowedToolIds).toContain('rm');
    }
  });

  it('rejects disallowed MCP server in composite id', () => {
    const agent = baseAgent();
    const raw = JSON.stringify({
      id: 'p',
      tasks: [{ id: 't1', description: 'x', toolIds: ['evil:tool'] }],
    });
    const r = parseLlmPlanJson(raw, agent);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.phase).toBe('policy');
      expect(r.disallowedToolIds).toContain('evil:tool');
    }
  });
});

describe('validatePlanToolsForAgent', () => {
  it('allows empty tool lists', () => {
    const agent = baseAgent();
    const plan = { id: 'p', tasks: [{ id: 't', description: 'noop' }] };
    const r = validatePlanToolsForAgent(plan, agent);
    expect(r.ok).toBe(true);
  });

  it('collectToolIdsFromPlan dedupes by iteration order', () => {
    const plan = {
      id: 'p',
      tasks: [
        { id: 'a', description: '1', toolIds: ['grep', 'lint'] },
        { id: 'b', description: '2', toolIds: ['grep'] },
      ],
    };
    expect(collectToolIdsFromPlan(plan)).toEqual(['grep', 'lint', 'grep']);
  });
});
