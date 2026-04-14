import { describe, expect, it } from 'vitest';
import type { Agent } from '@agent-platform/contracts';
import { isMcpServerAllowed, isSkillAllowed, isToolExecutionAllowed } from '../src/allowlists.js';

const limits = {
  maxSteps: 8,
  maxParallelTasks: 2,
  timeoutMs: 60_000,
};

const baseAgent: Agent = {
  id: 'a1',
  name: 'Test',
  systemPrompt: 'Test agent',
  allowedSkillIds: ['s1'],
  allowedToolIds: ['t-plain'],
  allowedMcpServerIds: ['mcp-fs'],
  executionLimits: limits,
};

describe('allowlists', () => {
  it('allows listed skill', () => {
    expect(isSkillAllowed(baseAgent, 's1')).toBe(true);
    expect(isSkillAllowed(baseAgent, 'other')).toBe(false);
  });

  it('allows plain tool id when listed', () => {
    expect(isToolExecutionAllowed(baseAgent, 't-plain')).toBe(true);
    expect(isToolExecutionAllowed(baseAgent, 'nope')).toBe(false);
  });

  it('allows MCP composite tool when server id is allowlisted', () => {
    expect(isToolExecutionAllowed(baseAgent, 'mcp-fs:read')).toBe(true);
    expect(isToolExecutionAllowed(baseAgent, 'other:read')).toBe(false);
  });

  it('checks MCP server id directly', () => {
    expect(isMcpServerAllowed(baseAgent, 'mcp-fs')).toBe(true);
    expect(isMcpServerAllowed(baseAgent, 'other')).toBe(false);
  });
});
