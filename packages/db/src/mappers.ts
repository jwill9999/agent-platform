import type { Agent, ExecutionLimits, Skill } from '@agent-platform/contracts';
import { AgentSchema, ExecutionLimitsSchema, SkillSchema } from '@agent-platform/contracts';
import { eq } from 'drizzle-orm';

import type { DrizzleDb } from './database.js';
import * as schema from './schema.js';

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
