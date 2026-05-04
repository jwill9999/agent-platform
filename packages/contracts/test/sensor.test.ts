import { describe, expect, it } from 'vitest';
import {
  SensorDefinitionSchema,
  SensorDashboardResponseSchema,
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

  it('represents a session sensor dashboard with provider and runtime guidance', () => {
    const dashboard = SensorDashboardResponseSchema.parse({
      sessionId: 'session-1',
      activeAgentProfile: 'coding',
      selectedSensorProfile: 'coding/repository-feedback',
      codingSensorsRequired: true,
      definitions: [
        {
          id: 'collector:sonarqube',
          name: 'SonarQube findings',
          executionType: 'computational',
          category: 'security_hotspot',
          feedbackSources: ['sonarqube_remote'],
          agentProfilePolicy: { coding: 'optional', personal_assistant: 'manual_only' },
          triggerPolicy: { triggers: ['after_push', 'manual'] },
        },
      ],
      recentRuns: [],
      recentResults: [],
      providerAvailability: [
        {
          provider: 'github',
          capability: 'check_runs',
          state: 'auth_required',
          repairActions: [{ kind: 'authenticate_cli', label: 'Authenticate GitHub CLI' }],
        },
      ],
      mcpCapabilities: [
        {
          serverId: 'sonarqube',
          capability: 'issues',
          state: 'available',
          selectedForReflection: true,
        },
      ],
      findings: [
        {
          sensorId: 'collector:sonarqube',
          runId: 'run-1',
          observedAtMs: 1_000,
          source: 'sonarqube_remote',
          severity: 'high',
          category: 'security',
          message: 'Review generated credential handling.',
        },
      ],
      runtimeLimitations: [
        {
          kind: 'sandbox_policy_denied',
          message: 'The sandbox blocked access to the IDE terminal socket.',
        },
      ],
      failurePatterns: [],
      feedbackCandidates: [],
      setupGuidance: [
        {
          id: 'github:check_runs',
          title: 'github check_runs',
          provider: 'github',
          state: 'auth_required',
          summary: 'GitHub CLI is not authenticated.',
          actions: [{ kind: 'retry', label: 'Retry discovery' }],
        },
      ],
      statusSummary: {
        passed: 0,
        failed: 1,
        failedAndRepaired: 0,
        escalated: 0,
        skipped: 0,
        unavailable: 1,
        openFindings: 1,
        lastTrigger: 'after_push',
      },
    });

    expect(dashboard.providerAvailability[0]?.state).toBe('auth_required');
    expect(dashboard.mcpCapabilities[0]?.selectedForReflection).toBe(true);
    expect(dashboard.statusSummary.openFindings).toBe(1);
  });
});
