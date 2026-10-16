import type { ContextTokenProviderRequest } from '../../../apps/desktop/e2e/support/contextTokenProvider.js';
export type StopReply =
  | { kind: 'text'; text: string; hold?: boolean; partial?: string }
  | { kind: 'tool'; name: string; args: Record<string, unknown> }
  | { kind: 'error'; status: 400 | 429 | 503 };
export type StopLedger = {
  index: number;
  received: boolean;
  partialSent: boolean;
  completed: boolean;
  disconnected: boolean;
};
export type StopProvider = {
  baseURL: string;
  requests: ContextTokenProviderRequest[];
  errors: string[];
  ledger: StopLedger[];
  enqueue(reply: StopReply): number | void | Promise<void>;
  release(index: number): void;
  close(): Promise<void>;
};
export function startStopProvider(options: {
  model: string;
  port?: number;
  observe?: (event: {
    kind: string;
    value?: StopLedger;
    body?: ContextTokenProviderRequest;
    message?: string;
  }) => void;
}): Promise<StopProvider>;
