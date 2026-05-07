import { describe, expect, it } from 'vitest';
import type { Agent } from '@agent-platform/contracts';

import { pickDefaultAgent, pickDefaultAgentForMode } from '../lib/default-agent';

function agent(overrides: Partial<Agent>): Agent {
  return {
    id: overrides.id ?? 'agent-1',
    slug: overrides.slug ?? 'agent-1',
    name: overrides.name ?? 'Agent',
    systemPrompt: 'You are helpful.',
    allowedSkillIds: [],
    allowedToolIds: [],
    allowedMcpServerIds: [],
    executionLimits: { maxSteps: 10, maxParallelTasks: 1, timeoutMs: 60_000 },
    ...overrides,
  };
}

describe('default agent selection', () => {
  it('keeps the personal assistant as the default chat agent', () => {
    const agents = [
      agent({ id: 'coding', slug: 'coding' }),
      agent({ id: 'pa', slug: 'default-agent' }),
    ];

    expect(pickDefaultAgent(agents)?.id).toBe('pa');
    expect(pickDefaultAgentForMode(agents, 'chat')?.id).toBe('pa');
  });

  it('uses the coding agent as the default project agent', () => {
    const agents = [
      agent({ id: 'pa', slug: 'default-agent' }),
      agent({ id: 'coding', slug: 'coding' }),
    ];

    expect(pickDefaultAgentForMode(agents, 'project')?.id).toBe('coding');
  });

  it('falls back to the first available agent when a mode-specific seeded agent is missing', () => {
    const agents = [agent({ id: 'first', slug: 'custom-agent' })];

    expect(pickDefaultAgentForMode(agents, 'project')?.id).toBe('first');
    expect(pickDefaultAgentForMode(agents, 'chat')?.id).toBe('first');
  });
});
