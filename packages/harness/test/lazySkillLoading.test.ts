import { describe, it, expect } from 'vitest';
import type { Agent, Skill } from '@agent-platform/contracts';
import type { HarnessStateType } from '../src/graphState.js';
import type { ToolDispatchContext } from '../src/nodes/toolDispatch.js';
import { createToolDispatchNode } from '../src/nodes/toolDispatch.js';
import { GET_SKILL_DETAIL_ID } from '../src/systemTools.js';
import { McpSessionManager } from '@agent-platform/mcp-adapter';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const baseAgent: Agent = {
  id: 'agent-1',
  slug: 'agent-1',
  name: 'Test Agent',
  systemPrompt: 'You are a test assistant.',
  allowedSkillIds: ['skill-1', 'skill-2'],
  allowedToolIds: [],
  allowedMcpServerIds: [],
  executionLimits: { maxSteps: 10, maxParallelTasks: 2, timeoutMs: 60_000 },
};

const fullSkill: Skill = {
  id: 'skill-1',
  slug: 'skill-1',
  name: 'Code Review',
  description: 'Reviews code for bugs and style.',
  hint: 'Use when the user asks for code review or quality checks.',
  goal: 'Perform a thorough code review checking for bugs, style violations, and performance issues.',
  constraints: ['max 3 files per review', 'provide line-by-line feedback'],
  tools: ['sys_read_file'],
};

const skillNoDescription: Skill = {
  id: 'skill-2',
  slug: 'skill-2',
  name: 'Summarize',
  goal: 'Summarize the provided text into a concise paragraph. Keep key details and omit filler words to produce a short summary.',
  constraints: [],
  tools: [],
};

function makeState(overrides: Partial<HarnessStateType> = {}): HarnessStateType {
  return {
    trace: [],
    plan: null,
    taskIndex: 0,
    limits: { maxSteps: 10, maxParallelTasks: 2, timeoutMs: 60_000 },
    runId: 'run-1',
    sessionId: 'session-1',
    halted: false,
    mode: 'react',
    messages: [],
    toolDefinitions: [],
    llmOutput: null,
    modelConfig: null,
    stepCount: 0,
    recentToolCalls: [],
    totalTokensUsed: 0,
    totalCostUnits: 0,
    totalToolCalls: 0,
    loadedSkillIds: [],
    totalRetries: 0,
    startedAtMs: Date.now(),
    deadlineMs: 60_000,
    ...overrides,
  };
}

