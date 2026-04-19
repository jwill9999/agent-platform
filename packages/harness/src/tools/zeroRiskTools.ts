/**
 * Zero-risk system tools — pure compute, no I/O.
 *
 * These tools are safe to execute without any security checks:
 * no file access, no network, no side effects.
 */

import { createHash, randomUUID } from 'node:crypto';

import type { Output, Tool as ContractTool } from '@agent-platform/contracts';
import {
  SYSTEM_TOOL_PREFIX,
  stringArg,
  errorMessage,
  toolResult,
  toolError,
  buildRiskMap,
} from './toolHelpers.js';

// ---------------------------------------------------------------------------
// IDs
// ---------------------------------------------------------------------------

export const ZERO_RISK_IDS = {
  generateUuid: `${SYSTEM_TOOL_PREFIX}generate_uuid`,
  getCurrentTime: `${SYSTEM_TOOL_PREFIX}get_current_time`,
  jsonParse: `${SYSTEM_TOOL_PREFIX}json_parse`,
  jsonStringify: `${SYSTEM_TOOL_PREFIX}json_stringify`,
  regexMatch: `${SYSTEM_TOOL_PREFIX}regex_match`,
  regexReplace: `${SYSTEM_TOOL_PREFIX}regex_replace`,
  countTokens: `${SYSTEM_TOOL_PREFIX}count_tokens`,
  base64Encode: `${SYSTEM_TOOL_PREFIX}base64_encode`,
  base64Decode: `${SYSTEM_TOOL_PREFIX}base64_decode`,
  hashString: `${SYSTEM_TOOL_PREFIX}hash_string`,
  templateRender: `${SYSTEM_TOOL_PREFIX}template_render`,
} as const;

// ---------------------------------------------------------------------------
// Risk assignments
// ---------------------------------------------------------------------------

export const ZERO_RISK_MAP = buildRiskMap(ZERO_RISK_IDS, 'zero');

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

