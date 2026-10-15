'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GitDeliveryReceiptSchema, type GitDeliveryReceipt } from '@agent-platform/contracts';
import type {
  ApprovalCardState,
  ApprovalDecision,
  ApprovalDecisionHandler,
  ToolTraceEvent,
} from '@/hooks/use-harness-chat';
import { apiPath, apiPost } from '@/lib/apiClient';
import { Button } from '@/components/ui/button';
import { GitDeliveryReceiptControl } from '@/components/project/git-delivery-receipt';

import { gitDeliveryActions, isGitDeliveryTool, gitReceiptBinding } from '@/lib/git-chat-receipts';
export { isGitDeliveryTool } from '@/lib/git-chat-receipts';

type Ownership = Readonly<{
  projectId?: string | null;
  sessionId?: string | null;
  toolEvents?: readonly ToolTraceEvent[];
  onReceiptChange?: (receipt: GitDeliveryReceipt) => void;
  onReceiptDeleted?: (receipt: GitDeliveryReceipt) => void;
}>;
type Props = Ownership &
  Readonly<{ approval: ApprovalCardState; onDecision?: ApprovalDecisionHandler }>;
type RecoveryProps = Ownership & Readonly<{ recoveryReceipt: GitDeliveryReceipt }>;
type BoundProps = Props | RecoveryProps;

function previewReceipt(props: BoundProps): GitDeliveryReceipt | null {
  const { projectId, sessionId } = props;
  const approval = 'approval' in props ? props.approval : undefined;
  const preview = approval
    ? approval.argsPreview
    : { gitDeliveryReceipt: 'recoveryReceipt' in props ? props.recoveryReceipt : undefined };
  if (
    !preview ||
    typeof preview !== 'object' ||
    Object.keys(preview).length !== 1 ||
    !('gitDeliveryReceipt' in preview)
  )
    return null;
  const parsed = GitDeliveryReceiptSchema.safeParse(preview.gitDeliveryReceipt);
  if (!parsed.success || (approval && !isGitDeliveryTool(approval.toolName))) return null;
  const receipt = parsed.data;
  if (
    !projectId ||
    !sessionId ||
    receipt.projectId !== projectId ||
    receipt.sessionId !== sessionId ||
    receipt.source !== 'chat' ||
    (approval &&
      (!isGitDeliveryTool(approval.toolName) ||
        receipt.action.kind !== gitDeliveryActions[approval.toolName]))
  )
    return null;
  if (![receipt.createdAtMs, receipt.updatedAtMs, receipt.expiresAtMs].every(Number.isFinite))
    return null;
  return receipt;
}

async function readSavedReceipt(path: string, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(path, { cache: 'no-store', signal });
  if (!response.ok) throw new Error('Saved receipt unavailable');
  const envelope: unknown = await response.json();
  return envelope && typeof envelope === 'object' && 'data' in envelope ? envelope.data : undefined;
}

type View = {
  identity: object;
  receipt: GitDeliveryReceipt;
  verified: boolean;
  pending: boolean;
  error?: string;
};

