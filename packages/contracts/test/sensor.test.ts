import { describe, expect, it } from 'vitest';
import {
  SensorDefinitionSchema,
  SensorFindingSchema,
  SensorRepairInstructionSchema,
  SensorResultSchema,
  SensorRunRecordSchema,
  SensorTerminalEvidenceSchema,
  SensorTriggerPolicySchema,
} from '../src/index.js';

describe('sensor contracts', () => {
  it('round-trips a coding sensor definition with profile policy and trigger cadence', () => {
    const definition = SensorDefinitionSchema.parse({
      id: 'typescript-typecheck',
      name: 'TypeScript typecheck',
      executionType: 'computational',
      category: 'quality_gate',
      description: 'Run TypeScript type checking before push.',
      requiredCapabilities: ['quality_gate'],
      feedbackSources: ['local_command'],
      agentProfilePolicy: {
        coding: 'required',
        personal_assistant: 'disabled',
        research: 'manual_only',
        automation: 'optional',
        custom: 'optional',
      },
      triggerPolicy: {
        triggers: ['before_push', 'manual'],
        cadence: 'pre_push',
        appliesWhen: {
          changedFileGlobs: ['**/*.ts', '**/*.tsx'],
          taskContexts: ['repo_change'],
          toolRiskTiers: ['medium'],
        },
        budget: {
          maxRuntimeMs: 120_000,
          maxAttemptsPerTurn: 1,
          maxEvidenceBytes: 20_000,
        },
        requiredForCompletion: true,
      },
    });

    expect(SensorDefinitionSchema.parse(structuredClone(definition))).toEqual(definition);
    expect(definition.agentProfilePolicy.coding).toBe('required');
    expect(definition.triggerPolicy.triggers).toContain('before_push');
  });

  it('represents failed findings with evidence and repair instructions', () => {
    const finding = SensorFindingSchema.parse({
      id: 'finding-1',
      source: 'sonarqube_remote',
      severity: 'high',
      status: 'open',
      category: 'security_hotspot',
      message: 'Review use of dynamic regular expression.',
      file: 'packages/harness/src/security/example.ts',
      line: 42,
      ruleId: 'javascript:S4784',
      dedupeKey: 'sonarqube:javascript:S4784:packages/harness/src/security/example.ts:42',
      evidence: [
        {
          kind: 'external_url',
          label: 'SonarQube issue',
          uri: 'https://sonarcloud.io/project/issues?id=agent-platform',
        },
      ],
    });

    const repair = SensorRepairInstructionSchema.parse({
      summary: 'Replace the dynamic regular expression with a bounded literal parser.',
      actions: [
        {
          kind: 'fix_code',
          label: 'Fix hotspot',
          file: 'packages/harness/src/security/example.ts',
          line: 42,
        },
      ],
    });

    const result = SensorResultSchema.parse({
      sensorId: 'sonarqube-security',
      status: 'failed',
      severity: 'high',
      summary: 'SonarQube reported one high-severity security hotspot.',
      findings: [finding],
      repairInstructions: [repair],
      evidence: finding.evidence,
      completedAtMs: 2_000,
    });

    expect(result.findings[0]?.ruleId).toBe('javascript:S4784');
    expect(result.repairInstructions[0]?.actions[0]?.kind).toBe('fix_code');
  });

  it('represents auth and runtime limitations without treating them as code failures', () => {
    const result = SensorResultSchema.parse({
      sensorId: 'github-checks',
      status: 'unavailable',
      summary: 'GitHub checks are required but GitHub CLI auth is missing.',
      providerAvailability: {
        provider: 'github',
        capability: 'check_runs',
        state: 'auth_required',
        repairActions: [
          {
            kind: 'authenticate_cli',
            label: 'Authenticate GitHub CLI',
            command: ['gh', 'auth', 'login'],
          },
          {
            kind: 'retry',
            label: 'Retry check discovery',
          },
        ],
      },
      runtime: {
        kind: 'docker_compose_service',
        name: 'api',
        workspacePath: '/workspace',
        hostWorkspacePath: '/Users/example/project',
        pathMappings: [{ hostPath: '/Users/example/project', runtimePath: '/workspace' }],
      },
      runtimeLimitations: [
        {
          kind: 'network_unavailable',
          message: 'The current sandbox cannot resolve github.com.',
          repairActions: [{ kind: 'retry', label: 'Retry with network access' }],
        },
      ],
    });

    expect(result.status).toBe('unavailable');
    expect(result.providerAvailability?.state).toBe('auth_required');
    expect(result.runtimeLimitations[0]?.kind).toBe('network_unavailable');
  });

  it('bounds IDE terminal evidence and rejects invalid profiles', () => {
    const terminalEvidence = SensorTerminalEvidenceSchema.parse({
      source: 'ide_terminal_output',
      producer: 'vscode-extension',
      taskName: 'SonarQube: Analyze Open Files',
      capturedAtMs: 1_000,
      content: 'src/example.ts:42 javascript:S4784 Review this regex.',
      sizeBytes: 54,
      truncated: false,
      redacted: true,
      maxBytes: 20_000,
      extractedFindingCount: 1,
    });

    expect(terminalEvidence.redacted).toBe(true);
    expect(() =>
      SensorDefinitionSchema.parse({
        id: 'bad-profile',
        name: 'Bad profile',
        executionType: 'computational',
        category: 'quality_gate',
        agentProfilePolicy: { sales: 'required' },
        triggerPolicy: SensorTriggerPolicySchema.parse({ triggers: ['manual'] }),
      }),
    ).toThrow();
  });

  it('records sensor run lifecycle metadata', () => {
    const record = SensorRunRecordSchema.parse({
      id: 'run-1',
      sensorId: 'typescript-typecheck',
      sessionId: 'session-1',
      runId: 'harness-run-1',
      trigger: 'before_push',
      selectedForProfile: 'coding',
      selectionState: 'required',
      status: 'completed',
      startedAtMs: 1_000,
      completedAtMs: 2_000,
      result: {
        sensorId: 'typescript-typecheck',
        status: 'passed',
        summary: 'Typecheck passed.',
      },
    });

    expect(SensorRunRecordSchema.parse(structuredClone(record))).toEqual(record);
  });
});
