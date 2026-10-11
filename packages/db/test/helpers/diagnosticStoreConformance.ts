import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { DiagnosticEvent, DiagnosticStore } from '@agent-platform/contracts';

/** Reuse this suite for any future adapter; the factory owns cleanup after each test. */
export function diagnosticStoreConformance(name: string, create: () => DiagnosticStore): void {
  function observation(store: DiagnosticStore, requestId = randomUUID()): DiagnosticEvent {
    return {
      schemaVersion: 1,
      eventId: randomUUID(),
      processInstanceId: store.health().processInstanceId,
      requestId,
      phase: 'request',
      outcome: 'started',
      observedAtMs: Date.now(),
    };
  }
  describe(`${name}: diagnostic adapter contract`, () => {
    it('acknowledges only strict envelopes and never returns another request scope', async () => {
      const store = create();
      await store.ready;
      const first = observation(store);
      const second = observation(store);
      expect(store.record({ ...first, rawContent: 'contract-canary' })).toBe(false);
      expect(store.record(first)).toBe(true);
      expect(store.record(second)).toBe(true);
      await store.flush();
      const page = await store.query({ requestId: first.requestId });
      expect(page.events.map((row) => row.event.eventId)).toEqual([first.eventId]);
      expect(JSON.stringify(page)).not.toContain('contract-canary');
    });
    it('deduplicates identical event identities and rejects conflicting content without replacing history', async () => {
      const store = create();
      await store.ready;
      const first = observation(store);
      store.record(first);
      store.record(first);
      store.record({ ...first, outcome: 'failed' });
      await store.flush();
      const page = await store.query({ requestId: first.requestId });
      expect(page.events).toHaveLength(1);
      expect(page.events[0]!.event.outcome).toBe('started');
      expect(page.health.conflicts).toBe(1);
    });
    it('paginates one stable snapshot while newer events are appended', async () => {
      const store = create();
      await store.ready;
      const requestId = randomUUID();
      const first = observation(store, requestId);
      const second = observation(store, requestId);
      store.record(first);
      store.record(second);
      await store.flush();
      const page = await store.query({ requestId }, { limit: 1 });
      store.record(observation(store, requestId));
      await store.flush();
      const next = await store.query({ requestId }, { cursor: page.nextCursor });
      expect(next.events.map((row) => row.event.eventId)).toEqual([second.eventId]);
      expect(next.snapshotSequence).toBe(page.snapshotSequence);
    });
  });
}
