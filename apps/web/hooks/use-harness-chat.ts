'use client';

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { UIMessage } from 'ai';
import { z } from 'zod';
import { gitApprovalReceipt, isGitDeliveryTool, gitReceiptBinding } from '@/lib/git-chat-receipts';
import {
  type DiagnosticPartialFailure,
  type ApprovalRequest,
  type ApprovalRequestStatus,
  type CapabilityRecovery,
  type MessageRecord,
  type WorkspaceEvent,
  ApprovalRequestSchema,
  GitDeliveryReceiptSchema,
  type GitDeliveryReceipt,
  WorkspaceEventSchema,
} from '@agent-platform/contracts';
import { apiPath, apiPost } from '@/lib/apiClient';
import { observeChatResponse, partialChatFailure } from '@/lib/chat-diagnostics';
import { parseCriticContent, type CriticEvent } from '@/lib/critic-events';

export type { CriticEvent } from '@/lib/critic-events';

const THINKING_PLACEHOLDER = 'The agent is thinking…';
const THINKING_REVISE_PLACEHOLDER = 'The agent is revising…';
function removeMessageEntry<T>(previous: Record<string, T>, messageId: string): Record<string, T> {
  if (!(messageId in previous)) return previous;
  const next = { ...previous };
  delete next[messageId];
  return next;
}

function clearThinkingPlaceholder(previous: Record<string, string>, messageId: string) {
  const current = previous[messageId];
  if (current === THINKING_PLACEHOLDER || current === THINKING_REVISE_PLACEHOLDER)
    return removeMessageEntry(previous, messageId);
  return previous;
}

const CREDENTIAL_PATTERNS: readonly RegExp[] = [
  /sk-(?:proj-|svcacct-)?[A-Za-z0-9_*.-]{20,}/g,
  /(ghp|gho|ghu|ghs|ghr)_\w{36,}/g,
  /Bearer\s+[A-Za-z0-9_\-.~+/]{20,}/g,
];

function redactDisplayText(text: string): string {
  return CREDENTIAL_PATTERNS.reduce(
    (current, pattern) => current.replace(pattern, '[REDACTED:CREDENTIAL]'),
    text,
  );
}

