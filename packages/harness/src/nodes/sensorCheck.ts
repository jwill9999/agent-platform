import { END } from '@langchain/langgraph';
import type {
  SensorAgentProfile,
  SensorResult,
  SensorRunRecord,
  SensorTrigger,
} from '@agent-platform/contracts';

import type { HarnessStateType } from '../graphState.js';
import type { TraceEvent } from '../trace.js';
import type { ChatMessage, OutputEmitter } from '../types.js';
import {
  runComputationalSensors,
  type ComputationalSensorRun,
  type ComputationalSensorRunnerInput,
  type ComputationalSensorRunnerOptions,
} from '../sensors/computationalSensorRunner.js';

export type SensorRunner = (
  input: ComputationalSensorRunnerInput,
  options?: ComputationalSensorRunnerOptions,
) => Promise<ComputationalSensorRun>;

export type SensorCheckNodeOptions = {
  runSensors?: SensorRunner;
  runnerOptions?: ComputationalSensorRunnerOptions;
  emitter?: OutputEmitter;
  maxFeedbackChars?: number;
  repeatedFailureLimit?: number;
};

const DEFAULT_MAX_FEEDBACK_CHARS = 1_600;
const DEFAULT_REPEATED_FAILURE_LIMIT = 2;
const CODE_CHANGING_TOOL_IDS = new Set([
  'coding_apply_patch',
  'sys_write_file',
  'sys_append_file',
  'sys_copy_file',
  'sys_create_directory',
  'sys_download_file',
  'sys_bash',
]);

async function safeEmit(
  emitter: OutputEmitter | undefined,
  event: Parameters<OutputEmitter['emit']>[0],
) {
  if (!emitter) return;
  await emitter.emit(event);
}

function hasMeaningfulCodeCheckpoint(state: HarnessStateType): boolean {
  return (state.sensorLastToolIds ?? []).some((toolId) => CODE_CHANGING_TOOL_IDS.has(toolId));
}

function resolveTrigger(state: HarnessStateType): SensorTrigger | null {
  if (state.sensorRequestedTrigger) return state.sensorRequestedTrigger;
  if (state.llmOutput?.kind === 'text') return 'before_push';
  return hasMeaningfulCodeCheckpoint(state) ? 'on_meaningful_change' : null;
}

function resolveAgentProfile(state: HarnessStateType): SensorAgentProfile {
  return state.sensorAgentProfile ?? 'coding';
}

function isRequired(record: SensorRunRecord): boolean {
  return record.selectionState === 'required';
}

function resultRequiresEscalation(result: SensorResult, required: boolean): boolean {
  return required && (result.status === 'unavailable' || result.status === 'error');
}

function primaryFailureKey(result: SensorResult): string | null {
  const finding = result.findings[0];
  if (!finding && result.status !== 'failed') return null;
  if (finding?.dedupeKey) return `${result.sensorId}:${finding.dedupeKey}`;
  return [
    result.sensorId,
    finding?.source,
    finding?.ruleId,
    finding?.file,
    finding?.line,
    finding?.message,
    result.summary,
  ]
    .filter(Boolean)
    .join(':');
}

function updateAttempts(
  state: HarnessStateType,
  results: readonly SensorResult[],
): Record<string, number> {
  const attempts = { ...(state.sensorAttempts ?? {}) };
  for (const result of results) {
    const key = primaryFailureKey(result);
    if (!key) continue;
    attempts[key] = (attempts[key] ?? 0) + 1;
  }
  return attempts;
}

function repeatedFailure(
  attempts: Record<string, number>,
  results: readonly SensorResult[],
  limit: number,
): { sensorId: string; repeats: number; key: string } | null {
  for (const result of results) {
    const key = primaryFailureKey(result);
    if (!key) continue;
    const repeats = attempts[key] ?? 0;
    if (repeats >= limit) return { sensorId: result.sensorId, repeats, key };
  }
  return null;
}

function traceForRun(
  trigger: SensorTrigger,
  records: readonly SensorRunRecord[],
  results: readonly SensorResult[],
): TraceEvent[] {
  const traces: TraceEvent[] = [];
  for (const record of records) {
    traces.push({
      type: 'sensor_run',
      sensorId: record.sensorId,
      trigger,
      profile: record.selectedForProfile,
      required: isRequired(record),
    });
  }
  for (const result of results) {
    traces.push({
      type: 'sensor_result',
      sensorId: result.sensorId,
      status: result.status,
      findingCount: result.findings.length,
      repairInstructionCount: result.repairInstructions.length,
    });
  }
  return traces;
}

function buildRepairFeedback(results: readonly SensorResult[], maxChars: number): string {
  const lines = ['<sensor-feedback>'];
  for (const result of results) {
    if (result.status === 'passed') continue;
    lines.push(`Sensor ${result.sensorId}: ${result.status} - ${result.summary}`);
    for (const instruction of result.repairInstructions.slice(0, 3)) {
      lines.push(`Repair: ${instruction.summary}`);
    }
    for (const finding of result.findings.slice(0, 5)) {
      const location = finding.file
        ? ` (${finding.file}${finding.line ? `:${finding.line}` : ''})`
        : '';
      lines.push(`Finding: ${finding.message}${location}`);
    }
  }
  lines.push('</sensor-feedback>');
  const content = lines.join('\n');
  return content.length <= maxChars
    ? content
    : content.slice(0, Math.max(0, maxChars - 12)) + '\n<truncated>';
}

