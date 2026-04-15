import type { Agent, McpServer, Skill } from '@agent-platform/contracts';

import type { DrizzleDb } from '../database.js';
import { replaceAgent, upsertMcpServer, upsertSkill } from '../repositories/registry.js';

/** Stable ids for E2E registry rows (API + Playwright assertions). */
export const E2E_MCP_ID = 'e2e-fs';
export const E2E_SKILL_ID = 'e2e-skill';
export const E2E_SPECIALIST_ID = 'e2e-specialist';

/**
 * Idempotent seed: filesystem MCP (stdio), skill referencing MCP tools, specialist agent.
 * Intended for `E2E_SEED=1` against the same SQLite file the API uses (compose or local).
 */
export function runE2eSeed(db: DrizzleDb): void {
  const mcp: McpServer = {
    id: E2E_MCP_ID,
    name: 'E2E filesystem MCP',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', '/workspace'],
    metadata: { e2e: true },
  };
  upsertMcpServer(db, mcp);

  const skill: Skill = {
    id: E2E_SKILL_ID,
    goal: 'E2E: use filesystem MCP for list/read within the mounted workspace.',
    constraints: [],
    tools: [`${E2E_MCP_ID}:read_file`, `${E2E_MCP_ID}:list_directory`],
  };
  upsertSkill(db, skill);

  const specialist: Agent = {
    id: E2E_SPECIALIST_ID,
    name: 'E2E specialist',
    systemPrompt: 'You are an E2E test agent with filesystem access via MCP.',
    allowedSkillIds: [E2E_SKILL_ID],
    allowedToolIds: [],
    allowedMcpServerIds: [E2E_MCP_ID],
    executionLimits: {
      maxSteps: 32,
      maxParallelTasks: 4,
      timeoutMs: 600_000,
      maxTokens: 128_000,
    },
  };
  replaceAgent(db, specialist);
}
