import { describe, expect, it } from 'vitest';
import {
  AgentSchema,
  ExecutionLimitsSchema,
  HealthResponseSchema,
  OutputSchema,
  PlanSchema,
  SecretRefSchema,
  SkillSchema,
} from '../src/index.js';

describe('contracts round-trip', () => {
  it('OutputSchema', () => {
    const samples = [
      { type: 'text' as const, content: 'hi' },
      { type: 'code' as const, language: 'ts', content: 'const x = 1' },
      { type: 'tool_result' as const, toolId: 't1', data: { ok: true } },
      { type: 'error' as const, message: 'bad', code: 'E1' },
      { type: 'thinking' as const, content: '...' },
    ];
    for (const s of samples) {
      const parsed = OutputSchema.parse(s);
      expect(OutputSchema.parse(JSON.parse(JSON.stringify(parsed)))).toEqual(parsed);
    }
  });

  it('SkillSchema + AgentSchema + limits', () => {
    const limits = ExecutionLimitsSchema.parse({
      maxSteps: 10,
      maxParallelTasks: 2,
      timeoutMs: 60_000,
    });
    const skill = SkillSchema.parse({
      id: 'skill-1',
      goal: 'Do X',
      constraints: ['c1'],
      tools: ['tool-a'],
    });
    const agent = AgentSchema.parse({
      id: 'agent-1',
      name: 'Default',
      allowedSkillIds: [skill.id],
      allowedToolIds: ['tool-a'],
      allowedMcpServerIds: [],
      executionLimits: limits,
    });
    expect(AgentSchema.parse(JSON.parse(JSON.stringify(agent)))).toEqual(agent);
  });

  it('HealthResponseSchema', () => {
    const h = HealthResponseSchema.parse({ ok: true });
    expect(HealthResponseSchema.parse(JSON.parse(JSON.stringify(h)))).toEqual(h);
  });

  it('PlanSchema + SecretRefSchema', () => {
    const ref = SecretRefSchema.parse({ id: 'sec-1', label: 'OpenAI' });
    const plan = PlanSchema.parse({
      id: 'plan-1',
      tasks: [{ id: 'task-1', description: 'step', toolIds: ['t'] }],
    });
    expect(SecretRefSchema.parse(JSON.parse(JSON.stringify(ref)))).toEqual(ref);
    expect(PlanSchema.parse(JSON.parse(JSON.stringify(plan)))).toEqual(plan);
  });
});
