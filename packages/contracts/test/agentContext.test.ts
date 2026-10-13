import { describe, expect, it } from 'vitest';
import { ContextWindowSchema, AgentCreateBodySchema, AgentSchema } from '../src/agent.js';

describe('agent context allowances', () => {
  it('preserves saved input defaults and adds a separate default output cap', () => {
    expect(ContextWindowSchema.parse({})).toEqual({
      maxInputTokens: 8000,
      maxOutputTokens: 2048,
      strategy: 'truncate',
    });
    expect(ContextWindowSchema.parse({ maxInputTokens: 1234, strategy: 'summarize' })).toEqual({
      maxInputTokens: 1234,
      maxOutputTokens: 2048,
      strategy: 'summarize',
    });
  });
  it.each([0, -1, 0.5, Infinity, NaN])('rejects invalid output allowance %s', (maxOutputTokens) => {
    expect(ContextWindowSchema.safeParse({ maxOutputTokens }).success).toBe(false);
  });
  it('round trips output allowance through create and saved agent contracts', () => {
    const body = AgentCreateBodySchema.parse({
      name: 'Test',
      systemPrompt: 'Help',
      allowedSkillIds: [],
      allowedToolIds: [],
      allowedMcpServerIds: [],
      executionLimits: { maxSteps: 10, maxParallelTasks: 1, timeoutMs: 60000 },
      contextWindow: { maxInputTokens: 10000, maxOutputTokens: 3000, strategy: 'summarize' },
    });
    const saved = AgentSchema.parse({ ...body, id: 'id', slug: 'test' });
    const copied = AgentCreateBodySchema.parse(saved);
    expect(copied.contextWindow).toEqual(body.contextWindow);
  });
});
