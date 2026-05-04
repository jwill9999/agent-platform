import { describe, expect, it, vi } from 'vitest';
import type { SensorResult, SensorRunRecord } from '@agent-platform/contracts';
import {
  createSensorCheckNode,
  routeAfterSensorCheck,
  type SensorRunner,
} from '../src/nodes/sensorCheck.js';
import type { HarnessStateType } from '../src/graphState.js';
import { captureEmitter } from './testUtils.js';

function makeSensorResult(overrides: Partial<SensorResult>): SensorResult {
  return {
    sensorId: 'quality_gate:typecheck',
    status: 'passed',
    summary: 'typecheck passed',
    findings: [],
    repairInstructions: [],
    evidence: [],
    terminalEvidence: [],
    runtimeLimitations: [],
    metadata: {},
    ...overrides,
  };
}

function makeSensorRecord(
  result: SensorResult,
  selectionState: SensorRunRecord['selectionState'] = 'required',
): SensorRunRecord {
  return {
    id: `${result.sensorId}:before_push`,
    sensorId: result.sensorId,
    trigger: 'before_push',
    selectedForProfile: 'coding',
    selectionState,
    status: 'completed',
    startedAtMs: 0,
    completedAtMs: 1,
    result,
    metadata: {},
  };
}

function makeState(overrides: Partial<HarnessStateType> = {}): HarnessStateType {
  return {
    trace: [],
    plan: null,
    taskIndex: 0,
    limits: { maxSteps: 8, maxParallelTasks: 2, timeoutMs: 60_000 },
    runId: 'run-sensor',
    sessionId: 'session-sensor',
    halted: false,
    mode: 'react',
    messages: [{ role: 'user', content: 'finish this change' }],
    toolDefinitions: [],
    llmOutput: { kind: 'text', content: 'Done' },
    modelConfig: null,
    stepCount: 1,
    recentToolCalls: [],
    totalTokensUsed: 0,
    totalCostUnits: 0,
    totalToolCalls: 0,
    loadedSkillIds: [],
    totalRetries: 0,
    startedAtMs: 0,
    deadlineMs: 60_000,
    iterations: 0,
    dodAttempts: 0,
    sensorResults: [],
    sensorAttempts: {},
    sensorAgentProfile: 'coding',
    sensorTaskContexts: ['repo_change'],
    sensorChangedFiles: ['packages/harness/src/foo.ts'],
    ...overrides,
  };
}

function runnerWith(result: SensorResult, selectionState?: SensorRunRecord['selectionState']) {
  const runner: SensorRunner = vi.fn(async () => ({
    results: [result],
    records: [makeSensorRecord(result, selectionState)],
  }));
  return runner;
}

