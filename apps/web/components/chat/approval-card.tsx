'use client';

import { Check, CircleAlert, Clock, Play, ShieldAlert, X } from 'lucide-react';

import type { ApprovalCardState, ApprovalDecision } from '@/hooks/use-harness-chat';
import { cn } from '@/lib/cn';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

type Props = Readonly<{
  approval: ApprovalCardState;
  onDecision?: (approvalRequestId: string, decision: ApprovalDecision) => void;
}>;

const statusLabels: Record<ApprovalCardState['status'], string> = {
  pending: 'Pending',
  approving: 'Approving',
  rejecting: 'Rejecting',
  approved: 'Approved',
  rejected: 'Rejected',
  expired: 'Expired',
  executed: 'Executed',
  failed: 'Failed',
};

function previewArgs(value: unknown): string {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function isBusy(status: ApprovalCardState['status']) {
  return status === 'approving' || status === 'rejecting';
}

function canDecide(status: ApprovalCardState['status']) {
  return status === 'pending' || status === 'failed';
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

  return (
    <section
      className="mt-3 rounded-lg border border-amber-300/70 bg-amber-50/80 p-3 text-sm text-amber-950 shadow-sm dark:border-amber-800/70 dark:bg-amber-950/20 dark:text-amber-100"
      aria-label={`Approval required for ${approval.toolName}`}
      data-testid="approval-card"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <ShieldAlert className="h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" />
          <div className="min-w-0">
            <div className="font-medium leading-tight">Approval required</div>
            <div className="truncate font-mono text-xs text-amber-900/80 dark:text-amber-100/80">
              {approval.toolName}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {approval.riskTier && (
            <Badge variant="outline" className="border-amber-500/50 bg-background/60 uppercase">
              {approval.riskTier}
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
            {statusLabels[approval.status]}
          </Badge>
        </div>
      </div>

      {approval.message && (
        <p className="mt-2 text-xs leading-relaxed text-amber-900/80 dark:text-amber-100/80">
          {approval.message}
        </p>
      )}

      <pre className="mt-3 max-h-40 overflow-auto rounded-md border border-amber-200/70 bg-background/80 p-2 text-xs text-foreground">
        {previewArgs(approval.argsPreview)}
      </pre>

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
            Reject
          </Button>
        </div>
      )}
    </section>
  );
}
