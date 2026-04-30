'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { UIMessage } from 'ai';
import type {
  ApprovalRequest,
  ApprovalRequestStatus,
  MessageRecord,
} from '@agent-platform/contracts';
import { apiGet, apiPath, apiPost } from '@/lib/apiClient';
import { parseCriticContent, type CriticEvent } from '@/lib/critic-events';

export type { CriticEvent } from '@/lib/critic-events';

const THINKING_PLACEHOLDER = 'The agent is thinking…';
const THINKING_REVISE_PLACEHOLDER = 'The agent is revising…';
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
  | 'failed';

export type ApprovalCardState = ApprovalRequiredStreamEvent & {
  status: ApprovalCardStatus;
  error?: string;
};

export type ApprovalDecision = 'approve' | 'reject';

export type ToolTraceEvent =
  | { type: 'status'; label: string }
  | { type: 'result'; toolId: string; data: unknown; status: 'success' | 'error' | 'denied' }
  | { type: 'error'; code?: string; message: string };

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
    code.endsWith('_FAILED') ||
    code.startsWith('TOOL_') ||
    code.startsWith('MCP_') ||
    code.startsWith('NATIVE_')
  );
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
    return { error: message };
  }
  if (isRecoverableToolErrorCode(code)) return { toolTrace: { type: 'error', code, message } };
  return { error: message };
}

export type StreamRenderResult =
  | { text: string }
  | { error: string }
  | { critic: CriticEvent }
  | { thinking: string }
  | { toolTrace: ToolTraceEvent }
  | { approvalRequired: ApprovalRequiredStreamEvent }
  | null;

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

