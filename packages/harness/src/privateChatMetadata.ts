import type { ProviderContinuationRecord } from '@agent-platform/db';

export const continuation = Symbol('provider-continuation');

export type PrivateChatMetadata = {
  id?: string;
  /** Survives graph checkpoints; opaque material must be rehydrated from encrypted storage. */
  providerContinuationRequired?: boolean;
  [continuation]?: ProviderContinuationRecord;
};
