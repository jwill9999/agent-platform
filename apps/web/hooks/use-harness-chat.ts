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

const BLOCKING_APPROVAL_STATUSES = new Set<ApprovalCardStatus>([
  'pending',
  'approving',
  'rejecting',
  'failed',
]);

function formatToolResultPreview(data: unknown, maxLen = 6000): string {
  if (typeof data === 'string') return data.length > maxLen ? `${data.slice(0, maxLen)}…` : data;
  try {
    const s = JSON.stringify(data, null, 2);
    return s.length > maxLen ? `${s.slice(0, maxLen)}\n… (truncated)` : s;
  } catch {
    return String(data);
  }
}

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

function renderErrorEvent(o: StreamEvent): StreamRenderResult {
  if (typeof o.message !== 'string') return null;
  const { code } = o;
  if (code === 'CRITIC_CAP_REACHED') {
    return { critic: { kind: 'cap_reached', reasons: o.message } };
  }
  if (code === 'APPROVAL_REJECTED') {
    return { text: `\n\n[${code}] ${o.message}\n` };
  }
  const isToolError =
    typeof code === 'string' &&
    (code.startsWith('TOOL_') || code.startsWith('MCP_') || code.startsWith('NATIVE_'));
  if (isToolError) return { text: `\n\n[${code}] ${o.message}\n` };
  return { error: o.message };
}

export type StreamRenderResult =
  | { text: string }
  | { error: string }
  | { critic: CriticEvent }
  | { thinking: string }
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
      const body = formatToolResultPreview(o.data);
      return { text: `\n\n**${o.toolId}**\n\`\`\`json\n${body}\n\`\`\`\n` };
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
      setApprovalEventsByMessage({});
      return;
    }
    if (!resumeRef.current) {
      setMessages([]);
      setCriticEventsByMessage({});
      setThinkingByMessage({});
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

        let accumulated = '';
        let pendingRevisionReset = false;
        await readNdjsonStream(
          res.body,
          (chunk) => {
            if (!chunk) return;
            if (pendingRevisionReset) {
              // Keep the previous draft visible until a new revision starts producing text.
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
              // A critic revise starts a fresh draft iteration; replace prior text.
              pendingRevisionReset = true;
              setThinkingByMessage((prev) => ({
                ...prev,
                [assistantId]: THINKING_REVISE_PLACEHOLDER,
              }));
            }
          },
          (chunk) => appendThinking(assistantId, chunk),
          (event) => appendApprovalRequired(assistantId, event),
        );

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
    [
      sessionId,
      hasPendingApproval,
      updateAssistantMessage,
      appendCriticEvent,
      appendThinking,
      appendApprovalRequired,
    ],
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
          await readNdjsonStream(
            res.body,
            (chunk) => {
              accumulated += chunk;
            },
            (msg) => setError(msg),
            (event) => appendCriticEvent(assistantId, event),
            (chunk) => appendThinking(assistantId, chunk),
            (event) => appendApprovalRequired(assistantId, event),
          );
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
      } finally {
        setStatus('ready');
      }
    },
    [
      sessionId,
      status,
      setApprovalStatus,
      updateAssistantMessage,
      appendCriticEvent,
      appendThinking,
      appendApprovalRequired,
    ],
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
    approvalEventsByMessage,
    hasPendingApproval,
  };
}