function friendlyChatErrorMessage(message: string): string {
  const redacted = redactDisplayText(message);
  if (/messages with role ['"]tool['"].*tool_calls/i.test(redacted)) {
    return 'The agent could not continue because the conversation tool state is out of sync. Start a new Project chat or retry after preparing Project instructions.';
  }
  if (/ENOENT: no such file or directory.*AGENTS\.md/i.test(redacted)) {
    return 'Project instructions are missing. Run /init or use Generate AGENTS.md before asking the agent to edit Project files.';
  }
  if (/^Invalid request body$/i.test(redacted)) {
    return 'The agent request could not be sent because the chat payload was invalid. Retry the message, or start a new Project chat if it persists.';
  }
  return redacted;
}

function failedRunMessage(errorMessage: string): string {
  return `The agent run failed before returning a response.\n\n${friendlyChatErrorMessage(errorMessage)}`;
}

function finalAssistantText(text: string, errorMessage: string | null): string {
  return text.trim() || !errorMessage ? text : failedRunMessage(errorMessage);
}

function makeTextParts(text: string): NonNullable<UIMessage['parts']> {
  return [{ type: 'text', text }];
}

function uiMessage(id: string, role: 'user' | 'assistant', text: string): UIMessage {
  return {
    id,
    role,
    content: text,
    parts: makeTextParts(text),
  };
}

function messageRecordToUi(m: MessageRecord): UIMessage | null {
  if (m.role !== 'user' && m.role !== 'assistant') return null;
  return uiMessage(m.id, m.role, m.content);
}

// ---------------------------------------------------------------------------
// NDJSON stream event types
// ---------------------------------------------------------------------------

interface StreamEvent {
  type: string;
  content?: string;
  text?: string;
  message?: string;
  reason?: string;
  toolId?: string;
  data?: unknown;
  language?: string;
  code?: string;
  mimeType?: string;
  approvalRequestId?: string;
  toolName?: string;
  riskTier?: string;
  argsPreview?: unknown;
  recovery?: unknown;
  event?: unknown;
}

export type ApprovalRequiredStreamEvent = {
  type: 'approval_required';
  approvalRequestId: string;
  toolName: string;
  riskTier?: string;
  argsPreview: unknown;
  message?: string;
};

export type ApprovalCardStatus =
  | 'pending'
  | 'approving'
  | 'rejecting'
  | 'approved'
  | 'rejected'
  | 'expired'
  | 'executed'
  | 'not_completed'
  | 'failed';

export type ApprovalCardState = ApprovalRequiredStreamEvent & {
  status: ApprovalCardStatus;
  error?: string;
};

export type ApprovalDecision = 'approve' | 'reject';

export type ToolTraceEvent =
  | { type: 'status'; label: string }
  | { type: 'result'; toolId: string; data: unknown; status: 'success' | 'error' | 'denied' }
  | { type: 'error'; code?: string; message: string; recovery?: CapabilityRecovery };

/** Terminal MCP failures cannot be replayed through the same approval card. */
export function mcpApprovalHaltMessage(event: ToolTraceEvent): string | null {
  if (event.type !== 'error') return null;
  if (event.code === 'MCP_OUTCOME_UNKNOWN')
    return 'The MCP action may have taken effect, but its result was not confirmed. Inspect the server before starting a new request. This approval cannot be retried.';
  if (event.code === 'MCP_APPROVAL_STALE')
    return 'The MCP connection or assignment changed. This action was not run. Start a new request and review its permissions.';
  return null;
}

async function mcpApprovalHaltFromResponse(response: Response): Promise<string | null> {
  const failure: unknown = await response
    .clone()
    .json()
    .catch(() => null);
  if (!isRecord(failure) || !isRecord(failure.error)) return null;
  return mcpApprovalHaltMessage({
    type: 'error',
    code: typeof failure.error.code === 'string' ? failure.error.code : undefined,
    message: '',
  });
}

const BLOCKING_APPROVAL_STATUSES = new Set<ApprovalCardStatus>([
  'pending',
  'approving',
  'rejecting',
  'failed',
]);

function parseStreamEvent(line: string): StreamEvent | null {
  if (!line.trim()) return null;
  let ev: unknown;
  try {
    ev = JSON.parse(line);
  } catch {
    return null;
  }
  if (typeof ev !== 'object' || ev === null || !('type' in ev)) return null;
  return ev as StreamEvent;
}

function extractTextDelta(o: StreamEvent): string {
  if (typeof o.content === 'string') return o.content;
  if (typeof o.text === 'string') return o.text;
  return '';
}

function isDodSummaryText(text: string): boolean {
  return /^\s*DoD:\s*\d+\/\d+\s+criteria\s+met\s*$/i.test(text.trim());
}

function parseToolStatusText(text: string): ToolTraceEvent | null {
  const trimmed = text.trim();
  if (!/^Calling tools?:/i.test(trimmed)) return null;
  return { type: 'status', label: trimmed };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toolResultStatus(data: unknown): 'success' | 'error' | 'denied' {
  if (!isRecord(data)) return 'success';
  if (data.ok === false) {
    const evidence = data.evidence;
    return isRecord(evidence) && evidence.status === 'denied' ? 'denied' : 'error';
  }
  if ('error' in data) return 'error';
  if (typeof data.exitCode === 'number' && data.exitCode !== 0) return 'error';
  return 'success';
}

function isRecoverableToolErrorCode(code: unknown): code is string {
  if (typeof code !== 'string') return false;
  if (code === 'MODEL_AUTH_FAILED' || code === 'DOD_FAILED' || code === 'CRITIC_CAP_REACHED') {
    return false;
  }
  return (
    code === 'INVALID_ARGS' ||
    code === 'CONTENT_TOO_LARGE' ||
    code === 'PATH_ACCESS_DENIED' ||
    code === 'BASH_COMMAND_BLOCKED' ||
    code === 'QUALITY_GATE_DENIED' ||
    code.endsWith('_UNAVAILABLE') ||
    code.endsWith('_FAILED') ||
    code.startsWith('TOOL_') ||
    code.startsWith('MCP_') ||
    code.startsWith('NATIVE_')
  );
}

function parseCapabilityRecovery(value: unknown): CapabilityRecovery | undefined {
  if (!isRecord(value)) return undefined;
  const status = value.status;
  const summary = value.summary;
  const options = Array.isArray(value.options) ? value.options : [];
  if (
    status !== 'capability_missing' &&
    status !== 'provider_required' &&
    status !== 'approval_escalation' &&
    status !== 'sandbox_available'
  ) {
    return undefined;
  }
  if (typeof summary !== 'string' || summary.trim().length === 0) return undefined;
  const parsedOptions = options.flatMap((option): CapabilityRecovery['options'] => {
    if (!isRecord(option)) return [];
    const { id, label, action } = option;
    if (typeof id !== 'string' || typeof label !== 'string') return [];
    if (
      action !== 'approve' &&
      action !== 'connect' &&
      action !== 'sandbox' &&
      action !== 'manual' &&
      action !== 'cancel'
    ) {
      return [];
    }
    return [{ id, label, action }];
  });
  return { status, summary, options: parsedOptions };
}

function renderErrorEvent(o: StreamEvent): StreamRenderResult {
  if (typeof o.message !== 'string') return null;
  const { code } = o;
  const message = redactDisplayText(o.message);
  if (code === 'CRITIC_CAP_REACHED') {
    return { critic: { kind: 'cap_reached', reasons: message } };
  }
  if (code === 'DOD_FAILED') {
    return { critic: { kind: 'cap_reached', reasons: message } };
  }
  if (code === 'APPROVAL_REJECTED') {
    return { text: `\n\n[${code}] ${message}\n` };
  }
  if (code === 'MODEL_AUTH_FAILED') {
    return { error: friendlyChatErrorMessage(message) };
  }
  if (isRecoverableToolErrorCode(code)) {
    const recovery = parseCapabilityRecovery(o.recovery);
    return { toolTrace: { type: 'error', code, message, ...(recovery ? { recovery } : {}) } };
  }
  return { error: friendlyChatErrorMessage(message) };
}

export type StreamRenderResult =
  | { text: string }
  | { error: string }
  | { critic: CriticEvent }
  | { thinking: string }
  | { toolTrace: ToolTraceEvent }
  | { workspaceEvent: WorkspaceEvent }
  | { approvalRequired: ApprovalRequiredStreamEvent }
  | null;

type StreamAssistantResult = {
  text: string;
  errorMessage: string | null;
  mcpHaltMessage: string | null;
};

type NdjsonStreamHandlers = {
  onText: (chunk: string) => void;
  onError: (msg: string) => void;
  onCritic: (event: CriticEvent) => void;
  onThinking: (chunk: string) => void;
  onToolTrace: (event: ToolTraceEvent) => void;
  onWorkspaceEvent: (event: WorkspaceEvent) => void;
  onApprovalRequired: (event: ApprovalRequiredStreamEvent) => void;
};

function renderThinkingEvent(o: StreamEvent): StreamRenderResult {
  if (typeof o.content !== 'string') return null;
  const critic = parseCriticContent(o.content.trimStart());
  if (critic) return { critic };
  return { thinking: o.content };
}

function renderTextEvent(o: StreamEvent): StreamRenderResult {
  const text = extractTextDelta(o);
  if (!text) return null;
  if (isDodSummaryText(text)) return null;
  const toolStatus = parseToolStatusText(text);
  if (toolStatus) return { toolTrace: toolStatus };
  const critic = parseCriticContent(text.trimStart());
  if (critic) return { critic };
  return { text };
}

function renderCodeEvent(o: StreamEvent): StreamRenderResult {
  if (typeof o.content !== 'string') return null;
  const lang = typeof o.language === 'string' ? o.language : '';
  return { text: `\n\`\`\`${lang}\n${o.content}\n\`\`\`\n` };
}

function renderImageEvent(o: StreamEvent): StreamRenderResult {
  return typeof o.data === 'string' && typeof o.mimeType === 'string'
    ? { text: `\n\n![screenshot](data:${o.mimeType};base64,${o.data})\n\n` }
    : null;
}

function renderToolResultEvent(o: StreamEvent): StreamRenderResult {
  if (typeof o.toolId !== 'string') return null;
  return {
    toolTrace: {
      type: 'result',
      toolId: o.toolId,
      data: o.data,
      status: toolResultStatus(o.data),
    },
  };
}

function renderApprovalRequiredEvent(o: StreamEvent): StreamRenderResult {
  if (typeof o.approvalRequestId !== 'string' || typeof o.toolName !== 'string') return null;
  return {
    approvalRequired: {
      type: 'approval_required',
      approvalRequestId: o.approvalRequestId,
      toolName: o.toolName,
      argsPreview: o.argsPreview,
      ...(typeof o.riskTier === 'string' ? { riskTier: o.riskTier } : {}),
      ...(typeof o.message === 'string' ? { message: o.message } : {}),
    },
  };
}

function renderWorkspaceEvent(o: StreamEvent): StreamRenderResult {
  const parsed = WorkspaceEventSchema.safeParse(o.event);
  return parsed.success ? { workspaceEvent: parsed.data } : null;
}

export function renderStreamEvent(o: StreamEvent): StreamRenderResult {
  switch (o.type) {
    case 'text':
      return renderTextEvent(o);
    case 'thinking':
      return renderThinkingEvent(o);
    case 'code':
      return renderCodeEvent(o);
    case 'image':
      return renderImageEvent(o);
    case 'tool_result':
      return renderToolResultEvent(o);
    case 'error':
      return renderErrorEvent(o);
    case 'approval_required':
      return renderApprovalRequiredEvent(o);
    case 'workspace_event':
      return renderWorkspaceEvent(o);
    default:
      return null;
  }
}

async function parseErrorResponse(res: Response): Promise<string> {
  let msg = `Chat failed (${res.status})`;
  const raw = await res.text();
  try {
    const j = JSON.parse(raw) as { error?: { message?: string } };
    if (j.error?.message) msg = j.error.message;
  } catch {
    if (raw.trim()) msg = raw.slice(0, 500);
  }
  return msg;
}

async function readNdjsonStream(
  body: ReadableStream<Uint8Array>,
  handlers: NdjsonStreamHandlers,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const processLine = (line: string) => {
    const ev = parseStreamEvent(line);
    if (!ev) return;
    const result = renderStreamEvent(ev);
    if (!result) return;
    if ('text' in result) handlers.onText(result.text);
    else if ('thinking' in result) handlers.onThinking(result.thinking);
    else if ('toolTrace' in result) handlers.onToolTrace(result.toolTrace);
    else if ('workspaceEvent' in result) handlers.onWorkspaceEvent(result.workspaceEvent);
    else if ('critic' in result) handlers.onCritic(result.critic);
    else if ('approvalRequired' in result) handlers.onApprovalRequired(result.approvalRequired);
    else handlers.onError(result.error);
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) processLine(line);
  }
  if (buffer.trim()) processLine(buffer);
}

function parseApprovalArgs(argsJson: string): unknown {
  try {
    return JSON.parse(argsJson);
  } catch {
    return argsJson;
  }
}

function approvalStatusFromRecord(status: ApprovalRequestStatus): ApprovalCardStatus {
  if (status === 'approved') return 'approved';
  if (status === 'rejected') return 'rejected';
  if (status === 'expired') return 'expired';
  return 'pending';
}

function approvalFromRecord(request: ApprovalRequest): ApprovalCardState {
  return {
    type: 'approval_required',
    approvalRequestId: request.id,
    toolName: request.toolName,
    riskTier: request.riskTier,
    argsPreview: parseApprovalArgs(request.argsJson),
    status:
      request.resumedAtMs && !isGitDeliveryTool(request.toolName)
        ? 'executed'
        : approvalStatusFromRecord(request.status),
  };
}

export function mergeApprovalEvent(
  existing: readonly ApprovalCardState[],
  event: ApprovalRequiredStreamEvent,
): ApprovalCardState[] {
  const next: ApprovalCardState = { ...event, status: 'pending' };
  const index = existing.findIndex(
    (approval) => approval.approvalRequestId === event.approvalRequestId,
  );
  if (index === -1) return [...existing, next];
  return existing.map((approval, i) => (i === index ? { ...approval, ...next } : approval));
}

function updateApprovalStatus(
  approvals: readonly ApprovalCardState[],
  approvalRequestId: string,
  status: ApprovalCardStatus,
  error?: string,
): ApprovalCardState[] {
  return approvals.map((approval) =>
    approval.approvalRequestId === approvalRequestId
      ? { ...approval, status, ...(error ? { error } : { error: undefined }) }
      : approval,
  );
}

export function hasBlockingApprovalEvents(
  approvalsByMessage: Record<string, readonly ApprovalCardState[]>,
): boolean {
  return Object.values(approvalsByMessage).some((approvals) =>
    approvals.some((approval) => {
      if (!BLOCKING_APPROVAL_STATUSES.has(approval.status)) return false;
      if (!isGitDeliveryTool(approval.toolName)) return true;
      const receipt = gitApprovalReceipt(approval.toolName, approval.argsPreview);
      return receipt === null || (receipt.state === 'prepared' && receipt.expiresAtMs > Date.now());
    }),
  );
}

// ---------------------------------------------------------------------------
// Session-owned lifecycle
// ---------------------------------------------------------------------------

export type ChatRestorationStatus = 'unbound' | 'restoring' | 'ready' | 'restore-error';
export type ChatAdmission =
  | {
      accepted: false;
      reason:
        | 'unbound'
        | 'restoring'
        | 'restore-error'
        | 'busy'
        | 'pending-approval'
        | 'empty'
        | 'invalid-approval';
    }
  | { accepted: true; completion: Promise<void>; isCurrent: () => boolean };

export type ApprovalDecisionHandler = (
  approvalRequestId: string,
  decision: ApprovalDecision,
) => ChatAdmission | void;

type ChatView = {
  selection: symbol;
  epoch: number;
  messages: UIMessage[];
  status: 'ready' | 'streaming';
  error: string | null;
  diagnosticRequestId: string | null;
  diagnosticFailure: DiagnosticPartialFailure | null;
  criticEventsByMessage: Record<string, CriticEvent[]>;
  thinkingByMessage: Record<string, string>;
  toolEventsByMessage: Record<string, ToolTraceEvent[]>;
  workspaceEventsByMessage: Record<string, WorkspaceEvent[]>;
  approvalEventsByMessage: Record<string, ApprovalCardState[]>;
  gitRecoveryReceipts: GitDeliveryReceipt[];
  restorationStatus: ChatRestorationStatus;
  restorationError: string | null;
};
type ChatOperation = { busy: boolean };
type ChatGeneration = {
  sessionId: string | null;
  selection: symbol;
  epoch: number;
  active: boolean;
  operation: ChatOperation | null;
  state: ChatView;
};
type PublishChat = (update: (previous: ChatView) => ChatView) => void;
const RESTORE_FAILURE = 'Conversation history could not be restored. Retry history before sending.';
const RESTORE_TIMEOUT = 'Conversation history took too long to load. Retry history before sending.';
const RESTORE_DEADLINE_MS = 15_000;

function emptyChatView(selection: symbol, epoch: number, status: ChatRestorationStatus): ChatView {
  return {
    selection,
    epoch,
    messages: [],
    status: 'ready',
    error: null,
    diagnosticRequestId: null,
    diagnosticFailure: null,
    criticEventsByMessage: {},
    thinkingByMessage: {},
    toolEventsByMessage: {},
    workspaceEventsByMessage: {},
    approvalEventsByMessage: {},
    gitRecoveryReceipts: [],
    restorationStatus: status,
    restorationError: null,
  };
}

function initialRestorationStatus(
  sessionId: string | null,
  resume: boolean,
): ChatRestorationStatus {
  if (!sessionId) return 'unbound';
  return resume ? 'restoring' : 'ready';
}

function createChatGeneration(sessionId: string | null, resume: boolean): ChatGeneration {
  const selection = Symbol('chat-selection');
  return {
    sessionId,
    selection,
    epoch: 0,
    active: false,
    operation: null,
    state: emptyChatView(selection, 0, initialRestorationStatus(sessionId, resume)),
  };
}

async function restoredRecords<T>(path: string, signal: AbortSignal): Promise<T[]> {
  const response = await fetch(path, { cache: 'no-store', signal });
  if (!response.ok) throw new Error(RESTORE_FAILURE);
  const body = await response.text();
  if (!body.trim()) return [];
  const data: unknown = (JSON.parse(body) as { data?: unknown }).data;
  if (!Array.isArray(data)) throw new Error(RESTORE_FAILURE);
  return data as T[];
}

const PublicGitApprovalSchema = ApprovalRequestSchema.omit({ executionPayloadJson: true }).extend({
  executionPayloadJson: z.null().optional(),
});
const GitRestorationSchema = z
  .object({
    approvals: z.array(PublicGitApprovalSchema).max(1000),
    recoveryReceipts: z.array(GitDeliveryReceiptSchema).max(1000),
  })
  .strict();

async function restoredGitRecords(sessionId: string, signal: AbortSignal) {
  const params = new URLSearchParams({ sessionId });
  const response = await fetch(`${apiPath('approval-requests', 'git-delivery')}?${params}`, {
    cache: 'no-store',
    signal,
  });
  if (!response.ok) throw new Error(RESTORE_FAILURE);
  const envelope: unknown = await response.json();
  const parsed = GitRestorationSchema.safeParse(
    envelope && typeof envelope === 'object' && 'data' in envelope ? envelope.data : undefined,
  );
  if (!parsed.success || parsed.data.approvals.length + parsed.data.recoveryReceipts.length > 1000)
    throw new Error(RESTORE_FAILURE);
  const receiptIds = new Set<string>();
  const approvalIds = new Set<string>();
  const approvals: ApprovalRequest[] = [];
  for (const record of parsed.data.approvals) {
    const receipt = gitApprovalReceipt(
      record.toolName,
      parseApprovalArgs(record.argsJson),
      sessionId,
    );
    if (
      record.sessionId !== sessionId ||
      !receipt ||
      receiptIds.has(receipt.id) ||
      approvalIds.has(record.id)
    )
      throw new Error(RESTORE_FAILURE);
    receiptIds.add(receipt.id);
    approvalIds.add(record.id);
    approvals.push(ApprovalRequestSchema.omit({ executionPayloadJson: true }).parse(record));
  }
  for (const receipt of parsed.data.recoveryReceipts) {
    if (receipt.source !== 'chat' || receipt.sessionId !== sessionId || receiptIds.has(receipt.id))
      throw new Error(RESTORE_FAILURE);
    receiptIds.add(receipt.id);
  }
  return { approvals, recoveryReceipts: parsed.data.recoveryReceipts };
}

async function restoreChatSnapshot(sessionId: string, signal: AbortSignal) {
  const params = new URLSearchParams({ sessionId, status: 'pending' });
  const [records, pendingApprovals, retainedGit] = await Promise.all([
    restoredRecords<MessageRecord>(apiPath('sessions', sessionId, 'messages'), signal),
    restoredRecords<ApprovalRequest>(`${apiPath('approval-requests')}?${params}`, signal),
    restoredGitRecords(sessionId, signal),
  ]);
  // Retained operations are authoritative for Git. Pending history may contain deleted ghosts.
  const approvals = [
    ...new Map(
      [
        ...pendingApprovals.filter((record) => !isGitDeliveryTool(record.toolName)),
        ...retainedGit.approvals,
      ].map((record) => [record.id, record]),
    ).values(),
  ];
  const messages = records.map(messageRecordToUi).filter((m): m is UIMessage => m !== null);
  const approvalEventsByMessage: Record<string, ApprovalCardState[]> = {};
  if (approvals.length) {
    let assistant = [...messages].reverse().find((message) => message.role === 'assistant');
    if (!assistant) {
      assistant = uiMessage(`restored-approvals:${sessionId}`, 'assistant', '');
      messages.push(assistant);
    }
    approvalEventsByMessage[assistant.id] = approvals.map(approvalFromRecord);
  }
  return { messages, approvalEventsByMessage, gitRecoveryReceipts: retainedGit.recoveryReceipts };
}

function appendChatEvent<T>(previous: Record<string, T[]>, id: string, event: T) {
  return { ...previous, [id]: [...(previous[id] ?? []), event] };
}

function publishApprovalStatus(
  publish: PublishChat,
  requestId: string,
  status: ApprovalCardStatus,
  error?: string,
) {
  publish((previous) => ({
    ...previous,
    approvalEventsByMessage: Object.fromEntries(
      Object.entries(previous.approvalEventsByMessage).map(([id, approvals]) => [
        id,
        updateApprovalStatus(approvals, requestId, status, error),
      ]),
    ),
  }));
}

async function streamOwnedResponse(
  assistantId: string,
  body: ReadableStream<Uint8Array>,
  publish: PublishChat,
): Promise<StreamAssistantResult> {
  let accumulated = '';
  let streamErrorMessage: string | null = null;
  let mcpHaltMessage: string | null = null;
  let pendingRevisionReset = false;
  // Obsolete streams are still drained: losing display ownership is not server cancellation.
  await readNdjsonStream(body, {
    onText: (chunk) => {
      if (!chunk) return;
      accumulated = pendingRevisionReset ? chunk : accumulated + chunk;
      pendingRevisionReset = false;
    },
    onError: (message) => {
      streamErrorMessage = message;
      publish((previous) => ({ ...previous, error: message }));
    },
    onCritic: (event) => {
      pendingRevisionReset = event.kind === 'revise' || pendingRevisionReset;
      publish((previous) => ({
        ...previous,
        criticEventsByMessage: appendChatEvent(previous.criticEventsByMessage, assistantId, event),
        thinkingByMessage:
          event.kind === 'revise'
            ? { ...previous.thinkingByMessage, [assistantId]: THINKING_REVISE_PLACEHOLDER }
            : previous.thinkingByMessage,
      }));
    },
    onThinking: (chunk) => {
      if (!chunk) return;
      publish((previous) => {
        const current = previous.thinkingByMessage[assistantId] ?? '';
        const text =
          current === THINKING_PLACEHOLDER || current === THINKING_REVISE_PLACEHOLDER
            ? chunk
            : current + chunk;
        return {
          ...previous,
          thinkingByMessage: { ...previous.thinkingByMessage, [assistantId]: text },
        };
      });
    },
    onToolTrace: (event) => {
      mcpHaltMessage = mcpApprovalHaltMessage(event) ?? mcpHaltMessage;
      publish((previous) => ({
        ...previous,
        toolEventsByMessage: appendChatEvent(previous.toolEventsByMessage, assistantId, event),
      }));
    },
    onWorkspaceEvent: (event) =>
      publish((previous) => ({
        ...previous,
        workspaceEventsByMessage: appendChatEvent(
          previous.workspaceEventsByMessage,
          assistantId,
          event,
        ),
      })),
    onApprovalRequired: (event) =>
      publish((previous) => ({
        ...previous,
        approvalEventsByMessage: {
          ...previous.approvalEventsByMessage,
          [assistantId]: mergeApprovalEvent(
            previous.approvalEventsByMessage[assistantId] ?? [],
            event,
          ),
        },
      })),
  });
  return { text: accumulated, errorMessage: streamErrorMessage, mcpHaltMessage };
}

function publishAssistant(publish: PublishChat, assistantId: string, text: string) {
  publish((previous) => ({
    ...previous,
    messages: previous.messages.map((message) =>
      message.id === assistantId ? uiMessage(assistantId, 'assistant', text) : message,
    ),
  }));
}

async function runOwnedSend(
  sessionId: string,
  assistantId: string,
  trimmed: string,
  modelConfigId: string | null | undefined,
  publish: PublishChat,
) {
  const observedAtMs = Date.now();
  const started = performance.now();
  let requestId = crypto.randomUUID();
  let apiObserved = false;
  let responseStatus: number | undefined;
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        message: trimmed,
        ...(modelConfigId ? { modelConfigId } : {}),
      }),
    });
    ({ requestId, apiObserved, responseStatus } = observeChatResponse(response, requestId));
    if (apiObserved && !response.ok)
      publish((previous) => ({ ...previous, diagnosticRequestId: requestId }));
    if (!response.ok) throw new Error(await parseErrorResponse(response));
    if (!response.body) throw new Error('No response body');
    const result = await streamOwnedResponse(assistantId, response.body, publish);
    publishAssistant(publish, assistantId, finalAssistantText(result.text, result.errorMessage));
    publish((previous) => ({
      ...previous,
      thinkingByMessage: clearThinkingPlaceholder(previous.thinkingByMessage, assistantId),
    }));
  } catch (error) {
    const failure = partialChatFailure({
      requestId,
      observedAtMs,
      durationMs: performance.now() - started,
      apiObserved,
      responseStatus,
    });
    publish((previous) => ({
      ...previous,
      diagnosticFailure: failure ?? previous.diagnosticFailure,
      error: friendlyChatErrorMessage(error instanceof Error ? error.message : String(error)),
      messages: previous.messages.filter((message) => message.id !== assistantId),
      criticEventsByMessage: removeMessageEntry(previous.criticEventsByMessage, assistantId),
      thinkingByMessage: removeMessageEntry(previous.thinkingByMessage, assistantId),
      toolEventsByMessage: removeMessageEntry(previous.toolEventsByMessage, assistantId),
      workspaceEventsByMessage: removeMessageEntry(previous.workspaceEventsByMessage, assistantId),
      approvalEventsByMessage: removeMessageEntry(previous.approvalEventsByMessage, assistantId),
    }));
  }
}

