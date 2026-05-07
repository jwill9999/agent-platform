import type { Agent, ProjectMode } from '@agent-platform/contracts';

/** Stable slug for the primary seeded agent (see `packages/db` seed). */
export const DEFAULT_AGENT_SLUG = 'default-agent';
export const CODING_AGENT_SLUG = 'coding';

export function pickDefaultAgent(agents: Agent[]): Agent | undefined {
  if (agents.length === 0) return undefined;
  const bySlug = agents.find((a) => a.slug === DEFAULT_AGENT_SLUG);
  return bySlug ?? agents[0];
}

export function pickDefaultAgentForMode(agents: Agent[], mode: ProjectMode): Agent | undefined {
  if (agents.length === 0) return undefined;
  const slug = mode === 'project' ? CODING_AGENT_SLUG : DEFAULT_AGENT_SLUG;
  return agents.find((a) => a.slug === slug) ?? agents[0];
}