function makeCtx(overrides: Partial<ToolDispatchContext> = {}): ToolDispatchContext {
  return {
    agent: baseAgent,
    mcpManager: new McpSessionManager(),
    skillResolver: (id: string) => {
      if (id === 'skill-1') return fullSkill;
      if (id === 'skill-2') return skillNoDescription;
      return undefined;
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('sys_get_skill_detail', () => {
  it('returns full skill body for a valid assigned skill', async () => {
    const ctx = makeCtx();
    const node = createToolDispatchNode(ctx);
    const state = makeState({
      llmOutput: {
        kind: 'tool_calls',
        calls: [{ id: 'tc-1', name: GET_SKILL_DETAIL_ID, args: { skill_id: 'skill-1' } }],
      },
    });

    const result = await node(state);
    const msg = result.messages?.[0];
    expect(msg).toBeDefined();
    expect(msg!.role).toBe('tool');
    const content = JSON.parse(msg!.content);
    expect(content.id).toBe('skill-1');
    expect(content.goal).toContain('thorough code review');
    expect(content.constraints).toEqual([
      'max 3 files per review',
      'provide line-by-line feedback',
    ]);
    expect(content.tools).toEqual(['sys_read_file']);
  });

  it('returns error for a skill not assigned to the agent', async () => {
    const ctx = makeCtx();
    const node = createToolDispatchNode(ctx);
    const state = makeState({
      llmOutput: {
        kind: 'tool_calls',
        calls: [{ id: 'tc-1', name: GET_SKILL_DETAIL_ID, args: { skill_id: 'unknown-skill' } }],
      },
    });

    const result = await node(state);
    const msg = result.messages?.[0];
    const content = JSON.parse(msg!.content);
    expect(content.error).toBe('SKILL_NOT_ASSIGNED');
  });

  it('returns error for a skill that does not exist', async () => {
    const agent = { ...baseAgent, allowedSkillIds: ['nonexistent'] };
    const ctx = makeCtx({
      agent,
      skillResolver: () => undefined,
    });
    const node = createToolDispatchNode(ctx);
    const state = makeState({
      llmOutput: {
        kind: 'tool_calls',
        calls: [{ id: 'tc-1', name: GET_SKILL_DETAIL_ID, args: { skill_id: 'nonexistent' } }],
      },
    });

    const result = await node(state);
    const msg = result.messages?.[0];
    const content = JSON.parse(msg!.content);
    expect(content.error).toBe('SKILL_NOT_FOUND');
  });

  it('returns error when skill_id is missing', async () => {
    const ctx = makeCtx();
    const node = createToolDispatchNode(ctx);
    const state = makeState({
      llmOutput: {
        kind: 'tool_calls',
        calls: [{ id: 'tc-1', name: GET_SKILL_DETAIL_ID, args: {} }],
      },
    });

    const result = await node(state);
    const msg = result.messages?.[0];
    const content = JSON.parse(msg!.content);
    expect(content.error).toBe('INVALID_INPUT');
  });

  it('tracks loaded skill IDs in state', async () => {
    const ctx = makeCtx();
    const node = createToolDispatchNode(ctx);
    const state = makeState({
      llmOutput: {
        kind: 'tool_calls',
        calls: [{ id: 'tc-1', name: GET_SKILL_DETAIL_ID, args: { skill_id: 'skill-1' } }],
      },
    });

    const result = await node(state);
    expect(result.loadedSkillIds).toEqual(['skill-1']);
  });

  it('emits skill_loaded trace event', async () => {
    const ctx = makeCtx();
    const node = createToolDispatchNode(ctx);
    const state = makeState({
      llmOutput: {
        kind: 'tool_calls',
        calls: [{ id: 'tc-1', name: GET_SKILL_DETAIL_ID, args: { skill_id: 'skill-1' } }],
      },
    });

    const result = await node(state);
    const loadEvent = result.trace?.find((e) => e.type === 'skill_loaded');
    expect(loadEvent).toEqual({ type: 'skill_loaded', skillId: 'skill-1', loadCount: 1 });
  });

  it('emits tool_dispatch trace with ok:true on success', async () => {
    const ctx = makeCtx();
    const node = createToolDispatchNode(ctx);
    const state = makeState({
      llmOutput: {
        kind: 'tool_calls',
        calls: [{ id: 'tc-1', name: GET_SKILL_DETAIL_ID, args: { skill_id: 'skill-1' } }],
      },
    });

    const result = await node(state);
    const dispatchEvent = result.trace?.find((e) => e.type === 'tool_dispatch');
    expect(dispatchEvent).toMatchObject({ type: 'tool_dispatch', ok: true });
  });

  it('emits tool_dispatch trace with ok:false on error', async () => {
    const ctx = makeCtx();
    const node = createToolDispatchNode(ctx);
    const state = makeState({
      llmOutput: {
        kind: 'tool_calls',
        calls: [{ id: 'tc-1', name: GET_SKILL_DETAIL_ID, args: { skill_id: 'unknown-skill' } }],
      },
    });

    const result = await node(state);
    const dispatchEvent = result.trace?.find((e) => e.type === 'tool_dispatch');
    expect(dispatchEvent).toMatchObject({ type: 'tool_dispatch', ok: false });
  });

  it('filters returned tools to only those executable for the agent', async () => {
    const skillWithGhost: Skill = {
      ...fullSkill,
      tools: ['sys_read_file', 'ghost_tool', 'another_missing'],
    };
    const ctx = makeCtx({
      agent: {
        ...baseAgent,
        allowedToolIds: ['sys_read_file'],
      },
      skillResolver: (id: string) => (id === 'skill-1' ? skillWithGhost : undefined),
    });
    const node = createToolDispatchNode(ctx);
    const state = makeState({
      llmOutput: {
        kind: 'tool_calls',
        calls: [{ id: 'tc-1', name: GET_SKILL_DETAIL_ID, args: { skill_id: 'skill-1' } }],
      },
    });

    const result = await node(state);
    const msg = result.messages?.[0];
    const content = JSON.parse(msg!.content);
    // ghost_tool and another_missing should be filtered out
    expect(content.tools).toEqual(['sys_read_file']);
  });

  describe('governor', () => {
    it('emits warning trace at 3 loads of same skill', async () => {
      const ctx = makeCtx();
      const node = createToolDispatchNode(ctx);
      const state = makeState({
        loadedSkillIds: ['skill-1', 'skill-1'],
        llmOutput: {
          kind: 'tool_calls',
          calls: [{ id: 'tc-1', name: GET_SKILL_DETAIL_ID, args: { skill_id: 'skill-1' } }],
        },
      });

      const result = await node(state);
      const loopEvent = result.trace?.find((e) => e.type === 'skill_load_loop');
      expect(loopEvent).toEqual({ type: 'skill_load_loop', skillId: 'skill-1', loadCount: 3 });
      // Still returns data at warning level
      const msg = result.messages?.[0];
      const content = JSON.parse(msg!.content);
      expect(content.id).toBe('skill-1');
    });

    it('returns error at 5 loads of same skill (reasoning loop)', async () => {
      const ctx = makeCtx();
      const node = createToolDispatchNode(ctx);
      const state = makeState({
        loadedSkillIds: ['skill-1', 'skill-1', 'skill-1', 'skill-1'],
        llmOutput: {
          kind: 'tool_calls',
          calls: [{ id: 'tc-1', name: GET_SKILL_DETAIL_ID, args: { skill_id: 'skill-1' } }],
        },
      });

      const result = await node(state);
      const msg = result.messages?.[0];
      const content = JSON.parse(msg!.content);
      expect(content.error).toBe('SKILL_LOAD_LOOP');
      expect(content.message).toContain('loaded 5 times');
    });

    it('does not error for different skills even with many total loads', async () => {
      const ctx = makeCtx();
      const node = createToolDispatchNode(ctx);
      const state = makeState({
        loadedSkillIds: ['skill-1', 'skill-1', 'skill-1', 'skill-1', 'skill-2', 'skill-2'],
        llmOutput: {
          kind: 'tool_calls',
          calls: [{ id: 'tc-1', name: GET_SKILL_DETAIL_ID, args: { skill_id: 'skill-2' } }],
        },
      });

      const result = await node(state);
      const msg = result.messages?.[0];
      const content = JSON.parse(msg!.content);
      // skill-2 has only been loaded 2 times before, this is load 3 — warning but success
      expect(content.id).toBe('skill-2');
    });
  });

  it('works without skillResolver configured (returns error gracefully)', async () => {
    const ctx = makeCtx({ skillResolver: undefined });
    const node = createToolDispatchNode(ctx);
    const state = makeState({
      llmOutput: {
        kind: 'tool_calls',
        calls: [{ id: 'tc-1', name: GET_SKILL_DETAIL_ID, args: { skill_id: 'skill-1' } }],
      },
    });

    const result = await node(state);
    const msg = result.messages?.[0];
    const content = JSON.parse(msg!.content);
    expect(content.error).toBe('SKILL_RESOLVER_MISSING');
  });
});

describe('formatSkillSection (stub-only)', () => {
  // These are tested indirectly via buildAgentContext in factory.test.ts
  // but we verify the stub format directly via the prompt output

  it('stubs use description when available', async () => {
    const ctx = makeCtx();
    const node = createToolDispatchNode(ctx);
    // The stubs are in the system prompt, tested in factory.test.ts
    // Here we just verify the tool itself works correctly
    const state = makeState({
      llmOutput: {
        kind: 'tool_calls',
        calls: [{ id: 'tc-1', name: GET_SKILL_DETAIL_ID, args: { skill_id: 'skill-1' } }],
      },
    });

    const result = await node(state);
    const msg = result.messages?.[0];
    const content = JSON.parse(msg!.content);
    expect(content.name).toBe('Code Review');
  });
});
