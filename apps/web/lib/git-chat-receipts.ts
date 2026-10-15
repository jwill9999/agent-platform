import { GitDeliveryReceiptSchema, type GitDeliveryReceipt } from '@agent-platform/contracts';

export const gitDeliveryActions = {
  sys_git_stage: 'stage',
  sys_git_commit: 'commit',
  sys_git_push: 'push',
  sys_git_create_pull_request: 'pull_request',
} as const;
export function isGitDeliveryTool(tool: string): tool is keyof typeof gitDeliveryActions {
  return Object.hasOwn(gitDeliveryActions, tool);
}
export function gitApprovalReceipt(
  tool: string,
  preview: unknown,
  sessionId?: string,
): GitDeliveryReceipt | null {
  if (
    !isGitDeliveryTool(tool) ||
    !preview ||
    typeof preview !== 'object' ||
    Object.keys(preview).length !== 1 ||
    !('gitDeliveryReceipt' in preview)
  )
    return null;
  const parsed = GitDeliveryReceiptSchema.safeParse(preview.gitDeliveryReceipt);
  if (
    !parsed.success ||
    parsed.data.source !== 'chat' ||
    parsed.data.action.kind !== gitDeliveryActions[tool] ||
    (sessionId !== undefined && parsed.data.sessionId !== sessionId)
  )
    return null;
  return parsed.data;
}

/** The review is immutable; only the saved outcome may change after an approval. */
export function gitReceiptBinding(receipt: GitDeliveryReceipt): string {
  return JSON.stringify({
    id: receipt.id,
    projectId: receipt.projectId,
    sessionId: receipt.sessionId,
    source: receipt.source,
    action: receipt.action,
    review: receipt.review,
    createdAtMs: receipt.createdAtMs,
    expiresAtMs: receipt.expiresAtMs,
  });
}
