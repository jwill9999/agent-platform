'use client';

import { Check, RefreshCw, AlertTriangle } from 'lucide-react';

import { cn } from '@/lib/cn';
import { formatCriticBadgeLabel, type CriticEvent } from '@/lib/critic-events';

interface CriticBadgeProps {
  readonly event: CriticEvent;
}

interface CriticBadgesProps {
  readonly events: readonly CriticEvent[];
}

function badgeIcon(event: CriticEvent) {
  switch (event.kind) {
    case 'revise':
      return <RefreshCw className="h-3 w-3" aria-hidden="true" />;
    case 'accept':
      return <Check className="h-3 w-3" aria-hidden="true" />;
    case 'cap_reached':
      return <AlertTriangle className="h-3 w-3" aria-hidden="true" />;
  }
}

function badgeClasses(event: CriticEvent): string {
  switch (event.kind) {
    case 'revise':
      return 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-800';
    case 'accept':
      return 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-800';
    case 'cap_reached':
      return 'bg-red-100 text-red-900 border-red-300 dark:bg-red-950/40 dark:text-red-200 dark:border-red-800';
  }
}

export function CriticBadge({ event }: CriticBadgeProps) {
  return (
    <span
      data-testid="critic-badge"
      data-critic-kind={event.kind}
      title={event.reasons || undefined}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium',
        badgeClasses(event),
      )}
    >
      {badgeIcon(event)}
      <span>{formatCriticBadgeLabel(event)}</span>
    </span>
  );
}

export function CriticBadges({ events }: CriticBadgesProps) {
  if (events.length === 0) return null;
  return (
    <div
      data-testid="critic-badges"
      className="mb-2 flex flex-wrap gap-1.5"
      aria-label="Critic iterations"
    >
      {events.map((ev, i) => (
        <CriticBadge key={`${ev.kind}-${ev.iteration ?? i}-${i}`} event={ev} />
      ))}
    </div>
  );
}
