export type JsonObject = Record<string, unknown>;

export interface RedactionResult<T> {
  value: T;
  wasRedacted: boolean;
}

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

const CREDENTIAL_PATTERNS: readonly { name: string; pattern: RegExp }[] = [
  { name: 'AWS Access Key', pattern: /AKIA[0-9A-Z]{16}/ },
  { name: 'JWT', pattern: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/ },
  { name: 'Private Key', pattern: /-----BEGIN (RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/ },
  { name: 'GitHub Token', pattern: /(ghp|gho|ghu|ghs|ghr)_\w{36,}/ },
  { name: 'OpenAI API Key', pattern: /sk-(?:proj-|svcacct-)?[A-Za-z0-9_*.-]{20,}/ },
  { name: 'Generic API Key', pattern: /(?:api[_-]?key|apikey)\s*[:=]\s*["']?[\w-]{20,}/i },
  { name: 'Generic Secret', pattern: /(?:secret|password)\s*[:=]\s*["']?[^\s"']{8,}/i },
  { name: 'Bearer Token', pattern: /Bearer\s+[A-Za-z0-9_\-.~+/]{20,}/ },
  {
    name: 'Base64 Encoded Key',
    pattern: /(?:key|secret|token)\s*[:=]\s*["']?[a-z0-9+/]{40,}={0,2}/i,
  },
];

function globalPattern(pattern: RegExp): RegExp {
  const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
  return new RegExp(pattern.source, flags);
}

export function redactCredentialText(content: string): RedactionResult<string> {
  let value = content;
  let wasRedacted = false;
  for (const { name, pattern } of CREDENTIAL_PATTERNS) {
    const next = value.replace(globalPattern(pattern), `[REDACTED:${name}]`);
    wasRedacted ||= next !== value;
    value = next;
  }
  return { value, wasRedacted };
}

export function redactJsonValue(value: unknown): RedactionResult<unknown> {
  if (Array.isArray(value)) {
    let wasRedacted = false;
    const redacted = value.map((entry) => {
      const result = redactJsonValue(entry);
      wasRedacted ||= result.wasRedacted;
      return result.value;
    });
    return { value: redacted, wasRedacted };
  }
  if (typeof value !== 'object' || value === null) {
    return { value, wasRedacted: false };
  }

  const redacted: JsonObject = {};
  let wasRedacted = false;
  for (const [key, child] of Object.entries(value)) {
    if (REDACT_KEYS.has(key.toLowerCase())) {
      redacted[key] = '[REDACTED]';
      wasRedacted = true;
      continue;
    }

    const result = redactJsonValue(child);
    redacted[key] = result.value;
    wasRedacted ||= result.wasRedacted;
  }
  return { value: redacted, wasRedacted };
}

export function redactObject(value: JsonObject): RedactionResult<JsonObject> {
  const result = redactJsonValue(value);
  return { value: result.value as JsonObject, wasRedacted: result.wasRedacted };
}

export function stringifyRedactedJson(value: unknown): string {
  return JSON.stringify(redactJsonValue(value).value);
}
