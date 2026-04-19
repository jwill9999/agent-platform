import { describe, it, expect } from 'vitest';
import { validateUrl } from '../src/security/urlGuard.js';

describe('validateUrl', () => {
  // -----------------------------------------------------------------------
  // Allowed URLs
  // -----------------------------------------------------------------------
  describe('allowed URLs', () => {
    it('allows standard HTTPS URLs', () => {
      expect(validateUrl('https://example.com')).toEqual({ allowed: true });
    });

    it('allows standard HTTP URLs', () => {
      expect(validateUrl('http://example.com/api/v1/data')).toEqual({ allowed: true });
    });

    it('allows URLs with ports', () => {
      expect(validateUrl('https://api.example.com:8443/path')).toEqual({ allowed: true });
    });

    it('allows URLs with query parameters', () => {
      expect(validateUrl('https://example.com/search?q=test&page=1')).toEqual({ allowed: true });
    });

    it('allows public IP addresses', () => {
      expect(validateUrl('http://8.8.8.8/dns')).toEqual({ allowed: true });
    });
  });

  // -----------------------------------------------------------------------
  // Blocked protocols
  // -----------------------------------------------------------------------
  describe('blocked protocols', () => {
    it('blocks file:// protocol', () => {
      const result = validateUrl('file:///etc/passwd');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Blocked protocol');
    });

    it('blocks ftp:// protocol', () => {
      const result = validateUrl('ftp://ftp.example.com/file');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Blocked protocol');
    });

    it('blocks javascript: protocol', () => {
      const result = validateUrl('javascript:alert(1)');
      expect(result.allowed).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Metadata endpoints
  // -----------------------------------------------------------------------
  describe('metadata endpoints', () => {
    it('blocks AWS metadata endpoint (169.254.169.254)', () => {
      const result = validateUrl('http://169.254.169.254/latest/meta-data/');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('metadata');
    });

    it('blocks AWS container metadata (169.254.170.2)', () => {
      const result = validateUrl('http://169.254.170.2/v2/credentials');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('metadata');
    });

    it('blocks Google metadata hostname', () => {
      const result = validateUrl('http://metadata.google.internal/computeMetadata/v1/');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('metadata');
    });
  });

  // -----------------------------------------------------------------------
  // Localhost
  // -----------------------------------------------------------------------
  describe('localhost', () => {
    it('blocks localhost by name', () => {
      const result = validateUrl('http://localhost:3000/api');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('localhost');
    });

    it('blocks 127.0.0.1', () => {
      const result = validateUrl('http://127.0.0.1:8080');
      expect(result.allowed).toBe(false);
    });

    it('blocks 0.0.0.0', () => {
      const result = validateUrl('http://0.0.0.0:4000');
      expect(result.allowed).toBe(false);
    });

    it('blocks IPv6 loopback ::1', () => {
      const result = validateUrl('http://[::1]:3000');
      expect(result.allowed).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Private IP ranges
  // -----------------------------------------------------------------------
  describe('private IP ranges', () => {
    it('blocks 10.x.x.x range', () => {
      const result = validateUrl('http://10.0.0.1/internal');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('private IP');
    });

    it('blocks 172.16.x.x range', () => {
      const result = validateUrl('http://172.16.0.1/internal');
      expect(result.allowed).toBe(false);
    });

    it('blocks 172.31.x.x range', () => {
      const result = validateUrl('http://172.31.255.255/internal');
      expect(result.allowed).toBe(false);
    });

    it('blocks 192.168.x.x range', () => {
      const result = validateUrl('http://192.168.1.1/admin');
      expect(result.allowed).toBe(false);
    });

    it('blocks link-local 169.254.x.x range', () => {
      const result = validateUrl('http://169.254.1.1/something');
      expect(result.allowed).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Invalid URLs
  // -----------------------------------------------------------------------
  describe('invalid URLs', () => {
    it('rejects invalid URL strings', () => {
      const result = validateUrl('not-a-url');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Invalid URL');
    });

    it('rejects empty string', () => {
      const result = validateUrl('');
      expect(result.allowed).toBe(false);
    });
  });
});
