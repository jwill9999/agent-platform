import { randomUUID } from 'node:crypto';

import type {
  Agent,
  AgentCreateBody,
  McpServer,
  McpServerCreateBody,
  SessionRecord,
  Skill,
  SkillCreateBody,
  Tool,
  ToolCreateBody,
} from '@agent-platform/contracts';
import { eq, or } from 'drizzle-orm';

import type { DrizzleDb } from '../database.js';
import { wrapConstraintError } from '../errors.js';
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
import { slugify } from '../slug.js';
import { withTransaction } from '../transaction.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

// ---------------------------------------------------------------------------
// Skills
// ---------------------------------------------------------------------------

export function listSkills(db: DrizzleDb): Skill[] {
  return db
    .select()
    .from(schema.skills)
    .all()
    .map((row) => skillRowToContract(row));
}

export function getSkill(db: DrizzleDb, idOrSlug: string): Skill | undefined {
  const cond = isUuid(idOrSlug)
    ? eq(schema.skills.id, idOrSlug)
    : or(eq(schema.skills.id, idOrSlug), eq(schema.skills.slug, idOrSlug));
  const row = db.select().from(schema.skills).where(cond).get();
  return row ? skillRowToContract(row) : undefined;
}

export function createSkill(db: DrizzleDb, body: SkillCreateBody): Skill {
  const id = randomUUID();
  const slug = slugify(body.name);
  const skill: Skill = { ...body, id, slug };
  const row = skillToRow(skill);
  db.insert(schema.skills).values(row).run();
  return skill;
}

export function upsertSkill(db: DrizzleDb, skill: Skill): void {
  const row = skillToRow(skill);
  db.insert(schema.skills)
    .values(row)
    .onConflictDoUpdate({
      target: schema.skills.id,
      set: {
        name: row.name,
        slug: row.slug,
        goal: row.goal,
        constraintsJson: row.constraintsJson,
        toolIdsJson: row.toolIdsJson,
        outputSchemaJson: row.outputSchemaJson,
      },
    })
    .run();
}

export function deleteSkill(db: DrizzleDb, idOrSlug: string): boolean {
  const existing = getSkill(db, idOrSlug);
  if (!existing) return false;
  const r = db.delete(schema.skills).where(eq(schema.skills.id, existing.id)).run();
  return r.changes > 0;
}

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

export function listTools(db: DrizzleDb): Tool[] {
  return db
    .select()
    .from(schema.tools)
    .all()
    .map((row) => toolRowToContract(row));
}

export function getTool(db: DrizzleDb, idOrSlug: string): Tool | undefined {
  const cond = isUuid(idOrSlug)
    ? eq(schema.tools.id, idOrSlug)
    : or(eq(schema.tools.id, idOrSlug), eq(schema.tools.slug, idOrSlug));
  const row = db.select().from(schema.tools).where(cond).get();
  return row ? toolRowToContract(row) : undefined;
}

export function createTool(db: DrizzleDb, body: ToolCreateBody): Tool {
  const id = randomUUID();
  const slug = slugify(body.name);
  const tool: Tool = { ...body, id, slug };
  const row = toolToRow(tool);
  db.insert(schema.tools).values(row).run();
  return tool;
}

export function upsertTool(db: DrizzleDb, tool: Tool): void {
  const row = toolToRow(tool);
  db.insert(schema.tools)
    .values(row)
    .onConflictDoUpdate({
      target: schema.tools.id,
      set: {
        name: row.name,
        slug: row.slug,
        description: row.description,
        configJson: row.configJson,
      },
    })
    .run();
}

export function deleteTool(db: DrizzleDb, idOrSlug: string): boolean {
  const existing = getTool(db, idOrSlug);
  if (!existing) return false;
  const r = db.delete(schema.tools).where(eq(schema.tools.id, existing.id)).run();
  return r.changes > 0;
}

// ---------------------------------------------------------------------------
// MCP Servers
// ---------------------------------------------------------------------------

export function listMcpServers(db: DrizzleDb): McpServer[] {
  return db
    .select()
    .from(schema.mcpServers)
    .all()
    .map((row) => mcpRowToContract(row));
}

export function getMcpServer(db: DrizzleDb, idOrSlug: string): McpServer | undefined {
  const cond = isUuid(idOrSlug)
    ? eq(schema.mcpServers.id, idOrSlug)
    : or(eq(schema.mcpServers.id, idOrSlug), eq(schema.mcpServers.slug, idOrSlug));
  const row = db.select().from(schema.mcpServers).where(cond).get();
  return row ? mcpRowToContract(row) : undefined;
}

export function createMcpServer(db: DrizzleDb, body: McpServerCreateBody): McpServer {
  const id = randomUUID();
  const slug = slugify(body.name);
  const server: McpServer = { ...body, id, slug };
  const row = mcpToRow(server);
  db.insert(schema.mcpServers).values(row).run();
  return server;
}

export function upsertMcpServer(db: DrizzleDb, m: McpServer): void {
  const row = mcpToRow(m);
  db.insert(schema.mcpServers)
    .values(row)
    .onConflictDoUpdate({
      target: schema.mcpServers.id,
      set: {
        name: row.name,
        slug: row.slug,
        transport: row.transport,
        command: row.command,
        argsJson: row.argsJson,
        url: row.url,
        metadataJson: row.metadataJson,
      },
    })
    .run();
}

