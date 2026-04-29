const REDACT_KEYS = new Set([
  'key',
  'token',
  'password',
  'secret',
  'apikey',
  'api_key',
  'authorization',
  'auth',
  'credential',
  'credentials',
  'access_token',
  'refresh_token',
  'private_key',
]);

export function redactArgs(args: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(args)) {
    if (REDACT_KEYS.has(key.toLowerCase())) {
      result[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      result[key] = redactArgs(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result;
}
