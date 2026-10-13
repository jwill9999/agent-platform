import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import {
  ContextWindowSchema,
  DEFAULT_CONTEXT_WINDOW,
  AgentCreateBodySchema,
  AgentSchema,
} from '../src/agent.js';

describe('agent context allowances', () => {
  it('defaults absent input to16000 while preserving explicit input and the separate output cap', () => {
    expect(ContextWindowSchema.parse({})).toEqual({
      maxInputTokens: 16000,
      maxOutputTokens: 2048,
      strategy: 'truncate',
    });
    expect(ContextWindowSchema.parse({ maxInputTokens: 1234, strategy: 'summarize' })).toEqual({
      maxInputTokens: 1234,
      maxOutputTokens: 2048,
      strategy: 'summarize',
    });
  });
  it('uses the same fallback for absent and partial configuration without replacing explicit8000', () => {
    expect(DEFAULT_CONTEXT_WINDOW).toEqual(ContextWindowSchema.parse({}));
    expect(ContextWindowSchema.parse({ maxOutputTokens: 321, strategy: 'summarize' })).toEqual({
      maxInputTokens: 16000,
      maxOutputTokens: 321,
      strategy: 'summarize',
    });
    expect(ContextWindowSchema.parse({ maxInputTokens: 8000 })).toEqual({
      maxInputTokens: 8000,
      maxOutputTokens: 2048,
      strategy: 'truncate',
    });
  });
  it('keeps the public OpenAPI input and output allowances aligned with shared defaults', () => {
    const spec = parse(
      readFileSync(
        new URL('../../../contracts/openapi/agent-platform.yaml', import.meta.url),
        'utf8',
      ),
    ) as { components: { schemas: { ContextWindow: { properties: Record<string, unknown> } } } };
    const properties = spec.components.schemas.ContextWindow.properties;
    expect(properties['maxInputTokens']).toEqual({
      type: 'integer',
      minimum: 1,
      default: DEFAULT_CONTEXT_WINDOW.maxInputTokens,
    });
    expect(properties['maxOutputTokens']).toEqual({
      type: 'integer',
      minimum: 1,
      default: DEFAULT_CONTEXT_WINDOW.maxOutputTokens,
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
