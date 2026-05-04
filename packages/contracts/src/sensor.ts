import { z } from 'zod';
import { RiskTierSchema } from './tool.js';

export const SensorExecutionTypeSchema = z.enum(['computational', 'inferential']);
export type SensorExecutionType = z.infer<typeof SensorExecutionTypeSchema>;

export const SensorCategorySchema = z.enum([
  'quality_gate',
  'security',
  'code_quality',
  'duplication',
  'security_hotspot',
  'test',
  'build',
  'ui_quality',
  'accessibility',
  'definition_of_done',
  'architecture_fit',
  'runtime_environment',
  'custom',
]);
export type SensorCategory = z.infer<typeof SensorCategorySchema>;

export const SensorAgentProfileSchema = z.enum([
  'personal_assistant',
  'coding',
  'research',
  'automation',
  'custom',
]);
export type SensorAgentProfile = z.infer<typeof SensorAgentProfileSchema>;

export const SensorSelectionStateSchema = z.enum([
  'required',
  'optional',
  'manual_only',
  'disabled',
]);
export type SensorSelectionState = z.infer<typeof SensorSelectionStateSchema>;

export const SensorAgentProfilePolicySchema = z
  .object({
    personal_assistant: SensorSelectionStateSchema.optional(),
    coding: SensorSelectionStateSchema.optional(),
    research: SensorSelectionStateSchema.optional(),
    automation: SensorSelectionStateSchema.optional(),
    custom: SensorSelectionStateSchema.optional(),
  })
  .strict();
export type SensorAgentProfilePolicy = z.infer<typeof SensorAgentProfilePolicySchema>;

export const SensorFeedbackSourceSchema = z.enum([
  'local_command',
  'ide_problems',
  'ide_terminal_output',
  'ide_plugin_finding',
  'container_runtime',
  'sandbox_runtime',
  'sonarqube_local',
  'sonarqube_remote',
  'codeql_local',
  'codeql_remote',
  'github_check_run',
  'github_pr_review',
  'github_pr_annotation',
  'agent_code_comment',
  'user_feedback',
]);
export type SensorFeedbackSource = z.infer<typeof SensorFeedbackSourceSchema>;

export const SensorTriggerSchema = z.enum([
  'on_meaningful_change',
  'before_commit',
  'before_push',
  'after_push',
  'before_completion',
  'external_feedback',
  'scheduled',
  'manual',
]);
export type SensorTrigger = z.infer<typeof SensorTriggerSchema>;

export const SensorCadenceSchema = z.enum([
  'during_work',
  'pre_commit',
  'pre_push',
  'post_push',
  'manual',
  'scheduled',
]);
export type SensorCadence = z.infer<typeof SensorCadenceSchema>;

export const SensorTriggerAppliesWhenSchema = z
  .object({
    changedFileGlobs: z.array(z.string().min(1)).default([]),
    taskContexts: z.array(z.string().min(1)).default([]),
    toolIds: z.array(z.string().min(1)).default([]),
    toolRiskTiers: z.array(RiskTierSchema).default([]),
    agentProfiles: z.array(SensorAgentProfileSchema).default([]),
  })
  .strict();
export type SensorTriggerAppliesWhen = z.infer<typeof SensorTriggerAppliesWhenSchema>;

export const SensorBudgetSchema = z
  .object({
    maxRuntimeMs: z.number().int().positive().optional(),
    maxAttemptsPerTurn: z.number().int().positive().optional(),
    maxEvidenceBytes: z.number().int().positive().optional(),
    maxCostUnits: z.number().positive().optional(),
  })
  .strict();
export type SensorBudget = z.infer<typeof SensorBudgetSchema>;

export const SensorTriggerPolicySchema = z
  .object({
    triggers: z.array(SensorTriggerSchema).min(1),
    cadence: SensorCadenceSchema.optional(),
    appliesWhen: SensorTriggerAppliesWhenSchema.default({}),
    budget: SensorBudgetSchema.default({}),
    requiredForCompletion: z.boolean().default(false),
  })
  .strict();
export type SensorTriggerPolicy = z.infer<typeof SensorTriggerPolicySchema>;