function BoundGitApprovalCard(props: BoundProps) {
  const { projectId, sessionId, toolEvents, onReceiptChange, onReceiptDeleted } = props;
  const approval = 'approval' in props ? props.approval : undefined;
  const onDecision = 'onDecision' in props ? props.onDecision : undefined;
  const [initial] = useState(() => previewReceipt(props));
  const preview = previewReceipt(props);
  const valid =
    initial !== null &&
    preview !== null &&
    gitReceiptBinding(initial) === gitReceiptBinding(preview);
  // A distinct object prevents Project A -> B -> A or an earlier status refresh reclaiming ownership.
  const identity = useMemo(() => ({}), [projectId, sessionId, approval?.status, toolEvents, valid]);
  const active = useRef<object | null>(null);
  const revision = useRef(0);
  const request = useRef<AbortController | null>(null);
  const lastReceipt = useRef(initial);
  const [view, setView] = useState<View | null>(null);
  const [nowMs, setNowMs] = useState(Date.now);
  const [decisionPending, setDecisionPending] = useState(false);
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [deleted, setDeleted] = useState(false);
  const deletionConfirmed = useRef(false);
  const decisionSent = useRef(false);
  const receipt = view?.identity === identity ? view.receipt : initial;
  const verified = valid && view?.identity === identity && view.verified;
  const pending = Boolean(view?.identity === identity && view.pending);
  const busy =
    pending ||
    decisionPending ||
    approval?.status === 'approving' ||
    approval?.status === 'rejecting';

  const refresh = useCallback(
    async (recovery?: 'cancel' | 'reconcile' | 'acknowledge' | 'delete') => {
      if (
        !valid ||
        !initial ||
        !projectId ||
        active.current !== identity ||
        deletionConfirmed.current
      )
        return;
      if (recovery && request.current) return;
      request.current?.abort();
      const controller = new AbortController();
      request.current = controller;
      const version = ++revision.current;
      const current = () =>
        active.current === identity && version === revision.current && !controller.signal.aborted;
      setView({
        identity,
        receipt: lastReceipt.current ?? initial,
        verified: false,
        pending: true,
      });
      try {
        const path = apiPath('projects', projectId, 'git', 'delivery', initial.id);
        if (recovery === 'delete') {
          const response = await fetch(path, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ confirmed: true }),
            signal: controller.signal,
          });
          if (!response.ok) throw new Error('Closed receipt deletion unverified');
          if (!current()) return;
          deletionConfirmed.current = true;
          onReceiptDeleted?.(lastReceipt.current ?? initial);
          setDeleted(true);
          setView({
            identity,
            receipt: lastReceipt.current ?? initial,
            verified: false,
            pending: false,
          });
          return;
        }
        const value = recovery
          ? await apiPost<unknown>(
              `${path}/${recovery}`,
              recovery === 'acknowledge' ? { confirmed: true } : {},
              { signal: controller.signal },
            )
          : await readSavedReceipt(path, controller.signal);
        if (!current()) return;
        const parsed = GitDeliveryReceiptSchema.safeParse(value);
        if (
          !parsed.success ||
          gitReceiptBinding(parsed.data) !== gitReceiptBinding(initial) ||
          !Number.isFinite(parsed.data.updatedAtMs) ||
          parsed.data.updatedAtMs < (lastReceipt.current?.updatedAtMs ?? initial.updatedAtMs)
        )
          throw new Error('Invalid saved receipt');
        lastReceipt.current = parsed.data;
        onReceiptChange?.(parsed.data);
        setView({ identity, receipt: parsed.data, verified: true, pending: false });
      } catch {
        if (current())
          setView({
            identity,
            receipt: lastReceipt.current ?? initial,
            verified: false,
            pending: false,
            error: 'Saved Git outcome could not be verified. Refresh before continuing.',
          });
      } finally {
        if (request.current === controller) request.current = null;
      }
    },
    [identity, initial, projectId, valid, onReceiptChange, onReceiptDeleted],
  );

  useEffect(() => {
    active.current = identity;
    void refresh();
    return () => {
      active.current = null;
      revision.current += 1;
      request.current?.abort();
      request.current = null;
    };
  }, [identity, refresh]);

  useEffect(() => {
    decisionSent.current = false;
    setDecisionPending(false);
    setDecisionError(null);
  }, [approval?.status]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    function tick() {
      setNowMs(Date.now());
      if (!receipt || receipt.state !== 'prepared') return;
      const remaining = receipt.expiresAtMs - Date.now();
      if (remaining > 0) timer = setTimeout(tick, Math.min(remaining, 2_147_483_647));
    }
    tick();
    return () => clearTimeout(timer);
  }, [receipt]);

  const canDecide =
    verified &&
    receipt?.state === 'prepared' &&
    !busy &&
    (approval?.status === 'pending' || approval?.status === 'failed') &&
    Boolean(onDecision);
  function decide(decision: ApprovalDecision) {
    if (
      !canDecide ||
      decisionSent.current ||
      active.current !== identity ||
      (decision === 'approve' && Date.now() >= receipt.expiresAtMs)
    )
      return;
    decisionSent.current = true;
    setDecisionPending(true);
    setDecisionError(null);
    const refuse = () => {
      if (active.current !== identity) return;
      decisionSent.current = false;
      setDecisionPending(false);
      setDecisionError('Approval was not started. Wait for any active request, then try again.');
    };
    try {
      const admission = approval ? onDecision?.(approval.approvalRequestId, decision) : undefined;
      if (!admission?.accepted) {
        refuse();
        return;
      }
      void admission.completion.catch(() => {
        if (admission.isCurrent()) refuse();
      });
    } catch {
      refuse();
    }
  }
  function recover(operation: 'cancel' | 'reconcile' | 'acknowledge' | 'delete') {
    if (!verified || busy || active.current !== identity) return;
    if (!receipt) return;
    const closed =
      receipt.state !== 'prepared' &&
      receipt.state !== 'executing' &&
      (receipt.state !== 'unknown' || receipt.acknowledgedAtMs !== undefined);
    if (
      operation === 'delete'
        ? !closed
        : operation === 'cancel'
          ? receipt.state !== 'prepared' ||
            (approval !== undefined && approval.status !== 'rejected')
          : receipt.state !== 'unknown'
    )
      return;
    void refresh(operation);
  }

  return (
    <section
      aria-label={approval ? 'Git operation approval' : 'Retained Git outcome'}
      data-testid="git-approval-card"
      className="mt-3 space-y-3 rounded-lg border p-3 text-sm"
    >
      <h2 className="font-medium">{approval ? 'Review Git operation' : 'Retained Git outcome'}</h2>
      {!approval && (
        <p>Approval unavailable; recovery only. This record cannot authorize execution.</p>
      )}
      {decisionError && <p role="alert">{decisionError}</p>}
      {deleted ? (
        <p role="status">
          Retained Git record deleted. Its result is no longer available; this operation cannot
          execute again.
        </p>
      ) : !valid || !receipt ? (
        <p role="alert">
          This Git review does not match the current Project, session or operation. Approval is
          unavailable.
        </p>
      ) : (
        <>
          <GitDeliveryReceiptControl
            receipt={receipt}
            nowMs={nowMs}
            pending={busy}
            unverified={!verified}
            onCancel={
              !approval || approval.status === 'rejected' ? () => recover('cancel') : undefined
            }
            onReconcile={() => recover('reconcile')}
            onAcknowledge={() => recover('acknowledge')}
            onDelete={() => recover('delete')}
          />
          {view?.identity === identity && view.error && <p role="alert">{view.error}</p>}
          <Button
            type="button"
            variant="outline"
            disabled={pending || decisionPending}
            onClick={() => void refresh()}
          >
            Refresh saved Git outcome
          </Button>
          {(approval?.status === 'pending' || approval?.status === 'failed') && (
            <div className="flex gap-2">
              <Button
                type="button"
                disabled={!canDecide || nowMs >= receipt.expiresAtMs}
                onClick={() => decide('approve')}
              >
                Approve Git operation
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={!canDecide}
                onClick={() => decide('reject')}
              >
                Deny Git operation
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

export function GitApprovalCard(props: Props) {
  return (
    <BoundGitApprovalCard
      key={JSON.stringify([props.projectId, props.sessionId, props.approval.approvalRequestId])}
      {...props}
    />
  );
}

export function GitRecoveryCard(props: RecoveryProps) {
  return (
    <BoundGitApprovalCard
      key={JSON.stringify([props.projectId, props.sessionId, props.recoveryReceipt.id])}
      {...props}
    />
  );
}
