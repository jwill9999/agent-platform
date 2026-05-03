import { describe, expect, it } from 'vitest';
import type { SensorFinding } from '@agent-platform/contracts';
import {
  runFeedbackSensors,
  runInferentialSensors,
  type InferentialSensorEvaluator,
} from '../src/sensors/inferentialSensorRunner.js';
import { QUALITY_GATE_TOOL_ID } from '../src/tools/qualityGateTool.js';
import type { Output } from '@agent-platform/contracts';

function qualityGateOutput(ok: boolean): Output {
  return {
    type: 'tool_result',
    toolId: QUALITY_GATE_TOOL_ID,
    data: {
      ok,
      message: ok ? 'Quality gate "typecheck" passed.' : 'Quality gate "typecheck" failed.',
      error: ok ? undefined : { code: 'QUALITY_GATE_FAILED', message: 'typecheck failed' },
      result: {
        profile: 'typecheck',
        repoPath: '.',
        command: ['pnpm', 'typecheck'],
        exitCode: ok ? 0 : 1,
        timedOut: false,
        durationMs: 10,
        stdoutTail: '',
        stderrTail: '',
        truncated: false,
        failures: ok
          ? []
          : [
              {
                message: 'TS2322 Type mismatch',
                file: 'packages/harness/src/foo.ts',
                line: 12,
              },
            ],
      },
      evidence: {
        kind: 'test',
        summary: ok ? 'passed' : 'failed',
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

describe('inferential sensor runner', () => {
  it('selects coding readiness checks and returns structured passing sensor results', async () => {
    const evaluator: InferentialSensorEvaluator = async (input) => ({
      checks: input.checks.map((check) => ({
        sensorId: check.id,
        passed: true,
        summary: `${check.name} passed`,
        failedCriteria: [],
      })),
    });

    const run = await runInferentialSensors({
      agentProfile: 'coding',
      trigger: 'before_push',
      repoPath: '.',
      changedFiles: ['packages/harness/src/foo.ts'],
      messages: [
        { role: 'user', content: 'Add the sensors' },
        { role: 'assistant', content: 'Implemented.' },
      ],
      dodContract: {
        criteria: ['Adds inferential sensors'],
        evidence: ['Tests pass'],
        passed: true,
        failedCriteria: [],
      },
      evaluate: evaluator,
    });

    expect(run.records).toHaveLength(6);
    expect(run.records.every((record) => record.selectionState === 'required')).toBe(true);
    expect(run.results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sensorId: 'inferential:task_satisfaction',
          status: 'passed',
        }),
        expect.objectContaining({
          sensorId: 'inferential:readiness',
          status: 'passed',
        }),
      ]),
    );
  });

  it('keeps personal-assistant profiles on task satisfaction and readiness checks only', async () => {
    const evaluator: InferentialSensorEvaluator = async (input) => ({
      checks: input.checks.map((check) => ({
        sensorId: check.id,
        passed: true,
        summary: 'passed',
        failedCriteria: [],
      })),
    });

    const run = await runInferentialSensors({
      agentProfile: 'personal_assistant',
      trigger: 'before_completion',
      repoPath: '.',
      changedFiles: [],
      messages: [{ role: 'user', content: 'Schedule lunch tomorrow' }],
      evaluate: evaluator,
    });

    expect(run.results.map((result) => result.sensorId)).toEqual([
      'inferential:task_satisfaction',
      'inferential:readiness',
    ]);
  });

  it('feeds open computational findings into the evaluator and fails with concise repair instructions', async () => {
    const openFinding: SensorFinding = {
      source: 'sonarqube_remote',
      severity: 'high',
      status: 'open',
      category: 'duplication',
      message: 'Duplicated branch in sensor runner.',
      file: 'packages/harness/src/sensors/inferentialSensorRunner.ts',
      line: 22,
      ruleId: 'typescript:S1871',
      dedupeKey: 'sonar:duplication:22',
      evidence: [],
      metadata: {},
    };
    const evaluator: InferentialSensorEvaluator = async (input) => {
      expect(input.openFindings).toEqual([openFinding]);
      return {
        checks: [
          {
            sensorId: 'inferential:open_findings',
            passed: false,
            summary: 'Open SonarQube finding remains unresolved.',
            failedCriteria: [
              'Resolve or explicitly defer open security and code-quality findings.',
            ],
          },
        ],
      };
    };

    const run = await runInferentialSensors({
      agentProfile: 'coding',
      trigger: 'before_push',
      repoPath: '.',
      changedFiles: ['packages/harness/src/sensors/inferentialSensorRunner.ts'],
      previousSensorResults: [
        {
          sensorId: 'collector:sonarqube',
          status: 'failed',
          summary: 'Imported 1 finding from SonarQube.',
          findings: [openFinding],
          repairInstructions: [],
          evidence: [],
          terminalEvidence: [],
          runtimeLimitations: [],
          metadata: {},
        },
      ],
      evaluate: evaluator,
    });

    const failed = run.results.find((result) => result.sensorId === 'inferential:open_findings');
    expect(failed).toMatchObject({
      status: 'failed',
      severity: 'high',
      summary: 'Open SonarQube finding remains unresolved.',
    });
    expect(failed?.repairInstructions[0]?.summary).toBe(
      'Resolve or explicitly defer open security and code-quality findings.',
    );
  });

  it('fails closed when evaluator output is malformed', async () => {
    const run = await runInferentialSensors({
      agentProfile: 'coding',
      trigger: 'before_push',
      repoPath: '.',
      changedFiles: ['packages/harness/src/foo.ts'],
      evaluate: async () => ({ bad: true }),
    });

    expect(run.results).toEqual([
      expect.objectContaining({
        sensorId: 'inferential:self_assessment',
        status: 'failed',
        summary: expect.stringContaining('malformed'),
      }),
    ]);
  });

  it('respects the inferential max sensor cap before invoking the evaluator', async () => {
    const seen: string[] = [];
    const evaluator: InferentialSensorEvaluator = async (input) => {
      seen.push(...input.checks.map((check) => check.id));
      return {
        checks: input.checks.map((check) => ({
          sensorId: check.id,
          passed: true,
          summary: 'passed',
          failedCriteria: [],
        })),
      };
    };

    await runInferentialSensors({
      agentProfile: 'coding',
      trigger: 'before_push',
      repoPath: '.',
      changedFiles: ['packages/harness/src/foo.ts'],
      executionLimits: { maxSensors: 2 },
      evaluate: evaluator,
    });

    expect(seen).toEqual(['inferential:task_satisfaction', 'inferential:diff_intent']);
  });

  it('keeps computational gates in the combined default run when inferential checks pass', async () => {
    const calls: string[] = [];
    const run = await runFeedbackSensors(
      {
        agentProfile: 'coding',
        taskContexts: ['repo_change'],
        trigger: 'before_push',
        repoPath: '.',
        changedFiles: ['packages/harness/src/foo.ts'],
        evaluateInferentialSensors: async (input) => ({
          checks: input.checks.map((check) => ({
            sensorId: check.id,
            passed: true,
            summary: 'passed',
            failedCriteria: [],
          })),
        }),
      },
      {
        qualityGateExecutor: async (_toolId, args) => {
          calls.push(String(args['profile']));
          return qualityGateOutput(true);
        },
      },
    );

    expect(calls).toEqual(['typecheck', 'test', 'lint']);
    expect(run.results.map((result) => result.sensorId)).toEqual(
      expect.arrayContaining(['quality_gate:typecheck', 'inferential:readiness']),
    );
  });

  it('does not spend an implicit evaluator call in the combined run without an evaluator', async () => {
    const calls: string[] = [];
    const run = await runFeedbackSensors(
      {
        agentProfile: 'coding',
        taskContexts: ['repo_change'],
        trigger: 'before_push',
        repoPath: '.',
        changedFiles: ['packages/harness/src/foo.ts'],
        modelConfig: {
          provider: 'openai',
          model: 'gpt-test',
          apiKey: 'sk-test-key',
        },
      },
      {
        qualityGateExecutor: async (_toolId, args) => {
          calls.push(String(args['profile']));
          return qualityGateOutput(true);
        },
      },
    );

    expect(calls).toEqual(['typecheck', 'test', 'lint']);
    expect(run.results.map((result) => result.sensorId)).not.toContain(
      'inferential:self_assessment',
    );
    expect(run.results.some((result) => result.sensorId.startsWith('inferential:'))).toBe(false);
  });
});
