import { generateText } from 'ai';
import { CriticVerdictSchema, type CriticVerdict } from '@agent-platform/contracts';
import { createLanguageModel, type SupportedProvider } from '@agent-platform/model-router';
import type { PluginDispatcher } from '@agent-platform/plugin-sdk';
import { createLogger } from '@agent-platform/logger';

import type { HarnessStateType } from '../graphState.js';
import type { TraceEvent } from '../trace.js';
import type { ChatMessage, OutputEmitter } from '../types.js';
import { EVALUATOR_SYSTEM_PROMPT } from '../personas/evaluator.js';

const log = createLogger('harness:critic');

/** Default cap when `executionLimits.maxCriticIterations` is unset. */
export const DEFAULT_MAX_CRITIC_ITERATIONS = 3;

/**
 * Pluggable evaluator. Receives the harness state at the moment the LLM
 * emitted a tentative final answer and returns a parsed verdict. Replace in
 * tests; the default uses model-router with the evaluator persona.
 */
export type CriticEvaluator = (state: HarnessStateType) => Promise<CriticVerdict>;

export type CriticNodeOptions = {
  emitter?: OutputEmitter;
  dispatcher?: PluginDispatcher;
  /** Override the default LLM-backed evaluator. Useful for unit tests. */
  evaluate?: CriticEvaluator;
};

// ---------------------------------------------------------------------------
// Default evaluator (model-router-backed)
// ---------------------------------------------------------------------------

function extractFirstJsonObject(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) return null;
  return trimmed.slice(start, end + 1);
}

/**
 * Build the message thread for the evaluator: the original user request and
 * the assistant's most recent draft answer (plus any tool results from this
 * turn) wrapped in an evaluator system prompt.
 */
function buildEvaluatorMessages(state: HarnessStateType): ChatMessage[] {
  const messages = state.messages ?? [];
  const lastUser = [...messages].reverse().find((m) => m.role === 'user');
  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
  const recentToolResults = [...messages]
    .reverse()
    .filter((m) => m.role === 'tool')
    .slice(0, 4)
    .reverse();

  const evalMessages: ChatMessage[] = [{ role: 'system', content: EVALUATOR_SYSTEM_PROMPT }];
  if (lastUser) evalMessages.push({ role: 'user', content: `User request:\n${lastUser.content}` });
  for (const t of recentToolResults) {
    evalMessages.push({
      role: 'user',
      content: `Tool result (${t.toolName}):\n${t.content}`,
    });
  }
  if (lastAssistant) {
    evalMessages.push({
      role: 'user',
      content: `Assistant draft answer:\n${lastAssistant.content}`,
    });
  }
  return evalMessages;
}

async function defaultEvaluate(state: HarnessStateType): Promise<CriticVerdict> {
  const modelConfig = state.modelConfig;
  if (!modelConfig) {
    // No LLM configured (e.g. test harness without a model) — accept by default.
    return { verdict: 'accept', reasons: [] };
  }
  const model = createLanguageModel({
    provider: (modelConfig.provider ?? 'openai') as SupportedProvider,
    model: modelConfig.model,
    apiKey: modelConfig.apiKey,
  });
  const evalMessages = buildEvaluatorMessages(state);
  // Evaluator only emits system + user messages — narrow the type so the SDK
  // accepts them without the discriminated CoreMessage union complaining.
  const sdkMessages: Array<{ role: 'system' | 'user'; content: string }> = evalMessages
    .filter(
      (m): m is ChatMessage & { role: 'system' | 'user' } =>
        m.role === 'system' || m.role === 'user',
    )
    .map((m) => ({ role: m.role, content: m.content }));
  const result = await generateText({
    model,
    messages: sdkMessages,
  });
  const json = extractFirstJsonObject(result.text);
  if (!json) {
    return { verdict: 'accept', reasons: ['malformed evaluator output'] };
  }
  return CriticVerdictSchema.parse(JSON.parse(json));
}

