import type { Agent } from '@agent-platform/contracts';
import { parseToolId } from './toolId.js';

/** System tool IDs are always allowed regardless of agent allowlists. */
const SYSTEM_TOOL_PREFIX = 'sys_';

/** Skill id must appear on the agent allowlist. */
export function isSkillAllowed(agent: Agent, skillId: string): boolean {
  return agent.allowedSkillIds.includes(skillId);
}

/**
 * Tool execution is allowed if:
 * - tool id starts with `sys_` (built-in system tools), or
 * - plain tool id is listed in `allowedToolIds`, or
 * - composite MCP id `server:tool` and `server` is in `allowedMcpServerIds`.
 */
export function isToolExecutionAllowed(agent: Agent, toolId: string): boolean {
  if (toolId.startsWith(SYSTEM_TOOL_PREFIX)) return true;
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