export const ZERO_RISK_TOOLS: readonly ContractTool[] = [
  {
    id: ZERO_RISK_IDS.generateUuid,
    slug: 'sys-generate-uuid',
    name: 'generate_uuid',
    description: 'Generate a new random UUID (v4).',
    riskTier: 'zero',
    config: { inputSchema: { type: 'object', properties: {} } },
  },
  {
    id: ZERO_RISK_IDS.getCurrentTime,
    slug: 'sys-get-current-time',
    name: 'get_current_time',
    description: 'Get the current date/time as ISO 8601 and Unix timestamp.',
    riskTier: 'zero',
    config: {
      inputSchema: {
        type: 'object',
        properties: {
          timezone: {
            type: 'string',
            description: 'IANA timezone (e.g. "America/New_York"). Defaults to UTC.',
          },
        },
      },
    },
  },
  {
    id: ZERO_RISK_IDS.jsonParse,
    slug: 'sys-json-parse',
    name: 'json_parse',
    description: 'Parse a JSON string and return the structured data.',
    riskTier: 'zero',
    config: {
      inputSchema: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'JSON string to parse.' },
        },
        required: ['text'],
      },
    },
  },
  {
    id: ZERO_RISK_IDS.jsonStringify,
    slug: 'sys-json-stringify',
    name: 'json_stringify',
    description: 'Convert data to a JSON string with optional pretty-printing.',
    riskTier: 'zero',
    config: {
      inputSchema: {
        type: 'object',
        properties: {
          data: { description: 'Data to stringify (any JSON-compatible value).' },
          pretty: {
            type: 'boolean',
            description: 'Pretty-print with 2-space indentation (default false).',
          },
        },
        required: ['data'],
      },
    },
  },
  {
    id: ZERO_RISK_IDS.regexMatch,
    slug: 'sys-regex-match',
    name: 'regex_match',
    description: 'Test text against a regular expression and return matches.',
    riskTier: 'zero',
    config: {
      inputSchema: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'Text to search.' },
          pattern: { type: 'string', description: 'Regular expression pattern.' },
          flags: {
            type: 'string',
            description: 'Regex flags (e.g. "gi"). Defaults to "".',
          },
        },
        required: ['text', 'pattern'],
      },
    },
  },
  {
    id: ZERO_RISK_IDS.regexReplace,
    slug: 'sys-regex-replace',
    name: 'regex_replace',
    description: 'Replace occurrences of a regex pattern in text.',
    riskTier: 'zero',
    config: {
      inputSchema: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'Text to transform.' },
          pattern: { type: 'string', description: 'Regular expression pattern.' },
          replacement: { type: 'string', description: 'Replacement string.' },
          flags: { type: 'string', description: 'Regex flags (default "g").' },
        },
        required: ['text', 'pattern', 'replacement'],
      },
    },
  },
  {
    id: ZERO_RISK_IDS.countTokens,
    slug: 'sys-count-tokens',
    name: 'count_tokens',
    description: 'Count characters, words, lines, and estimate tokens in text.',
    riskTier: 'zero',
    config: {
      inputSchema: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'Text to count.' },
        },
        required: ['text'],
      },
    },
  },
  {
    id: ZERO_RISK_IDS.base64Encode,
    slug: 'sys-base64-encode',
    name: 'base64_encode',
    description: 'Encode a string to base64.',
    riskTier: 'zero',
    config: {
      inputSchema: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'Text to encode.' },
        },
        required: ['text'],
      },
    },
  },
  {
    id: ZERO_RISK_IDS.base64Decode,
    slug: 'sys-base64-decode',
    name: 'base64_decode',
    description: 'Decode a base64 string to UTF-8 text.',
    riskTier: 'zero',
    config: {
      inputSchema: {
        type: 'object',
        properties: {
          encoded: { type: 'string', description: 'Base64 string to decode.' },
        },
        required: ['encoded'],
      },
    },
  },
  {
    id: ZERO_RISK_IDS.hashString,
    slug: 'sys-hash-string',
    name: 'hash_string',
    description: 'Compute a SHA-256 or SHA-512 hash of a string.',
    riskTier: 'zero',
    config: {
      inputSchema: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'Text to hash.' },
          algorithm: {
            type: 'string',
            description: 'Hash algorithm: "sha256" or "sha512" (default "sha256").',
          },
        },
        required: ['text'],
      },
    },
  },
  {
    id: ZERO_RISK_IDS.templateRender,
    slug: 'sys-template-render',
    name: 'template_render',
    description: 'Render a template string by replacing {{key}} placeholders with provided values.',
    riskTier: 'zero',
    config: {
      inputSchema: {
        type: 'object',
        properties: {
          template: {
            type: 'string',
            description: 'Template with {{key}} placeholders.',
          },
          variables: {
            type: 'object',
            description: 'Key-value map of variables to substitute.',
          },
        },
        required: ['template', 'variables'],
      },
    },
  },
];

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

function handleGenerateUuid(toolId: string): Output {
  return toolResult(toolId, { uuid: randomUUID() });
}

function handleGetCurrentTime(toolId: string, args: Record<string, unknown>): Output {
  const tz = stringArg(args, 'timezone', 'UTC');
  const now = new Date();
  let formatted: string;
  try {
    formatted = now.toLocaleString('en-US', {
      timeZone: tz,
      dateStyle: 'full',
      timeStyle: 'long',
    });
  } catch {
    formatted = now.toISOString();
  }
  return toolResult(toolId, {
    iso: now.toISOString(),
    unix: Math.floor(now.getTime() / 1000),
    formatted,
    timezone: tz,
  });
}

function handleJsonParse(toolId: string, args: Record<string, unknown>): Output {
  const text = stringArg(args, 'text');
  try {
    const parsed: unknown = JSON.parse(text);
    return toolResult(toolId, { result: parsed });
  } catch (err) {
    return toolError('JSON_PARSE_FAILED', errorMessage(err));
  }
}

function handleJsonStringify(toolId: string, args: Record<string, unknown>): Output {
  const data = args.data;
  const pretty = args.pretty === true;
  try {
    const result = JSON.stringify(data, null, pretty ? 2 : undefined);
    return toolResult(toolId, { result });
  } catch (err) {
    return toolError('JSON_STRINGIFY_FAILED', errorMessage(err));
  }
}

const MAX_REGEX_INPUT_LEN = 100_000;

