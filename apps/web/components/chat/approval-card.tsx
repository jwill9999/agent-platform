'use client';

import { Check, CircleAlert, Clock, Info, Play, ShieldAlert, X } from 'lucide-react';

import type { ApprovalCardState, ApprovalDecision } from '@/hooks/use-harness-chat';
import { cn } from '@/lib/cn';
import { displayApproval } from '@/lib/operator-approval-display';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

type Props = Readonly<{
  approval: ApprovalCardState;
  onDecision?: (approvalRequestId: string, decision: ApprovalDecision) => void;
}>;

function isBusy(status: ApprovalCardState['status']) {
  return status === 'approving' || status === 'rejecting';
}

function canDecide(status: ApprovalCardState['status']) {
  return status === 'pending' || status === 'failed';
}

function cardTone(status: ApprovalCardState['status'], riskTier: string | undefined): string {
  if (status === 'failed' || status === 'rejected') {
    return 'border-destructive/45 bg-destructive/10 text-foreground';
  }
  if (status === 'executed' || status === 'approved') {
    return 'border-emerald-300/70 bg-emerald-50/80 text-emerald-950 dark:border-emerald-800/70 dark:bg-emerald-950/20 dark:text-emerald-100';
  }
  if (riskTier === 'critical' || riskTier === 'high') {
    return 'border-amber-400/80 bg-amber-50/90 text-amber-950 dark:border-amber-700/80 dark:bg-amber-950/25 dark:text-amber-100';
  }
  return 'border-border bg-muted/40 text-foreground';
}

function statusIcon(status: ApprovalCardState['status']) {
  if (status === 'executed') return <Play className="h-3.5 w-3.5" />;
  if (status === 'approved') return <Check className="h-3.5 w-3.5" />;
  if (status === 'rejected' || status === 'failed') return <X className="h-3.5 w-3.5" />;
  if (status === 'expired') return <Clock className="h-3.5 w-3.5" />;
  return <CircleAlert className="h-3.5 w-3.5" />;
}

export function ApprovalCard({ approval, onDecision }: Props) {
  const disabled = isBusy(approval.status);
  const showActions = canDecide(approval.status);
  const display = displayApproval(approval);

  return (
    <section
      className={cn(
        'mt-3 rounded-lg border p-3 text-sm shadow-sm',
        cardTone(approval.status, approval.riskTier),
      )}
      aria-label={display.title}
      data-testid="approval-card"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <ShieldAlert className="h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" />
          <div className="min-w-0">
            <div className="font-medium leading-tight">{display.title}</div>
            {display.target && (
              <div className="truncate text-xs text-muted-foreground">{display.target}</div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {display.riskLabel && (
            <Badge variant="outline" className="border-amber-500/50 bg-background/60 uppercase">
              {display.riskLabel}
            </Badge>
          )}
          <Badge
            variant="outline"
            className={cn(
              'gap-1 bg-background/60',
              approval.status === 'failed' || approval.status === 'rejected'
                ? 'border-destructive/50 text-destructive'
                : 'border-amber-500/50',
            )}
          >
            {statusIcon(approval.status)}
            {display.statusLabel}
          </Badge>
        </div>
      </div>

      <div className="mt-3 grid gap-2 rounded-md border border-border/70 bg-background/70 p-3 text-xs">
        <div className="flex gap-2">
          <Info className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <div>
            <div className="font-medium text-foreground">Why this needs approval</div>
            <p className="mt-0.5 text-muted-foreground">{display.reason}</p>
          </div>
        </div>
        <div className="grid gap-1 text-muted-foreground sm:grid-cols-2">
          <p>{display.allowText}</p>
          <p>{display.denyText}</p>
        </div>
      </div>

      <details className="mt-3 rounded-md border border-border/70 bg-background/60">
        <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-muted-foreground">
          Technical details
          {display.details.redacted ? ' · redacted' : ''}
        </summary>
        <pre className="max-h-40 overflow-auto border-t border-border/70 p-3 text-xs text-foreground">
          {display.details.payload}
        </pre>
      </details>

      {approval.error && (
        <p className="mt-2 text-xs leading-relaxed text-destructive" role="alert">
          {approval.error}
        </p>
      )}

      {showActions && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            onClick={() => onDecision?.(approval.approvalRequestId, 'approve')}
            disabled={disabled}
          >
            <Check className="h-4 w-4" />
            Approve
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onDecision?.(approval.approvalRequestId, 'reject')}
            disabled={disabled}
          >
            <X className="h-4 w-4" />
            Deny
          </Button>
        </div>
      )}
    </section>
  );
}
