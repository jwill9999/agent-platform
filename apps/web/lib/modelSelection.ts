import type { Agent, ModelConfig } from '@agent-platform/contracts';

export function resolveChatModelConfigId(
  agentId: string | null,
  agentList: readonly Agent[],
  configList: readonly ModelConfig[],
): string | null {
  const agent = agentList.find((candidate) => candidate.id === agentId);
  const agentConfigId = agent?.modelConfigId;
  if (agentConfigId && configList.some((config) => config.id === agentConfigId)) {
    return agentConfigId;
  }
  return configList.find((config) => config.hasApiKey || config.provider === 'ollama')?.id ?? null;
}
