import { describe, it, expect } from 'vitest';
import { validateUrl } from '../src/security/urlGuard.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Assert a URL is blocked, optionally checking a reason substring. */
const expectBlocked = (url: string, reason?: string) => {
  const result = validateUrl(url);
  expect(result.allowed).toBe(false);
  if (reason) expect(result.reason).toContain(reason);
};

describe('validateUrl', () => {
  // Allowed URLs
  it.each([
    ['standard HTTPS', 'https://example.com'],
    ['standard HTTP', 'http://example.com/api/v1/data'],
    ['URL with port', 'https://api.example.com:8443/path'],
    ['URL with query params', 'https://example.com/search?q=test&page=1'],
    ['public IP', 'http://8.8.8.8/dns'],
  ])('allows %s', (_label, url) => {
    expect(validateUrl(url)).toEqual({ allowed: true });
  });

  // Blocked protocols
  it.each<[string, string, string | undefined]>([
    ['file://', 'file:///etc/passwd', 'Blocked protocol'],
    ['ftp://', 'ftp://ftp.example.com/file', 'Blocked protocol'],
    ['javascript:', 'javascript:alert(1)', undefined],
  ])('blocks %s protocol', (_label, url, reason) => {
    expectBlocked(url, reason);
  });

  // Metadata endpoints
  it.each([
    ['AWS instance metadata (169.254.169.254)', 'http://169.254.169.254/latest/meta-data/'],
    ['AWS container metadata (169.254.170.2)', 'http://169.254.170.2/v2/credentials'],
    ['Google metadata hostname', 'http://metadata.google.internal/computeMetadata/v1/'],
  ])('blocks %s', (_label, url) => {
    expectBlocked(url, 'metadata');
  });

  // Localhost
  it.each<[string, string, string | undefined]>([
    ['localhost by name', 'http://localhost:3000/api', 'localhost'],
    ['127.0.0.1', 'http://127.0.0.1:8080', undefined],
    ['0.0.0.0', 'http://0.0.0.0:4000', undefined],
    ['IPv6 loopback ::1', 'http://[::1]:3000', undefined],
  ])('blocks %s', (_label, url, reason) => {
    expectBlocked(url, reason);
  });

  // Private IP ranges (intentional test fixtures for security guard)
  it.each<[string, string, string | undefined]>([
    ['10.x.x.x', 'http://10.0.0.1/internal', 'private IP'],
    ['172.16.x.x', 'http://172.16.0.1/internal', undefined],
    ['172.31.x.x', 'http://172.31.255.255/internal', undefined],
    ['192.168.x.x', 'http://192.168.1.1/admin', undefined],
    ['link-local 169.254.x.x', 'http://169.254.1.1/something', undefined],
  ])('blocks %s range', (_label, url, reason) => {
    expectBlocked(url, reason);
  });

  // Invalid URLs
  it.each<[string, string, string | undefined]>([
    ['invalid URL string', 'not-a-url', 'Invalid URL'],
    ['empty string', '', undefined],
  ])('rejects %s', (_label, url, reason) => {
    expectBlocked(url, reason);
  });

  // Domain allowlist
  describe('domain allowlist', () => {
    it('allows URL when domain is in allowlist', () => {
      expect(
        validateUrl('https://api.example.com/data', { allowedDomains: ['api.example.com'] }),
      ).toEqual({ allowed: true });
    });

    it('blocks URL when domain is not in allowlist', () => {
      const result = validateUrl('https://evil.com/exfil', {
        allowedDomains: ['api.example.com'],
      });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('allowlist');
    });

    it('allows subdomain when parent domain is in allowlist', () => {
      expect(
        validateUrl('https://sub.example.com/api', { allowedDomains: ['example.com'] }),
      ).toEqual({ allowed: true });
    });

    it('ignores allowlist when empty array', () => {
      expect(validateUrl('https://any-domain.com', { allowedDomains: [] })).toEqual({
        allowed: true,
      });
    });

    it('ignores allowlist when not provided', () => {
      expect(validateUrl('https://any-domain.com')).toEqual({ allowed: true });
    });

    it('still blocks private IPs even with allowlist', () => {
      const result = validateUrl('http://192.168.1.1/admin', {
        allowedDomains: ['192.168.1.1'],
      });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('private IP');
    });
  });
});