// ---------------------------------------------------------------------------
// Node factory
// ---------------------------------------------------------------------------

/**
 * Resolve the configured iteration cap; falls back to {@link DEFAULT_MAX_CRITIC_ITERATIONS}.
 */
export function resolveCriticCap(state: HarnessStateType): number {
  return state.limits?.maxCriticIterations ?? DEFAULT_MAX_CRITIC_ITERATIONS;
}

function summariseReasons(reasons: string[]): string {
  if (reasons.length === 0) return '(no specific reasons)';
  return reasons.slice(0, 3).join('; ');
}

async function safeEmit(
  emitter: OutputEmitter | undefined,
  event: Parameters<OutputEmitter['emit']>[0],
): Promise<void> {
  if (!emitter) return;
  try {
    await emitter.emit(event);
  } catch {
    /* emitter errors must not crash the graph */
  }
}

async function notifyDispatcherOnError(
  dispatcher: PluginDispatcher | undefined,
  state: HarnessStateType,
  err: unknown,
): Promise<void> {
  if (!dispatcher) return;
  const message = err instanceof Error ? err.message : String(err);
  try {
    await dispatcher.onError({
      sessionId: state.sessionId ?? '',
      runId: state.runId ?? '',
      error: err instanceof Error ? err : new Error(message),
      phase: 'unknown',
    });
  } catch {
    /* plugin errors must not crash the graph */
  }
}

async function runEvaluator(
  evaluate: CriticEvaluator,
  state: HarnessStateType,
  dispatcher: PluginDispatcher | undefined,
): Promise<CriticVerdict> {
  try {
    return await evaluate(state);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.warn('evaluator failed, defaulting to accept', { error: message });
    await notifyDispatcherOnError(dispatcher, state, err);
    return { verdict: 'accept', reasons: [`evaluator error: ${message}`] };
  }
}

function buildVerdictTrace(
  verdict: CriticVerdict,
  nextIterations: number,
  capReached: boolean,
): TraceEvent[] {
  return [
    {
      type: 'critic_verdict',
      iterations: nextIterations,
      verdict: verdict.verdict,
      reasons: verdict.reasons,
      capReached,
    },
  ];
}

async function emitVerdictThinking(
  emitter: OutputEmitter | undefined,
  verdict: CriticVerdict,
  nextIterations: number,
  cap: number,
): Promise<void> {
  const label = verdict.verdict === 'accept' ? 'accept' : 'revise';
  await safeEmit(emitter, {
    type: 'thinking',
    content: `Critic: ${label} (${nextIterations}/${cap}) — ${summariseReasons(verdict.reasons)}`,
  });
}

function buildCritiqueText(reasons: string[]): string {
  return `<critique>\n${summariseReasons(reasons)}\n</critique>`;
}

export function createCriticNode(options: CriticNodeOptions = {}) {
  const evaluate = options.evaluate ?? defaultEvaluate;
  const { emitter, dispatcher } = options;

  return async (state: HarnessStateType): Promise<Partial<HarnessStateType>> => {
    const cap = resolveCriticCap(state);
    const nextIterations = (state.iterations ?? 0) + 1;
    const verdict = await runEvaluator(evaluate, state, dispatcher);
    const capReached = verdict.verdict === 'revise' && nextIterations >= cap;
    await emitVerdictThinking(emitter, verdict, nextIterations, cap);
    const trace = buildVerdictTrace(verdict, nextIterations, capReached);

    if (verdict.verdict === 'accept') {
      return { iterations: 1, critique: '', trace };
    }

    const critique = buildCritiqueText(verdict.reasons);
    if (capReached) {
      await safeEmit(emitter, {
        type: 'error',
        code: 'CRITIC_CAP_REACHED',
        message: `Critic iteration cap (${cap}) reached without acceptance.`,
      });
      return { iterations: 1, critique, trace };
    }

    return {
      iterations: 1,
      critique,
      messages: [{ role: 'system', content: critique }],
      trace,
    };
  };
}
