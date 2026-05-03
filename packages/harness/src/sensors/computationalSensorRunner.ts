import {
  CodingRunQualityGateResultSchema,
  SensorEvidenceSchema,
  SensorFindingSchema,
  SensorRepairInstructionSchema,
  SensorResultSchema,
  SensorRunRecordSchema,
  type Output,
  type SensorAgentProfile,
  type SensorDefinition,
  type SensorFinding,
  type SensorProviderAvailability,
  type SensorResult,
  type SensorRunRecord,
  type SensorRuntime,
  type SensorRuntimeLimitation,
  type SensorSelectionState,
  type SensorTerminalEvidence,
  type SensorTrigger,
} from '@agent-platform/contracts';
import { executeQualityGateTool, QUALITY_GATE_TOOL_ID } from '../tools/qualityGateTool.js';

type QualityGateProfile = 'test' | 'typecheck' | 'lint' | 'format' | 'docs' | 'build' | 'e2e';

export type QualityGateExecutor = (
  toolId: string,
  args: Record<string, unknown>,
  options?: { workspaceRoot?: string; pnpmBin?: string },
) => Promise<Output | null>;

export type ComputationalFindingCollectorResult = {
  id: string;
  providerAvailability?: SensorProviderAvailability;
  findings?: SensorFinding[];
  terminalEvidence?: SensorTerminalEvidence[];
  runtime?: SensorRuntime;
  runtimeLimitations?: SensorRuntimeLimitation[];
};

export type ComputationalSensorRunnerInput = {
  agentProfile: SensorAgentProfile;
  taskContexts?: string[];
  trigger: SensorTrigger;
  repoPath: string;
  changedFiles: string[];
  availableSensorDefinitions?: Pick<SensorDefinition, 'id' | 'agentProfilePolicy'>[];
  executionLimits?: {
    maxRuntimeMs?: number;
    maxEvidenceBytes?: number;
    maxSensors?: number;
  };
  requestedSensorIds?: string[];
  timeoutMs?: number;
  maxOutputBytes?: number;
  runtime?: SensorRuntime;
  findingCollectorResults?: ComputationalFindingCollectorResult[];
};

export type ComputationalSensorRunnerOptions = {
  workspaceRoot?: string;
  pnpmBin?: string;
  qualityGateExecutor?: QualityGateExecutor;
};

export type ComputationalSensorRun = {
  records: SensorRunRecord[];
  results: SensorResult[];
};

const QUALITY_GATE_ORDER: QualityGateProfile[] = ['typecheck', 'test', 'lint', 'docs', 'format'];

const CODE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);

function extensionOf(path: string): string {
  const match = /\.[a-z0-9]+$/i.exec(path);
  return match?.[0]?.toLowerCase() ?? '';
}

function hasRepoContext(input: ComputationalSensorRunnerInput): boolean {
  return (
    input.agentProfile === 'coding' ||
    input.taskContexts?.includes('repo_change') === true ||
    input.trigger === 'before_commit' ||
    input.trigger === 'before_push'
  );
}

function sensorIdFor(profile: QualityGateProfile): string {
  return `quality_gate:${profile}`;
}

function profileForSensorId(sensorId: string): QualityGateProfile | null {
  const profile = sensorId.replace(/^quality_gate:/, '') as QualityGateProfile;
  return QUALITY_GATE_ORDER.includes(profile) || profile === 'build' || profile === 'e2e'
    ? profile
    : null;
}

