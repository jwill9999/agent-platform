import { describe, expect, it } from 'vitest';
import type { Agent, ModelConfig } from '@agent-platform/contracts';

import { resolveChatModelConfigId, usableModelConfigs } from '../lib/modelSelection';

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

  it('falls back to the first saved keyed config when the agent has no override', () => {
    expect(resolveChatModelConfigId('agent-1', [agent()], [configA, configB])).toBe('cfg-a');
  });

  it('falls back to platform defaults when the assigned config is unavailable', () => {
    expect(
      resolveChatModelConfigId('agent-1', [agent({ modelConfigId: 'missing' })], [configA]),
    ).toBe('cfg-a');
  });

  it('skips saved configs without credentials unless they are local providers', () => {
    expect(
      resolveChatModelConfigId(
        'agent-1',
        [agent()],
        [
          { ...configA, id: 'cfg-unkeyed', hasApiKey: false },
          { ...configB, id: 'cfg-keyed', hasApiKey: true },
        ],
      ),
    ).toBe('cfg-keyed');

    expect(
      resolveChatModelConfigId(
        'agent-1',
        [agent()],
        [{ ...configA, id: 'cfg-ollama', provider: 'ollama', hasApiKey: false }],
      ),
    ).toBe('cfg-ollama');
  });

  it('returns no default when no usable model configs exist', () => {
    const configs = [
      { ...configA, id: 'cfg-unkeyed-a', hasApiKey: false },
      { ...configB, id: 'cfg-unkeyed-b', hasApiKey: false },
    ];

    expect(usableModelConfigs(configs)).toEqual([]);
    expect(resolveChatModelConfigId('agent-1', [agent()], usableModelConfigs(configs))).toBeNull();
  });

  it('uses the only usable model config as the workspace default', () => {
    const onlyUsable = { ...configA, id: 'cfg-only' };
    const configs = [{ ...configB, id: 'cfg-unkeyed', hasApiKey: false }, onlyUsable];

    expect(resolveChatModelConfigId('agent-1', [agent()], usableModelConfigs(configs))).toBe(
      'cfg-only',
    );
  });

  it('keeps agent preference when multiple usable model configs exist', () => {
    expect(
      resolveChatModelConfigId(
        'agent-1',
        [agent({ modelConfigId: 'cfg-b' })],
        usableModelConfigs([configA, configB]),
      ),
    ).toBe('cfg-b');
  });
});
