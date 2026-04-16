import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { PlanSchema } from '@agent-platform/contracts';
import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';

import { closeDatabase, openDatabase } from '../src/database.js';
import { loadAgentById, skillRowToContract } from '../src/mappers.js';
import * as schema from '../src/schema.js';

describe('contracts v0 alignment', () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const d of dirs) {
      try {
        rmSync(d, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    }
    dirs.length = 0;
  });

  it('round-trips Skill rows through SkillSchema', () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'agent-platform-db-'));
    dirs.push(dir);
    const { db, sqlite } = openDatabase(path.join(dir, 't.sqlite'));

    db.insert(schema.skills)
      .values({
        id: 'skill-1',
        slug: 'skill-1',
        name: 'Skill 1',
        goal: 'Do the thing',
        constraintsJson: JSON.stringify(['c1']),
        toolIdsJson: JSON.stringify(['tool-a']),
        outputSchemaJson: JSON.stringify({ type: 'object' }),
      })
      .run();

    const row = db.select().from(schema.skills).where(eq(schema.skills.id, 'skill-1')).get();
    expect(row).toBeDefined();
    const skill = skillRowToContract(row);
    expect(skill.id).toBe('skill-1');
    expect(skill.tools).toEqual(['tool-a']);

    closeDatabase(sqlite);
  });

  it('round-trips Agent + allowlists through AgentSchema', () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'agent-platform-db-'));
    dirs.push(dir);
    const { db, sqlite } = openDatabase(path.join(dir, 'a.sqlite'));
    const now = Date.now();

    db.insert(schema.agents)
      .values({
        id: 'agent-1',
        slug: 'agent-1',
        name: 'Default',
        systemPrompt: 'Test agent for contracts alignment',
        executionLimitsJson: JSON.stringify({
          maxSteps: 10,
          maxParallelTasks: 2,
          timeoutMs: 60_000,
          maxTokens: 8000,
        }),
        modelOverrideJson: JSON.stringify({ provider: 'openai', model: 'gpt-4.1-mini' }),
        pluginAllowlistJson: JSON.stringify(['p1']),
        pluginDenylistJson: JSON.stringify(null),
        createdAtMs: now,
        updatedAtMs: now,
      })
      .run();

    db.insert(schema.skills)
      .values({
        id: 's1',
        slug: 's1',
        name: 'Skill S1',
        goal: 'g',
        constraintsJson: '[]',
        toolIdsJson: '[]',
      })
      .run();
    db.insert(schema.tools).values({ id: 't1', slug: 't1', name: 'Tool' }).run();
    db.insert(schema.mcpServers)
      .values({
        id: 'm1',
        slug: 'm1',
        name: 'MCP',
        transport: 'stdio',
      })
      .run();

    db.insert(schema.agentSkills).values({ agentId: 'agent-1', skillId: 's1' }).run();
    db.insert(schema.agentTools).values({ agentId: 'agent-1', toolId: 't1' }).run();
    db.insert(schema.agentMcpServers).values({ agentId: 'agent-1', mcpServerId: 'm1' }).run();

    const agent = loadAgentById(db, 'agent-1');
    expect(agent).toBeDefined();
    expect(agent!.allowedSkillIds).toEqual(['s1']);
    expect(agent!.allowedToolIds).toEqual(['t1']);
    expect(agent!.allowedMcpServerIds).toEqual(['m1']);
    expect(agent!.executionLimits.maxSteps).toBe(10);

    closeDatabase(sqlite);
  });

  it('stores Plan JSON matching PlanSchema', () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'agent-platform-db-'));
    dirs.push(dir);
    const { db, sqlite } = openDatabase(path.join(dir, 'p.sqlite'));

    const plan = PlanSchema.parse({
      id: 'plan-1',
      tasks: [{ id: 'task-1', description: 'step', toolIds: ['t1'] }],
    });

    db.insert(schema.plans)
      .values({ id: plan.id, sessionId: null, payloadJson: JSON.stringify(plan) })
      .run();

    const row = db.select().from(schema.plans).where(eq(schema.plans.id, 'plan-1')).get();
    expect(row).toBeDefined();
    const parsed = PlanSchema.parse(JSON.parse(row!.payloadJson));
    expect(parsed.tasks).toHaveLength(1);

    closeDatabase(sqlite);
  });
});
