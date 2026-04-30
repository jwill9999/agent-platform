'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, CircleAlert, CircleCheck, CircleSlash, Wrench } from 'lucide-react';

import type { ToolTraceEvent } from '@/hooks/use-harness-chat';
import { cn } from '@/lib/cn';

type Props = Readonly<{
  events: readonly ToolTraceEvent[];
  isStreaming: boolean;
}>;

const STATUS_LABELS: Record<'success' | 'error' | 'denied', string> = {
  success: 'Completed',
  error: 'Needs review',
  denied: 'Denied',
};

function formatToolResultPreview(data: unknown, maxLen = 2000): string {
  if (typeof data === 'string') return data.length > maxLen ? `${data.slice(0, maxLen)}...` : data;
  try {
    const value = JSON.stringify(data, null, 2);
    return value.length > maxLen ? `${value.slice(0, maxLen)}\n... (truncated)` : value;
  } catch {
    return String(data);
  }
}

function eventTitle(event: ToolTraceEvent): string {
  if (event.type === 'status') return event.label;
  if (event.type === 'error') return event.code ? `${event.code}` : 'Tool error';
  return event.toolId;
}

function eventStatus(event: ToolTraceEvent): 'success' | 'error' | 'denied' | 'running' {
  if (event.type === 'status') return 'running';
  if (event.type === 'error') return 'error';
  return event.status;
}

function StatusIcon({ status }: Readonly<{ status: ReturnType<typeof eventStatus> }>) {
  if (status === 'success') return <CircleCheck className="h-3.5 w-3.5 text-emerald-600" />;
  if (status === 'denied') return <CircleSlash className="h-3.5 w-3.5 text-amber-600" />;
  if (status === 'error') return <CircleAlert className="h-3.5 w-3.5 text-amber-600" />;
  return <Wrench className="h-3.5 w-3.5 text-muted-foreground" />;
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

  const finalStatus = events.some((event) => eventStatus(event) === 'error')
    ? 'error'
    : events.some((event) => eventStatus(event) === 'denied')
      ? 'denied'
      : 'success';
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
            const status = eventStatus(event);
            return (
              <li
                key={`${eventTitle(event)}-${index}`}
                className="rounded border border-border/70 bg-background p-2"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <StatusIcon status={status} />
                  <span className="truncate font-medium">{eventTitle(event)}</span>
                  {event.type === 'result' && (
                    <span
                      className={cn(
                        'ml-auto rounded px-1.5 py-0.5 text-[11px]',
                        event.status === 'success' && 'bg-emerald-50 text-emerald-700',
                        event.status === 'error' && 'bg-amber-50 text-amber-700',
                        event.status === 'denied' && 'bg-amber-50 text-amber-700',
                      )}
                    >
                      {STATUS_LABELS[event.status]}
                    </span>
                  )}
                </div>
                {event.type === 'error' && (
                  <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{event.message}</p>
                )}
                {event.type === 'result' && (
                  <pre className="mt-2 max-h-48 overflow-auto rounded bg-muted/50 p-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
                    {formatToolResultPreview(event.data)}
                  </pre>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </details>
  );
}
