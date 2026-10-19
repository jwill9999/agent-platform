export type ProviderErrorCategory =
  | 'authentication'
  | 'access'
  | 'quota'
  | 'rate_limit'
  | 'request'
  | 'transport'
  | 'timeout'
  | 'output_limited'
  | 'invalid_response'
  | 'unknown';
const MESSAGES: Record<ProviderErrorCategory, string> = {
  authentication: 'Provider authentication failed. Check the saved credential.',
  access: 'The provider denied access to this model or endpoint.',
  quota: 'The provider account has insufficient quota or credits.',
  rate_limit: 'The provider rate limit was reached.',
  request: 'The provider rejected the model request.',
  transport: 'The provider could not be reached.',
  timeout: 'The provider request timed out.',
  output_limited:
    'Provider accepted the request, but the test output limit prevented a visible reply.',
  invalid_response: 'The provider returned an invalid response.',
  unknown: 'The provider request failed.',
};
export class ProviderRequestError extends Error {
  constructor(
    public readonly category: ProviderErrorCategory,
    public readonly statusCode?: number,
    public readonly retryable = false,
  ) {
    super(MESSAGES[category]);
    this.name = 'ProviderRequestError';
  }
}
function property(value: unknown, key: string): unknown {
  if (typeof value !== 'object' || value === null) return undefined;
  // SDK errors are trusted classes; do not serialize any raw error or cause.
  try {
    return Reflect.get(value, key);
  } catch {
    return undefined;
  }
}
function categoryForStatus(status: number, error: unknown): ProviderErrorCategory {
  if (status < 400) return 'invalid_response';
  if (status === 401) return 'authentication';
  if (status === 402) return 'quota';
  if (status === 403 || status === 404) return 'access';
  if (status === 429) {
    const data = property(error, 'data');
    const code = property(property(data, 'error'), 'code');
    return code === 'insufficient_quota' || code === 'quota_exceeded' ? 'quota' : 'rate_limit';
  }
  return status >= 500 ? 'transport' : 'request';
}
const INVALID_RESPONSE_ERRORS = new Set([
  'AI_InvalidResponseDataError',
  'AI_TypeValidationError',
  'AI_JSONParseError',
  'AI_NoContentGeneratedError',
  'AI_EmptyResponseBodyError',
]);
const NETWORK_ERRORS = new Set(['AI_APICallError', 'TypeError', 'AI_RetryError']);
const NETWORK_CODES = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'EPIPE',
  'ENOTFOUND',
  'EHOSTUNREACH',
  'ETIMEDOUT',
]);
function httpStatus(error: unknown): number | undefined {
  const cause = property(error, 'cause');
  const status =
    property(error, 'statusCode') ??
    property(error, 'status') ??
    property(cause, 'statusCode') ??
    property(cause, 'status');
  return typeof status === 'number' && Number.isInteger(status) && status >= 100 && status <= 599
    ? status
    : undefined;
}
function nonHttpError(error: unknown, name: unknown): ProviderRequestError {
  if (typeof name === 'string' && INVALID_RESPONSE_ERRORS.has(name))
    return new ProviderRequestError('invalid_response');
  const code = property(error, 'code') ?? property(property(error, 'cause'), 'code');
  if (typeof code === 'string' && NETWORK_CODES.has(code))
    return new ProviderRequestError(
      code === 'ETIMEDOUT' ? 'timeout' : 'transport',
      undefined,
      true,
    );
  if (typeof name === 'string' && NETWORK_ERRORS.has(name))
    return new ProviderRequestError('transport', undefined, true);
  return new ProviderRequestError('unknown');
}
/** Preserve cancellation identity; all other errors become fixed safe public messages. */
export function toProviderRequestError(error: unknown): Error {
  if (error instanceof ProviderRequestError) return error;
  const name = property(error, 'name');
  if (error instanceof Error && (name === 'AbortError' || name === 'RunStoppedError')) return error;
  if (name === 'TimeoutError') return new ProviderRequestError('timeout');
  const status = httpStatus(error);
  if (status !== undefined) {
    const category = categoryForStatus(status, error);
    return new ProviderRequestError(
      category,
      status,
      category !== 'quota' && [429, 500, 502, 503, 504].includes(status),
    );
  }
  return nonHttpError(error, name);
}
