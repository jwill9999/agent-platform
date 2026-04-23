import { describe, expect, it } from 'vitest';
import type { DodContract, ExecutionLimits } from '@agent-platform/contracts';
import { createPluginDispatcher } from '@agent-platform/plugin-sdk';
import { createDodCheckNode } from '../src/index.js';
import type { HarnessStateType } from '../src/graphState.js';
import type { ChatMessage, LlmOutput, OutputEmitter } from '../src/types.js';

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
    runId: 'run-dod-check',
    sessionId: 'sess-dod-check',
    halted: false,
    mode: 'react',
    messages: [
      { role: 'user', content: 'What happened?' },
      { role: 'assistant', content: 'The deployment completed successfully.' },
    ] as ChatMessage[],
    toolDefinitions: [],
    llmOutput: { kind: 'text', content: 'The deployment completed successfully.' } as LlmOutput,
    modelConfig: null,
    stepCount: 1,
    recentToolCalls: [],
    totalTokensUsed: 0,
    totalCostUnits: 0,
    iterations: 1,
    dodContract: {
      criteria: ['Answer the user'],
      evidence: [],
      passed: false,
      failedCriteria: [],
    } satisfies DodContract,
    ...overrides,
  };
}

function captureEmitter(): { emitter: OutputEmitter; events: Array<Record<string, unknown>> } {
  const events: Array<Record<string, unknown>> = [];
  return {
    events,
    emitter: {
      emit: async (event) => {
        events.push(event as unknown as Record<string, unknown>);
      },
      end: () => {},
    },
  };
}

describe('createDodCheckNode', () => {
  it('stores a passing contract and emits a summary text line', async () => {
    const { emitter, events } = captureEmitter();
    const node = createDodCheckNode({
      emitter,
      evaluate: async (_state, contract) => ({
        ...contract,
        evidence: ['Final answer satisfied the request'],
        passed: true,
        failedCriteria: [],
      }),
    });

    const delta = await node(initialState() as HarnessStateType);

    expect(delta.dodContract).toMatchObject({
      passed: true,
      failedCriteria: [],
    });
    expect(delta.messages).toBeUndefined();
    expect(events.some((event) => event['type'] === 'text')).toBe(true);
  });

  it('injects <dod-failed> feedback while still under the iteration cap', async () => {
    const node = createDodCheckNode({
      evaluate: async (_state, contract) => ({
        ...contract,
        evidence: ['Missing one required detail'],
        passed: false,
        failedCriteria: ['Answer the user'],
      }),
    });

    const delta = await node(initialState() as HarnessStateType);

    expect(delta.dodContract).toMatchObject({
      passed: false,
      failedCriteria: ['Answer the user'],
    });
    expect(delta.messages?.[0]?.role).toBe('system');
    expect(delta.messages?.[0]?.content).toContain('<dod-failed>');
  });

  it('uses the plugin override when onDodCheck returns a contract', async () => {
    const node = createDodCheckNode({
      dispatcher: createPluginDispatcher([
        {
          onDodCheck: async (ctx) => ({
            ...ctx.contract,
            evidence: ['Plugin override'],
            passed: true,
            failedCriteria: [],
          }),
        },
      ]),
      evaluate: async (_state, contract) => ({
        ...contract,
        evidence: ['Internal evaluator failed'],
        passed: false,
        failedCriteria: contract.criteria,
      }),
    });

    const delta = await node(initialState() as HarnessStateType);
    expect(delta.dodContract).toMatchObject({
      evidence: ['Plugin override'],
      passed: true,
    });
  });

  it('emits DOD_FAILED instead of retry feedback when the cap is exhausted', async () => {
    const { emitter, events } = captureEmitter();
    const node = createDodCheckNode({
      emitter,
      evaluate: async (_state, contract) => ({
        ...contract,
        evidence: ['Still missing detail'],
        passed: false,
        failedCriteria: ['Answer the user'],
      }),
    });

    const delta = await node(
      initialState({
        iterations: 1,
        limits: { ...limits, maxCriticIterations: 1 },
      }) as HarnessStateType,
    );

    expect(delta.messages).toBeUndefined();
    expect(
      events.some((event) => event['type'] === 'error' && event['code'] === 'DOD_FAILED'),
    ).toBe(true);
  });
});
