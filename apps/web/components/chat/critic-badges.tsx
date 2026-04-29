'use client';

import { Check, RefreshCw, AlertTriangle } from 'lucide-react';

import { cn } from '@/lib/cn';
import { formatCriticBadgeLabel, type CriticEvent } from '@/lib/critic-events';

/**
 * Returns only the final accept event from the critic events array, or null if none.
 * Suppresses cap_reached and revise events from display.
 */
function getFinalAcceptEvent(events: readonly CriticEvent[]): CriticEvent | null {
  // Find the last accept event (if any)
  for (let i = events.length - 1; i >= 0; --i) {
    if (events[i]?.kind === 'accept') return events[i]!;
  }
  return null;
}

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
  const finalAccept = getFinalAcceptEvent(events);
  if (!finalAccept) return null;
  return (
    <div
      data-testid="critic-badges"
      className="mb-2 flex flex-wrap gap-1.5"
      aria-label="Critic review"
    >
      <CriticBadge key={`accept-${finalAccept.iteration ?? 0}`} event={finalAccept} />
    </div>
  );
}

/**
 * CriticReviewBlock: renders the critic review summary and score (if present) from the final accept event.
 */
export function CriticReviewBlock({ event }: { readonly event: CriticEvent }) {
  if (!event || event.kind !== 'accept') return null;
  return (
    <div className="mt-3 mb-2 rounded-lg border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 p-3">
      <div className="font-semibold text-emerald-900 dark:text-emerald-200 mb-1">Critic Review</div>
      {Boolean(event.reasons && event.reasons.length > 0) && (
        <div className="text-sm text-emerald-900 dark:text-emerald-200">{event.reasons}</div>
      )}
    </div>
  );
}
