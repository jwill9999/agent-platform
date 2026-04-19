import { describe, it, expect } from 'vitest';
import { executeZeroRiskTool, ZERO_RISK_IDS, ZERO_RISK_TOOLS } from '../src/tools/zeroRiskTools.js';

describe('Zero-risk tools', () => {
  it('has 11 tool definitions', () => {
    expect(ZERO_RISK_TOOLS).toHaveLength(11);
  });

  it('all tool IDs start with sys_', () => {
    for (const tool of ZERO_RISK_TOOLS) {
      expect(tool.id).toMatch(/^sys_/);
    }
  });

  it('all tools have riskTier zero', () => {
    for (const tool of ZERO_RISK_TOOLS) {
      expect(tool.riskTier).toBe('zero');
    }
  });

  describe('generate_uuid', () => {
    it('returns a valid UUID v4', () => {
      const result = executeZeroRiskTool(ZERO_RISK_IDS.generateUuid, {});
      expect(result).not.toBeNull();
      expect(result!.type).toBe('tool_result');
      if (result!.type === 'tool_result') {
        expect(result!.data.uuid).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
        );
      }
    });

    it('generates unique UUIDs', () => {
      const r1 = executeZeroRiskTool(ZERO_RISK_IDS.generateUuid, {});
      const r2 = executeZeroRiskTool(ZERO_RISK_IDS.generateUuid, {});
      if (r1!.type === 'tool_result' && r2!.type === 'tool_result') {
        expect(r1!.data.uuid).not.toBe(r2!.data.uuid);
      }
    });
  });

  describe('get_current_time', () => {
    it('returns ISO and unix timestamps', () => {
      const result = executeZeroRiskTool(ZERO_RISK_IDS.getCurrentTime, {});
      expect(result!.type).toBe('tool_result');
      if (result!.type === 'tool_result') {
        expect(result!.data.iso).toMatch(/^\d{4}-\d{2}-\d{2}T/);
        expect(typeof result!.data.unix).toBe('number');
        expect(result!.data.timezone).toBe('UTC');
      }
    });
  });

  describe('json_parse', () => {
    it('parses valid JSON', () => {
      const result = executeZeroRiskTool(ZERO_RISK_IDS.jsonParse, {
        text: '{"name":"test","value":42}',
      });
      expect(result!.type).toBe('tool_result');
      if (result!.type === 'tool_result') {
        expect(result!.data.result).toEqual({ name: 'test', value: 42 });
      }
    });

    it('returns error on invalid JSON', () => {
      const result = executeZeroRiskTool(ZERO_RISK_IDS.jsonParse, {
        text: 'not json',
      });
      expect(result!.type).toBe('error');
    });
  });

  describe('json_stringify', () => {
    it('stringifies data', () => {
      const result = executeZeroRiskTool(ZERO_RISK_IDS.jsonStringify, {
        data: { a: 1 },
      });
      expect(result!.type).toBe('tool_result');
      if (result!.type === 'tool_result') {
        expect(result!.data.result).toBe('{"a":1}');
      }
    });

    it('pretty-prints when requested', () => {
      const result = executeZeroRiskTool(ZERO_RISK_IDS.jsonStringify, {
        data: { a: 1 },
        pretty: true,
      });
      if (result!.type === 'tool_result') {
        expect(result!.data.result).toContain('\n');
      }
    });
  });

  describe('regex_match', () => {
    it('finds matches in text', () => {
      const result = executeZeroRiskTool(ZERO_RISK_IDS.regexMatch, {
        text: 'hello world hello',
        pattern: 'hello',
      });
      expect(result!.type).toBe('tool_result');
      if (result!.type === 'tool_result') {
        expect(result!.data.matched).toBe(true);
        expect(result!.data.count).toBe(2);
      }
    });

    it('returns no match for non-matching pattern', () => {
      const result = executeZeroRiskTool(ZERO_RISK_IDS.regexMatch, {
        text: 'hello world',
        pattern: 'xyz',
      });
      if (result!.type === 'tool_result') {
        expect(result!.data.matched).toBe(false);
        expect(result!.data.count).toBe(0);
      }
    });

    it('returns error for invalid regex', () => {
      const result = executeZeroRiskTool(ZERO_RISK_IDS.regexMatch, {
        text: 'test',
        pattern: '[invalid',
      });
      expect(result!.type).toBe('error');
    });
  });

  describe('regex_replace', () => {
    it('replaces matches', () => {
      const result = executeZeroRiskTool(ZERO_RISK_IDS.regexReplace, {
        text: 'foo bar foo',
        pattern: 'foo',
        replacement: 'baz',
      });
      if (result!.type === 'tool_result') {
        expect(result!.data.result).toBe('baz bar baz');
      }
    });
  });

  describe('count_tokens', () => {
    it('counts chars, words, lines', () => {
      const result = executeZeroRiskTool(ZERO_RISK_IDS.countTokens, {
        text: 'hello world\nfoo bar',
      });
      if (result!.type === 'tool_result') {
        expect(result!.data.chars).toBe(19);
        expect(result!.data.words).toBe(4);
        expect(result!.data.lines).toBe(2);
        expect(result!.data.estimatedTokens).toBeGreaterThan(0);
      }
    });
  });

  describe('base64_encode / decode', () => {
    it('encodes to base64', () => {
      const result = executeZeroRiskTool(ZERO_RISK_IDS.base64Encode, {
        text: 'Hello, World!',
      });
      if (result!.type === 'tool_result') {
        expect(result!.data.encoded).toBe('SGVsbG8sIFdvcmxkIQ==');
      }
    });

    it('decodes from base64', () => {
      const result = executeZeroRiskTool(ZERO_RISK_IDS.base64Decode, {
        encoded: 'SGVsbG8sIFdvcmxkIQ==',
      });
      if (result!.type === 'tool_result') {
        expect(result!.data.decoded).toBe('Hello, World!');
      }
    });

    it('round-trips correctly', () => {
      const original = 'Special chars: àéïõü 🎉';
      const encoded = executeZeroRiskTool(ZERO_RISK_IDS.base64Encode, {
        text: original,
      });
      if (encoded!.type === 'tool_result') {
        const decoded = executeZeroRiskTool(ZERO_RISK_IDS.base64Decode, {
          encoded: encoded!.data.encoded,
        });
        if (decoded!.type === 'tool_result') {
          expect(decoded!.data.decoded).toBe(original);
        }
      }
    });
  });

  describe('hash_string', () => {
    it('computes sha256 hash', () => {
      const result = executeZeroRiskTool(ZERO_RISK_IDS.hashString, {
        text: 'hello',
      });
      if (result!.type === 'tool_result') {
        expect(result!.data.algorithm).toBe('sha256');
        expect(result!.data.hash).toBe(
          '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
        );
      }
    });

    it('computes sha512 hash', () => {
      const result = executeZeroRiskTool(ZERO_RISK_IDS.hashString, {
        text: 'hello',
        algorithm: 'sha512',
      });
      if (result!.type === 'tool_result') {
        expect(result!.data.algorithm).toBe('sha512');
        expect(result!.data.hash).toHaveLength(128); // 512 bits = 128 hex chars
      }
    });

    it('rejects unsupported algorithm', () => {
      const result = executeZeroRiskTool(ZERO_RISK_IDS.hashString, {
        text: 'hello',
        algorithm: 'md5',
      });
      expect(result!.type).toBe('error');
    });
  });

  describe('template_render', () => {
    it('renders template with variables', () => {
      const result = executeZeroRiskTool(ZERO_RISK_IDS.templateRender, {
        template: 'Hello, {{name}}! You have {{count}} messages.',
        variables: { name: 'Alice', count: 5 },
      });
      if (result!.type === 'tool_result') {
        expect(result!.data.result).toBe('Hello, Alice! You have 5 messages.');
      }
    });

    it('preserves unmatched placeholders', () => {
      const result = executeZeroRiskTool(ZERO_RISK_IDS.templateRender, {
        template: '{{greeting}}, {{name}}!',
        variables: { name: 'Bob' },
      });
      if (result!.type === 'tool_result') {
        expect(result!.data.result).toBe('{{greeting}}, Bob!');
      }
    });
  });

  it('returns null for unknown tool ID', () => {
    const result = executeZeroRiskTool('sys_unknown', {});
    expect(result).toBeNull();
  });
});