async function runOwnedApproval(
  sessionId: string,
  assistantId: string,
  requestId: string,
  decision: ApprovalDecision,
  modelConfigId: string | null | undefined,
  publish: PublishChat,
) {
  let mcpHaltMessage: string | null = null;
  try {
    await apiPost<ApprovalRequest>(apiPath('approval-requests', requestId, decision), {});
    publishApprovalStatus(publish, requestId, decision === 'approve' ? 'approved' : 'rejected');
    const response = await fetch(apiPath('sessions', sessionId, 'resume'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(modelConfigId ? { 'x-model-config-id': modelConfigId } : {}),
      },
      body: JSON.stringify({ approvalRequestId: requestId }),
    });
    if (!response.ok) {
      mcpHaltMessage = await mcpApprovalHaltFromResponse(response);
      throw new Error(await parseErrorResponse(response));
    }
    let accumulated = '';
    if (response.body && !response.headers.get('content-type')?.includes('application/json')) {
      const result = await streamOwnedResponse(assistantId, response.body, publish);
      mcpHaltMessage = result.mcpHaltMessage;
      accumulated = finalAssistantText(result.text, result.errorMessage);
    }
    publishAssistant(publish, assistantId, accumulated);
    const completedStatus = decision === 'approve' ? 'executed' : 'rejected';
    publishApprovalStatus(
      publish,
      requestId,
      mcpHaltMessage ? 'not_completed' : completedStatus,
      mcpHaltMessage ?? undefined,
    );
    publish((previous) => ({
      ...previous,
      thinkingByMessage: removeMessageEntry(previous.thinkingByMessage, assistantId),
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    publishApprovalStatus(
      publish,
      requestId,
      mcpHaltMessage ? 'not_completed' : 'failed',
      mcpHaltMessage ?? message,
    );
    publish((previous) => ({
      ...previous,
      error: message,
      messages: previous.messages.filter((item) => item.id !== assistantId),
      thinkingByMessage: removeMessageEntry(previous.thinkingByMessage, assistantId),
      toolEventsByMessage: removeMessageEntry(previous.toolEventsByMessage, assistantId),
      workspaceEventsByMessage: removeMessageEntry(previous.workspaceEventsByMessage, assistantId),
    }));
  }
}

/** Session restoration and accepted operations publish only to their current selection epoch. */
export function useHarnessChat(sessionId: string | null, resume = false) {
  const [retryVersion, setRetryVersion] = useState(0);
  const generation = useMemo(
    () => createChatGeneration(sessionId, resume),
    [sessionId, resume, retryVersion],
  );
  const current = useRef<ChatGeneration | null>(null);
  const [storedView, setStoredView] = useState<ChatView>(generation.state);

  const makePublisher = useCallback(
    (owner: ChatGeneration, epoch: number, operation?: ChatOperation) => {
      const isCurrent = () =>
        current.current === owner &&
        owner.active &&
        owner.epoch === epoch &&
        (!operation || owner.operation === operation);
      const publish: PublishChat = (update) => {
        if (!isCurrent()) return;
        owner.state = update(owner.state);
        setStoredView(owner.state);
      };
      return { isCurrent, publish };
    },
    [],
  );

  useLayoutEffect(() => {
    current.current = generation;
    generation.active = true;
    generation.epoch += 1;
    generation.operation = null;
    const { publish } = makePublisher(generation, generation.epoch);
    const status = initialRestorationStatus(sessionId, resume);
    publish(() => emptyChatView(generation.selection, generation.epoch, status));
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let timedOut = false;
    if (sessionId && resume) {
      const deadline = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          timedOut = true;
          controller.abort();
          reject(new Error(RESTORE_TIMEOUT));
        }, RESTORE_DEADLINE_MS);
      });
      void Promise.race([restoreChatSnapshot(sessionId, controller.signal), deadline])
        .then((snapshot) =>
          publish((previous) => ({ ...previous, ...snapshot, restorationStatus: 'ready' })),
        )
        .catch(() =>
          publish((previous) => ({
            ...previous,
            restorationStatus: 'restore-error',
            restorationError: timedOut ? RESTORE_TIMEOUT : RESTORE_FAILURE,
          })),
        )
        .finally(() => {
          clearTimeout(timer);
          controller.abort();
        });
    }
    return () => {
      generation.active = false;
      if (current.current === generation) current.current = null;
      clearTimeout(timer);
      controller.abort();
    };
  }, [generation, makePublisher, sessionId, resume]);

  const refusal = (): Extract<ChatAdmission, { accepted: false }> | null => {
    if (!sessionId || current.current !== generation || !generation.active)
      return { accepted: false, reason: 'unbound' };
    if (generation.state.restorationStatus !== 'ready')
      return {
        accepted: false,
        reason:
          generation.state.restorationStatus === 'restore-error' ? 'restore-error' : 'restoring',
      };
    if (generation.operation?.busy) return { accepted: false, reason: 'busy' };
    return null;
  };

  const startOperation = (run: (publish: PublishChat) => Promise<void>): ChatAdmission => {
    const operation: ChatOperation = { busy: true };
    generation.operation = operation;
    const { isCurrent, publish } = makePublisher(generation, generation.epoch, operation);
    publish((previous) => ({ ...previous, status: 'streaming', error: null }));
    const completion = run(publish).finally(() => {
      if (!isCurrent()) return;
      operation.busy = false;
      publish((previous) => ({ ...previous, status: 'ready' }));
    });
    return { accepted: true, completion, isCurrent };
  };

  const sendMessage = (
    messageForApi: string,
    displayText?: string,
    modelConfigId?: string | null,
  ): ChatAdmission => {
    const denied = refusal();
    if (denied) return denied;
    const trimmed = messageForApi.trim();
    if (!trimmed) return { accepted: false, reason: 'empty' };
    if (hasBlockingApprovalEvents(generation.state.approvalEventsByMessage))
      return { accepted: false, reason: 'pending-approval' };
    const assistantId = crypto.randomUUID();
    return startOperation(async (publish) => {
      publish((previous) => ({
        ...previous,
        messages: [
          ...previous.messages,
          uiMessage(crypto.randomUUID(), 'user', displayText ?? trimmed),
          uiMessage(assistantId, 'assistant', ''),
        ],
        thinkingByMessage: { ...previous.thinkingByMessage, [assistantId]: THINKING_PLACEHOLDER },
        diagnosticRequestId: null,
        diagnosticFailure: null,
      }));
      await runOwnedSend(sessionId!, assistantId, trimmed, modelConfigId, publish);
    });
  };

  const decideApproval = (
    requestId: string,
    decision: ApprovalDecision,
    modelConfigId?: string | null,
  ): ChatAdmission => {
    const denied = refusal();
    if (denied) return denied;
    const approval = Object.values(generation.state.approvalEventsByMessage)
      .flat()
      .find((item) => item.approvalRequestId === requestId);
    if (!approval || !['pending', 'failed'].includes(approval.status))
      return { accepted: false, reason: 'invalid-approval' };
    const assistantId = crypto.randomUUID();
    return startOperation(async (publish) => {
      publishApprovalStatus(publish, requestId, decision === 'approve' ? 'approving' : 'rejecting');
      publish((previous) => ({
        ...previous,
        messages: [...previous.messages, uiMessage(assistantId, 'assistant', '')],
        thinkingByMessage: { ...previous.thinkingByMessage, [assistantId]: THINKING_PLACEHOLDER },
      }));
      await runOwnedApproval(sessionId!, assistantId, requestId, decision, modelConfigId, publish);
    });
  };

  const retryHistory = () => {
    if (
      current.current !== generation ||
      !generation.active ||
      generation.state.restorationStatus !== 'restore-error'
    )
      return;
    generation.active = false;
    setRetryVersion((version) => version + 1);
  };
  const setError = (error: string | null) =>
    makePublisher(generation, generation.epoch).publish((previous) => ({ ...previous, error }));
  const updateGitReceipt = useCallback(
    (value: GitDeliveryReceipt) => {
      const parsed = GitDeliveryReceiptSchema.safeParse(value);
      if (
        !parsed.success ||
        parsed.data.source !== 'chat' ||
        parsed.data.sessionId !== generation.sessionId
      )
        return;
      const receipt = parsed.data;
      const { publish } = makePublisher(generation, generation.epoch);
      publish((previous) => {
        let changed = false;
        const approvalEventsByMessage = Object.fromEntries(
          Object.entries(previous.approvalEventsByMessage).map(([id, approvals]) => [
            id,
            approvals.map((approval) => {
              const prior = gitApprovalReceipt(
                approval.toolName,
                approval.argsPreview,
                generation.sessionId ?? undefined,
              );
              if (
                !prior ||
                gitReceiptBinding(prior) !== gitReceiptBinding(receipt) ||
                receipt.updatedAtMs < prior.updatedAtMs ||
                JSON.stringify(prior) === JSON.stringify(receipt)
              )
                return approval;
              changed = true;
              return { ...approval, argsPreview: { gitDeliveryReceipt: receipt } };
            }),
          ]),
        );
        return changed ? { ...previous, approvalEventsByMessage } : previous;
      });
    },
    [generation, makePublisher],
  );
  const removeGitReceipt = useCallback(
    (receipt: GitDeliveryReceipt) => {
      if (receipt.source !== 'chat' || receipt.sessionId !== generation.sessionId) return;
      const matches = (prior: GitDeliveryReceipt | null) =>
        prior !== null &&
        gitReceiptBinding(prior) === gitReceiptBinding(receipt) &&
        receipt.updatedAtMs >= prior.updatedAtMs;
      makePublisher(generation, generation.epoch).publish((previous) => ({
        ...previous,
        approvalEventsByMessage: Object.fromEntries(
          Object.entries(previous.approvalEventsByMessage).map(([id, approvals]) => [
            id,
            approvals.filter(
              (approval) => !matches(gitApprovalReceipt(approval.toolName, approval.argsPreview)),
            ),
          ]),
        ),
        gitRecoveryReceipts: previous.gitRecoveryReceipts.filter((prior) => !matches(prior)),
      }));
    },
    [generation, makePublisher],
  );
  const view =
    storedView.selection === generation.selection && storedView.epoch === generation.epoch
      ? storedView
      : generation.state;
  useLayoutEffect(() => {
    const now = Date.now();
    const expiries = Object.values(view.approvalEventsByMessage)
      .flat()
      .flatMap((approval) => {
        if (!BLOCKING_APPROVAL_STATUSES.has(approval.status)) return [];
        const receipt = gitApprovalReceipt(approval.toolName, approval.argsPreview);
        return receipt?.state === 'prepared' && receipt.expiresAtMs > now
          ? [receipt.expiresAtMs]
          : [];
      });
    if (!expiries.length) return;
    const { publish } = makePublisher(generation, generation.epoch);
    const timer = setTimeout(
      () => publish((previous) => ({ ...previous })),
      Math.min(Math.min(...expiries) - now, 2_147_483_647),
    );
    return () => clearTimeout(timer);
  }, [generation, makePublisher, view]);
  const hasPendingApproval = hasBlockingApprovalEvents(view.approvalEventsByMessage);
  const canSend =
    generation.active &&
    current.current === generation &&
    view.restorationStatus === 'ready' &&
    view.status === 'ready' &&
    !hasPendingApproval;
  return {
    ...view,
    sendMessage,
    decideApproval,
    setError,
    hasPendingApproval,
    canSend,
    retryHistory,
    updateGitReceipt,
    removeGitReceipt,
  };
}
