import { describe, expect, it } from 'vitest';
import type { Output, SensorFinding, SensorRuntimeLimitation } from '@agent-platform/contracts';
import {
  runComputationalSensors,
  type ComputationalFindingCollectorResult,
  type QualityGateExecutor,
} from '../src/sensors/computationalSensorRunner.js';
import { QUALITY_GATE_TOOL_ID } from '../src/tools/qualityGateTool.js';

function qualityGateOutput(
  ok: boolean,
  overrides: {
    profile?: string;
    stdoutTail?: string;
    stderrTail?: string;
    failures?: Array<{ message: string; file?: string; line?: number }>;
    truncated?: boolean;
    errorCode?: string;
    message?: string;
  } = {},
): Output {
  const profile = overrides.profile ?? 'typecheck';
  const message =
    overrides.message ??
    (ok ? `Quality gate "${profile}" passed.` : `Quality gate "${profile}" failed.`);

  return {
    type: 'tool_result',
    toolId: QUALITY_GATE_TOOL_ID,
    data: {
      ok,
      message,
      error: ok ? undefined : { code: overrides.errorCode ?? 'QUALITY_GATE_FAILED', message },
      result: {
        profile,
        repoPath: '/workspace/repo',
        command: ['pnpm', profile],
        exitCode: ok ? 0 : 1,
        timedOut: false,
        durationMs: 25,
        stdoutTail: overrides.stdoutTail ?? '',
        stderrTail: overrides.stderrTail ?? '',
        truncated: overrides.truncated ?? false,
        failures: overrides.failures ?? [],
      },
      evidence: {
        kind: 'test',
        summary: message,
        artifacts: [],
        riskTier: 'medium',
        status: ok ? 'succeeded' : 'failed',
        sourceTool: QUALITY_GATE_TOOL_ID,
        startedAtMs: 1,
        completedAtMs: 2,
      },
    },
  };
}

function executorWith(outputs: Record<string, Output>): {
  calls: Array<Record<string, unknown>>;
  executor: QualityGateExecutor;
} {
  const calls: Array<Record<string, unknown>> = [];
  const executor: QualityGateExecutor = async (_toolId, args) => {
    calls.push(args);
    const profile = String(args['profile']);
    return outputs[profile] ?? qualityGateOutput(true, { profile });
  };
  return { calls, executor };
}

