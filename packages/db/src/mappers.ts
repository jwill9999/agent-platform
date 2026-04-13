import type { Agent, ExecutionLimits, McpServer, Skill, Tool } from '@agent-platform/contracts';
import {
  AgentSchema,
  ExecutionLimitsSchema,
  McpServerSchema,
  SessionRecordSchema,
  SkillSchema,
  ToolSchema,
} from '@agent-platform/contracts';
import { eq } from 'drizzle-orm';

import type { DrizzleDb } from './database.js';
import * as schema from './schema.js';

export function skillToRow(skill: Skill): typeof schema.skills.$inferInsert {
  return {
    id: skill.id,
    goal: skill.goal,
    constraintsJson: JSON.stringify(skill.constraints),
    toolIdsJson: JSON.stringify(skill.tools),
    outputSchemaJson: skill.outputSchema ? JSON.stringify(skill.outputSchema) : null,
  };
}

export function skillRowToContract(row: typeof schema.skills.$inferSelect): Skill {
  return SkillSchema.parse({
    id: row.id,
    goal: row.goal,
    constraints: JSON.parse(row.constraintsJson) as string[],
    tools: JSON.parse(row.toolIdsJson) as string[],
    outputSchema: row.outputSchemaJson
      ? (JSON.parse(row.outputSchemaJson) as Record<string, unknown>)
      : undefined,
  });
}

export function loadAgentById(db: DrizzleDb, id: string): Agent | undefined {
  const row = db.select().from(schema.agents).where(eq(schema.agents.id, id)).get();
  if (!row) return undefined;

  const skillRows = db
    .select({ skillId: schema.agentSkills.skillId })
    .from(schema.agentSkills)
    .where(eq(schema.agentSkills.agentId, id))
    .all();
  const toolRows = db
    .select({ toolId: schema.agentTools.toolId })
    .from(schema.agentTools)
    .where(eq(schema.agentTools.agentId, id))
    .all();
  const mcpRows = db
    .select({ mcpServerId: schema.agentMcpServers.mcpServerId })
    .from(schema.agentMcpServers)
    .where(eq(schema.agentMcpServers.agentId, id))
    .all();

  const executionLimits = ExecutionLimitsSchema.parse(
    JSON.parse(row.executionLimitsJson) as ExecutionLimits,
  );
  const modelOverride = row.modelOverrideJson
    ? (JSON.parse(row.modelOverrideJson) as { provider: string; model: string })
    : undefined;
  const pluginAllowlist = row.pluginAllowlistJson
    ? (JSON.parse(row.pluginAllowlistJson) as string[] | null)
    : null;
  const pluginDenylist = row.pluginDenylistJson
    ? (JSON.parse(row.pluginDenylistJson) as string[] | null)
    : null;

  return AgentSchema.parse({
    id: row.id,
    name: row.name,
    allowedSkillIds: skillRows.map((r) => r.skillId),
    allowedToolIds: toolRows.map((r) => r.toolId),
    allowedMcpServerIds: mcpRows.map((r) => r.mcpServerId),
    executionLimits,
    modelOverride,
    pluginAllowlist: pluginAllowlist ?? undefined,
    pluginDenylist: pluginDenylist ?? undefined,
  });
}

export function toolRowToContract(row: typeof schema.tools.$inferSelect): Tool {
  return ToolSchema.parse({
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    config: row.configJson ? (JSON.parse(row.configJson) as Record<string, unknown>) : undefined,
  });
}

export function toolToRow(tool: Tool): typeof schema.tools.$inferInsert {
  return {
    id: tool.id,
    name: tool.name,
    description: tool.description ?? null,
    configJson: tool.config ? JSON.stringify(tool.config) : null,
  };
}

export function mcpRowToContract(row: typeof schema.mcpServers.$inferSelect): McpServer {
  return McpServerSchema.parse({
    id: row.id,
    name: row.name,
    transport: row.transport,
    command: row.command ?? undefined,
    args: row.argsJson ? (JSON.parse(row.argsJson) as string[]) : undefined,
    url: row.url ?? undefined,
    metadata: row.metadataJson
      ? (JSON.parse(row.metadataJson) as Record<string, unknown>)
      : undefined,
  });
}

export function mcpToRow(m: McpServer): typeof schema.mcpServers.$inferInsert {
  return {
    id: m.id,
    name: m.name,
    transport: m.transport,
    command: m.command ?? null,
    argsJson: m.args ? JSON.stringify(m.args) : null,
    url: m.url ?? null,
    metadataJson: m.metadata ? JSON.stringify(m.metadata) : null,
  };
}

export function sessionRowToContract(row: typeof schema.sessions.$inferSelect) {
  return SessionRecordSchema.parse({
    id: row.id,
    agentId: row.agentId,
    createdAtMs: row.createdAtMs,
    updatedAtMs: row.updatedAtMs,
  });
}
