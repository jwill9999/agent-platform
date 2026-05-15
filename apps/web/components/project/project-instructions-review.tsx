'use client';

import type { ProjectOnboardingDraft } from '@agent-platform/contracts';
import * as React from 'react';
import { X } from 'lucide-react';

import { Button } from '@/components/ui/button';

export type ProjectInstructionsReviewProps = Readonly<{
  draft: ProjectOnboardingDraft;
  isApproving: boolean;
  isRejecting: boolean;
  onApprove: () => void;
  onReject: () => void;
}>;

export type ProjectInstructionsApprovalNoticeProps = Readonly<{
  targetPath: string;
  onDismiss?: () => void;
}>;

export type ProjectInstructionsRejectedNoticeProps = Readonly<{
  targetPath: string;
  onDismiss?: () => void;
}>;

export function ProjectInstructionsReview({
  draft,
  isApproving,
  isRejecting,
  onApprove,
  onReject,
}: ProjectInstructionsReviewProps) {
  const isReviewing = isApproving || isRejecting;

  return (
    <section className="mb-6 rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">Review Project instructions</h3>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Read the proposed {draft.targetPath} file. Approve it when you are ready to let the
            assistant use these Project instructions.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onReject}
            disabled={isReviewing}
          >
            {isRejecting ? 'Rejecting...' : 'Reject draft'}
          </Button>
          <Button type="button" size="sm" onClick={onApprove} disabled={isReviewing}>
            {isApproving ? 'Approving...' : 'Approve instructions'}
          </Button>
        </div>
      </div>
      <pre className="mt-4 max-h-96 overflow-auto rounded-md border border-border bg-background p-3 text-xs leading-5 text-foreground">
        <code>{draft.markdown}</code>
      </pre>
    </section>
  );
}

export function ProjectInstructionsRejectedNotice({
  targetPath,
  onDismiss,
}: ProjectInstructionsRejectedNoticeProps) {
  return (
    <section className="my-4 rounded-lg border border-amber-800/60 bg-amber-950/20 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Project instructions rejected</h3>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            The {targetPath} draft was not approved. Run /init again when you are ready to prepare a
            revised draft.
          </p>
        </div>
        {onDismiss && (
          <button
            type="button"
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-background/60 hover:text-foreground"
            aria-label="Dismiss Project instructions notice"
            onClick={onDismiss}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </section>
  );
}

export function ProjectInstructionsApprovalNotice({
  targetPath,
  onDismiss,
}: ProjectInstructionsApprovalNoticeProps) {
  return (
    <section className="my-4 rounded-lg border border-emerald-800/60 bg-emerald-950/20 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Project instructions approved</h3>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {targetPath} was saved at the Project root.
          </p>
        </div>
        {onDismiss && (
          <button
            type="button"
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-background/60 hover:text-foreground"
            aria-label="Dismiss Project instructions notice"
            onClick={onDismiss}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </section>
  );
}
