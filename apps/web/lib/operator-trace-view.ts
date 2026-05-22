import type { ToolTraceEvent } from '@/hooks/use-harness-chat';
import { summarizeBrowserToolResult } from '@/lib/browser-tool-results';
import { isRecord, stringValue } from '@/lib/operator-display-utils';
import { displayToolEvent, type OperatorToolEventStatus } from '@/lib/operator-tool-event-display';

export type OperatorTraceEntry = {
  id: string;
  sequence: number;
  kind: 'status' | 'result' | 'error';
  label: string;
  status: OperatorToolEventStatus;
  statusLabel: string;
  target?: string;
  toolId?: string;
  traceId?: string;
  policy?: string;
  errorCode?: string;
  errorMessage?: string;
  artifactCount: number;
  payload: string;
  redacted: boolean;
};

function eventKind(event: ToolTraceEvent): OperatorTraceEntry['kind'] {
  if (event.type === 'status') return 'status';
  if (event.type === 'error') return 'error';
  return 'result';
}

function stableEntryId(event: ToolTraceEvent, sequence: number): string {
  if (event.type === 'result') return `${sequence}-${event.toolId}`;
  if (event.type === 'error') return `${sequence}-${event.code ?? 'tool-error'}`;
  return `${sequence}-status`;
}

function traceIdFromPayload(payload: unknown): string | undefined {
  if (!isRecord(payload)) return undefined;
  const metadata = isRecord(payload.metadata) ? payload.metadata : undefined;
  return (
    stringValue(payload.traceId) ??
    stringValue(payload.trace_id) ??
    stringValue(payload.trace) ??
    stringValue(metadata?.traceId) ??
    stringValue(metadata?.trace_id)
  );
}

export function createTraceEntries(events: readonly ToolTraceEvent[]): OperatorTraceEntry[] {
  return events.map((event, index) => {
    const sequence = index + 1;
    const display = displayToolEvent(event);
    const browserSummary = event.type === 'result' ? summarizeBrowserToolResult(event.data) : null;
    return {
      id: stableEntryId(event, sequence),
      sequence,
      kind: eventKind(event),
      label: display.label,
      status: display.status,
      statusLabel: display.statusLabel,
      target: display.target,
      toolId: event.type === 'result' ? event.toolId : undefined,
      traceId: event.type === 'result' ? traceIdFromPayload(event.data) : undefined,
      policy: browserSummary?.policy,
      errorCode: event.type === 'error' ? event.code : undefined,
      errorMessage: event.type === 'error' ? event.message : browserSummary?.error,
      artifactCount: display.artifacts.length,
      payload: display.details?.payload ?? '',
      redacted: display.details?.redacted ?? false,
    };
  });
}

export function traceSummary(entries: readonly OperatorTraceEntry[]): string {
  if (entries.length === 0) return 'No trace events captured';
  const failed = entries.filter((entry) => entry.status === 'failed').length;
  const blocked = entries.filter(
    (entry) =>
      entry.status === 'blocked' ||
      entry.status === 'approval_required' ||
      entry.status === 'capability_missing' ||
      entry.status === 'provider_required' ||
      entry.status === 'approval_escalation' ||
      entry.status === 'sandbox_available',
  ).length;
  const artifacts = entries.reduce((count, entry) => count + entry.artifactCount, 0);
  const parts = [`${entries.length} event${entries.length === 1 ? '' : 's'}`];
  if (failed > 0) parts.push(`${failed} failed`);
  if (blocked > 0) parts.push(`${blocked} gated`);
  if (artifacts > 0) parts.push(`${artifacts} artifact${artifacts === 1 ? '' : 's'}`);
  return parts.join(' · ');
}
