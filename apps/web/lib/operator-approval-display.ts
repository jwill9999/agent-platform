import type { ApprovalCardState } from '@/hooks/use-harness-chat';
import {
  isRecord,
  redactDisplayText,
  stringValue,
  toolActionLabel,
} from '@/lib/operator-display-utils';

export type OperatorApprovalDisplay = {
  action: string;
  title: string;
  target?: string;
  reason: string;
  riskLabel?: string;
  statusLabel: string;
  allowText: string;
  denyText: string;
  details: {
    payload: string;
    redacted: boolean;
  };
};

const STATUS_LABELS: Record<ApprovalCardState['status'], string> = {
  pending: 'Waiting for approval',
  approving: 'Approving action',
  rejecting: 'Denying action',
  approved: 'Approved',
  rejected: 'Denied',
  expired: 'Expired',
  executed: 'Approved action completed',
  failed: 'Approval action failed',
};

function technicalPayload(approval: ApprovalCardState): OperatorApprovalDisplay['details'] {
  let rendered: string;
  try {
    rendered = JSON.stringify(
      {
        approvalRequestId: approval.approvalRequestId,
        toolName: approval.toolName,
        riskTier: approval.riskTier,
        argsPreview: approval.argsPreview,
        message: approval.message,
        status: approval.status,
      },
      null,
      2,
    );
  } catch {
    rendered = String(approval.argsPreview);
  }
  const redacted = redactDisplayText(rendered);
  return { payload: redacted.text, redacted: redacted.redacted };
}

function targetFromArgs(args: unknown): string | undefined {
  if (!isRecord(args)) return undefined;
  const target =
    stringValue(args.url) ??
    stringValue(args.path) ??
    stringValue(args.filePath) ??
    stringValue(args.command) ??
    stringValue(args.selector) ??
    stringValue(args.text);
  return target ? redactDisplayText(target).text : undefined;
}

function approvalReason(approval: ApprovalCardState): string {
  const message = approval.message ?? '';
  if (/external domain/i.test(message) || /not allowlisted/i.test(message)) {
    return 'External domain is not allowlisted';
  }
  if (/critical-risk/i.test(message)) return 'Critical-risk actions require approval';
  if (/high-risk/i.test(message)) return 'High-risk actions require approval';
  if (/requires human approval/i.test(message) || /approval policy/i.test(message)) {
    return 'This action requires approval by policy';
  }
  return message.trim() || 'This action requires approval before it can run';
}

function titleForStatus(status: ApprovalCardState['status'], action: string): string {
  if (status === 'executed') return `${action} completed`;
  if (status === 'approved') return `${action} approved`;
  if (status === 'rejected') return `${action} denied`;
  if (status === 'expired') return `${action} expired`;
  if (status === 'failed') return `${action} needs attention`;
  if (status === 'approving') return `Approving ${action.toLowerCase()}`;
  if (status === 'rejecting') return `Denying ${action.toLowerCase()}`;
  return `Approval required to ${action.toLowerCase()}`;
}

export function displayApproval(approval: ApprovalCardState): OperatorApprovalDisplay {
  const action = toolActionLabel(approval.toolName);
  const target = targetFromArgs(approval.argsPreview);
  const targetSuffix = target ? ` for ${target}` : '';
  return {
    action,
    title: titleForStatus(approval.status, action),
    target,
    reason: approvalReason(approval),
    riskLabel: approval.riskTier?.toUpperCase(),
    statusLabel: STATUS_LABELS[approval.status],
    allowText: `Approving allows the agent to ${action.toLowerCase()}${targetSuffix}.`,
    denyText: `Denying prevents this action from running.`,
    details: technicalPayload(approval),
  };
}
