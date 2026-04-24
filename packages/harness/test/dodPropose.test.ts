import { describe, expect, it } from 'vitest';
import type { ExecutionLimits } from '@agent-platform/contracts';
import { createDodProposeNode } from '../src/index.js';
import type { HarnessStateType } from '../src/graphState.js';
import type { ChatMessage, LlmOutput } from '../src/types.js';

const limits: ExecutionLimits = {
  maxSteps: 10,
  maxParallelTasks: 2,
  timeoutMs: 60_000,
};

function initialState(overrides: Partial<HarnessStateType> = {}): Record<string, unknown> {
  return {
    trace: [],
    plan: null,
    taskIndex: 0,
    limits,
    runId: 'run-dod-propose',
    sessionId: 'sess-dod-propose',
    halted: false,
    mode: 'react',
    messages: [{ role: 'user', content: 'Summarise the result clearly.' }] as ChatMessage[],
    toolDefinitions: [],
    llmOutput: { kind: 'text', content: 'draft' } as LlmOutput,
    modelConfig: null,
    stepCount: 0,
    recentToolCalls: [],
    totalTokensUsed: 0,
    totalCostUnits: 0,
    iterations: 0,
    ...overrides,
  };
}

describe('createDodProposeNode', () => {
  it('falls back to a default criterion when no modelConfig is present', async () => {
    const node = createDodProposeNode();
    const delta = await node(initialState() as HarnessStateType);

    expect(delta.dodContract).toEqual({
      criteria: ["Answer the user's question."],
      evidence: [],
      passed: false,
      failedCriteria: [],
    });
  });

  it('uses an injected proposer when provided', async () => {
    const node = createDodProposeNode({
      propose: async () => ['Address every bullet', 'Cite the tool output'],
    });
    const delta = await node(initialState() as HarnessStateType);

    expect(delta.dodContract).toEqual({
      criteria: ['Address every bullet', 'Cite the tool output'],
      evidence: [],
      passed: false,
      failedCriteria: [],
    });
  });
});