function handleRegexMatch(toolId: string, args: Record<string, unknown>): Output {
  const text = stringArg(args, 'text');
  const pattern = stringArg(args, 'pattern');
  const flags = stringArg(args, 'flags');
  if (text.length > MAX_REGEX_INPUT_LEN) {
    return toolError('INPUT_TOO_LARGE', 'Text exceeds 100k character limit for regex');
  }
  try {
    const regex = new RegExp(pattern, flags);
    const globalFlags = regex.flags.includes('g') ? regex.flags : regex.flags + 'g';
    const matches = [...text.matchAll(new RegExp(regex.source, globalFlags))];
    return toolResult(toolId, {
      matched: matches.length > 0,
      count: matches.length,
      matches: matches.slice(0, 100).map((m) => ({
        match: m[0],
        index: m.index,
        groups: m.groups ?? null,
      })),
    });
  } catch (err) {
    return toolError('REGEX_ERROR', errorMessage(err));
  }
}

function handleRegexReplace(toolId: string, args: Record<string, unknown>): Output {
  const text = stringArg(args, 'text');
  const pattern = stringArg(args, 'pattern');
  const replacement = stringArg(args, 'replacement');
  const flags = stringArg(args, 'flags', 'g');
  try {
    const regex = new RegExp(pattern, flags);
    const result = text.replace(regex, replacement);
    return toolResult(toolId, { result });
  } catch (err) {
    return toolError('REGEX_ERROR', errorMessage(err));
  }
}

function handleCountTokens(toolId: string, args: Record<string, unknown>): Output {
  const text = stringArg(args, 'text');
  const chars = text.length;
  const words = text.split(/\s+/).filter(Boolean).length;
  const lines = text.split('\n').length;
  // Rough token estimate: ~4 chars per token (GPT-like)
  const estimatedTokens = Math.ceil(chars / 4);
  return toolResult(toolId, { chars, words, lines, estimatedTokens });
}

function handleBase64Encode(toolId: string, args: Record<string, unknown>): Output {
  const text = stringArg(args, 'text');
  return toolResult(toolId, { encoded: Buffer.from(text, 'utf-8').toString('base64') });
}

function handleBase64Decode(toolId: string, args: Record<string, unknown>): Output {
  const encoded = stringArg(args, 'encoded');
  try {
    const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
    return toolResult(toolId, { decoded });
  } catch (err) {
    return toolError('BASE64_DECODE_FAILED', errorMessage(err));
  }
}

function handleHashString(toolId: string, args: Record<string, unknown>): Output {
  const text = stringArg(args, 'text');
  const algorithm = stringArg(args, 'algorithm', 'sha256');
  const allowed = ['sha256', 'sha512'];
  if (!allowed.includes(algorithm)) {
    return toolError('INVALID_ARGS', `Algorithm must be one of: ${allowed.join(', ')}`);
  }
  const hash = createHash(algorithm).update(text, 'utf-8').digest('hex');
  return toolResult(toolId, { hash, algorithm });
}

function handleTemplateRender(toolId: string, args: Record<string, unknown>): Output {
  const template = stringArg(args, 'template');
  const variables = (
    args.variables && typeof args.variables === 'object' ? args.variables : {}
  ) as Record<string, unknown>;
  const result = template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    const val = variables[key];
    return val !== undefined ? String(val) : `{{${key}}}`;
  });
  return toolResult(toolId, { result });
}

// ---------------------------------------------------------------------------
// Executor — returns null if toolId is not a zero-risk tool
// ---------------------------------------------------------------------------

export function executeZeroRiskTool(toolId: string, args: Record<string, unknown>): Output | null {
  switch (toolId) {
    case ZERO_RISK_IDS.generateUuid:
      return handleGenerateUuid(toolId);
    case ZERO_RISK_IDS.getCurrentTime:
      return handleGetCurrentTime(toolId, args);
    case ZERO_RISK_IDS.jsonParse:
      return handleJsonParse(toolId, args);
    case ZERO_RISK_IDS.jsonStringify:
      return handleJsonStringify(toolId, args);
    case ZERO_RISK_IDS.regexMatch:
      return handleRegexMatch(toolId, args);
    case ZERO_RISK_IDS.regexReplace:
      return handleRegexReplace(toolId, args);
    case ZERO_RISK_IDS.countTokens:
      return handleCountTokens(toolId, args);
    case ZERO_RISK_IDS.base64Encode:
      return handleBase64Encode(toolId, args);
    case ZERO_RISK_IDS.base64Decode:
      return handleBase64Decode(toolId, args);
    case ZERO_RISK_IDS.hashString:
      return handleHashString(toolId, args);
    case ZERO_RISK_IDS.templateRender:
      return handleTemplateRender(toolId, args);
    default:
      return null;
  }
}