describe('computational sensor runner', () => {
  it('selects repository quality sensors for coding profile based on changed files', async () => {
    const { calls, executor } = executorWith({
      typecheck: qualityGateOutput(true, { profile: 'typecheck' }),
      test: qualityGateOutput(true, { profile: 'test' }),
      lint: qualityGateOutput(true, { profile: 'lint' }),
    });

    const run = await runComputationalSensors(
      {
        agentProfile: 'coding',
        taskContexts: ['repo_change'],
        trigger: 'before_push',
        repoPath: '.',
        changedFiles: ['packages/harness/src/foo.ts', 'packages/harness/test/foo.test.ts'],
      },
      { qualityGateExecutor: executor },
    );

    expect(calls.map((call) => call['profile'])).toEqual(['typecheck', 'test', 'lint']);
    expect(run.results.every((result) => result.status === 'passed')).toBe(true);
    expect(run.records.map((record) => record.selectionState)).toEqual([
      'required',
      'required',
      'required',
    ]);
  });

  it('skips coding quality gates for personal-assistant profile unless repo work is explicit', async () => {
    const { calls, executor } = executorWith({});

    const run = await runComputationalSensors(
      {
        agentProfile: 'personal_assistant',
        taskContexts: ['calendar'],
        trigger: 'before_completion',
        repoPath: '.',
        changedFiles: ['packages/harness/src/foo.ts'],
      },
      { qualityGateExecutor: executor },
    );

    expect(calls).toEqual([]);
    expect(run.results).toEqual([]);
  });

  it('allows manual requests to run manual-only coding sensors', async () => {
    const { calls, executor } = executorWith({
      typecheck: qualityGateOutput(true, { profile: 'typecheck' }),
    });

    await runComputationalSensors(
      {
        agentProfile: 'research',
        taskContexts: ['documentation'],
        trigger: 'manual',
        repoPath: '.',
        changedFiles: ['packages/contracts/src/sensor.ts'],
        requestedSensorIds: ['quality_gate:typecheck'],
      },
      { qualityGateExecutor: executor },
    );

    expect(calls.map((call) => call['profile'])).toEqual(['typecheck']);
  });

  it('respects available sensor definitions and execution limits', async () => {
    const { calls, executor } = executorWith({});

    const run = await runComputationalSensors(
      {
        agentProfile: 'coding',
        taskContexts: ['repo_change'],
        trigger: 'before_push',
        repoPath: '.',
        changedFiles: ['packages/harness/src/foo.ts', 'packages/harness/test/foo.test.ts'],
        availableSensorDefinitions: [
          { id: 'quality_gate:typecheck', agentProfilePolicy: { coding: 'required' } },
          { id: 'quality_gate:test', agentProfilePolicy: { coding: 'disabled' } },
          { id: 'quality_gate:lint', agentProfilePolicy: { coding: 'optional' } },
        ],
        executionLimits: { maxRuntimeMs: 12_000, maxEvidenceBytes: 8_000, maxSensors: 2 },
      },
      { qualityGateExecutor: executor },
    );

    expect(calls.map((call) => call['profile'])).toEqual(['typecheck', 'lint']);
    expect(calls[0]).toMatchObject({ timeoutMs: 12_000, maxOutputBytes: 8_000 });
    expect(run.records.map((record) => record.selectionState)).toEqual(['required', 'optional']);
  });

  it('converts failing quality gates into findings and repair instructions', async () => {
    const { executor } = executorWith({
      typecheck: qualityGateOutput(false, {
        profile: 'typecheck',
        stderrTail: 'packages/contracts/src/sensor.ts:42 TS2322 Type mismatch',
        failures: [
          {
            message: 'TS2322 Type mismatch',
            file: 'packages/contracts/src/sensor.ts',
            line: 42,
          },
        ],
        truncated: true,
      }),
    });

    const run = await runComputationalSensors(
      {
        agentProfile: 'coding',
        taskContexts: ['repo_change'],
        trigger: 'before_push',
        repoPath: '.',
        changedFiles: ['packages/contracts/src/sensor.ts'],
      },
      { qualityGateExecutor: executor },
    );

    const failed = run.results.find((result) => result.sensorId === 'quality_gate:typecheck');
    expect(failed?.status).toBe('failed');
    expect(failed?.findings[0]).toMatchObject({
      source: 'local_command',
      severity: 'high',
      category: 'quality_gate',
      file: 'packages/contracts/src/sensor.ts',
      line: 42,
      ruleId: 'TS2322',
    });
    expect(failed?.repairInstructions[0]?.summary).toContain('Fix TypeScript typecheck');
    expect(failed?.evidence.some((evidence) => evidence.truncated)).toBe(true);
  });

  it('normalizes imported findings, terminal evidence, provider auth, and runtime limitations', async () => {
    const importedFinding: SensorFinding = {
      source: 'sonarqube_remote',
      severity: 'high',
      status: 'open',
      category: 'security_hotspot',
      message: 'Review dynamic regular expression.',
      file: 'packages/harness/src/security.ts',
      line: 12,
      ruleId: 'javascript:S4784',
      dedupeKey: 'sonar:javascript:S4784:packages/harness/src/security.ts:12',
      evidence: [],
      metadata: {},
    };
    const codeqlFinding: SensorFinding = {
      source: 'codeql_remote',
      severity: 'critical',
      status: 'open',
      category: 'security',
      message: 'Avoid unsafe path construction.',
      file: 'packages/harness/src/files.ts',
      line: 7,
      ruleId: 'js/path-injection',
      evidence: [],
      metadata: { queryId: 'js/path-injection' },
    };
    const reviewFinding: SensorFinding = {
      source: 'github_pr_review',
      severity: 'medium',
      status: 'open',
      category: 'code_quality',
      message: 'Handle the null output case before parsing.',
      file: 'packages/harness/src/sensors/computationalSensorRunner.ts',
      line: 122,
      evidence: [],
      metadata: { reviewer: 'agent-code-review' },
    };
    const limitation: SensorRuntimeLimitation = {
      kind: 'missing_mount',
      message: 'The IDE provider cannot see /workspace.',
      repairActions: [{ kind: 'retry', label: 'Retry after mounting workspace' }],
      metadata: {},
    };
    const collectorResult: ComputationalFindingCollectorResult = {
      id: 'sonarqube',
      providerAvailability: {
        provider: 'github',
        capability: 'check_runs',
        state: 'auth_required',
        repairActions: [{ kind: 'authenticate_cli', label: 'Authenticate GitHub CLI' }],
      },
      findings: [importedFinding, { ...importedFinding }, codeqlFinding, reviewFinding],
      terminalEvidence: [
        {
          source: 'ide_terminal_output',
          producer: 'vscode-extension',
          capturedAtMs: 100,
          content: 'Review dynamic regular expression.',
          sizeBytes: 34,
          truncated: false,
          redacted: true,
          maxBytes: 20_000,
          extractedFindingCount: 1,
        },
      ],
      runtime: {
        kind: 'docker_container',
        name: 'api',
        workspacePath: '/workspace',
        hostWorkspacePath: '/Users/letuscode/projects/agent-platform',
        pathMappings: [
          {
            hostPath: '/Users/letuscode/projects/agent-platform',
            runtimePath: '/workspace',
          },
        ],
      },
      runtimeLimitations: [limitation],
    };

    const run = await runComputationalSensors({
      agentProfile: 'coding',
      taskContexts: ['repo_change'],
      trigger: 'manual',
      repoPath: '.',
      changedFiles: [],
      findingCollectorResults: [collectorResult],
    });

    const imported = run.results.find((result) => result.sensorId === 'collector:sonarqube');
    expect(imported?.status).toBe('unavailable');
    expect(imported?.findings).toHaveLength(3);
    expect(imported?.terminalEvidence[0]?.redacted).toBe(true);
    expect(imported?.providerAvailability?.state).toBe('auth_required');
    expect(imported?.runtime?.pathMappings[0]).toMatchObject({
      hostPath: '/Users/letuscode/projects/agent-platform',
      runtimePath: '/workspace',
    });
    expect(imported?.runtimeLimitations[0]?.kind).toBe('missing_mount');
  });

  it('reports quality gate denial as environment or policy error without code-failure findings', async () => {
    const { executor } = executorWith({
      typecheck: qualityGateOutput(false, {
        profile: 'typecheck',
        errorCode: 'QUALITY_GATE_DENIED',
        message: 'Repository path "/tmp/outside" is outside the approved workspace.',
      }),
    });

    const run = await runComputationalSensors(
      {
        agentProfile: 'coding',
        taskContexts: ['repo_change'],
        trigger: 'before_push',
        repoPath: '/tmp/outside',
        changedFiles: ['packages/contracts/src/sensor.ts'],
      },
      { qualityGateExecutor: executor },
    );

    const denied = run.results.find((result) => result.sensorId === 'quality_gate:typecheck');
    expect(denied?.status).toBe('error');
    expect(denied?.findings).toEqual([]);
    expect(denied?.runtimeLimitations[0]).toMatchObject({
      kind: 'sandbox_policy_denied',
    });
  });
});