export const SensorEvidenceKindSchema = z.enum([
  'stdout',
  'stderr',
  'terminal_transcript',
  'ide_problem',
  'external_url',
  'file',
  'screenshot',
  'accessibility_tree',
  'dom_summary',
  'trace',
  'json',
]);
export type SensorEvidenceKind = z.infer<typeof SensorEvidenceKindSchema>;

export const SensorEvidenceSchema = z
  .object({
    kind: SensorEvidenceKindSchema,
    label: z.string().min(1),
    uri: z.string().min(1).optional(),
    file: z.string().min(1).optional(),
    line: z.number().int().positive().optional(),
    content: z.string().optional(),
    sizeBytes: z.number().int().min(0).optional(),
    truncated: z.boolean().default(false),
    redacted: z.boolean().default(false),
    sha256: z.string().length(64).optional(),
  })
  .strict();
export type SensorEvidence = z.infer<typeof SensorEvidenceSchema>;

export const SensorFindingSeveritySchema = z.enum(['info', 'low', 'medium', 'high', 'critical']);
export type SensorFindingSeverity = z.infer<typeof SensorFindingSeveritySchema>;

export const SensorFindingStatusSchema = z.enum(['open', 'fixed', 'suppressed', 'deferred']);
export type SensorFindingStatus = z.infer<typeof SensorFindingStatusSchema>;

export const SensorFindingSchema = z
  .object({
    id: z.string().min(1).optional(),
    source: SensorFeedbackSourceSchema,
    severity: SensorFindingSeveritySchema,
    status: SensorFindingStatusSchema.default('open'),
    category: SensorCategorySchema,
    message: z.string().min(1),
    file: z.string().min(1).optional(),
    line: z.number().int().positive().optional(),
    column: z.number().int().positive().optional(),
    ruleId: z.string().min(1).optional(),
    dedupeKey: z.string().min(1).optional(),
    evidence: z.array(SensorEvidenceSchema).default([]),
    metadata: z.record(z.unknown()).default({}),
  })
  .strict();
export type SensorFinding = z.infer<typeof SensorFindingSchema>;

export const SensorRepairActionKindSchema = z.enum([
  'fix_code',
  'run_command',
  'connect_provider',
  'authenticate_cli',
  'retry',
  'open_external',
  'ask_user',
  'defer_with_reason',
]);
export type SensorRepairActionKind = z.infer<typeof SensorRepairActionKindSchema>;

export const SensorRepairActionSchema = z
  .object({
    kind: SensorRepairActionKindSchema,
    label: z.string().min(1),
    message: z.string().min(1).optional(),
    command: z.array(z.string().min(1)).optional(),
    file: z.string().min(1).optional(),
    line: z.number().int().positive().optional(),
    uri: z.string().min(1).optional(),
  })
  .strict();
export type SensorRepairAction = z.infer<typeof SensorRepairActionSchema>;

export const SensorRepairInstructionSchema = z
  .object({
    summary: z.string().min(1),
    details: z.string().min(1).optional(),
    actions: z.array(SensorRepairActionSchema).default([]),
  })
  .strict();
export type SensorRepairInstruction = z.infer<typeof SensorRepairInstructionSchema>;

export const SensorProviderAvailabilityStateSchema = z.enum([
  'available',
  'unavailable',
  'auth_required',
  'not_configured',
  'permission_denied',
]);
export type SensorProviderAvailabilityState = z.infer<typeof SensorProviderAvailabilityStateSchema>;

export const SensorProviderAvailabilitySchema = z
  .object({
    provider: z.string().min(1),
    capability: z.string().min(1),
    state: SensorProviderAvailabilityStateSchema,
    message: z.string().min(1).optional(),
    repairActions: z.array(SensorRepairActionSchema).default([]),
  })
  .strict();
export type SensorProviderAvailability = z.infer<typeof SensorProviderAvailabilitySchema>;

export const SensorRuntimeKindSchema = z.enum([
  'host',
  'docker_container',
  'docker_compose_service',
  'ide_plugin',
  'sandbox',
]);
export type SensorRuntimeKind = z.infer<typeof SensorRuntimeKindSchema>;

export const SensorPathMappingSchema = z
  .object({
    hostPath: z.string().min(1),
    runtimePath: z.string().min(1),
  })
  .strict();
export type SensorPathMapping = z.infer<typeof SensorPathMappingSchema>;

