'use client';

import { useId, useState } from 'react';
import type { GitDeliveryAction, GitDeliveryReceipt } from '@agent-platform/contracts';
import { Button } from '@/components/ui/button';

export type GitDeliveryReceiptProps = Readonly<{
  receipt: GitDeliveryReceipt;
  nowMs: number;
  pending?: boolean;
  unverified?: boolean;
  onConfirm?: (id: string) => void;
  onCancel?: (id: string) => void;
  onReconcile?: (id: string) => void;
  onAcknowledge?: (id: string) => void;
  onDelete?: (id: string) => void;
}>;

function actionLabel(action: GitDeliveryAction): string {
  switch (action.kind) {
    case 'stage':
      return action.mode === 'stage' ? 'Stage selected files' : 'Unstage selected files';
    case 'commit':
      return 'Commit reviewed files';
    case 'push':
      return action.mode === 'publish' ? 'Publish branch' : 'Push branch';
    case 'pull_request':
      return 'Create pull request';
  }
}

function ActionDetails({ action }: Readonly<{ action: GitDeliveryAction }>) {
  if (action.kind === 'stage' || action.kind === 'commit') {
    return (
      <>
        <ul aria-label="Reviewed files" className="list-inside list-disc">
          {action.paths.map((path) => (
            <li key={path} className="whitespace-pre-wrap break-all font-mono">
              {path}
            </li>
          ))}
        </ul>
        {action.kind === 'commit' && (
          <p className="whitespace-pre-wrap break-words">
            <strong>Commit message:</strong> {action.message}
          </p>
        )}
      </>
    );
  }
  if (action.kind === 'pull_request') {
    return (
      <dl className="space-y-1 break-words">
        <dt>Base branch</dt>
        <dd>{action.baseBranch}</dd>
        <dt>Title</dt>
        <dd>{action.title}</dd>
        <dt>Description</dt>
        <dd className="whitespace-pre-wrap">{action.body || '(empty)'}</dd>
        <dt>Draft</dt>
        <dd>{action.draft ? 'Yes' : 'No'}</dd>
      </dl>
    );
  }
  return null;
}

function receiptStatus(receipt: GitDeliveryReceipt, unverified: boolean, expired: boolean): string {
  if (unverified) return 'Saved outcome unverified — refresh before continuing.';
  if (receipt.state === 'unknown') return 'Outcome unknown — inspect before trying again.';
  if (expired) return 'Review expired — prepare a new operation.';
  return `Status: ${receipt.state}`;
}

function ReceiptControl({
  receipt,
  nowMs,
  pending = false,
  unverified = false,
  onConfirm,
  onCancel,
  onReconcile,
  onAcknowledge,
  onDelete,
}: GitDeliveryReceiptProps) {
  const titleId = useId();
  const [ackConfirmed, setAckConfirmed] = useState(false);
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);
  const prepared = receipt.state === 'prepared';
  const expired = prepared && nowMs >= receipt.expiresAtMs;
  const unknown = receipt.state === 'unknown';
  const acknowledged = receipt.acknowledgedAtMs !== undefined;
  const closed = !prepared && receipt.state !== 'executing' && (!unknown || acknowledged);
  return (
    <section aria-labelledby={titleId} className="space-y-3 rounded-md border p-3 text-sm">
      <h3 id={titleId} className="font-semibold">
        {actionLabel(receipt.action)}
      </h3>
      <output className="block">{receiptStatus(receipt, unverified, expired)}</output>
      <p className="break-all">
        <strong>Operation:</strong> {receipt.id}
      </p>
      <p className="break-all">
        <strong>Branch:</strong> {receipt.review.branch}
      </p>
      <p className="break-all">
        <strong>Reviewed commit:</strong> {receipt.review.head}
      </p>
      {receipt.review.remoteName && (
        <p>
          <strong>Remote:</strong> {receipt.review.remoteName}
        </p>
      )}
      {receipt.review.remoteRef && (
        <p className="break-all">
          <strong>Remote branch:</strong> {receipt.review.remoteRef}
        </p>
      )}
      {receipt.review.repositorySlug && (
        <p className="break-all">
          <strong>Repository:</strong> {receipt.review.repositorySlug}
        </p>
      )}
      <ActionDetails action={receipt.action} />
      {receipt.review.warning && <p role="alert">{receipt.review.warning}</p>}
      {receipt.error && (
        <p role="alert">
          {receipt.error.message} ({receipt.error.code})
        </p>
      )}
      {receipt.result?.commitSha && (
        <p className="break-all">
          <strong>Commit result:</strong> {receipt.result.commitSha}
        </p>
      )}
      {receipt.result?.remoteRef && (
        <p className="break-all">
          <strong>Remote result:</strong> {receipt.result.remoteRef}
        </p>
      )}
      {receipt.result?.pullRequestUrl && (
        <p className="break-all">
          <strong>Pull request:</strong> {receipt.result.pullRequestUrl}
        </p>
      )}
      {receipt.result?.warning && <p role="alert">{receipt.result.warning}</p>}
      {prepared && !unverified && (
        <div className="flex flex-wrap gap-2">
          {onConfirm && (
            <Button
              type="button"
              disabled={pending || expired}
              onClick={() => onConfirm(receipt.id)}
            >
              Confirm Git operation
            </Button>
          )}
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => onCancel(receipt.id)}
            >
              Cancel Git operation
            </Button>
          )}
        </div>
      )}
      {unknown && !unverified && (
        <div className="space-y-2">
          <p>
            This action may have taken effect. Cancellation or acknowledgement does not undo it.
          </p>
          {onReconcile && (
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => onReconcile(receipt.id)}
            >
              Check actual outcome
            </Button>
          )}
          {acknowledged ? (
            <p>Uncertainty acknowledged. This operation cannot execute again.</p>
          ) : (
            onAcknowledge && (
              <>
                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={ackConfirmed}
                    disabled={pending}
                    onChange={(event) => setAckConfirmed(event.target.checked)}
                  />{' '}
                  I have inspected the outcome and understand a fresh operation could duplicate the
                  effect.
                </label>
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending || !ackConfirmed}
                  onClick={() => onAcknowledge(receipt.id)}
                >
                  Acknowledge uncertain outcome
                </Button>
              </>
            )
          )}
        </div>
      )}
      {closed && !unverified && onDelete && (
        <div className="space-y-2">
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={deleteConfirmed}
              disabled={pending}
              onChange={(event) => setDeleteConfirmed(event.target.checked)}
            />{' '}
            Delete this retained record. Its result will no longer be available; the old operation
            cannot execute again.
          </label>
          <Button
            type="button"
            variant="outline"
            disabled={pending || !deleteConfirmed}
            onClick={() => onDelete(receipt.id)}
          >
            Delete closed record
          </Button>
        </div>
      )}
    </section>
  );
}

/** Pure review control: callers own transport, current time and trusted human actions. */
export function GitDeliveryReceiptControl(props: GitDeliveryReceiptProps) {
  const { receipt } = props;
  return (
    <ReceiptControl key={`${receipt.id}:${receipt.updatedAtMs}:${receipt.state}`} {...props} />
  );
}
