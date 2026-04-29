/**
 * Output guard — scans tool results and outbound HTTP bodies for
 * credential leakage and sensitive data exposure.
 *
 * See docs/planning/security.md — Threat 3: Secret and Credential Exfiltration.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OutputScanResult {
  /** True when no credential patterns were detected. */
  safe: boolean;
  /** Human-readable descriptions of each detected issue. */
  issues: string[];
}

export interface OutboundBodyScanResult {
  /** True when no sensitive context data was detected. */
  safe: boolean;
  /** Human-readable descriptions of each detected issue. */
  issues: string[];
}

// ---------------------------------------------------------------------------
// Credential patterns
// ---------------------------------------------------------------------------

const CREDENTIAL_PATTERNS: readonly { name: string; pattern: RegExp }[] = [
  { name: 'AWS Access Key', pattern: /AKIA[0-9A-Z]{16}/ },
  { name: 'JWT', pattern: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/ },
  { name: 'Private Key', pattern: /-----BEGIN (RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/ },
  { name: 'GitHub Token', pattern: /(ghp|gho|ghu|ghs|ghr)_\w{36,}/ },
  { name: 'OpenAI API Key', pattern: /sk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{20,}/ },
  { name: 'Generic API Key', pattern: /(?:api[_-]?key|apikey)\s*[:=]\s*["']?[\w-]{20,}/i },
  { name: 'Generic Secret', pattern: /(?:secret|password)\s*[:=]\s*["']?[^\s"']{8,}/i },
  { name: 'Bearer Token', pattern: /Bearer\s+[A-Za-z0-9_\-.~+/]{20,}/ },
  {
    name: 'Base64 Encoded Key',
    pattern: /(?:key|secret|token)\s*[:=]\s*["']?[a-z0-9+/]{40,}={0,2}/i,
  },
];

// ---------------------------------------------------------------------------
// Sensitive context patterns for outbound body scanning
// ---------------------------------------------------------------------------

const SENSITIVE_CONTEXT_PATTERNS: readonly { name: string; pattern: RegExp }[] = [
  { name: 'session_id', pattern: /session[_-]?id/i },
  { name: 'system_prompt', pattern: /system[_-]?prompt/i },
  { name: 'access_token', pattern: /access[_-]?token/i },
  { name: 'conversation_history', pattern: /conversation[_-]?history/i },
  { name: 'private_key reference', pattern: /-----BEGIN.*PRIVATE KEY-----/ },
];

// ---------------------------------------------------------------------------
// Output scanning
// ---------------------------------------------------------------------------

/**
 * Scan output content for credential patterns before it enters the LLM
 * context or is returned to the user.
 */
export function scanOutput(content: string): OutputScanResult {
  const issues: string[] = [];

  for (const { name, pattern } of CREDENTIAL_PATTERNS) {
    if (pattern.test(content)) {
      issues.push(`Possible ${name} detected in output`);
    }
  }

  return { safe: issues.length === 0, issues };
}

/**
 * Scan an outbound HTTP request body for sensitive context data that
 * should not leave the system boundary.
 */
export function scanOutboundBody(url: string, body: string | undefined): OutboundBodyScanResult {
  if (!body) return { safe: true, issues: [] };

  const issues: string[] = [];

  for (const { name, pattern } of SENSITIVE_CONTEXT_PATTERNS) {
    if (pattern.test(body)) {
      issues.push(`Outbound request to ${url} may contain ${name}`);
    }
  }

  return { safe: issues.length === 0, issues };
}

// ---------------------------------------------------------------------------
// Redaction
// ---------------------------------------------------------------------------

/**
 * Redact known credential patterns from a string, replacing matches with
 * `[REDACTED:<type>]` markers.
 */
export function redactCredentials(content: string): string {
  let result = content;
  for (const { name, pattern } of CREDENTIAL_PATTERNS) {
    result = result.replace(new RegExp(pattern.source, pattern.flags + 'g'), `[REDACTED:${name}]`);
  }
  return result;
}
