import type { Agent } from '@agent-platform/contracts';
import type { PluginHooks } from '@agent-platform/plugin-sdk';

export type RegisteredPlugin = Readonly<{
  id: string;
  hooks: PluginHooks;
}>;

/**
 * Whether a plugin id may run for this agent (denylist wins; allowlist restricts when set).
 */
export function isPluginAllowedForAgent(pluginId: string, agent: Agent): boolean {
  if (agent.pluginDenylist?.includes(pluginId)) {
    return false;
  }
  const allow = agent.pluginAllowlist;
  if (allow == null) {
    return true;
  }
  if (allow.length === 0) {
    return false;
  }
  return allow.includes(pluginId);
}

/**
 * Merge **global** plugins first, then **user** overrides (same id appears twice — both run
 * in order, mirroring host composition). Then filter by {@link isPluginAllowedForAgent}.
 */
export function resolveEffectivePluginHooks(input: {
  global: readonly RegisteredPlugin[];
  user: readonly RegisteredPlugin[];
  agent: Agent;
}): PluginHooks[] {
  const merged = [...input.global, ...input.user];
  return merged.filter((p) => isPluginAllowedForAgent(p.id, input.agent)).map((p) => p.hooks);
}
