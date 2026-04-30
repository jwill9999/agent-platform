import { describe, expect, it } from 'vitest';
import type { Agent, ModelConfig } from '@agent-platform/contracts';

import { resolveChatModelConfigId } from '../lib/modelSelection';

const configA: ModelConfig = {
  id: 'cfg-a',
  name: 'Config A',
  provider: 'openai',
  model: 'gpt-4o',
  hasApiKey: true,
  createdAtMs: 1,
  updatedAtMs: 1,
};

const configB: ModelConfig = {
  ...configA,
  id: 'cfg-b',
  name: 'Config B',
  model: 'gpt-4.1',
};

function agent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: 'agent-1',
    slug: 'agent-1',
    name: 'Agent',
    systemPrompt: 'You are helpful.',
    allowedSkillIds: [],
    allowedToolIds: [],
    allowedMcpServerIds: [],
    executionLimits: { maxSteps: 10, maxParallelTasks: 1, timeoutMs: 60_000 },
    ...overrides,
  };
}

describe('resolveChatModelConfigId', () => {
  it('uses the agent-assigned model config when it exists', () => {
    expect(
      resolveChatModelConfigId('agent-1', [agent({ modelConfigId: 'cfg-b' })], [configA, configB]),
    ).toBe('cfg-b');
  });

  it('does not fall back to the first saved config when the agent has no override', () => {
    expect(resolveChatModelConfigId('agent-1', [agent()], [configA, configB])).toBeNull();
  });

  it('falls back to platform defaults when the assigned config is unavailable', () => {
    expect(
      resolveChatModelConfigId('agent-1', [agent({ modelConfigId: 'missing' })], [configA]),
    ).toBeNull();
  });
});
