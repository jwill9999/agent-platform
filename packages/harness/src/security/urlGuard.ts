/**
 * URL guard — validates URLs against a blocklist of dangerous endpoints.
 *
 * Blocks: metadata endpoints, localhost, private IPs, link-local addresses.
 */

// ---------------------------------------------------------------------------
// Blocked patterns
// ---------------------------------------------------------------------------

const BLOCKED_HOSTS = new Set(['metadata.google.internal', 'metadata.google', 'metadata']);

const BLOCKED_IP_PREFIXES = [
  '10.',
  '172.16.',
  '172.17.',
  '172.18.',
  '172.19.',
  '172.20.',
  '172.21.',
  '172.22.',
  '172.23.',
  '172.24.',
  '172.25.',
  '172.26.',
  '172.27.',
  '172.28.',
  '172.29.',
  '172.30.',
  '172.31.',
  '192.168.',
  '169.254.',
  'fd',
  'fe80:',
];

const BLOCKED_EXACT_IPS = new Set(['127.0.0.1', '0.0.0.0', '::1', '[::]', '[::1]']);

const LOCALHOST_NAMES = new Set(['localhost', 'localhost.localdomain', '127.0.0.1', '0.0.0.0']);

// AWS/GCP/Azure metadata endpoints
const METADATA_IPS = new Set(['169.254.169.254', '169.254.170.2']);

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface UrlValidationResult {
  allowed: boolean;
  reason?: string;
}

export function validateUrl(rawUrl: string): UrlValidationResult {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { allowed: false, reason: `Invalid URL: ${rawUrl}` };
  }

  // Only allow http and https
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { allowed: false, reason: `Blocked protocol: ${parsed.protocol}` };
  }

  const hostname = parsed.hostname.toLowerCase();

  // Block known metadata services
  if (METADATA_IPS.has(hostname)) {
    return { allowed: false, reason: `Blocked metadata endpoint: ${hostname}` };
  }

  // Block known metadata hostnames
  if (BLOCKED_HOSTS.has(hostname)) {
    return { allowed: false, reason: `Blocked metadata host: ${hostname}` };
  }

  // Block localhost
  if (LOCALHOST_NAMES.has(hostname)) {
    return { allowed: false, reason: `Blocked localhost access: ${hostname}` };
  }

  // Block exact IPs
  if (BLOCKED_EXACT_IPS.has(hostname)) {
    return { allowed: false, reason: `Blocked IP address: ${hostname}` };
  }

  // Block private IP ranges
  for (const prefix of BLOCKED_IP_PREFIXES) {
    if (hostname.startsWith(prefix)) {
      return { allowed: false, reason: `Blocked private IP range: ${hostname}` };
    }
  }

  return { allowed: true };
}
