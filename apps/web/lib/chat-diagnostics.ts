import { DiagnosticScopeSchema, type DiagnosticPartialFailure } from '@agent-platform/contracts';

/** Only a valid response identity can replace the locally generated fallback. */
export function observeChatResponse(response: Response, fallbackRequestId: string) {
  const identity = DiagnosticScopeSchema.safeParse({
    requestId: response.headers.get('x-request-id'),
  });
  const requestId =
    identity.success && 'requestId' in identity.data ? identity.data.requestId : fallbackRequestId;
  return {
    requestId,
    apiObserved: response.headers.get('x-diagnostics-api-observed') === '1',
    responseStatus: response.status,
  };
}

function partialErrorCode(
  responseStatus: number | undefined,
  apiObserved: boolean,
): DiagnosticPartialFailure['errorCode'] {
  if (responseStatus === 400) return 'invalid_request';
  if (responseStatus === 504) return 'timeout';
  return apiObserved ? 'connection_lost' : 'backend_unavailable';
}

/** API-observed HTTP failures use API request scope; partials describe the client boundary only. */
export function partialChatFailure(input: {
  requestId: string;
  observedAtMs: number;
  durationMs: number;
  apiObserved: boolean;
  responseStatus?: number;
}): DiagnosticPartialFailure | null {
  if (input.apiObserved && input.responseStatus !== undefined && input.responseStatus >= 400)
    return null;
  return {
    requestId: input.requestId,
    observedAtMs: input.observedAtMs,
    durationMs: Math.max(0, input.durationMs),
    phase: input.responseStatus === 400 ? 'ingress' : 'connection',
    errorCode: partialErrorCode(input.responseStatus, input.apiObserved),
  };
}
