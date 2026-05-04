import {
  SensorDashboardResponseSchema,
  SensorDefinitionSchema,
  type Agent,
  type SensorAgentProfile,
  type SensorDashboardResponse,
  type SensorDefinition,
  type SensorProviderAvailability,
  type SensorResult,
  type SensorSetupGuidance,
} from '@agent-platform/contracts';
import type { ObservabilityRecord, ObservabilityStore } from '@agent-platform/plugin-observability';

type SensorEvent = Extract<ObservabilityRecord['event'], { kind: 'sensor_run' }>;

const DEFAULT_LIMIT = 20;

function sensorDefinition(input: Parameters<typeof SensorDefinitionSchema.parse>[0]) {
  return SensorDefinitionSchema.parse(input);
}

export const SENSOR_DEFINITIONS: readonly SensorDefinition[] = [
  sensorDefinition({
    id: 'quality_gate:typecheck',
    name: 'TypeScript typecheck',
    executionType: 'computational',
    category: 'quality_gate',
    description: 'Runs the repository typecheck before completion or push handoff.',
    requiredCapabilities: ['local_command'],
    feedbackSources: ['local_command'],
    agentProfilePolicy: { coding: 'required', personal_assistant: 'disabled' },
    triggerPolicy: {
      triggers: ['on_meaningful_change', 'before_push', 'manual'],
      cadence: 'pre_push',
      appliesWhen: {
        changedFileGlobs: ['**/*.ts', '**/*.tsx'],
        taskContexts: ['repo_change'],
      },
      requiredForCompletion: true,
    },
    runtimeRequirements: ['workspace mount', 'package manager available inside container'],
  }),
  sensorDefinition({
    id: 'quality_gate:test',
    name: 'Unit tests',
    executionType: 'computational',
    category: 'test',
    description: 'Runs focused or repository tests when source or test files changed.',
    requiredCapabilities: ['local_command'],
    feedbackSources: ['local_command'],
    agentProfilePolicy: { coding: 'required', personal_assistant: 'disabled' },
    triggerPolicy: {
      triggers: ['on_meaningful_change', 'before_push', 'manual'],
      cadence: 'pre_push',
      appliesWhen: {
        changedFileGlobs: ['**/src/**/*.{ts,tsx,js,jsx}', '**/*.{test,spec}.{ts,tsx,js,jsx}'],
        taskContexts: ['repo_change'],
      },
      requiredForCompletion: true,
    },
  }),
  sensorDefinition({
    id: 'quality_gate:lint',
    name: 'Lint',
    executionType: 'computational',
    category: 'code_quality',
    description: 'Runs lint checks for code-quality and style regressions.',
    requiredCapabilities: ['local_command'],
    feedbackSources: ['local_command'],
    agentProfilePolicy: { coding: 'required', personal_assistant: 'disabled' },
    triggerPolicy: {
      triggers: ['on_meaningful_change', 'before_push', 'manual'],
      cadence: 'pre_push',
      appliesWhen: {
        changedFileGlobs: ['**/*.{ts,tsx,js,jsx}'],
        taskContexts: ['repo_change'],
      },
      requiredForCompletion: true,
    },
  }),
  sensorDefinition({
    id: 'collector:ide-problems',
    name: 'IDE Problems',
    executionType: 'computational',
    category: 'code_quality',
    description: 'Imports bounded diagnostics exposed by IDE problem and plugin adapters.',
    requiredCapabilities: ['ide_problems'],
    feedbackSources: ['ide_problems', 'ide_plugin_finding'],
    agentProfilePolicy: { coding: 'optional', personal_assistant: 'manual_only' },
    providerRequirements: ['IDE adapter or plugin bridge'],
    triggerPolicy: {
      triggers: ['before_push', 'external_feedback', 'manual'],
      cadence: 'pre_push',
      appliesWhen: { taskContexts: ['repo_change'] },
    },
  }),
  sensorDefinition({
    id: 'collector:ide-terminal',
    name: 'IDE terminal output',
    executionType: 'computational',
    category: 'runtime_environment',
    description:
      'Imports bounded terminal output from IDE tasks such as SonarQube or CodeQL plugins.',
    requiredCapabilities: ['ide_terminal_output'],
    feedbackSources: ['ide_terminal_output'],
    agentProfilePolicy: { coding: 'optional', personal_assistant: 'manual_only' },
    providerRequirements: ['IDE terminal-output adapter'],
    triggerPolicy: {
      triggers: ['external_feedback', 'manual'],
      cadence: 'manual',
      appliesWhen: { taskContexts: ['repo_change'] },
    },
  }),
  sensorDefinition({
    id: 'collector:sonarqube',
    name: 'SonarQube findings',
    executionType: 'computational',
    category: 'security_hotspot',
    description: 'Imports SonarQube quality, duplication, hotspot, and vulnerability findings.',
    requiredCapabilities: ['sonarqube_issues'],
    feedbackSources: ['sonarqube_local', 'sonarqube_remote', 'ide_plugin_finding'],
    agentProfilePolicy: { coding: 'optional', personal_assistant: 'manual_only' },
    providerRequirements: ['SonarQube MCP, CLI, IDE plugin, or remote API credentials'],
    triggerPolicy: {
      triggers: ['before_push', 'after_push', 'external_feedback', 'manual'],
      cadence: 'post_push',
      appliesWhen: { taskContexts: ['repo_change'] },
    },
  }),
  sensorDefinition({
    id: 'collector:codeql',
    name: 'CodeQL findings',
    executionType: 'computational',
    category: 'security',
    description: 'Imports CodeQL local or GitHub security findings.',
    requiredCapabilities: ['codeql_alerts'],
    feedbackSources: ['codeql_local', 'codeql_remote', 'github_pr_annotation'],
    agentProfilePolicy: { coding: 'optional', personal_assistant: 'manual_only' },
    providerRequirements: ['CodeQL CLI, GitHub checks, or security-events access'],
    triggerPolicy: {
      triggers: ['before_push', 'after_push', 'external_feedback', 'manual'],
      cadence: 'post_push',
      appliesWhen: { taskContexts: ['repo_change'] },
    },
  }),
  sensorDefinition({
    id: 'collector:github-review',
    name: 'GitHub checks and review comments',
    executionType: 'computational',
    category: 'quality_gate',
    description: 'Imports GitHub Actions check runs, review comments, and PR annotations.',
    requiredCapabilities: ['github_checks', 'github_reviews'],
    feedbackSources: ['github_check_run', 'github_pr_review', 'github_pr_annotation'],
    agentProfilePolicy: { coding: 'optional', personal_assistant: 'manual_only' },
    providerRequirements: ['GitHub CLI or GitHub MCP authentication'],
    triggerPolicy: {
      triggers: ['after_push', 'external_feedback', 'manual'],
      cadence: 'post_push',
      appliesWhen: { taskContexts: ['repo_change'] },
    },
  }),
  sensorDefinition({
    id: 'inferential:open_findings',
    name: 'Open finding reflection',
    executionType: 'inferential',
    category: 'code_quality',
    description:
      'Reviews unresolved quality, security, duplication, hotspot, and review-agent findings.',
    requiredCapabilities: ['model_self_assessment'],
    feedbackSources: [
      'local_command',
      'ide_problems',
      'ide_terminal_output',
      'sonarqube_remote',
      'codeql_remote',
      'github_pr_review',
      'agent_code_comment',
    ],
    agentProfilePolicy: { coding: 'required', personal_assistant: 'optional' },
    triggerPolicy: {
      triggers: ['before_completion', 'before_push', 'external_feedback', 'manual'],
      cadence: 'pre_push',
      appliesWhen: { taskContexts: ['repo_change'] },
      requiredForCompletion: true,
    },
  }),
];

