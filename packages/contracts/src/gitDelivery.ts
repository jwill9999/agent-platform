import { z } from 'zod';

const paths = z.array(z.string().min(1).max(4096)).min(1).max(500);
/** Only action data may originate from a model. Repository identity is resolved by the host. */
export const GitDeliveryActionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('stage'), mode: z.enum(['stage', 'unstage']), paths }).strict(),
  z
    .object({ kind: z.literal('commit'), message: z.string().trim().min(1).max(10000), paths })
    .strict(),
  z.object({ kind: z.literal('push'), mode: z.enum(['publish', 'push']) }).strict(),
  z
    .object({
      kind: z.literal('pull_request'),
      baseBranch: z.string().min(1).max(255),
      title: z.string().trim().min(1).max(256),
      body: z.string().max(65536),
      draft: z.boolean(),
    })
    .strict(),
]);
export type GitDeliveryAction = z.infer<typeof GitDeliveryActionSchema>;
export const GitDeliveryStateSchema = z.enum([
  'prepared',
  'executing',
  'succeeded',
  'failed',
  'unknown',
  'cancelled',
  'denied',
  'stale',
  'expired',
]);
export type GitDeliveryState = z.infer<typeof GitDeliveryStateSchema>;
export const GitDeliveryReceiptSchema = z
  .object({
    id: z.string().uuid(),
    projectId: z.string(),
    sessionId: z.string().optional(),
    source: z.enum(['panel', 'chat']),
    action: GitDeliveryActionSchema,
    state: GitDeliveryStateSchema,
    createdAtMs: z.number(),
    updatedAtMs: z.number(),
    expiresAtMs: z.number(),
    review: z
      .object({
        branch: z.string(),
        head: z.string(),
        indexTree: z.string(),
        paths: z.array(z.string()),
        remoteName: z.string().optional(),
        remoteRef: z.string().optional(),
        repositorySlug: z.string().optional(),
        warning: z.string().optional(),
      })
      .strict(),
    result: z
      .object({
        commitSha: z.string().optional(),
        indexTree: z.string().optional(),
        remoteRef: z.string().optional(),
        pullRequestUrl: z.string().optional(),
        pullRequestNumber: z.number().int().positive().optional(),
        warning: z.string().optional(),
      })
      .strict()
      .optional(),
    error: z.object({ code: z.string(), message: z.string() }).strict().optional(),
    acknowledgedAtMs: z.number().optional(),
  })
  .strict();
export type GitDeliveryReceipt = z.infer<typeof GitDeliveryReceiptSchema>;

/** Bound by the trusted API, never constructed from model-supplied project/root/approval flags. */
export interface GitDeliveryPort {
  prepare(
    action: GitDeliveryAction,
    options: { toolCallId: string; signal?: AbortSignal },
  ): Promise<GitDeliveryReceipt>;
  get(operationId: string): Promise<GitDeliveryReceipt>;
  execute(
    operationId: string,
    options: { approvalRequestId: string; signal?: AbortSignal },
  ): Promise<GitDeliveryReceipt>;
  cancel(operationId: string, reason: 'cancelled' | 'denied'): Promise<GitDeliveryReceipt>;
}
