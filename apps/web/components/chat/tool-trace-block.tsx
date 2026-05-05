'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, CircleAlert, CircleCheck, CircleSlash, Wrench } from 'lucide-react';

import type { ToolTraceEvent } from '@/hooks/use-harness-chat';
import { cn } from '@/lib/cn';
import { formatFileSize } from '@/lib/workspace-files';
import {
  displayToolEvent,
  type OperatorToolEventDisplay,
  type OperatorToolEventStatus,
} from '@/lib/operator-tool-event-display';

type Props = Readonly<{
  events: readonly ToolTraceEvent[];
  isStreaming: boolean;
}>;

function eventStatus(event: ToolTraceEvent): OperatorToolEventStatus {
  return displayToolEvent(event).status;
}

function StatusIcon({ status }: Readonly<{ status: OperatorToolEventStatus }>) {
  if (status === 'completed') {
    return <CircleCheck className="h-3.5 w-3.5 text-emerald-600" />;
  }
  if (status === 'denied') return <CircleSlash className="h-3.5 w-3.5 text-amber-600" />;
  if (
    status === 'failed' ||
    status === 'blocked' ||
    status === 'approval_required' ||
    status === 'unavailable'
  ) {
    return <CircleAlert className="h-3.5 w-3.5 text-amber-600" />;
  }
  return <Wrench className="h-3.5 w-3.5 text-muted-foreground" />;
}

function statusBadgeClass(status: OperatorToolEventStatus): string {
  return cn(
    'ml-auto rounded px-1.5 py-0.5 text-[11px]',
    status === 'completed' && 'bg-emerald-50 text-emerald-700',
    status === 'failed' && 'bg-destructive/10 text-destructive',
    (status === 'denied' ||
      status === 'blocked' ||
      status === 'approval_required' ||
      status === 'unavailable') &&
      'bg-amber-50 text-amber-700',
    status === 'running' && 'bg-muted text-muted-foreground',
  );
}

function ArtifactSummary({ display }: Readonly<{ display: OperatorToolEventDisplay }>) {
  if (display.artifacts.length === 0) return null;
  return (
    <div className="mt-2 flex flex-col gap-1 rounded border border-border/70 bg-muted/40 p-2">
      {display.artifacts.map((artifact) => (
        <div key={artifact.id} className="flex min-w-0 items-center gap-2 text-[11px]">
          <span className="truncate text-foreground">{artifact.label}</span>
          <span className="text-muted-foreground">{artifact.kind}</span>
          <span className="text-muted-foreground">{formatFileSize(artifact.sizeBytes)}</span>
          {artifact.truncated && <span className="text-amber-700">truncated</span>}
          {artifact.downloadHref && (
            <a
              href={artifact.downloadHref}
              className="ml-auto text-primary underline-offset-2 hover:underline"
            >
              Open
            </a>
          )}
        </div>
      ))}
    </div>
  );
}

function TechnicalDetails({ display }: Readonly<{ display: OperatorToolEventDisplay }>) {
  if (!display.details) return null;
  return (
    <details className="mt-2 rounded border border-border/70 bg-muted/30">
      <summary className="cursor-pointer px-2 py-1 text-[11px] font-medium text-muted-foreground">
        Technical details
        {display.details.redacted ? ' · redacted' : ''}
      </summary>
      <pre className="max-h-48 overflow-auto border-t border-border/70 p-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
        {display.details.payload}
      </pre>
    </details>
  );
}

export function ToolTraceBlock({ events, isStreaming }: Props) {
  const [open, setOpen] = useState(isStreaming);
  const wasStreaming = useRef(isStreaming);

  useEffect(() => {
    if (isStreaming) {
      setOpen(true);
    } else if (wasStreaming.current) {
      setOpen(false);
    }
    wasStreaming.current = isStreaming;
  }, [isStreaming]);

  if (events.length === 0) return null;

  const finalStatus = events.some((event) => eventStatus(event) === 'failed')
    ? 'failed'
    : events.some((event) => eventStatus(event) === 'denied')
      ? 'denied'
      : 'completed';
  const summary =
    events.length === 1
      ? '1 tool event'
      : `${events.length} tool event${events.length === 1 ? '' : 's'}`;

  return (
    <details
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      className="group my-3 rounded-md border border-border bg-muted/30 text-xs text-foreground"
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2">
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform group-open:rotate-180" />
        <StatusIcon status={isStreaming ? 'running' : finalStatus} />
        <span className="font-medium">{isStreaming ? 'Working with tools' : 'Tool activity'}</span>
        <span className="text-muted-foreground">{summary}</span>
      </summary>
      <div className="border-t border-border px-3 py-2">
        <ol className="space-y-2">
          {events.map((event, index) => {
            const display = displayToolEvent(event);
            return (
              <li
                key={`${display.label}-${index}`}
                className="rounded border border-border/70 bg-background p-2"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <StatusIcon status={display.status} />
                  <span className="truncate font-medium">{display.label}</span>
                  <span className={statusBadgeClass(display.status)}>{display.statusLabel}</span>
                </div>
                <p className="mt-1 text-muted-foreground">{display.summary}</p>
                {display.target && (
                  <p className="mt-0.5 break-all text-[11px] text-muted-foreground">
                    {display.target}
                  </p>
                )}
                {display.reason && (
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{display.reason}</p>
                )}
                <ArtifactSummary display={display} />
                <TechnicalDetails display={display} />
              </li>
            );
          })}
        </ol>
      </div>
    </details>
  );
}
