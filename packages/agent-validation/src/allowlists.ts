import type { Agent } from '@agent-platform/contracts';
import { parseToolId } from './toolId.js';

/** Skill id must appear on the agent allowlist. */
export function isSkillAllowed(agent: Agent, skillId: string): boolean {
  return agent.allowedSkillIds.includes(skillId);
}

/**
 * Tool execution is allowed if:
 * - plain tool id is listed in `allowedToolIds`, or
 * - composite MCP id `server:tool` and `server` is in `allowedMcpServerIds`.
 */
export function isToolExecutionAllowed(agent: Agent, toolId: string): boolean {
  const parsed = parseToolId(toolId);
  if (parsed.kind === 'plain') {
    return agent.allowedToolIds.includes(parsed.toolId);
  }
  return agent.allowedMcpServerIds.includes(parsed.mcpServerId);
}

/** MCP server registry id must be allowlisted for the agent to connect or list tools. */
export function isMcpServerAllowed(agent: Agent, mcpServerId: string): boolean {
  return agent.allowedMcpServerIds.includes(mcpServerId);
}