function inferSensorAgentProfile(agent: Agent): SensorAgentProfile {
  const text = `${agent.slug} ${agent.name} ${agent.description ?? ''}`;
  return /\bcod(e|ing|er)\b|repository|typescript|application code/i.test(text)
    ? 'coding'
    : 'personal_assistant';
}

function selectionFor(definition: SensorDefinition, profile: SensorAgentProfile) {
  return definition.agentProfilePolicy[profile] ?? 'optional';
}

function mergeAvailability(
  defaults: readonly SensorProviderAvailability[],
  observed: readonly SensorProviderAvailability[],
): SensorProviderAvailability[] {
  const byKey = new Map(defaults.map((item) => [`${item.provider}:${item.capability}`, item]));
  for (const item of observed) {
    byKey.set(`${item.provider}:${item.capability}`, item);
  }
  return [...byKey.values()];
}

function defaultProviderAvailability(profile: SensorAgentProfile): SensorProviderAvailability[] {
  if (profile !== 'coding') return [];
  return [
    {
      provider: 'ide',
      capability: 'problems',
      state: 'not_configured',
      message: 'No IDE Problems adapter has reported diagnostics for this session.',
      repairActions: [
        { kind: 'connect_provider', label: 'Enable IDE Problems adapter' },
        { kind: 'retry', label: 'Retry discovery' },
      ],
    },
    {
      provider: 'ide',
      capability: 'terminal_output',
      state: 'not_configured',
      message: 'No IDE terminal-output adapter has reported bounded task output.',
      repairActions: [
        { kind: 'connect_provider', label: 'Enable IDE terminal-output adapter' },
        { kind: 'retry', label: 'Retry discovery' },
      ],
    },
    {
      provider: 'github',
      capability: 'check_runs',
      state: 'not_configured',
      message: 'GitHub check-run import has not been connected for this session.',
      repairActions: [
        {
          kind: 'authenticate_cli',
          label: 'Authenticate GitHub CLI',
          command: ['gh', 'auth', 'login'],
        },
        { kind: 'retry', label: 'Retry GitHub discovery' },
      ],
    },
    {
      provider: 'sonarqube',
      capability: 'issues',
      state: 'not_configured',
      message: 'SonarQube MCP, CLI, API, or IDE plugin findings have not been connected.',
      repairActions: [
        { kind: 'connect_provider', label: 'Connect SonarQube MCP or IDE plugin' },
        { kind: 'retry', label: 'Retry SonarQube import' },
      ],
    },
    {
      provider: 'codeql',
      capability: 'alerts',
      state: 'not_configured',
      message: 'CodeQL local or GitHub security findings have not been connected.',
      repairActions: [
        { kind: 'connect_provider', label: 'Connect CodeQL CLI or GitHub security access' },
        { kind: 'retry', label: 'Retry CodeQL import' },
      ],
    },
  ];
}