export const SensorRuntimeSchema = z
  .object({
    kind: SensorRuntimeKindSchema,
    name: z.string().min(1).optional(),
    workspacePath: z.string().min(1).optional(),
    hostWorkspacePath: z.string().min(1).optional(),
    sandboxProfile: z.string().min(1).optional(),
    pathMappings: z.array(SensorPathMappingSchema).default([]),
  })
  .strict();
export type SensorRuntime = z.infer<typeof SensorRuntimeSchema>;

export const SensorRuntimeLimitationKindSchema = z.enum([
  'runtime_unavailable',
  'missing_mount',
  'tool_unavailable',
  'network_unavailable',
  'path_mapping_required',
  'sandbox_policy_denied',
]);
export type SensorRuntimeLimitationKind = z.infer<typeof SensorRuntimeLimitationKindSchema>;

export const SensorRuntimeLimitationSchema = z
  .object({
    kind: SensorRuntimeLimitationKindSchema,
    message: z.string().min(1),
    repairActions: z.array(SensorRepairActionSchema).default([]),
    metadata: z.record(z.unknown()).default({}),
  })
  .strict();
export type SensorRuntimeLimitation = z.infer<typeof SensorRuntimeLimitationSchema>;

export const SensorTerminalEvidenceSchema = z
  .object({
    source: z.enum(['ide_terminal_output', 'local_command']),
    producer: z.string().min(1),
    taskName: z.string().min(1).optional(),
    capturedAtMs: z.number().int().nonnegative(),
    content: z.string(),
    sizeBytes: z.number().int().min(0),
    truncated: z.boolean().default(false),
    redacted: z.boolean().default(false),
    maxBytes: z.number().int().positive(),
    extractedFindingCount: z.number().int().min(0).default(0),
  })
  .strict();
export type SensorTerminalEvidence = z.infer<typeof SensorTerminalEvidenceSchema>;

export const SensorResultStatusSchema = z.enum([
  'passed',
  'failed',
  'skipped',
  'unavailable',
  'error',
]);
export type SensorResultStatus = z.infer<typeof SensorResultStatusSchema>;

export const SensorResultSchema = z
  .object({
    sensorId: z.string().min(1),
    status: SensorResultStatusSchema,
    severity: SensorFindingSeveritySchema.optional(),
    summary: z.string().min(1),
    findings: z.array(SensorFindingSchema).default([]),
    repairInstructions: z.array(SensorRepairInstructionSchema).default([]),
    evidence: z.array(SensorEvidenceSchema).default([]),
    terminalEvidence: z.array(SensorTerminalEvidenceSchema).default([]),
    providerAvailability: SensorProviderAvailabilitySchema.optional(),
    runtime: SensorRuntimeSchema.optional(),
    runtimeLimitations: z.array(SensorRuntimeLimitationSchema).default([]),
    completedAtMs: z.number().int().nonnegative().optional(),
    metadata: z.record(z.unknown()).default({}),
  })
  .strict();
export type SensorResult = z.infer<typeof SensorResultSchema>;

export const SensorDefinitionSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    executionType: SensorExecutionTypeSchema,
    category: SensorCategorySchema,
    description: z.string().min(1).optional(),
    requiredCapabilities: z.array(z.string().min(1)).default([]),
    feedbackSources: z.array(SensorFeedbackSourceSchema).default([]),
    agentProfilePolicy: SensorAgentProfilePolicySchema.default({}),
    triggerPolicy: SensorTriggerPolicySchema,
    providerRequirements: z.array(z.string().min(1)).default([]),
    runtimeRequirements: z.array(z.string().min(1)).default([]),
    metadata: z.record(z.unknown()).default({}),
  })
  .strict();
export type SensorDefinition = z.infer<typeof SensorDefinitionSchema>;

export const SensorRunStatusSchema = z.enum(['queued', 'running', 'completed', 'skipped', 'error']);
export type SensorRunStatus = z.infer<typeof SensorRunStatusSchema>;

export const SensorRunRecordSchema = z
  .object({
    id: z.string().min(1),
    sensorId: z.string().min(1),
    sessionId: z.string().min(1).optional(),
    runId: z.string().min(1).optional(),
    trigger: SensorTriggerSchema,
    selectedForProfile: SensorAgentProfileSchema.optional(),
    selectionState: SensorSelectionStateSchema,
    status: SensorRunStatusSchema,
    startedAtMs: z.number().int().nonnegative(),
    completedAtMs: z.number().int().nonnegative().optional(),
    result: SensorResultSchema.optional(),
    runtime: SensorRuntimeSchema.optional(),
    metadata: z.record(z.unknown()).default({}),
  })
  .strict();
