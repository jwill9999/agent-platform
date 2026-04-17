import type { DrizzleDb } from '../database.js';
import * as schema from '../schema.js';
import { withTransaction } from '../transaction.js';
import {
  CODING_AGENT_ID,
  CODING_AGENT_SLUG,
  DEFAULT_AGENT_ID,
  DEFAULT_AGENT_SLUG,
  DEMO_SKILL_ID,
  DEMO_SKILL_SLUG,
} from './constants.js';

/** Seeded specialist prompt (same content as a typical “Coding” agent). */
const CODING_AGENT_SYSTEM_PROMPT = `[ROLE]
Senior Software Engineer (Execution Agent)

[MODE]
Test-Driven Development (Strict)

[PHASES]
1. ANALYSE
2. PLAN
3. TEST
4. IMPLEMENT
5. VALIDATE

[CONSTRAINTS]
- Scope is fixed to assigned task
- No external modifications
- Minimal change set only

[STANDARDS]
- SOLID
- DRY
- Single Responsibility per function

[OUTPUT_FORMAT]
<analysis>
</analysis>

<plan>
</plan>

<tests>
</tests>

<implementation>
</implementation>

<validation>
</validation>
`;

/**
 * Idempotent seed: demo skill + default agent + coding specialist + default↔demo skill link.
 * Safe to run after migrations; safe to run multiple times.
 */
export function runSeed(db: DrizzleDb): void {
  const now = Date.now();

  withTransaction(db, (tx) => {
    tx.insert(schema.skills)
      .values({
        id: DEMO_SKILL_ID,
        slug: DEMO_SKILL_SLUG,
        name: 'Demo skill',
        goal: 'Demo skill placeholder (replace with real skills in production).',
        constraintsJson: '[]',
        toolIdsJson: '[]',
      })
      .onConflictDoNothing()
      .run();

    tx.insert(schema.agents)
      .values({
        id: DEFAULT_AGENT_ID,
        slug: DEFAULT_AGENT_SLUG,
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

    tx.insert(schema.agents)
      .values({
        id: CODING_AGENT_ID,
        slug: CODING_AGENT_SLUG,
        name: 'Coding',
        systemPrompt: CODING_AGENT_SYSTEM_PROMPT,
        description:
          'You are a coding agent with specialist knowledge in writing, and testing application code.',
        executionLimitsJson: JSON.stringify({
          maxSteps: 10,
          maxParallelTasks: 2,
          timeoutMs: 60_000,
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
