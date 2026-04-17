import type { Agent } from '@agent-platform/contracts';

/** Stable slug for the primary seeded agent (see `packages/db` seed). */
export const DEFAULT_AGENT_SLUG = 'default-agent';

export function pickDefaultAgent(agents: Agent[]): Agent | undefined {
  if (agents.length === 0) return undefined;
  const bySlug = agents.find((a) => a.slug === DEFAULT_AGENT_SLUG);
  return bySlug ?? agents[0];
}
