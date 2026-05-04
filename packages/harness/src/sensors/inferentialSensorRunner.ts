import { generateText } from 'ai';
import {
  SensorEvidenceSchema,
  SensorFindingSchema,
  SensorRepairInstructionSchema,
  SensorResultSchema,
  SensorRunRecordSchema,
  type DodContract,
  type SensorAgentProfile,
  type SensorCategory,
  type SensorFinding,
  type SensorResult,
  type SensorRunRecord,
  type SensorSelectionState,
  type SensorTrigger,
} from '@agent-platform/contracts';
import { createLanguageModel, type SupportedProvider } from '@agent-platform/model-router';

import type { ChatMessage, LlmModelConfig, LlmOutput } from '../types.js';
import {
  runComputationalSensors,
  type ComputationalSensorRun,
  type ComputationalSensorRunnerInput,
  type ComputationalSensorRunnerOptions,
} from './computationalSensorRunner.js';
import { extractFirstJsonObject } from '../nodes/jsonUtils.js';

export type InferentialSensorCheck = {
  id: string;
  name: string;
  category: SensorCategory;
  criteria: string[];
};

export type InferentialSensorEvaluatorInput = {
  agentProfile: SensorAgentProfile;
  trigger: SensorTrigger;
  checks: InferentialSensorCheck[];
  messages: ChatMessage[];
  llmOutput?: LlmOutput | null;
  dodContract?: DodContract;
  changedFiles: string[];
  openFindings: SensorFinding[];
};

export type InferentialCheckVerdict = {
  sensorId: string;
  passed: boolean;
  summary: string;
  failedCriteria: string[];
};

export type InferentialSensorEvaluation = {
  checks: InferentialCheckVerdict[];
};

export type InferentialSensorEvaluator = (
  input: InferentialSensorEvaluatorInput,
) => Promise<unknown>;

export type InferentialSensorRunnerInput = {
  agentProfile: SensorAgentProfile;
  trigger: SensorTrigger;
  repoPath: string;
  changedFiles: string[];
  taskContexts?: string[];
  messages?: ChatMessage[];
  llmOutput?: LlmOutput | null;
  dodContract?: DodContract;
  previousSensorResults?: SensorResult[];
  executionLimits?: {
    maxRuntimeMs?: number;
    maxEvidenceBytes?: number;
    maxSensors?: number;
    maxCostUnits?: number;
  };
  modelConfig?: LlmModelConfig | null;
  evaluate?: InferentialSensorEvaluator;
};

export type FeedbackSensorRunnerInput = ComputationalSensorRunnerInput & {
  messages?: ChatMessage[];
  llmOutput?: LlmOutput | null;
  dodContract?: DodContract;
  previousSensorResults?: SensorResult[];
  modelConfig?: LlmModelConfig | null;
  evaluateInferentialSensors?: InferentialSensorEvaluator;
};

const CODING_CHECKS: InferentialSensorCheck[] = [
  {
    id: 'inferential:task_satisfaction',
    name: 'Task satisfaction',
    category: 'definition_of_done',
    criteria: ['The final response or current work satisfies the user request and DoD evidence.'],
  },
  {
    id: 'inferential:diff_intent',
    name: 'Diff intent',
    category: 'code_quality',
    criteria: ['The changed files align with the requested implementation scope.'],
  },
  {
    id: 'inferential:architecture_boundary',
    name: 'Architecture boundary risk',
    category: 'architecture_fit',
    criteria: ['The change respects existing package and module boundaries.'],
  },
  {
    id: 'inferential:test_quality',
    name: 'Test quality concerns',
    category: 'test',
    criteria: ['The verification evidence is appropriate for the behavior and risk changed.'],
  },
  {
    id: 'inferential:open_findings',
    name: 'Unresolved security and code-quality findings',
    category: 'code_quality',
    criteria: [
      'Open security, quality, duplication, review, and hotspot findings are resolved or deferred.',
    ],
  },
  {
    id: 'inferential:readiness',
    name: 'Readiness to commit, push, or review',
    category: 'definition_of_done',
    criteria: [
      'The work is ready for the next repository handoff without weakening required gates.',
    ],
  },
];

const PERSONAL_ASSISTANT_CHECKS = CODING_CHECKS.filter(
  (check) => check.id === 'inferential:task_satisfaction' || check.id === 'inferential:readiness',
);

function shouldRunInferential(trigger: SensorTrigger): boolean {
  return (
    trigger === 'before_push' ||
    trigger === 'before_completion' ||
    trigger === 'manual' ||
    trigger === 'external_feedback'
  );
}

function selectChecks(input: InferentialSensorRunnerInput): InferentialSensorCheck[] {
  if (!shouldRunInferential(input.trigger)) return [];
  const checks =
    input.agentProfile === 'personal_assistant' ? PERSONAL_ASSISTANT_CHECKS : CODING_CHECKS;
  return input.executionLimits?.maxSensors
    ? checks.slice(0, input.executionLimits.maxSensors)
    : checks;
}

