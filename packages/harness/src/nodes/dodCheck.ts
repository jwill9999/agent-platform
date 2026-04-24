import { generateText } from 'ai';
import { createLogger } from '@agent-platform/logger';
import { createLanguageModel, type SupportedProvider } from '@agent-platform/model-router';
import { DodContractSchema, type DodContract } from '@agent-platform/contracts';
import type { PluginDispatcher } from '@agent-platform/plugin-sdk';

import type { HarnessStateType } from '../graphState.js';
import type { TraceEvent } from '../trace.js';
import type { ChatMessage, OutputEmitter } from '../types.js';

const log = createLogger('harness:dod-check');
const DEFAULT_MAX_CRITIC_ITERATIONS = 3;
const DEFAULT_DOD_CRITERIA = "Answer the user's question.";

export type DodCheckEvaluator = (
  state: HarnessStateType,
  contract: DodContract,
) => Promise<DodContract>;

export type DodCheckNodeOptions = {
  emitter?: OutputEmitter;
  dispatcher?: PluginDispatcher;
  evaluate?: DodCheckEvaluator;
};

function extractFirstJsonObject(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) return null;
  return trimmed.slice(start, end + 1);
}

async function safeEmit(
  emitter: OutputEmitter | undefined,
  event: Parameters<OutputEmitter['emit']>[0],
) {
  if (!emitter) return;
  await emitter.emit(event);
}

function buildEvidence(state: HarnessStateType): string[] {
  const evidence: string[] = [];
  const messages = state.messages ?? [];
  const lastAssistant = [...messages].reverse().find((message) => message.role === 'assistant');
  if (lastAssistant?.content) {
    evidence.push(`Assistant answer: ${lastAssistant.content}`);
  }

  const toolResults = [...messages]
    .reverse()
    .filter((message) => message.role === 'tool')
    .slice(0, 4)
    .reverse();
  for (const result of toolResults) {
    evidence.push(`Tool result (${result.toolName}): ${result.content}`);
  }
  return evidence;
}

function buildCandidateContract(state: HarnessStateType): DodContract {
  const criteria = state.dodContract?.criteria.length
    ? state.dodContract.criteria
    : [DEFAULT_DOD_CRITERIA];
  return DodContractSchema.parse({
    criteria,
    evidence: buildEvidence(state),
    passed: false,
    failedCriteria: [],
  });
}

function buildFailureContract(contract: DodContract, note: string): DodContract {
  return DodContractSchema.parse({
    criteria: contract.criteria,
    evidence: [...contract.evidence, note],
    passed: false,
    failedCriteria:
      contract.failedCriteria.length > 0 ? contract.failedCriteria : contract.criteria,
  });
}

async function defaultEvaluate(
  state: HarnessStateType,
  contract: DodContract,
): Promise<DodContract> {
  const { modelConfig } = state;
  if (!modelConfig) {
    return buildFailureContract(contract, 'No model configured for DoD verifier');
  }

  const criteriaText = contract.criteria
    .map((criterion, index) => `${index + 1}. ${criterion}`)
    .join('\n');
  const evidenceText = contract.evidence.join('\n') || '(none)';

  const model = createLanguageModel({
    provider: (modelConfig.provider ?? 'openai') as SupportedProvider,
    model: modelConfig.model,
    apiKey: modelConfig.apiKey,
  });
  const result = await generateText({
    model,
    messages: [
      {
        role: 'system',
        content:
          'Return JSON only matching {"criteria":string[],"evidence":string[],"passed":boolean,"failedCriteria":string[]}. Mark passed true only if every criterion is satisfied by the evidence.',
      },
      {
        role: 'user',
        content: `Criteria:\n${criteriaText}\n\nEvidence:\n${evidenceText}`,
      },
    ],
  });
  const json = extractFirstJsonObject(result.text);
  if (!json) {
    return buildFailureContract(contract, 'DoD verifier returned malformed output');
  }

  try {
    return DodContractSchema.parse(JSON.parse(json));
  } catch {
    return buildFailureContract(contract, 'DoD verifier returned malformed output');
  }
}

async function applyDispatcherOverride(
  dispatcher: PluginDispatcher | undefined,
  state: HarnessStateType,
  contract: DodContract,
): Promise<DodContract> {
  if (!dispatcher) return contract;
  try {
    const override = await dispatcher.onDodCheck({
      sessionId: state.sessionId ?? '',
      runId: state.runId ?? '',
      contract,
    });
    return override ? DodContractSchema.parse(override) : contract;
  } catch (error) {
    log.warn('plugin onDodCheck failed, retaining internal DoD contract', {
      error: error instanceof Error ? error.message : String(error),
    });
    try {
      await dispatcher.onError({
        sessionId: state.sessionId ?? '',
        runId: state.runId ?? '',
        phase: 'unknown',
        error,
      });
    } catch {
      /* plugin errors must not crash the graph */
    }
    return contract;
  }
}

function buildTrace(contract: DodContract): TraceEvent[] {
  return [
    {
      type: 'dod_check',
      passed: contract.passed,
      criteriaCount: contract.criteria.length,
      failedCriteria: contract.failedCriteria,
    },
  ];
}

function buildFailureNote(contract: DodContract): string {
  const failed = contract.failedCriteria.length > 0 ? contract.failedCriteria : contract.criteria;
  return `<dod-failed>\n${failed.join('; ')}\n</dod-failed>`;
}

function buildSummary(contract: DodContract): string {
  const met = contract.criteria.length - contract.failedCriteria.length;
  return `DoD: ${met}/${contract.criteria.length} criteria met`;
}

export function createDodCheckNode(options: DodCheckNodeOptions = {}) {
  const evaluate = options.evaluate ?? defaultEvaluate;
  const { emitter, dispatcher } = options;

  return async (state: HarnessStateType) => {
    const candidate = buildCandidateContract(state);
    const evaluated = DodContractSchema.parse(await evaluate(state, candidate));
    const contract = await applyDispatcherOverride(dispatcher, state, evaluated);
    const trace = buildTrace(contract);
    const cap = state.limits?.maxCriticIterations ?? DEFAULT_MAX_CRITIC_ITERATIONS;
    const capReached = (state.iterations ?? 0) >= cap;

    if (contract.passed) {
      await safeEmit(emitter, { type: 'text', content: `${buildSummary(contract)}\n` });
      return { dodContract: contract, trace };
    }

    if (capReached) {
      await safeEmit(emitter, {
        type: 'error',
        code: 'DOD_FAILED',
        message: `Definition of Done failed after ${cap} iteration(s).`,
      });
      await safeEmit(emitter, { type: 'text', content: `${buildSummary(contract)}\n` });
      return { dodContract: contract, trace };
    }

    const feedback: ChatMessage = { role: 'system', content: buildFailureNote(contract) };

    return {
      dodContract: contract,
      iterations: (state.iterations ?? 0) + 1,
      messages: [feedback],
      trace,
    };
  };
}
