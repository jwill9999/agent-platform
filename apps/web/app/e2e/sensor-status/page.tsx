'use client';

import type { SensorDashboardResponse } from '@agent-platform/contracts';

import { SensorStatusPanel } from '@/components/chat/sensor-status-panel';

const dashboard: SensorDashboardResponse = {
  sessionId: 'sensor-e2e-session',
  activeAgentProfile: 'coding',
  selectedSensorProfile: 'coding/repository-feedback',
  codingSensorsRequired: true,
  definitions: [],
  recentRuns: [],
  recentResults: [
    {
      sensorId: 'quality_gate:typecheck',
      status: 'passed',
      summary: 'Typecheck passed after correction.',
      findings: [],
      repairInstructions: [],
      evidence: [],
      terminalEvidence: [],
      runtimeLimitations: [],
      completedAtMs: 2_000,
      metadata: {},
    },
    {
      sensorId: 'collector:sonarqube',
      status: 'failed',
      severity: 'high',
      summary: 'SonarQube still has one high-severity issue.',
      findings: [
        {
          source: 'sonarqube_remote',
          severity: 'high',
          status: 'open',
          category: 'security',
          message: 'Review untrusted path handling.',
          file: 'packages/harness/src/security/pathJail.ts',
          line: 42,
          ruleId: 'typescript:S0001',
          evidence: [],
          metadata: {},
        },
      ],
      repairInstructions: [{ summary: 'Address imported SonarQube finding.', actions: [] }],
      evidence: [],
      terminalEvidence: [],
      providerAvailability: {
        provider: 'sonarqube',
        capability: 'issues',
        state: 'available',
        repairActions: [],
      },
      runtimeLimitations: [],
      completedAtMs: 1_500,
      metadata: {},
    },
  ],
  providerAvailability: [
    {
      provider: 'github',
      capability: 'check_runs',
      state: 'auth_required',
      message: 'GitHub CLI auth is required before importing remote check runs.',
      repairActions: [
        {
          kind: 'authenticate_cli',
          label: 'Authenticate GitHub CLI',
          command: ['gh', 'auth', 'login'],
        },
      ],
    },
    {
      provider: 'sonarqube',
      capability: 'issues',
      state: 'available',
      repairActions: [],
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
      observedAtMs: 1_500,
      source: 'sonarqube_remote',
      severity: 'high',
      status: 'open',
      category: 'security',
      message: 'Review untrusted path handling.',
      file: 'packages/harness/src/security/pathJail.ts',
      line: 42,
      ruleId: 'typescript:S0001',
      evidence: [],
      metadata: {},
    },
  ],
  runtimeLimitations: [
    {
      kind: 'sandbox_policy_denied',
      message: 'The sandbox blocked IDE terminal-output access.',
      repairActions: [{ kind: 'ask_user', label: 'Review sandbox policy' }],
      metadata: {},
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
      summary: 'GitHub CLI auth is required before importing remote check runs.',
      actions: [{ kind: 'retry', label: 'Retry discovery' }],
    },
  ],
  statusSummary: {
    passed: 1,
    failed: 1,
    failedAndRepaired: 1,
    escalated: 0,
    skipped: 0,
    unavailable: 1,
    openFindings: 1,
    lastTrigger: 'before_push',
    lastRunAtMs: 2_000,
  },
};

export default function SensorStatusE2ePage() {
  return (
    <main className="flex min-h-screen flex-col bg-background">
      <h1 className="border-b border-border px-6 py-4 text-lg font-semibold">
        E2E sensor status verify
      </h1>
      <div className="flex min-h-0 flex-1">
        <section className="flex min-w-0 flex-1 items-center justify-center text-sm text-muted-foreground">
          Chat transcript fixture
        </section>
        <SensorStatusPanel dashboard={dashboard} />
      </div>
    </main>
  );
}
