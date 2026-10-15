'use client';
import { useState } from 'react';
import type { GitDeliveryReceipt } from '@agent-platform/contracts';
import type {
  ApprovalCardState,
  ApprovalDecisionHandler,
  ToolTraceEvent,
} from '@/hooks/use-harness-chat';
import { gitApprovalReceipt } from '@/lib/git-chat-receipts';
import { Button } from '@/components/ui/button';
import { GitApprovalCard, GitRecoveryCard } from './git-approval-card';

/** One shared page bounds saved-receipt reads across every turn and recovery-only record. */
export function GitChatHistory(
  props: Readonly<{
    approvals: readonly { approval: ApprovalCardState; toolEvents?: readonly ToolTraceEvent[] }[];
    recoveryReceipts: readonly GitDeliveryReceipt[];
    projectId?: string | null;
    sessionId?: string | null;
    onDecision?: ApprovalDecisionHandler;
    onReceiptChange?: (receipt: GitDeliveryReceipt) => void;
    onReceiptDeleted?: (receipt: GitDeliveryReceipt) => void;
  }>,
) {
  const [olderPages, setOlderPages] = useState(0);
  const entries = [
    ...props.approvals.map((entry) => ({
      key: entry.approval.approvalRequestId,
      createdAt:
        gitApprovalReceipt(entry.approval.toolName, entry.approval.argsPreview)?.createdAtMs ?? 0,
      entry,
      receipt: null,
    })),
    ...props.recoveryReceipts.map((receipt) => ({
      key: receipt.id,
      createdAt: receipt.createdAtMs,
      entry: null,
      receipt,
    })),
  ].sort((a, b) => a.createdAt - b.createdAt || a.key.localeCompare(b.key));
  if (!entries.length) return null;
  const page = Math.min(olderPages, Math.floor((entries.length - 1) / 10));
  const end = entries.length - page * 10;
  const start = Math.max(0, end - 10);
  return (
    <section aria-label="Git reviews and retained outcomes" className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <p role="status">
          Git records {start + 1}–{end} of {entries.length}
        </p>
        <Button
          type="button"
          variant="outline"
          disabled={start === 0}
          onClick={() => setOlderPages(page + 1)}
        >
          Older Git records
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={page === 0}
          onClick={() => setOlderPages(page - 1)}
        >
          Newer Git records
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={start === 0}
          onClick={() => setOlderPages(Math.floor((entries.length - 1) / 10))}
        >
          Oldest Git records
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={page === 0}
          onClick={() => setOlderPages(0)}
        >
          Latest Git records
        </Button>
      </div>
      {entries
        .slice(start, end)
        .map(({ key, entry, receipt }) =>
          entry ? (
            <GitApprovalCard
              key={key}
              approval={entry.approval}
              toolEvents={entry.toolEvents}
              projectId={props.projectId}
              sessionId={props.sessionId}
              onDecision={props.onDecision}
              onReceiptChange={props.onReceiptChange}
              onReceiptDeleted={props.onReceiptDeleted}
            />
          ) : receipt ? (
            <GitRecoveryCard
              key={key}
              recoveryReceipt={receipt}
              onReceiptDeleted={props.onReceiptDeleted}
              projectId={props.projectId}
              sessionId={props.sessionId}
            />
          ) : null,
        )}
    </section>
  );
}
