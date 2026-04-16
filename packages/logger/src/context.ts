import { AsyncLocalStorage } from 'node:async_hooks';

export interface CorrelationContext {
  correlationId: string;
}

export const correlationStorage = new AsyncLocalStorage<CorrelationContext>();

/** Run a callback with a correlation ID propagated through async context. */
export function runWithCorrelation<T>(correlationId: string, fn: () => T): T {
  return correlationStorage.run({ correlationId }, fn);
}

/** Read the current correlation ID (if any) from async context. */
export function getCorrelationId(): string | undefined {
  return correlationStorage.getStore()?.correlationId;
}