function selectQualityGateProfiles(input: ComputationalSensorRunnerInput): QualityGateProfile[] {
  const requested = input.requestedSensorIds
    ?.map(profileForSensorId)
    .filter((profile): profile is QualityGateProfile => profile !== null);
  if (requested?.length) return [...new Set(requested)];

  if (!hasRepoContext(input)) return [];

  const profiles = new Set<QualityGateProfile>();
  for (const file of input.changedFiles) {
    const ext = extensionOf(file);
    if (ext === '.ts' || ext === '.tsx') profiles.add('typecheck');
    if (CODE_EXTENSIONS.has(ext)) {
      profiles.add('lint');
      if (
        file.includes('/src/') ||
        file.includes('/test/') ||
        /\.(test|spec)\.[tj]sx?$/i.test(file)
      ) {
        profiles.add('test');
      }
    }
    if (ext === '.md' || ext === '.mdx') {
      profiles.add('docs');
      profiles.add('format');
    }
  }

  return QUALITY_GATE_ORDER.filter((profile) => profiles.has(profile));
}

function definitionForSensor(input: ComputationalSensorRunnerInput, sensorId: string) {
  return input.availableSensorDefinitions?.find((definition) => definition.id === sensorId);
}

function isSensorAvailable(input: ComputationalSensorRunnerInput, sensorId: string): boolean {
  const definitions = input.availableSensorDefinitions;
  if (!definitions?.length) return true;

  const definition = definitionForSensor(input, sensorId);
  if (!definition) return false;
  return definition.agentProfilePolicy[input.agentProfile] !== 'disabled';
}

function applySelectionLimits(
  profiles: readonly QualityGateProfile[],
  input: ComputationalSensorRunnerInput,
): QualityGateProfile[] {
  const availableProfiles = profiles.filter((profile) =>
    isSensorAvailable(input, sensorIdFor(profile)),
  );
  return input.executionLimits?.maxSensors
    ? availableProfiles.slice(0, input.executionLimits.maxSensors)
    : availableProfiles;
}

function selectionState(
  input: ComputationalSensorRunnerInput,
  sensorId: string,
): SensorSelectionState {
  const configuredState = definitionForSensor(input, sensorId)?.agentProfilePolicy[
    input.agentProfile
  ];
  if (configuredState) return configuredState;
  if (input.trigger === 'manual') return 'manual_only';
  return input.agentProfile === 'coding' && input.trigger === 'before_push'
    ? 'required'
    : 'optional';
}

function byteLength(value: string): number {
  return Buffer.byteLength(value, 'utf-8');
}

function evidenceFromText(
  kind: 'stdout' | 'stderr',
  label: string,
  content: string,
  truncated: boolean,
) {
  return SensorEvidenceSchema.parse({
    kind,
    label,
    content,
    sizeBytes: byteLength(content),
    truncated,
    redacted: false,
  });
}

function ruleIdFromFailure(message: string): string | undefined {
  return /\b(TS\d{4}|[a-z]+:[A-Z]\d+|[a-z]+\/[a-z0-9-]+)\b/i.exec(message)?.[1];
}

function repairSummary(
  profile: QualityGateProfile,
  failures: readonly { message: string }[],
): string {
  if (profile === 'typecheck') return 'Fix TypeScript typecheck failures.';
  if (profile === 'lint') return 'Fix lint rule violations.';
  if (profile === 'test') return 'Fix failing tests.';
  if (failures.length > 0) return `Fix ${profile} quality gate failures.`;
  return `Review and fix the ${profile} quality gate failure.`;
}

function findingsFromQualityGate(
  profile: QualityGateProfile,
  failures: readonly { message: string; file?: string; line?: number }[],
): SensorFinding[] {
  return failures.map((failure, index) =>
    SensorFindingSchema.parse({
      id: `${profile}:${index}`,
      source: 'local_command',
      severity: profile === 'docs' || profile === 'format' ? 'medium' : 'high',
      status: 'open',
      category: 'quality_gate',
      message: failure.message,
      file: failure.file,
      line: failure.line,
      ruleId: ruleIdFromFailure(failure.message),
      dedupeKey: [profile, failure.file, failure.line, failure.message].filter(Boolean).join(':'),
    }),
  );
}

