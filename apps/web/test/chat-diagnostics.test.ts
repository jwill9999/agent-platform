import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { observeChatResponse, partialChatFailure } from '../lib/chat-diagnostics';

describe('chat diagnostic observation boundary', () => {
  it('retains a generated identity when the response supplies arbitrary text', () => {
    const fallback = randomUUID();
    expect(
      observeChatResponse(
        new Response('', { headers: { 'x-request-id': 'PRIVATE_CANARY' } }),
        fallback,
      ),
    ).toEqual({ requestId: fallback, apiObserved: false, responseStatus: 200 });
    const upstream = randomUUID();
    expect(
      observeChatResponse(
        new Response('', {
          status: 503,
          headers: { 'x-request-id': upstream, 'x-diagnostics-api-observed': '1' },
        }),
        fallback,
      ),
    ).toEqual({ requestId: upstream, apiObserved: true, responseStatus: 503 });
  });
  it.each([
    {
      apiObserved: false,
      responseStatus: undefined,
      phase: 'connection',
      errorCode: 'backend_unavailable',
    },
    { apiObserved: false, responseStatus: 400, phase: 'ingress', errorCode: 'invalid_request' },
    { apiObserved: false, responseStatus: 504, phase: 'connection', errorCode: 'timeout' },
    { apiObserved: true, responseStatus: 200, phase: 'connection', errorCode: 'connection_lost' },
  ])(
    'projects safe partial metadata at the failed client boundary: $errorCode',
    ({ apiObserved, responseStatus, phase, errorCode }) => {
      const requestId = randomUUID();
      expect(
        partialChatFailure({
          requestId,
          observedAtMs: 42,
          durationMs: -2,
          apiObserved,
          responseStatus,
        }),
      ).toEqual({ requestId, observedAtMs: 42, durationMs: 0, phase, errorCode });
    },
  );
  it.each([400, 403, 500, 504])(
    'does not relabel API-observed HTTP%s as a client-only partial',
    (responseStatus) => {
      expect(
        partialChatFailure({
          requestId: randomUUID(),
          observedAtMs: 42,
          durationMs: 10,
          apiObserved: true,
          responseStatus,
        }),
      ).toBeNull();
    },
  );
});
