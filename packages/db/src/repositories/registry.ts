import { randomUUID } from 'node:crypto';

import type { Agent, McpServer, SessionRecord, Skill, Tool } from '@agent-platform/contracts';
import { eq } from 'drizzle-orm';

import type { DrizzleDb } from '../database.js';
import {
  loadAgentById,
  mcpRowToContract,
  mcpToRow,
  sessionRowToContract,
  skillRowToContract,
  skillToRow,
  toolRowToContract,
  toolToRow,
} from '../mappers.js';
import * as schema from '../schema.js';

export function listSkills(db: DrizzleDb): Skill[] {
  return db
    .select()
    .from(schema.skills)
    .all()
    .map((row) => skillRowToContract(row));
}

export function getSkill(db: DrizzleDb, id: string): Skill | undefined {
  const row = db.select().from(schema.skills).where(eq(schema.skills.id, id)).get();
  return row ? skillRowToContract(row) : undefined;
}

export function upsertSkill(db: DrizzleDb, skill: Skill): void {
  const row = skillToRow(skill);
  db.insert(schema.skills)
    .values(row)
    .onConflictDoUpdate({
      target: schema.skills.id,
      set: {
        goal: row.goal,
        constraintsJson: row.constraintsJson,
        toolIdsJson: row.toolIdsJson,
        outputSchemaJson: row.outputSchemaJson,
      },
    })
    .run();
}

export function deleteSkill(db: DrizzleDb, id: string): boolean {
  const r = db.delete(schema.skills).where(eq(schema.skills.id, id)).run();
  return r.changes > 0;
}

export function listTools(db: DrizzleDb): Tool[] {
  return db
    .select()
    .from(schema.tools)
    .all()
    .map((row) => toolRowToContract(row));
}

export function getTool(db: DrizzleDb, id: string): Tool | undefined {
  const row = db.select().from(schema.tools).where(eq(schema.tools.id, id)).get();
  return row ? toolRowToContract(row) : undefined;
}

export function upsertTool(db: DrizzleDb, tool: Tool): void {
  const row = toolToRow(tool);
  db.insert(schema.tools)
    .values(row)
    .onConflictDoUpdate({
      target: schema.tools.id,
      set: {
        name: row.name,
        description: row.description,
        configJson: row.configJson,
      },
    })
    .run();
}

export function deleteTool(db: DrizzleDb, id: string): boolean {
  const r = db.delete(schema.tools).where(eq(schema.tools.id, id)).run();
  return r.changes > 0;
}

export function listMcpServers(db: DrizzleDb): McpServer[] {
  return db
    .select()
    .from(schema.mcpServers)
    .all()
    .map((row) => mcpRowToContract(row));
}

export function getMcpServer(db: DrizzleDb, id: string): McpServer | undefined {
  const row = db.select().from(schema.mcpServers).where(eq(schema.mcpServers.id, id)).get();
  return row ? mcpRowToContract(row) : undefined;
}

export function upsertMcpServer(db: DrizzleDb, m: McpServer): void {
  const row = mcpToRow(m);
  db.insert(schema.mcpServers)
    .values(row)
    .onConflictDoUpdate({
      target: schema.mcpServers.id,
      set: {
        name: row.name,
        transport: row.transport,
        command: row.command,
        argsJson: row.argsJson,
        url: row.url,
        metadataJson: row.metadataJson,
      },
    })
    .run();
}

export function deleteMcpServer(db: DrizzleDb, id: string): boolean {
  const r = db.delete(schema.mcpServers).where(eq(schema.mcpServers.id, id)).run();
  return r.changes > 0;
}

export function listAgents(db: DrizzleDb): Agent[] {
  const ids = db.select({ id: schema.agents.id }).from(schema.agents).all();
  const out: Agent[] = [];
  for (const { id } of ids) {
    const a = loadAgentById(db, id);
    if (a) out.push(a);
  }
  return out;
}

