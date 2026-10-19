import {
  ContextWindowSchema,
  type ContextDecisionMetadata,
  type ContextWindow,
} from '@agent-platform/contracts';
import type { ModelMessage } from 'ai';
import type { ChatMessage } from './types.js';

/** Versioned character estimate of the complete mapped request, including JSON escaping. */
export function estimateProviderInput(messages: ModelMessage[], tools: unknown): number {
  return Math.ceil(JSON.stringify({ messages, tools: tools ?? [] }).length / 4);
}

export function inferCurrentTurnStartIndex(messages: ChatMessage[]): number {
  for (let index = messages.length - 1; index >= 0; index--) {
    if (messages[index]?.role === 'user') return index;
  }
  return 0;
}

type Group = { start: number; indices: number[]; required: boolean; omitted: boolean };

/** Corroboration from actual same-session approval records, never from conversation text. */
export type ApprovalHistoryContext = {
  approvalToolCallIds?: readonly string[];
  pendingApprovalToolCallIds?: readonly string[];
};

type HistoryIndex = {
  messages: ChatMessage[];
  resultIndices: Map<string, number[]>;
  seenCalls: Set<string>;
  consumedResults: Set<number>;
  approvalCalls: Set<string>;
  pendingCalls: Set<string>;
  boundary: number;
};

function indexHistory(
  messages: ChatMessage[],
  boundary: number,
  approvals: ApprovalHistoryContext,
): HistoryIndex {
  const resultIndices = new Map<string, number[]>();
  messages.forEach((message, index) => {
    if (message.role !== 'tool') return;
    const indices = resultIndices.get(message.toolCallId) ?? [];
    indices.push(index);
    resultIndices.set(message.toolCallId, indices);
  });
  return {
    messages,
    resultIndices,
    boundary,
    seenCalls: new Set(),
    consumedResults: new Set(),
    approvalCalls: new Set(approvals.approvalToolCallIds),
    pendingCalls: new Set(approvals.pendingApprovalToolCallIds),
  };
}

function matchingResult(
  history: HistoryIndex,
  start: number,
  id: string,
  name: string,
): number | null | undefined {
  if (!id || history.seenCalls.has(id)) return null;
  history.seenCalls.add(id);
  const indices = history.resultIndices.get(id) ?? [];
  if (indices.length === 0) return undefined;
  if (indices.length !== 1) return null;
  const index = indices[0]!;
  const result = history.messages[index];
  if (index <= start || result?.role !== 'tool' || result.toolName !== name) return null;
  return index;
}

function toolGroup(history: HistoryIndex, start: number): Group | null {
  const message = history.messages[start]!;
  const group: Group = {
    start,
    indices: [start],
    required: start >= history.boundary || message.role === 'system',
    omitted: false,
  };
  if (message.role !== 'assistant' || !message.toolCalls?.length) return group;
  const missing: string[] = [];
  const resultCalls = new Map<number, string>();
  for (const call of message.toolCalls) {
    const index = matchingResult(history, start, call.id, call.name);
    if (index === null) return null;
    if (index === undefined) missing.push(call.id);
    else resultCalls.set(index, call.id);
  }
  const results = [...resultCalls.keys()].sort((a, b) => a - b);
  // A delayed result is movable only for a call backed by a persisted approval.
  for (let offset = 0; offset < results.length; offset++) {
    const index = results[offset]!;
    if (index !== start + offset + 1 && !history.approvalCalls.has(resultCalls.get(index)!))
      return null;
  }
  group.required ||= results.some((index) => index >= history.boundary);
  if (missing.length > 0) {
    if (group.required || missing.some((id) => !history.pendingCalls.has(id))) return null;
    group.omitted = true;
  }
  group.indices.push(...results);
  for (const index of results) history.consumedResults.add(index);
  return group;
}

function groupHistory(
  messages: ChatMessage[],
  boundary: number,
  approvals: ApprovalHistoryContext,
): Group[] | null {
  const groups: Group[] = [];
  const history = indexHistory(messages, boundary, approvals);
  for (let start = 0; start < messages.length; start++) {
    if (history.consumedResults.has(start)) continue;
    if (messages[start]!.role === 'tool') return null;
    const group = toolGroup(history, start);
    if (!group) return null;
    groups.push(group);
  }
  return groups;
}

function selectedMessages(mapped: ModelMessage[], groups: Group[]): ModelMessage[] {
  return groups.flatMap(({ indices }) => indices.map((index) => mapped[index]!));
}

export type ProviderAdmission = {
  messages: ModelMessage[];
  decision: ContextDecisionMetadata;
  admitted: boolean;
};

/** Pure projection: never changes graph messages, tool arguments, or persistence offsets. */
export function admitProviderContext(
  input: {
    messages: ChatMessage[];
    mappedMessages: ModelMessage[];
    /** Final provider tool names/descriptions/JSON schemas, not AI SDK wrapper objects. */
    mappedTools: unknown;
    contextWindow?: ContextWindow;
    currentTurnStartIndex?: number;
  } & ApprovalHistoryContext,
): ProviderAdmission {
  const policy = ContextWindowSchema.parse(input.contextWindow ?? {});
  const boundary = input.currentTurnStartIndex ?? inferCurrentTurnStartIndex(input.messages);
  const before = estimateProviderInput(input.mappedMessages, input.mappedTools);
  const decision: ContextDecisionMetadata = {
    estimatorVersion: 'serialized_request_chars_v1',
    effectivePolicy: 'group_window_working_memory_v1',
    requestedStrategy: policy.strategy,
    configuredInputTokens: policy.maxInputTokens,
    effectiveInputTokens: Math.floor(policy.maxInputTokens * 0.9),
    estimatedInputBefore: before,
    estimatedInputAfter: before,
    schemaEstimate: Math.ceil(JSON.stringify(input.mappedTools ?? []).length / 4),
    includedGroups: 0,
    omittedGroups: 0,
    outputCap: policy.maxOutputTokens,
    reason: 'invalid_history',
  };
  const validBoundary =
    Number.isInteger(boundary) &&
    boundary >= 0 &&
    boundary < input.messages.length &&
    (input.currentTurnStartIndex === undefined || input.messages[boundary]?.role === 'user');
  const groups = validBoundary ? groupHistory(input.messages, boundary, input) : null;
  if (!groups || input.messages.length !== input.mappedMessages.length) {
    return { admitted: false, messages: [], decision };
  }
  let selected = groups.filter((group) => group.required);
  let messages = selectedMessages(input.mappedMessages, selected);
  let estimate = estimateProviderInput(messages, input.mappedTools);
  if (estimate <= decision.effectiveInputTokens) {
    const optional = groups.filter((group) => !group.required && !group.omitted).reverse();
    for (const group of optional) {
      const candidate = [...selected, group].sort((a, b) => a.start - b.start);
      const candidateMessages = selectedMessages(input.mappedMessages, candidate);
      const candidateEstimate = estimateProviderInput(candidateMessages, input.mappedTools);
      if (candidateEstimate > decision.effectiveInputTokens) break;
      selected = candidate;
      messages = candidateMessages;
      estimate = candidateEstimate;
    }
  }
  decision.estimatedInputAfter = estimate;
  decision.includedGroups = selected.length;
  decision.omittedGroups = groups.length - selected.length;
  if (estimate > decision.effectiveInputTokens) decision.reason = 'required_overflow';
  else decision.reason = decision.omittedGroups > 0 ? 'windowed' : 'unchanged';
  return { admitted: decision.reason !== 'required_overflow', messages, decision };
}