function setupGuidanceFromAvailability(
  availability: readonly SensorProviderAvailability[],
): SensorSetupGuidance[] {
  return availability
    .filter((item) => item.state !== 'available')
    .map((item) => ({
      id: `${item.provider}:${item.capability}`,
      title: `${item.provider} ${item.capability}`,
      provider: item.provider,
      state: item.state,
      summary:
        item.message ??
        `${item.provider} ${item.capability} is not available to the sensor reflection loop.`,
      actions: item.repairActions,
    }));
}

function parseLimit(value: unknown): number {
  if (typeof value !== 'string') return DEFAULT_LIMIT;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 100) : DEFAULT_LIMIT;
}

function sensorEvents(records: readonly ObservabilityRecord[]): SensorEvent[] {
  return records
    .map((record) => record.event)
    .filter((event): event is SensorEvent => event.kind === 'sensor_run');
}

function summarize(
  events: readonly SensorEvent[],
  findings: SensorDashboardResponse['findings'],
  repeatedFailureCount: number,
): SensorDashboardResponse['statusSummary'] {
  const historyBySensor = new Map<string, SensorResult[]>();
  for (const event of events) {
    for (const result of event.results) {
      const history = historyBySensor.get(result.sensorId) ?? [];
      history.push(result);
      historyBySensor.set(result.sensorId, history);
    }
  }

  let passed = 0;
  let failed = 0;
  let failedAndRepaired = 0;
  let skipped = 0;
  let unavailable = 0;
  for (const history of historyBySensor.values()) {
    const latest = history[0];
    if (!latest) continue;
    if (latest.status === 'passed') {
      passed += 1;
      if (history.some((result) => result.status === 'failed')) failedAndRepaired += 1;
    } else if (latest.status === 'failed') {
      failed += 1;
    } else if (latest.status === 'skipped') {
      skipped += 1;
    } else if (latest.status === 'unavailable' || latest.status === 'error') {
      unavailable += 1;
    }
  }

  const lastEvent = events[0];
  return {
    passed,
    failed,
    failedAndRepaired,
    escalated: repeatedFailureCount,
    skipped,
    unavailable,
    openFindings: findings.filter((finding) => finding.status === 'open').length,
    lastTrigger: lastEvent?.trigger,
    lastRunAtMs: lastEvent
      ? Math.max(...lastEvent.results.map((result) => result.completedAtMs ?? 0), 0)
      : undefined,
  };
}

