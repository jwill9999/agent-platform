import { describe, expect, it } from 'vitest';
import {
  AgentSchema,
  ApprovalRequestDecisionBodySchema,
  ApprovalRequestQuerySchema,
  ApprovalRequestSchema,
  CriticVerdictSchema,
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
      expect(OutputSchema.parse(structuredClone(parsed))).toEqual(parsed);
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
      slug: 'skill-1',
      name: 'Skill 1',
      goal: 'Do X',
      constraints: ['c1'],
      tools: ['tool-a'],
    });
    const agent = AgentSchema.parse({
      id: 'agent-1',
      slug: 'agent-1',
      name: 'Default',
      systemPrompt: 'Test agent',
      allowedSkillIds: [skill.id],
      allowedToolIds: ['tool-a'],
      allowedMcpServerIds: [],
      executionLimits: limits,
    });
    expect(AgentSchema.parse(structuredClone(agent))).toEqual(agent);
  });

  it('HealthResponseSchema', () => {
    const h = HealthResponseSchema.parse({ ok: true });
    expect(HealthResponseSchema.parse(structuredClone(h))).toEqual(h);
  });

  it('PlanSchema + SecretRefSchema', () => {
    const ref = SecretRefSchema.parse({ id: 'sec-1', label: 'OpenAI' });
    const plan = PlanSchema.parse({
      id: 'plan-1',
      tasks: [{ id: 'task-1', description: 'step', toolIds: ['t'] }],
    });
    expect(SecretRefSchema.parse(structuredClone(ref))).toEqual(ref);
    expect(PlanSchema.parse(structuredClone(plan))).toEqual(plan);
  });

  it('CriticVerdictSchema', () => {
    const accept = CriticVerdictSchema.parse({ verdict: 'accept' });
    expect(accept).toEqual({ verdict: 'accept', reasons: [] });
    const revise = CriticVerdictSchema.parse({
      verdict: 'revise',
      reasons: ['gap', 'fix'],
    });
    expect(CriticVerdictSchema.parse(structuredClone(revise))).toEqual(revise);
    expect(() => CriticVerdictSchema.parse({ verdict: 'maybe' })).toThrow();
  });

  it('ExecutionLimitsSchema accepts maxCriticIterations', () => {
    const limits = ExecutionLimitsSchema.parse({
      maxSteps: 10,
      maxParallelTasks: 2,
      timeoutMs: 60_000,
      maxCriticIterations: 4,
    });
    expect(limits.maxCriticIterations).toBe(4);
  });

  it('ExecutionLimitsSchema rejects non-positive maxCriticIterations', () => {
    expect(() =>
      ExecutionLimitsSchema.parse({
        maxSteps: 10,
        maxParallelTasks: 2,
        timeoutMs: 60_000,
        maxCriticIterations: 0,
      }),
    ).toThrow();

    expect(() =>
      ExecutionLimitsSchema.parse({
        maxSteps: 10,
        maxParallelTasks: 2,
        timeoutMs: 60_000,
        maxCriticIterations: -1,
      }),
    ).toThrow();
  });

  it('ApprovalRequest schemas round-trip and validate decisions', () => {
    const request = ApprovalRequestSchema.parse({
      id: 'approval-1',
      sessionId: 'session-1',
      runId: 'run-1',
      agentId: 'agent-1',
      toolName: 'sys_bash',
      argsJson: '{"command":"date"}',
      executionPayloadJson: '{"toolCallId":"tc-1"}',
      riskTier: 'high',
      status: 'pending',
      createdAtMs: 1000,
      expiresAtMs: 2000,
    });

    expect(ApprovalRequestSchema.parse(structuredClone(request))).toEqual(request);
    expect(ApprovalRequestQuerySchema.parse({ status: 'pending', limit: '10' })).toMatchObject({
      status: 'pending',
      limit: 10,
      offset: 0,
    });
    expect(ApprovalRequestDecisionBodySchema.parse({ reason: 'approved by user' })).toEqual({
      reason: 'approved by user',
    });
    expect(() => ApprovalRequestSchema.parse({ ...request, status: 'done' })).toThrow();
  });
});