export function renderStreamEvent(o: StreamEvent): StreamRenderResult {
  switch (o.type) {
    case 'text':
      return renderTextEvent(o);
    case 'thinking':
      return renderThinkingEvent(o);
    case 'code': {
      if (typeof o.content !== 'string') return null;
      const lang = typeof o.language === 'string' ? o.language : '';
      return { text: `\n\`\`\`${lang}\n${o.content}\n\`\`\`\n` };
    }
    case 'image':
      return typeof o.data === 'string' && typeof o.mimeType === 'string'
        ? { text: `\n\n![screenshot](data:${o.mimeType};base64,${o.data})\n\n` }
        : null;
    case 'tool_result': {
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
    case 'error':
      return renderErrorEvent(o);
    case 'approval_required':
      return typeof o.approvalRequestId === 'string' && typeof o.toolName === 'string'
        ? {
            approvalRequired: {
              type: 'approval_required',
              approvalRequestId: o.approvalRequestId,
              toolName: o.toolName,
              argsPreview: o.argsPreview,
              ...(typeof o.riskTier === 'string' ? { riskTier: o.riskTier } : {}),
              ...(typeof o.message === 'string' ? { message: o.message } : {}),
            },
          }
        : null;
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
  onText: (chunk: string) => void,
  onError: (msg: string) => void,
  onCritic: (event: CriticEvent) => void,
  onThinking: (chunk: string) => void,
  onToolTrace: (event: ToolTraceEvent) => void,
  onApprovalRequired: (event: ApprovalRequiredStreamEvent) => void,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const processLine = (line: string) => {
    const ev = parseStreamEvent(line);
    if (!ev) return;
    const result = renderStreamEvent(ev);
    if (!result) return;
    if ('text' in result) onText(result.text);
    else if ('thinking' in result) onThinking(result.thinking);
    else if ('toolTrace' in result) onToolTrace(result.toolTrace);
    else if ('critic' in result) onCritic(result.critic);
    else if ('approvalRequired' in result) onApprovalRequired(result.approvalRequired);
    else onError(result.error);
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
    status: request.resumedAtMs ? 'executed' : approvalStatusFromRecord(request.status),
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
    approvals.some((approval) => BLOCKING_APPROVAL_STATUSES.has(approval.status)),
  );
}

async function listPendingApprovals(sessionId: string): Promise<ApprovalRequest[]> {
  const params = new URLSearchParams({ sessionId, status: 'pending' });
  const res = await fetch(`${apiPath('approval-requests')}?${params.toString()}`, {
    cache: 'no-store',
  });
  const text = await res.text();
  if (!res.ok) throw new Error(text || `Approval requests failed (${res.status})`);
  if (!text.trim()) return [];
  const json = JSON.parse(text) as { data?: ApprovalRequest[] };
  return json.data ?? [];
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Chat against the platform harness via `POST /api/chat` → `POST /v1/chat`
 * (NDJSON stream). When `sessionId` changes:
 * - If `resume` is true, fetches existing messages from the backend.
 * - Otherwise, starts with an empty message list (new session).
 */
export function useHarnessChat(sessionId: string | null, resume = false) {
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [status, setStatus] = useState<'ready' | 'streaming'>('ready');
  const [error, setError] = useState<string | null>(null);
  const [criticEventsByMessage, setCriticEventsByMessage] = useState<Record<string, CriticEvent[]>>(
    {},
  );
  const [thinkingByMessage, setThinkingByMessage] = useState<Record<string, string>>({});
  const [toolEventsByMessage, setToolEventsByMessage] = useState<Record<string, ToolTraceEvent[]>>(
    {},
  );
  const [approvalEventsByMessage, setApprovalEventsByMessage] = useState<
    Record<string, ApprovalCardState[]>
  >({});
  const hasPendingApproval = useMemo(
    () => hasBlockingApprovalEvents(approvalEventsByMessage),
    [approvalEventsByMessage],
  );
  const resumeRef = useRef(resume);
  resumeRef.current = resume;

  useEffect(() => {
    setError(null);
    if (!sessionId) {
      setMessages([]);
      setCriticEventsByMessage({});
      setThinkingByMessage({});
      setToolEventsByMessage({});
      setApprovalEventsByMessage({});
      return;
    }
    if (!resumeRef.current) {
      setMessages([]);
      setCriticEventsByMessage({});
      setThinkingByMessage({});
      setToolEventsByMessage({});
      setApprovalEventsByMessage({});
      return;
    }

    let cancelled = false;
    apiGet<MessageRecord[]>(apiPath('sessions', sessionId, 'messages'))
      .then((records) => {
        if (cancelled) return;
        const uiMsgs = (records ?? [])
          .map(messageRecordToUi)
          .filter((m): m is UIMessage => m !== null);
        setMessages(uiMsgs);
        return listPendingApprovals(sessionId).then((approvals) => ({ uiMsgs, approvals }));
      })
      .then((result) => {
        if (cancelled || !result) return;
        const assistant = [...result.uiMsgs]
          .reverse()
          .find((message) => message.role === 'assistant');
        if (!assistant || result.approvals.length === 0) return;
        setApprovalEventsByMessage((prev) => ({
          ...prev,
          [assistant.id]: result.approvals.map(approvalFromRecord),
        }));
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
          setMessages([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  // Extracted to keep sendMessage's nesting depth within 4 levels (sonar S2004).
  const updateAssistantMessage = useCallback((id: string, text: string) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? uiMessage(id, 'assistant', text) : m)));
  }, []);

  const appendCriticEvent = useCallback((id: string, event: CriticEvent) => {
    setCriticEventsByMessage((prev) => {
      const existing = prev[id] ?? [];
      return { ...prev, [id]: [...existing, event] };
    });
  }, []);

  const appendThinking = useCallback((id: string, chunk: string) => {
    if (!chunk) return;
    setThinkingByMessage((prev) => {
      const current = prev[id] ?? '';
      if (current === THINKING_PLACEHOLDER || current === THINKING_REVISE_PLACEHOLDER) {
        return { ...prev, [id]: chunk };
      }
      return { ...prev, [id]: current + chunk };
    });
  }, []);

  const appendToolTrace = useCallback((id: string, event: ToolTraceEvent) => {
    setToolEventsByMessage((prev) => {
      const existing = prev[id] ?? [];
      return { ...prev, [id]: [...existing, event] };
    });
  }, []);

  const appendApprovalRequired = useCallback((id: string, event: ApprovalRequiredStreamEvent) => {
    setApprovalEventsByMessage((prev) => {
      const existing = prev[id] ?? [];
      return { ...prev, [id]: mergeApprovalEvent(existing, event) };
    });
  }, []);

  const setApprovalStatus = useCallback(
    (approvalRequestId: string, status: ApprovalCardStatus, errorMessage?: string) => {
      setApprovalEventsByMessage((prev) => {
        const next = { ...prev };
        for (const [messageId, approvals] of Object.entries(next)) {
          if (approvals.some((approval) => approval.approvalRequestId === approvalRequestId)) {
            next[messageId] = updateApprovalStatus(
              approvals,
              approvalRequestId,
              status,
              errorMessage,
            );
          }
        }
        return next;
      });
    },
    [],
  );

  const streamAssistantResponse = useCallback(
    async (assistantId: string, body: ReadableStream<Uint8Array>): Promise<string> => {
      let accumulated = '';
      let pendingRevisionReset = false;
      await readNdjsonStream(
        body,
        (chunk) => {
          if (!chunk) return;
          if (pendingRevisionReset) {
            accumulated = chunk;
            pendingRevisionReset = false;
          } else {
            accumulated += chunk;
          }
        },
        (msg) => setError(msg),
        (event) => {
          appendCriticEvent(assistantId, event);
          if (event.kind === 'revise') {
            pendingRevisionReset = true;
            setThinkingByMessage((prev) => ({
              ...prev,
              [assistantId]: THINKING_REVISE_PLACEHOLDER,
            }));
          }
        },
        (chunk) => appendThinking(assistantId, chunk),
        (event) => appendToolTrace(assistantId, event),
        (event) => appendApprovalRequired(assistantId, event),
      );
      return accumulated;
    },
    [appendApprovalRequired, appendCriticEvent, appendThinking, appendToolTrace],
  );

  const sendMessage = useCallback(
    async (messageForApi: string, displayText?: string, modelConfigId?: string | null) => {
      const trimmed = messageForApi.trim();
      if (!sessionId || !trimmed || hasPendingApproval) return;

      const userVisible = displayText ?? trimmed;
      const assistantId = crypto.randomUUID();

      setMessages((prev) => [
        ...prev,
        uiMessage(crypto.randomUUID(), 'user', userVisible),
        uiMessage(assistantId, 'assistant', ''),
      ]);
      setThinkingByMessage((prev) => ({ ...prev, [assistantId]: THINKING_PLACEHOLDER }));
      setStatus('streaming');
      setError(null);

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            message: trimmed,
            ...(modelConfigId ? { modelConfigId } : {}),
          }),
        });

        if (!res.ok) throw new Error(await parseErrorResponse(res));
        if (!res.body) throw new Error('No response body');

        const accumulated = await streamAssistantResponse(assistantId, res.body);

        // Publish a single final answer for the turn after all revisions/streaming settle.
        updateAssistantMessage(assistantId, accumulated);
        setThinkingByMessage((prev) => {
          const current = prev[assistantId];
          if (current === THINKING_PLACEHOLDER || current === THINKING_REVISE_PLACEHOLDER) {
            const next = { ...prev };
            delete next[assistantId];
            return next;
          }
          return prev;
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setMessages((prev) => prev.filter((m) => m.id !== assistantId));
        setCriticEventsByMessage((prev) => {
          if (!(assistantId in prev)) return prev;
          const next = { ...prev };
          delete next[assistantId];
          return next;
        });
        setThinkingByMessage((prev) => {
          if (!(assistantId in prev)) return prev;
          const next = { ...prev };
          delete next[assistantId];
          return next;
        });
        setToolEventsByMessage((prev) => {
          if (!(assistantId in prev)) return prev;
          const next = { ...prev };
          delete next[assistantId];
          return next;
        });
        setApprovalEventsByMessage((prev) => {
          if (!(assistantId in prev)) return prev;
          const next = { ...prev };
          delete next[assistantId];
          return next;
        });
      } finally {
        setStatus('ready');
      }
    },
    [sessionId, hasPendingApproval, updateAssistantMessage, streamAssistantResponse],
  );

  const decideApproval = useCallback(
    async (
      approvalRequestId: string,
      decision: ApprovalDecision,
      modelConfigId?: string | null,
    ) => {
      if (!sessionId || status === 'streaming') return;
      const inFlightStatus = decision === 'approve' ? 'approving' : 'rejecting';
      const terminalStatus = decision === 'approve' ? 'executed' : 'rejected';
      setApprovalStatus(approvalRequestId, inFlightStatus);
      setStatus('streaming');
      setError(null);

      const assistantId = crypto.randomUUID();
      setMessages((prev) => [...prev, uiMessage(assistantId, 'assistant', '')]);
      setThinkingByMessage((prev) => ({ ...prev, [assistantId]: THINKING_PLACEHOLDER }));

      try {
        await apiPost<ApprovalRequest>(
          apiPath('approval-requests', approvalRequestId, decision),
          {},
        );
        setApprovalStatus(approvalRequestId, decision === 'approve' ? 'approved' : 'rejected');

        const res = await fetch(apiPath('sessions', sessionId, 'resume'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(modelConfigId ? { 'x-model-config-id': modelConfigId } : {}),
          },
          body: JSON.stringify({ approvalRequestId }),
        });
        if (!res.ok) throw new Error(await parseErrorResponse(res));

        let accumulated = '';
        if (res.body && !res.headers.get('content-type')?.includes('application/json')) {
          accumulated = await streamAssistantResponse(assistantId, res.body);
        }

        updateAssistantMessage(assistantId, accumulated);
        setApprovalStatus(approvalRequestId, terminalStatus);
        setThinkingByMessage((prev) => {
          const next = { ...prev };
          delete next[assistantId];
          return next;
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        setApprovalStatus(approvalRequestId, 'failed', message);
        setError(message);
        setMessages((prev) => prev.filter((m) => m.id !== assistantId));
        setThinkingByMessage((prev) => {
          const next = { ...prev };
          delete next[assistantId];
          return next;
        });
        setToolEventsByMessage((prev) => {
          if (!(assistantId in prev)) return prev;
          const next = { ...prev };
          delete next[assistantId];
          return next;
        });
      } finally {
        setStatus('ready');
      }
    },
    [sessionId, status, setApprovalStatus, updateAssistantMessage, streamAssistantResponse],
  );

  return {
    messages,
    sendMessage,
    decideApproval,
    status,
    error,
    setError,
    criticEventsByMessage,
    thinkingByMessage,
    toolEventsByMessage,
    approvalEventsByMessage,
    hasPendingApproval,
  };
}