export function deleteMcpServer(db: DrizzleDb, idOrSlug: string): boolean {
  const existing = getMcpServer(db, idOrSlug);
  if (!existing) return false;
  const r = db.delete(schema.mcpServers).where(eq(schema.mcpServers.id, existing.id)).run();
  return r.changes > 0;
}

// ---------------------------------------------------------------------------
// Agents
// ---------------------------------------------------------------------------

export function listAgents(db: DrizzleDb): Agent[] {
  const ids = db.select({ id: schema.agents.id }).from(schema.agents).all();
  const out: Agent[] = [];
  for (const { id } of ids) {
    const a = loadAgentById(db, id);
    if (a) out.push(a);
  }
  return out;
}

export function getAgent(db: DrizzleDb, idOrSlug: string): Agent | undefined {
  const cond = isUuid(idOrSlug)
    ? eq(schema.agents.id, idOrSlug)
    : or(eq(schema.agents.id, idOrSlug), eq(schema.agents.slug, idOrSlug));
  const row = db.select().from(schema.agents).where(cond).get();
  if (!row) return undefined;
  return loadAgentById(db, row.id);
}

export function createAgent(db: DrizzleDb, body: AgentCreateBody): Agent {
  const id = randomUUID();
  const slug = slugify(body.name);
  const agent: Agent = { ...body, id, slug };
  replaceAgent(db, agent);
  return getAgent(db, id)!;
}

export function replaceAgent(db: DrizzleDb, agent: Agent): void {
  const now = Date.now();
  wrapConstraintError(
    () =>
      withTransaction(db, (tx) => {
        const existing = tx
          .select()
          .from(schema.agents)
          .where(eq(schema.agents.id, agent.id))
          .get();
        const createdAtMs = existing?.createdAtMs ?? now;
        tx.delete(schema.agentSkills).where(eq(schema.agentSkills.agentId, agent.id)).run();
        tx.delete(schema.agentTools).where(eq(schema.agentTools.agentId, agent.id)).run();
        tx.delete(schema.agentMcpServers).where(eq(schema.agentMcpServers.agentId, agent.id)).run();

        tx.insert(schema.agents)
          .values({
            id: agent.id,
            slug: agent.slug,
            name: agent.name,
            systemPrompt: agent.systemPrompt,
            description: agent.description ?? null,
            executionLimitsJson: JSON.stringify(agent.executionLimits),
            modelOverrideJson: agent.modelOverride ? JSON.stringify(agent.modelOverride) : null,
            pluginAllowlistJson:
              agent.pluginAllowlist === undefined ? null : JSON.stringify(agent.pluginAllowlist),
            pluginDenylistJson:
              agent.pluginDenylist === undefined ? null : JSON.stringify(agent.pluginDenylist),
            createdAtMs,
            updatedAtMs: now,
          })
          .onConflictDoUpdate({
            target: schema.agents.id,
            set: {
              slug: agent.slug,
              name: agent.name,
              systemPrompt: agent.systemPrompt,
              description: agent.description ?? null,
              executionLimitsJson: JSON.stringify(agent.executionLimits),
              modelOverrideJson: agent.modelOverride ? JSON.stringify(agent.modelOverride) : null,
              pluginAllowlistJson:
                agent.pluginAllowlist === undefined ? null : JSON.stringify(agent.pluginAllowlist),
              pluginDenylistJson:
                agent.pluginDenylist === undefined ? null : JSON.stringify(agent.pluginDenylist),
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
      }),
    `agent ${agent.id} relationships`,
  );
}

export function deleteAgent(db: DrizzleDb, idOrSlug: string): boolean {
  const existing = getAgent(db, idOrSlug);
  if (!existing) return false;
  const r = db.delete(schema.agents).where(eq(schema.agents.id, existing.id)).run();
  return r.changes > 0;
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

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

export function createSession(db: DrizzleDb, input: { agentId: string }): SessionRecord {
  const now = Date.now();
  const id = randomUUID();
  wrapConstraintError(
    () =>
      db
        .insert(schema.sessions)
        .values({
          id,
          agentId: input.agentId,
          createdAtMs: now,
          updatedAtMs: now,
        })
        .run(),
    `agent ${input.agentId}`,
  );
  const row = db.select().from(schema.sessions).where(eq(schema.sessions.id, id)).get();
  if (!row) throw new Error('session insert failed');
  return sessionRowToContract(row);
}

export function replaceSession(db: DrizzleDb, record: SessionRecord): void {
  wrapConstraintError(
    () =>
      withTransaction(db, (tx) => {
        const existing = tx
          .select()
          .from(schema.sessions)
          .where(eq(schema.sessions.id, record.id))
          .get();
        tx.insert(schema.sessions)
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
      }),
    `session ${record.id}`,
  );
}

export function deleteSession(db: DrizzleDb, id: string): boolean {
  const r = db.delete(schema.sessions).where(eq(schema.sessions.id, id)).run();
  return r.changes > 0;
}