function dedupeFindings(findings: readonly SensorFinding[]): SensorFinding[] {
  const seen = new Set<string>();
  const deduped: SensorFinding[] = [];
  for (const finding of findings) {
    const key =
      finding.dedupeKey ??
      [finding.source, finding.ruleId, finding.file, finding.line, finding.message]
        .filter(Boolean)
        .join(':');
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(finding);
  }
  return deduped;
}

function runtimeLimitationForDenied(message: string): SensorRuntimeLimitation {
  return {
    kind: 'sandbox_policy_denied',
    message,
    repairActions: [{ kind: 'ask_user', label: 'Review workspace or sandbox policy' }],
    metadata: {},
  };
}

function parseToolEnvelope(output: Output): {
  ok: boolean;
  message?: string;
  errorCode?: string;
  result?: unknown;
} {
  if (output.type !== 'tool_result')
    return { ok: false, message: 'Quality gate did not return a tool result.' };
  const data = output.data as {
    ok?: unknown;
    message?: unknown;
    error?: { code?: unknown };
    result?: unknown;
  };
  return {
    ok: data.ok === true,
    message: typeof data.message === 'string' ? data.message : undefined,
    errorCode: typeof data.error?.code === 'string' ? data.error.code : undefined,
    result: data.result,
  };
}

function qualityGateRecord(
  input: ComputationalSensorRunnerInput,
  sensorId: string,
  result: SensorResult,
): SensorRunRecord {
  return SensorRunRecordSchema.parse({
    id: `${sensorId}:${input.trigger}`,
    sensorId,
    trigger: input.trigger,
    selectedForProfile: input.agentProfile,
    selectionState: selectionState(input, sensorId),
    status: result.status === 'skipped' ? 'skipped' : 'completed',
    startedAtMs: 0,
    completedAtMs: result.completedAtMs ?? Date.now(),
    result,
    runtime: input.runtime,
  });
}

async function runQualityGate(
  profile: QualityGateProfile,
  input: ComputationalSensorRunnerInput,
  options: ComputationalSensorRunnerOptions,
): Promise<{ record: SensorRunRecord; result: SensorResult }> {
  const sensorId = sensorIdFor(profile);
  const executor = options.qualityGateExecutor ?? executeQualityGateTool;
  const output = await executor(
    QUALITY_GATE_TOOL_ID,
    {
      profile,
      repoPath: input.repoPath,
      timeoutMs: input.timeoutMs ?? input.executionLimits?.maxRuntimeMs,
      maxOutputBytes: input.maxOutputBytes ?? input.executionLimits?.maxEvidenceBytes,
    },
    { workspaceRoot: options.workspaceRoot, pnpmBin: options.pnpmBin },
  );
  const envelope = output
    ? parseToolEnvelope(output)
    : { ok: false, message: 'Quality gate unavailable.' };

  if (envelope.errorCode === 'QUALITY_GATE_DENIED') {
    const result = SensorResultSchema.parse({
      sensorId,
      status: 'error',
      summary: envelope.message ?? 'Quality gate denied by policy.',
      findings: [],
      runtime: input.runtime,
      runtimeLimitations: [
        runtimeLimitationForDenied(envelope.message ?? 'Quality gate denied by policy.'),
      ],
    });
    return { result, record: qualityGateRecord(input, sensorId, result) };
  }

  const gateResult = CodingRunQualityGateResultSchema.safeParse(envelope.result);
  const stdoutTail = gateResult.success ? gateResult.data.stdoutTail : '';
  const stderrTail = gateResult.success ? gateResult.data.stderrTail : '';
  const failures = gateResult.success ? gateResult.data.failures : [];
  const truncated = gateResult.success ? gateResult.data.truncated : false;
  const findings = envelope.ok ? [] : findingsFromQualityGate(profile, failures);
  const result = SensorResultSchema.parse({
    sensorId,
    status: envelope.ok ? 'passed' : 'failed',
    severity: findings[0]?.severity,
    summary: envelope.message ?? (envelope.ok ? `${profile} passed.` : `${profile} failed.`),
    findings,
    repairInstructions: envelope.ok
      ? []
      : [
          SensorRepairInstructionSchema.parse({
            summary: repairSummary(profile, failures),
            actions: [{ kind: 'fix_code', label: `Fix ${profile} findings` }],
          }),
        ],
    evidence: [
      evidenceFromText('stdout', `${profile} stdout tail`, stdoutTail, truncated),
      evidenceFromText('stderr', `${profile} stderr tail`, stderrTail, truncated),
    ],
    runtime: input.runtime,
    completedAtMs: Date.now(),
  });

  return { result, record: qualityGateRecord(input, sensorId, result) };
}