export function buildSensorDashboardResponse(input: {
  sessionId: string;
  agent: Agent;
  observabilityStore?: ObservabilityStore;
  limit?: number;
}): SensorDashboardResponse {
  const activeAgentProfile = inferSensorAgentProfile(input.agent);
  const definitions = SENSOR_DEFINITIONS.map((definition) => ({
    ...definition,
    agentProfilePolicy: {
      ...definition.agentProfilePolicy,
      [activeAgentProfile]: selectionFor(definition, activeAgentProfile),
    },
  }));
  const limit = input.limit ?? DEFAULT_LIMIT;
  const logs = input.observabilityStore?.getLogs({ sessionId: input.sessionId, limit }) ?? [];
  const events = sensorEvents(logs);
  const findings =
    input.observabilityStore?.getSensorFindings({ sessionId: input.sessionId, limit }) ?? [];
  const failurePatterns =
    input.observabilityStore?.getSensorFailurePatterns({ sessionId: input.sessionId, limit }) ?? [];
  const providerAvailability = mergeAvailability(
    defaultProviderAvailability(activeAgentProfile),
    input.observabilityStore?.getSensorProviderAvailability({
      sessionId: input.sessionId,
      limit,
    }) ?? [],
  );

  return SensorDashboardResponseSchema.parse({
    sessionId: input.sessionId,
    activeAgentProfile,
    selectedSensorProfile:
      activeAgentProfile === 'coding' ? 'coding/repository-feedback' : 'general/manual-feedback',
    codingSensorsRequired: activeAgentProfile === 'coding',
    definitions,
    recentRuns: events.flatMap((event) => event.records),
    recentResults: events.flatMap((event) => event.results),
    providerAvailability,
    mcpCapabilities:
      input.observabilityStore?.getMcpCapabilityAvailability({
        sessionId: input.sessionId,
        limit,
      }) ?? [],
    findings,
    runtimeLimitations:
      input.observabilityStore?.getSensorRuntimeLimitations({
        sessionId: input.sessionId,
        limit,
      }) ?? [],
    failurePatterns,
    feedbackCandidates:
      input.observabilityStore?.getFeedbackCandidates({ sessionId: input.sessionId, limit }) ?? [],
    setupGuidance: setupGuidanceFromAvailability(providerAvailability),
    statusSummary: summarize(
      events,
      findings,
      failurePatterns.filter((pattern) => pattern.count >= 2).length,
    ),
  });
}

export function coerceSensorDashboardLimit(value: unknown): number {
  return parseLimit(value);
}