export function replaceAgent(db: DrizzleDb, agent: Agent): void {
  const now = Date.now();
  db.transaction((tx) => {
    const existing = tx.select().from(schema.agents).where(eq(schema.agents.id, agent.id)).get();
    const createdAtMs = existing?.createdAtMs ?? now;
    tx.delete(schema.agentSkills).where(eq(schema.agentSkills.agentId, agent.id)).run();
    tx.delete(schema.agentTools).where(eq(schema.agentTools.agentId, agent.id)).run();
    tx.delete(schema.agentMcpServers).where(eq(schema.agentMcpServers.agentId, agent.id)).run();

    tx.insert(schema.agents)
      .values({
        id: agent.id,
        name: agent.name,
        executionLimitsJson: JSON.stringify(agent.executionLimits),
        modelOverrideJson: agent.modelOverride ? JSON.stringify(agent.modelOverride) : null,
        pluginAllowlistJson:
          agent.pluginAllowlist !== undefined ? JSON.stringify(agent.pluginAllowlist) : null,
        pluginDenylistJson:
          agent.pluginDenylist !== undefined ? JSON.stringify(agent.pluginDenylist) : null,
        createdAtMs,
        updatedAtMs: now,
      })
      .onConflictDoUpdate({
        target: schema.agents.id,
        set: {
          name: agent.name,
          executionLimitsJson: JSON.stringify(agent.executionLimits),
          modelOverrideJson: agent.modelOverride ? JSON.stringify(agent.modelOverride) : null,
          pluginAllowlistJson:
            agent.pluginAllowlist !== undefined ? JSON.stringify(agent.pluginAllowlist) : null,
          pluginDenylistJson:
            agent.pluginDenylist !== undefined ? JSON.stringify(agent.pluginDenylist) : null,
          updatedAtMs: now,
        },
      })
      .run();

    for (const skillId of agent.allowedSkillIds) {
      tx.insert(schema.agentSkills).values({ agentId: agent.id, skillId }).run();
    }
    for (const toolId of agent.allowedToolIds) {
      tx.insert(schema.agentTools).values({ agentId: agent.id, toolId }).run();
    }
    for (const mcpServerId of agent.allowedMcpServerIds) {
      tx.insert(schema.agentMcpServers).values({ agentId: agent.id, mcpServerId }).run();
    }
  });
}

export function deleteAgent(db: DrizzleDb, id: string): boolean {
  const r = db.delete(schema.agents).where(eq(schema.agents.id, id)).run();
  return r.changes > 0;
}

export function listSessions(db: DrizzleDb, agentId?: string): SessionRecord[] {
  const rows = agentId
    ? db.select().from(schema.sessions).where(eq(schema.sessions.agentId, agentId)).all()
    : db.select().from(schema.sessions).all();
  return rows.map((row) => sessionRowToContract(row));
}

export function getSession(db: DrizzleDb, id: string): SessionRecord | undefined {
  const row = db.select().from(schema.sessions).where(eq(schema.sessions.id, id)).get();
  return row ? sessionRowToContract(row) : undefined;
}

export function createSession(
  db: DrizzleDb,
  input: { agentId: string; id?: string },
): SessionRecord {
  const now = Date.now();
  const id = input.id ?? randomUUID();
  db.insert(schema.sessions)
    .values({
      id,
      agentId: input.agentId,
      createdAtMs: now,
      updatedAtMs: now,
    })
    .run();
  const row = db.select().from(schema.sessions).where(eq(schema.sessions.id, id)).get();
  if (!row) throw new Error('session insert failed');
  return sessionRowToContract(row);
}

export function replaceSession(db: DrizzleDb, record: SessionRecord): void {
  const existing = db.select().from(schema.sessions).where(eq(schema.sessions.id, record.id)).get();
  db.insert(schema.sessions)
    .values({
      id: record.id,
      agentId: record.agentId,
      createdAtMs: existing?.createdAtMs ?? record.createdAtMs,
      updatedAtMs: record.updatedAtMs,
    })
    .onConflictDoUpdate({
      target: schema.sessions.id,
      set: {
        agentId: record.agentId,
        updatedAtMs: record.updatedAtMs,
      },
    })
    .run();
}

export function deleteSession(db: DrizzleDb, id: string): boolean {
  const r = db.delete(schema.sessions).where(eq(schema.sessions.id, id)).run();
  return r.changes > 0;
}