function statusForCollectorResult(
  result: ComputationalFindingCollectorResult,
): SensorResult['status'] {
  if (result.providerAvailability && result.providerAvailability.state !== 'available') {
    return 'unavailable';
  }
  if (result.runtimeLimitations?.length) return 'unavailable';
  return result.findings?.length ? 'failed' : 'passed';
}

function repairInstructionsForFindings(findings: readonly SensorFinding[]) {
  if (findings.length === 0) return [];
  return [
    SensorRepairInstructionSchema.parse({
      summary: `Address ${findings.length} imported sensor finding${findings.length === 1 ? '' : 's'}.`,
      actions: findings
        .filter((finding) => finding.file)
        .slice(0, 5)
        .map((finding) => ({
          kind: 'fix_code' as const,
          label: `Fix ${finding.ruleId ?? finding.category}`,
          file: finding.file,
          line: finding.line,
        })),
    }),
  ];
}

function collectorRecord(
  input: ComputationalSensorRunnerInput,
  collector: ComputationalFindingCollectorResult,
  result: SensorResult,
): SensorRunRecord {
  return SensorRunRecordSchema.parse({
    id: `collector:${collector.id}:${input.trigger}`,
    sensorId: `collector:${collector.id}`,
    trigger: input.trigger,
    selectedForProfile: input.agentProfile,
    selectionState: 'optional',
    status: 'completed',
    startedAtMs: 0,
    completedAtMs: Date.now(),
    result,
    runtime: collector.runtime ?? input.runtime,
  });
}

function normalizeCollectorResult(
  input: ComputationalSensorRunnerInput,
  collector: ComputationalFindingCollectorResult,
): { record: SensorRunRecord; result: SensorResult } {
  const findings = dedupeFindings(collector.findings ?? []);
  const result = SensorResultSchema.parse({
    sensorId: `collector:${collector.id}`,
    status: statusForCollectorResult(collector),
    severity: findings[0]?.severity,
    summary: findings.length
      ? `Imported ${findings.length} finding${findings.length === 1 ? '' : 's'} from ${collector.id}.`
      : `No findings imported from ${collector.id}.`,
    findings,
    repairInstructions: repairInstructionsForFindings(findings),
    terminalEvidence: collector.terminalEvidence ?? [],
    providerAvailability: collector.providerAvailability,
    runtime: collector.runtime ?? input.runtime,
    runtimeLimitations: collector.runtimeLimitations ?? [],
    completedAtMs: Date.now(),
  });
  return { result, record: collectorRecord(input, collector, result) };
}

export async function runComputationalSensors(
  input: ComputationalSensorRunnerInput,
  options: ComputationalSensorRunnerOptions = {},
): Promise<ComputationalSensorRun> {
  const qualityGateProfiles = applySelectionLimits(selectQualityGateProfiles(input), input);
  const qualityGateRuns = await Promise.all(
    qualityGateProfiles.map((profile) => runQualityGate(profile, input, options)),
  );
  const collectorRuns = (input.findingCollectorResults ?? []).map((collector) =>
    normalizeCollectorResult(input, collector),
  );
  const runs = [...qualityGateRuns, ...collectorRuns];
  return {
    records: runs.map((run) => run.record),
    results: runs.map((run) => run.result),
  };
}