describe('createSensorCheckNode', () => {
  it('does not run sensors after read-only tool checkpoints', async () => {
    const runner = runnerWith(makeSensorResult({ status: 'passed' }));
    const node = createSensorCheckNode({ runSensors: runner });

    const result = await node(
      makeState({
        llmOutput: null,
        sensorLastToolIds: ['sys_read_file'],
      }),
    );

    expect(runner).not.toHaveBeenCalled();
    expect(result).toEqual({});
  });

  it('runs a targeted optional sensor after a meaningful code edit checkpoint', async () => {
    const runner = runnerWith(makeSensorResult({ status: 'passed' }), 'optional');
    const node = createSensorCheckNode({ runSensors: runner });

    const result = await node(
      makeState({
        llmOutput: null,
        sensorLastToolIds: ['coding_apply_patch'],
      }),
    );

    expect(runner).toHaveBeenCalledWith(
      expect.objectContaining({
        trigger: 'on_meaningful_change',
        executionLimits: expect.objectContaining({ maxSensors: 1 }),
      }),
      expect.anything(),
    );
    expect(result.messages).toBeUndefined();
    expect(result.trace).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'sensor_run',
          sensorId: 'quality_gate:typecheck',
          trigger: 'on_meaningful_change',
          required: false,
        }),
      ]),
    );
  });

  it('runs required local sensors before completion and stays quiet when they pass', async () => {
    const runner = runnerWith(makeSensorResult({ status: 'passed' }), 'required');
    const node = createSensorCheckNode({ runSensors: runner });

    const result = await node(makeState());

    expect(runner).toHaveBeenCalledWith(
      expect.objectContaining({ trigger: 'before_push' }),
      expect.anything(),
    );
    expect(result.messages).toBeUndefined();
    expect(result.sensorLastTrigger).toBe('before_push');
    expect(routeAfterSensorCheck({ ...makeState(), ...result })).toBe('__end__');
  });

  it('adds bounded repair feedback and routes back to llm when a sensor fails', async () => {
    const failing = makeSensorResult({
      status: 'failed',
      summary: 'typecheck failed',
      findings: [
        {
          source: 'local_command',
          severity: 'high',
          status: 'open',
          category: 'quality_gate',
          message: 'TS2322 Type mismatch',
          file: 'packages/harness/src/foo.ts',
          line: 12,
          evidence: [],
          metadata: {},
        },
      ],
      repairInstructions: [
        {
          summary: 'Fix TypeScript typecheck failures.',
          actions: [{ kind: 'fix_code', label: 'Fix type mismatch' }],
        },
      ],
    });
    const runner = runnerWith(failing);
    const node = createSensorCheckNode({ runSensors: runner, maxFeedbackChars: 240 });

    const result = await node(makeState());

    expect(result.messages?.[0]).toMatchObject({ role: 'system' });
    expect(result.messages?.[0]?.content).toContain('<sensor-feedback');
    expect(result.messages?.[0]?.content).toContain('Fix TypeScript typecheck failures.');
    expect(result.messages?.[0]?.content.length).toBeLessThanOrEqual(240);
    expect(routeAfterSensorCheck({ ...makeState(), ...result })).toBe('react_llm_reason');
  });

  it('records compact sensor observability with provider and MCP capability summaries', async () => {
    const failing = makeSensorResult({
      status: 'failed',
      summary: 'SonarQube imported one finding.',
      providerAvailability: {
        provider: 'sonarqube',
        capability: 'quality_findings',
        state: 'available',
        repairActions: [],
      },
      findings: [
        {
          source: 'sonarqube_remote',
          severity: 'high',
          status: 'open',
          category: 'code_quality',
          message: 'Duplicated code.',
          file: 'packages/harness/src/foo.ts',
          evidence: [],
          metadata: {},
        },
      ],
      runtimeLimitations: [
        {
          kind: 'sandbox_policy_denied',
          message: 'Scanner metadata is outside the sandbox.',
          repairActions: [],
          metadata: {},
        },
      ],
    });
    const record = vi.fn();
    const node = createSensorCheckNode({
      runSensors: runnerWith(failing, 'optional'),
      observability: {
        store: { record },
        sessionId: 'session-sensor',
        traceId: 'run-sensor',
      },
    });

    await node(makeState());

    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'sensor_run',
        sessionId: 'session-sensor',
        runId: 'run-sensor',
        agentProfile: 'coding',
        taskContexts: ['repo_change'],
        providerAvailability: [
          expect.objectContaining({ provider: 'sonarqube', state: 'available' }),
        ],
        runtimeLimitations: [expect.objectContaining({ kind: 'sandbox_policy_denied' })],
        mcpCapabilities: [
          expect.objectContaining({
            serverId: 'sonarqube',
            capability: 'quality_findings',
            selectedForReflection: true,
          }),
        ],
      }),
    );
  });

  it('halts and emits an error when a required provider is unavailable', async () => {
    const { emitter, events } = captureEmitter();
    const unavailable = makeSensorResult({
      status: 'unavailable',
      summary: 'GitHub checks need authentication.',
      providerAvailability: {
        provider: 'github',
        capability: 'check_runs',
        state: 'auth_required',
        repairActions: [{ kind: 'authenticate_cli', label: 'Authenticate GitHub CLI' }],
      },
    });
    const runner = runnerWith(unavailable);
    const node = createSensorCheckNode({ runSensors: runner, emitter });

    const result = await node(makeState());

    expect(result.halted).toBe(true);
    expect(events).toContainEqual(
      expect.objectContaining({
        type: 'error',
        code: 'SENSOR_REQUIRED_UNAVAILABLE',
      }),
    );
    expect(routeAfterSensorCheck({ ...makeState(), ...result })).toBe('__end__');
  });

  it('continues after an optional runtime limitation while recording the result', async () => {
    const unavailable = makeSensorResult({
      status: 'unavailable',
      summary: 'IDE provider cannot see /workspace.',
      runtimeLimitations: [
        {
          kind: 'missing_mount',
          message: 'The IDE provider cannot see /workspace.',
          repairActions: [{ kind: 'retry', label: 'Retry after mounting workspace' }],
          metadata: {},
        },
      ],
    });
    const runner = runnerWith(unavailable, 'optional');
    const node = createSensorCheckNode({ runSensors: runner });

    const result = await node(
      makeState({
        llmOutput: null,
        sensorLastToolIds: ['coding_apply_patch'],
      }),
    );

    expect(result.halted).toBeUndefined();
    expect(result.messages).toBeUndefined();
    expect(result.sensorResults).toEqual([unavailable]);
    expect(routeAfterSensorCheck({ ...makeState(), ...result })).toBe('react_llm_reason');
  });

  it('uses explicit manual or external trigger requests and imported findings', async () => {
    const runner = runnerWith(makeSensorResult({ status: 'failed' }), 'optional');
    const node = createSensorCheckNode({ runSensors: runner });

    await node(
      makeState({
        sensorRequestedTrigger: 'external_feedback',
        sensorFindingCollectorResults: [
          {
            id: 'github-review',
            findings: [
              {
                source: 'github_pr_review',
                severity: 'medium',
                status: 'open',
                category: 'code_quality',
                message: 'Review comment',
                evidence: [],
                metadata: {},
              },
            ],
          },
        ],
      }),
    );

    expect(runner).toHaveBeenCalledWith(
      expect.objectContaining({
        trigger: 'external_feedback',
        findingCollectorResults: expect.arrayContaining([
          expect.objectContaining({ id: 'github-review' }),
        ]),
      }),
      expect.anything(),
    );
  });

  it('halts repeated identical sensor failures with a clear error', async () => {
    const { emitter, events } = captureEmitter();
    const failing = makeSensorResult({
      status: 'failed',
      summary: 'typecheck failed',
      findings: [
        {
          source: 'local_command',
          severity: 'high',
          status: 'open',
          category: 'quality_gate',
          message: 'TS2322 Type mismatch',
          file: 'packages/harness/src/foo.ts',
          line: 12,
          dedupeKey: 'ts2322:foo:12',
          evidence: [],
          metadata: {},
        },
      ],
    });
    const runner = runnerWith(failing);
    const node = createSensorCheckNode({ runSensors: runner, emitter, repeatedFailureLimit: 2 });

    const result = await node(
      makeState({
        sensorAttempts: { 'quality_gate:typecheck:ts2322:foo:12': 1 },
      }),
    );

    expect(result.halted).toBe(true);
    expect(result.trace).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'sensor_loop_limit',
          sensorId: 'quality_gate:typecheck',
          repeats: 2,
        }),
      ]),
    );
    expect(events).toContainEqual(
      expect.objectContaining({
        type: 'error',
        code: 'SENSOR_REPEATED_FAILURE',
      }),
    );
  });
});
