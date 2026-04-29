import { describe, it, expect } from 'vitest';
import { scanOutput, scanOutboundBody, redactCredentials } from '../src/security/outputGuard.js';

// Well-known jwt.io example token, split to avoid secret-scanner false positives
const JWT_PARTS = [
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
  'eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ',
  'SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
];
const EXAMPLE_JWT = JWT_PARTS.join('.');
const EXAMPLE_PASSWORD = ['s3cret', 'P@ss!'].join('');
const EXAMPLE_OPENAI_KEY = ['sk-proj-', 'abcdefghijklmnopqrstuvwxyz1234567890'].join('');

describe('OutputGuard', () => {
  // -----------------------------------------------------------------------
  // scanOutput — credential pattern detection
  // -----------------------------------------------------------------------
  describe('scanOutput', () => {
    it('returns safe for benign content', () => {
      const result = scanOutput('The weather is sunny and 72°F.');
      expect(result.safe).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('detects AWS access key pattern', () => {
      const result = scanOutput('key = AKIAIOSFODNN7EXAMPLE');
      expect(result.safe).toBe(false);
      expect(result.issues.some((i) => i.toLowerCase().includes('aws'))).toBe(true);
    });

    it('detects JWT tokens', () => {
      const result = scanOutput(`token: ${EXAMPLE_JWT}`);
      expect(result.safe).toBe(false);
    });

    it('detects GitHub tokens (ghp_)', () => {
      const result = scanOutput('GITHUB_TOKEN=ghp_ABCDEFghijklmnop1234567890abcdef1234567890');
      expect(result.safe).toBe(false);
    });

    it('detects OpenAI API keys', () => {
      const result = scanOutput(`Incorrect API key provided: ${EXAMPLE_OPENAI_KEY}`);
      expect(result.safe).toBe(false);
      expect(result.issues.some((issue) => issue.includes('OpenAI'))).toBe(true);
    });

    it('detects private key blocks', () => {
      const result = scanOutput(
        '-----BEGIN RSA PRIVATE KEY-----\nMIIE...\n-----END RSA PRIVATE KEY-----',
      );
      expect(result.safe).toBe(false);
    });

    it('detects generic secret patterns (password=...)', () => {
      const result = scanOutput(`password=${EXAMPLE_PASSWORD}`);
      expect(result.safe).toBe(false);
    });

    it('does not false-positive on normal code', () => {
      const result = scanOutput('const maxRetries = 3; // configuration value');
      expect(result.safe).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // scanOutboundBody — outbound request body scanning
  // -----------------------------------------------------------------------
  describe('scanOutboundBody', () => {
    it('returns safe for normal request body', () => {
      const result = scanOutboundBody(
        'https://api.example.com/data',
        JSON.stringify({ name: 'test', value: 42 }),
      );
      expect(result.safe).toBe(true);
    });

    it('detects session_id in request body', () => {
      const result = scanOutboundBody(
        'https://evil.com/exfil',
        JSON.stringify({ session_id: 'abc123', data: 'leaked' }),
      );
      expect(result.safe).toBe(false);
    });

    it('detects system_prompt in request body', () => {
      const result = scanOutboundBody(
        'https://api.example.com',
        'Here is the system_prompt: You are an assistant...',
      );
      expect(result.safe).toBe(false);
    });

    it('detects access_token in request body', () => {
      const result = scanOutboundBody(
        'https://api.example.com',
        JSON.stringify({ access_token: 'secret-value' }),
      );
      expect(result.safe).toBe(false);
    });

    it('detects private key block in request body', () => {
      const result = scanOutboundBody(
        'https://api.example.com',
        '-----BEGIN RSA PRIVATE KEY-----\nMIIE...',
      );
      expect(result.safe).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // redactCredentials
  // -----------------------------------------------------------------------
  describe('redactCredentials', () => {
    it('redacts AWS access keys', () => {
      const input = 'aws_access_key_id = AKIAIOSFODNN7EXAMPLE';
      const output = redactCredentials(input);
      expect(output).not.toContain('AKIAIOSFODNN7EXAMPLE');
      expect(output).toContain('[REDACTED:');
    });

    it('redacts GitHub tokens', () => {
      const input = 'export GH_TOKEN=ghp_ABCDEFghijklmnop1234567890abcdef1234567890';
      const output = redactCredentials(input);
      expect(output).not.toContain('ghp_ABCDEFghijklmnop1234567890abcdef1234567890');
      expect(output).toContain('[REDACTED:');
    });

    it('redacts OpenAI API keys from provider errors', () => {
      const output = redactCredentials(`Incorrect API key provided: ${EXAMPLE_OPENAI_KEY}`);
      expect(output).not.toContain(EXAMPLE_OPENAI_KEY);
      expect(output).toContain('[REDACTED:OpenAI API Key]');
    });

    it('preserves non-sensitive content', () => {
      const input = 'Hello world, this is fine.';
      const output = redactCredentials(input);
      expect(output).toBe(input);
    });
  });
});
