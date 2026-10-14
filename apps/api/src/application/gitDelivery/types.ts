import type {
  GitDeliveryAction,
  GitDeliveryPort,
  GitDeliveryReceipt,
} from '@agent-platform/contracts';
export class GitDeliveryError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: 400 | 403 | 404 | 409 | 503 = 409,
    readonly details?: { stagedPaths: string[] },
  ) {
    super(message);
    this.name = 'GitDeliveryError';
  }
}
export interface GitDeliveryPanelPort {
  prepare(
    action: GitDeliveryAction,
    options?: { signal?: AbortSignal },
  ): Promise<GitDeliveryReceipt>;
  get(id: string): Promise<GitDeliveryReceipt>;
  list(): Promise<GitDeliveryReceipt[]>;
  stagedPaths(options?: { signal?: AbortSignal }): Promise<string[]>;
  execute(
    id: string,
    options: { confirmed: true; signal?: AbortSignal },
  ): Promise<GitDeliveryReceipt>;
  cancel(id: string): Promise<GitDeliveryReceipt>;
  reconcile(id: string, options?: { signal?: AbortSignal }): Promise<GitDeliveryReceipt>;
  acknowledge(id: string, options: { confirmed: true }): Promise<GitDeliveryReceipt>;
  deleteClosed(id: string, options: { confirmed: true }): Promise<void>;
}
export interface GitDeliveryService {
  chat(context: { sessionId: string; agentId: string }): GitDeliveryPort;
  panel(projectId: string): GitDeliveryPanelPort;
}
export interface GitDeliveryServiceOptions {
  now?: () => number;
  /** Internal dependency option for bounded command tests; never read from action/HTTP/model data. */
  commandTimeoutMs?: number;
}