export type SensorRunRecord = z.infer<typeof SensorRunRecordSchema>;

export const SensorMcpCapabilityAvailabilitySchema = z
  .object({
    serverId: z.string().min(1),
    serverName: z.string().min(1).optional(),
    capability: z.string().min(1),
    state: SensorProviderAvailabilityStateSchema,
    selectedForReflection: z.boolean(),
    message: z.string().min(1).optional(),
  })
  .strict();
export type SensorMcpCapabilityAvailability = z.infer<typeof SensorMcpCapabilityAvailabilitySchema>;

export const SensorFailurePatternSchema = z
  .object({
    key: z.string().min(1),
    sensorId: z.string().min(1),
    count: z.number().int().positive(),
    severity: SensorFindingSeveritySchema.optional(),
    ruleId: z.string().min(1).optional(),
    files: z.array(z.string().min(1)).default([]),
    firstSeenMs: z.number().int().nonnegative(),
    lastSeenMs: z.number().int().nonnegative(),
  })
  .strict();
export type SensorFailurePattern = z.infer<typeof SensorFailurePatternSchema>;

export const SensorFeedbackCandidateSchema = z
  .object({
    id: z.string().min(1),
    kind: z.enum([
      'beads_issue_proposal',
      'memory_candidate',
      'instruction_update_proposal',
      'linter_test_proposal',
    ]),
    summary: z.string().min(1),
    evidence: z.array(z.string()).default([]),
    reviewRequired: z.literal(true),
    autoApply: z.literal(false),
  })
  .strict();
export type SensorFeedbackCandidate = z.infer<typeof SensorFeedbackCandidateSchema>;

export const SensorSetupGuidanceSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    provider: z.string().min(1),
    state: SensorProviderAvailabilityStateSchema,
    summary: z.string().min(1),
    actions: z.array(SensorRepairActionSchema).default([]),
  })
  .strict();
export type SensorSetupGuidance = z.infer<typeof SensorSetupGuidanceSchema>;

export const SensorDashboardStatusSummarySchema = z
  .object({
    passed: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
    failedAndRepaired: z.number().int().nonnegative(),
    escalated: z.number().int().nonnegative(),
    skipped: z.number().int().nonnegative(),
    unavailable: z.number().int().nonnegative(),
    openFindings: z.number().int().nonnegative(),
    lastTrigger: SensorTriggerSchema.optional(),
    lastRunAtMs: z.number().int().nonnegative().optional(),
  })
  .strict();
export type SensorDashboardStatusSummary = z.infer<typeof SensorDashboardStatusSummarySchema>;

export const SensorDashboardResponseSchema = z
  .object({
    sessionId: z.string().min(1),
    activeAgentProfile: SensorAgentProfileSchema,
    selectedSensorProfile: z.string().min(1),
    codingSensorsRequired: z.boolean(),
    definitions: z.array(SensorDefinitionSchema).default([]),
    recentRuns: z.array(SensorRunRecordSchema).default([]),
    recentResults: z.array(SensorResultSchema).default([]),
    providerAvailability: z.array(SensorProviderAvailabilitySchema).default([]),
    mcpCapabilities: z.array(SensorMcpCapabilityAvailabilitySchema).default([]),
    findings: z
      .array(
        SensorFindingSchema.extend({
          sensorId: z.string().min(1),
          runId: z.string().min(1),
          observedAtMs: z.number().int().nonnegative(),
        }),
      )
      .default([]),
    runtimeLimitations: z.array(SensorRuntimeLimitationSchema).default([]),
    failurePatterns: z.array(SensorFailurePatternSchema).default([]),
    feedbackCandidates: z.array(SensorFeedbackCandidateSchema).default([]),
    setupGuidance: z.array(SensorSetupGuidanceSchema).default([]),
    statusSummary: SensorDashboardStatusSummarySchema,
  })
  .strict();
export type SensorDashboardResponse = z.infer<typeof SensorDashboardResponseSchema>;