function hasActionableFailure(results: readonly SensorResult[]): boolean {
  return results.some((result) => result.status === 'failed');
}

function hasRequiredEscalation(
  records: readonly SensorRunRecord[],
  results: readonly SensorResult[],
): boolean {
  const requiredById = new Set(records.filter(isRequired).map((record) => record.sensorId));
  return results.some((result) =>
    resultRequiresEscalation(result, requiredById.has(result.sensorId)),
  );
}

function buildSensorInput(
  state: HarnessStateType,
  trigger: SensorTrigger,
): ComputationalSensorRunnerInput {
  return {
    agentProfile: resolveAgentProfile(state),
    taskContexts: state.sensorTaskContexts ?? [],
    trigger,
    repoPath: state.sensorRepoPath ?? '.',
    changedFiles: state.sensorChangedFiles ?? [],
    findingCollectorResults: state.sensorFindingCollectorResults ?? [],
    executionLimits:
      trigger === 'on_meaningful_change'
        ? {
            maxRuntimeMs: state.limits?.timeoutMs,
            maxEvidenceBytes: 20_000,
            maxSensors: 1,
          }
        : {
            maxRuntimeMs: state.limits?.timeoutMs,
            maxEvidenceBytes: 40_000,
          },
  };
}

export function routeAfterSensorCheck(state: HarnessStateType): 'react_llm_reason' | typeof END {
  if (state.halted) return END;
  if (state.sensorLastTrigger === 'on_meaningful_change') return 'react_llm_reason';
  const lastResult = state.sensorResults?.at(-1);
  if (lastResult?.status === 'failed') return 'react_llm_reason';
  return END;
}

export function createSensorCheckNode(options: SensorCheckNodeOptions = {}) {
  const runSensors = options.runSensors ?? runComputationalSensors;
  const maxFeedbackChars = options.maxFeedbackChars ?? DEFAULT_MAX_FEEDBACK_CHARS;
  const repeatedFailureLimit = options.repeatedFailureLimit ?? DEFAULT_REPEATED_FAILURE_LIMIT;

  return async (state: HarnessStateType): Promise<Partial<HarnessStateType>> => {
    const trigger = resolveTrigger(state);
    if (!trigger) return {};

    const run = await runSensors(buildSensorInput(state, trigger), {
      ...options.runnerOptions,
      qualityGateExecutor: options.runnerOptions?.qualityGateExecutor,
    });
    const clearRequestedTrigger = state.sensorRequestedTrigger
      ? { sensorRequestedTrigger: undefined }
      : {};
    if (run.records.length === 0 && run.results.length === 0) {
      return {
        ...clearRequestedTrigger,
        sensorLastTrigger: trigger,
      };
    }

    await safeEmit(options.emitter, {
      type: 'thinking',
      content:
        trigger === 'before_push'
          ? 'Running required repository sensors before completion.'
          : 'Running targeted repository sensors for recent code changes.',
    });

    const trace = traceForRun(trigger, run.records, run.results);
    const attempts = updateAttempts(state, run.results);
    const repeated = repeatedFailure(attempts, run.results, repeatedFailureLimit);

    if (repeated) {
      trace.push({
        type: 'sensor_loop_limit',
        sensorId: repeated.sensorId,
        repeats: repeated.repeats,
        reason: repeated.key,
      });
      await safeEmit(options.emitter, {
        type: 'error',
        code: 'SENSOR_REPEATED_FAILURE',
        message: `Sensor "${repeated.sensorId}" reported the same failure ${repeated.repeats} time(s).`,
      });
      return {
        ...clearRequestedTrigger,
        halted: true,
        sensorResults: run.results,
        sensorAttempts: attempts,
        sensorLastTrigger: trigger,
        trace,
      };
    }

    if (hasRequiredEscalation(run.records, run.results)) {
      await safeEmit(options.emitter, {
        type: 'error',
        code: 'SENSOR_REQUIRED_UNAVAILABLE',
        message: 'A required sensor is unavailable or blocked by the runtime environment.',
      });
      return {
        ...clearRequestedTrigger,
        halted: true,
        sensorResults: run.results,
        sensorAttempts: attempts,
        sensorLastTrigger: trigger,
        trace,
      };
    }

    if (hasActionableFailure(run.results)) {
      const feedback: ChatMessage = {
        role: 'system',
        content: buildRepairFeedback(run.results, maxFeedbackChars),
      };
      return {
        ...clearRequestedTrigger,
        messages: [feedback],
        sensorResults: run.results,
        sensorAttempts: attempts,
        sensorLastTrigger: trigger,
        trace,
      };
    }

    return {
      ...clearRequestedTrigger,
      sensorResults: run.results,
      sensorAttempts: attempts,
      sensorLastTrigger: trigger,
      trace,
    };
  };
}
