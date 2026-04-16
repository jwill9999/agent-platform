import type { DrizzleDb } from '../database.js';
import * as schema from '../schema.js';
import { withTransaction } from '../transaction.js';
import { DEFAULT_AGENT_ID, DEMO_SKILL_ID } from './constants.js';

/**
 * Idempotent seed: demo skill (optional registry row) + default agent + allowlist link.
 * Safe to run after migrations; safe to run multiple times.
 */
export function runSeed(db: DrizzleDb): void {
  const now = Date.now();

  withTransaction(db, (tx) => {
    tx.insert(schema.skills)
      .values({
        id: DEMO_SKILL_ID,
        goal: 'Demo skill placeholder (replace with real skills in production).',
        constraintsJson: '[]',
        toolIdsJson: '[]',
      })
      .onConflictDoNothing()
      .run();

    tx.insert(schema.agents)
      .values({
        id: DEFAULT_AGENT_ID,
        name: 'Default agent',
        systemPrompt:
          'You are a helpful assistant. Use available tools to help the user accomplish their tasks. Be concise and accurate.',
        description: 'Default general-purpose agent with standard tools and limits.',
        executionLimitsJson: JSON.stringify({
          maxSteps: 32,
          maxParallelTasks: 4,
          timeoutMs: 600_000,
          maxTokens: 128_000,
        }),
        modelOverrideJson: null,
        pluginAllowlistJson: null,
        pluginDenylistJson: null,
        createdAtMs: now,
        updatedAtMs: now,
      })
      .onConflictDoNothing()
      .run();

    tx.insert(schema.agentSkills)
      .values({ agentId: DEFAULT_AGENT_ID, skillId: DEMO_SKILL_ID })
      .onConflictDoNothing()
      .run();
  });
}