function openFindings(results: readonly SensorResult[]): SensorFinding[] {
  return results
    .flatMap((result) => result.findings)
    .filter((finding) => finding.status === 'open')
    .map((finding) => SensorFindingSchema.parse(finding));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseEvaluation(value: unknown): InferentialSensorEvaluation | null {
  if (!isRecord(value) || !Array.isArray(value['checks'])) return null;
  const checks: InferentialCheckVerdict[] = [];
  for (const item of value['checks']) {
    if (!isRecord(item)) return null;
    const sensorId = item['sensorId'];
    const passed = item['passed'];
    const summary = item['summary'];
    const failedCriteria = item['failedCriteria'] ?? [];
    if (
      typeof sensorId !== 'string' ||
      sensorId.length === 0 ||
      typeof passed !== 'boolean' ||
      typeof summary !== 'string' ||
      summary.length === 0 ||
      !Array.isArray(failedCriteria) ||
      !failedCriteria.every((criterion) => typeof criterion === 'string' && criterion.length > 0)
    ) {
      return null;
    }
    checks.push({ sensorId, passed, summary, failedCriteria });
  }
  return { checks };
}

function selectionState(input: InferentialSensorRunnerInput): SensorSelectionState {
  if (input.trigger === 'manual') return 'manual_only';
  return input.agentProfile === 'coding' ? 'required' : 'optional';
}

function evidenceForCheck(
  input: InferentialSensorRunnerInput,
  check: InferentialSensorCheck,
  openFindingCount: number,
) {
  return [
    SensorEvidenceSchema.parse({
      kind: 'json',
      label: `${check.name} assessment context`,
      content: JSON.stringify({
        trigger: input.trigger,
        agentProfile: input.agentProfile,
        changedFiles: input.changedFiles.slice(0, 20),
        dodPassed: input.dodContract?.passed,
        openFindingCount,
      }),
      redacted: false,
      truncated: false,
    }),
  ];
}

function recordFor(
  input: InferentialSensorRunnerInput,
  check: Pick<InferentialSensorCheck, 'id'>,
  result: SensorResult,
): SensorRunRecord {
  return SensorRunRecordSchema.parse({
    id: `${check.id}:${input.trigger}`,
    sensorId: check.id,
    trigger: input.trigger,
    selectedForProfile: input.agentProfile,
    selectionState: selectionState(input),
    status: result.status === 'error' ? 'error' : 'completed',
    startedAtMs: 0,
    completedAtMs: result.completedAtMs ?? Date.now(),
    result,
  });
}

function failedResultForMalformed(input: InferentialSensorRunnerInput): ComputationalSensorRun {
  const result = SensorResultSchema.parse({
    sensorId: 'inferential:self_assessment',
    status: 'failed',
    severity: 'high',
    summary: 'Inferential self-assessment returned malformed output.',
    findings: [],
    repairInstructions: [
      SensorRepairInstructionSchema.parse({
        summary:
          'Retry the self-assessment and return JSON matching the inferential sensor schema.',
        actions: [{ kind: 'retry', label: 'Retry inferential self-assessment' }],
      }),
    ],
    evidence: [],
    completedAtMs: Date.now(),
    metadata: { executionType: 'inferential' },
  });
  return { records: [recordFor(input, { id: result.sensorId }, result)], results: [result] };
}

function failedResultForMissingModel(input: InferentialSensorRunnerInput): ComputationalSensorRun {
  const result = SensorResultSchema.parse({
    sensorId: 'inferential:self_assessment',
    status: 'unavailable',
    summary: 'No model configuration is available for inferential self-assessment.',
    findings: [],
    repairInstructions: [
      SensorRepairInstructionSchema.parse({
        summary: 'Configure a model before running inferential readiness sensors.',
        actions: [{ kind: 'ask_user', label: 'Configure model for inferential sensors' }],
      }),
    ],
    completedAtMs: Date.now(),
    metadata: { executionType: 'inferential' },
  });
  return { records: [recordFor(input, { id: result.sensorId }, result)], results: [result] };
}

function resultForVerdict(
  input: InferentialSensorRunnerInput,
  check: InferentialSensorCheck,
  verdict: InferentialCheckVerdict | undefined,
  openFindingCount: number,
): SensorResult {
  const passed = verdict?.passed === true;
  let failedCriteria = check.criteria;
  if (passed) {
    failedCriteria = [];
  } else if (verdict?.failedCriteria.length) {
    failedCriteria = verdict.failedCriteria;
  }
  return SensorResultSchema.parse({
    sensorId: check.id,
    status: passed ? 'passed' : 'failed',
    severity: passed ? undefined : 'high',
    summary: verdict?.summary ?? `${check.name} was not assessed.`,
    findings: [],
    repairInstructions: failedCriteria.map((criterion) =>
      SensorRepairInstructionSchema.parse({
        summary: criterion,
        actions: [{ kind: 'fix_code', label: `Address ${check.name}` }],
      }),
    ),
    evidence: evidenceForCheck(input, check, openFindingCount),
    completedAtMs: Date.now(),
    metadata: {
      executionType: 'inferential',
      category: check.category,
    },
  });
}

function buildPrompt(input: InferentialSensorEvaluatorInput): string {
  const checks = input.checks.map((check) => `${check.id}: ${check.criteria.join(' ')}`).join('\n');
  const findings = input.openFindings
    .slice(0, 20)
    .map((finding) =>
      [
        finding.source,
        finding.category,
        finding.severity,
        finding.file,
        finding.line,
        finding.message,
      ]
        .filter(Boolean)
        .join(' | '),
    )
    .join('\n');
  const lastMessages = input.messages
    .slice(-8)
    .map((message) => `${message.role}: ${message.content}`)
    .join('\n');

  return `Assess the current agent work. Return JSON only as {"checks":[{"sensorId":string,"passed":boolean,"summary":string,"failedCriteria":string[]}]}.
Every failed criterion must be backed by the supplied evidence.

Agent profile: ${input.agentProfile}
Trigger: ${input.trigger}
Changed files:
${input.changedFiles.join('\n') || '(none)'}

Checks:
${checks}

DoD:
${input.dodContract ? JSON.stringify(input.dodContract) : '(none)'}

Open findings:
${findings || '(none)'}

Recent messages:
${lastMessages || '(none)'}`;
}

async function defaultModelEvaluate(
  input: InferentialSensorEvaluatorInput,
  modelConfig: LlmModelConfig,
): Promise<unknown> {
  const model = createLanguageModel({
    provider: (modelConfig.provider ?? 'openai') as SupportedProvider,
    model: modelConfig.model,
    apiKey: modelConfig.apiKey,
  });
  const response = await generateText({
    model,
    messages: [
      {
        role: 'system',
        content:
          'You are an inferential feedback sensor. Return JSON only. Do not waive required computational gates.',
      },
      {
        role: 'user',
        content: buildPrompt(input),
      },
    ],
  });
  const json = extractFirstJsonObject(response.text);
  return json ? JSON.parse(json) : response.text;
}

export async function runInferentialSensors(
  input: InferentialSensorRunnerInput,
): Promise<ComputationalSensorRun> {
  const checks = selectChecks(input);
  if (checks.length === 0) return { records: [], results: [] };

  const findings = openFindings(input.previousSensorResults ?? []);
  const evaluatorInput: InferentialSensorEvaluatorInput = {
    agentProfile: input.agentProfile,
    trigger: input.trigger,
    checks,
    messages: input.messages ?? [],
    llmOutput: input.llmOutput,
    dodContract: input.dodContract,
    changedFiles: input.changedFiles,
    openFindings: findings,
  };

  let rawEvaluation: unknown;
  try {
    if (input.evaluate) {
      rawEvaluation = await input.evaluate(evaluatorInput);
    } else if (input.modelConfig) {
      rawEvaluation = await defaultModelEvaluate(evaluatorInput, input.modelConfig);
    } else {
      return failedResultForMissingModel(input);
    }
  } catch {
    return failedResultForMalformed(input);
  }

  const evaluation = parseEvaluation(rawEvaluation);
  if (!evaluation) return failedResultForMalformed(input);

  const verdictBySensor = new Map(evaluation.checks.map((verdict) => [verdict.sensorId, verdict]));
  const results = checks.map((check) =>
    resultForVerdict(input, check, verdictBySensor.get(check.id), findings.length),
  );
  return {
    records: results.map((result, index) => recordFor(input, checks[index]!, result)),
    results,
  };
}

export async function runFeedbackSensors(
  input: FeedbackSensorRunnerInput,
  options: ComputationalSensorRunnerOptions = {},
): Promise<ComputationalSensorRun> {
  const computational = await runComputationalSensors(input, options);
  if (!input.evaluateInferentialSensors) {
    return computational;
  }

  const inferential = await runInferentialSensors({
    agentProfile: input.agentProfile,
    trigger: input.trigger,
    repoPath: input.repoPath,
    changedFiles: input.changedFiles,
    taskContexts: input.taskContexts,
    messages: input.messages,
    llmOutput: input.llmOutput,
    dodContract: input.dodContract,
    previousSensorResults: [...(input.previousSensorResults ?? []), ...computational.results],
    executionLimits: input.executionLimits,
    modelConfig: input.modelConfig,
    evaluate: input.evaluateInferentialSensors,
  });

  return {
    records: [...computational.records, ...inferential.records],
    results: [...computational.results, ...inferential.results],
  };
}
