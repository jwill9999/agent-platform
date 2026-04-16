import { describe, it, expect, beforeEach } from 'vitest';
import { resolveApiKeyForProvider, apiKeyResultToOutcome } from '../src/resolveApiKey.js';

describe('resolveApiKeyForProvider', () => {
  const envSnapshot: Record<string, string | undefined> = {};
  const VARS = [
    'AGENT_OPENAI_API_KEY',
    'AGENT_ANTHROPIC_API_KEY',
    'OPENAI_API_KEY',
    'ANTHROPIC_API_KEY',
    'ALLOW_LEGACY_ENV',
    'OPENAI_ALLOW_LEGACY_ENV',
  ];

  beforeEach(() => {
    for (const v of VARS) {
      envSnapshot[v] = process.env[v];
      delete process.env[v];
    }
    return () => {
      for (const v of VARS) {
        if (envSnapshot[v] === undefined) delete process.env[v];
        else process.env[v] = envSnapshot[v];
      }
    };
  });

  // --- Header precedence ---

  it('uses explicit header key for openai', () => {
    const r = resolveApiKeyForProvider({ provider: 'openai', headerKey: 'hdr-key' });
    expect(r).toEqual({ outcome: 'ok', key: 'hdr-key' });
  });

  it('uses explicit header key for anthropic', () => {
    const r = resolveApiKeyForProvider({ provider: 'anthropic', headerKey: 'hdr-key' });
    expect(r).toEqual({ outcome: 'ok', key: 'hdr-key' });
  });

  it('header takes precedence over env vars', () => {
    process.env.AGENT_OPENAI_API_KEY = 'env-key';
    const r = resolveApiKeyForProvider({ provider: 'openai', headerKey: 'hdr-key' });
    expect(r).toEqual({ outcome: 'ok', key: 'hdr-key' });
  });

  // --- Ollama ---

  it('returns not_required for ollama', () => {
    const r = resolveApiKeyForProvider({ provider: 'ollama' });
    expect(r).toEqual({ outcome: 'not_required' });
  });

  it('ollama uses header if provided', () => {
    const r = resolveApiKeyForProvider({ provider: 'ollama', headerKey: 'custom' });
    expect(r).toEqual({ outcome: 'ok', key: 'custom' });
  });

  // --- Provider-specific env vars ---

  it('resolves openai from AGENT_OPENAI_API_KEY', () => {
    process.env.AGENT_OPENAI_API_KEY = 'agent-oai';
    const r = resolveApiKeyForProvider({ provider: 'openai' });
    expect(r).toEqual({ outcome: 'ok', key: 'agent-oai' });
  });

  it('resolves anthropic from AGENT_ANTHROPIC_API_KEY', () => {
    process.env.AGENT_ANTHROPIC_API_KEY = 'agent-ant';
    const r = resolveApiKeyForProvider({ provider: 'anthropic' });
    expect(r).toEqual({ outcome: 'ok', key: 'agent-ant' });
  });

  // --- Legacy fallback ---

  it('blocks legacy OPENAI_API_KEY without gate', () => {
    process.env.OPENAI_API_KEY = 'legacy-key';
    const r = resolveApiKeyForProvider({ provider: 'openai' });
    expect(r.outcome).toBe('legacy_blocked');
  });

  it('allows legacy OPENAI_API_KEY with ALLOW_LEGACY_ENV=1', () => {
    process.env.OPENAI_API_KEY = 'legacy-key';
    process.env.ALLOW_LEGACY_ENV = '1';
    const r = resolveApiKeyForProvider({ provider: 'openai' });
    expect(r).toEqual({ outcome: 'ok', key: 'legacy-key' });
  });

  it('allows legacy with OPENAI_ALLOW_LEGACY_ENV=1', () => {
    process.env.OPENAI_API_KEY = 'legacy-key';
    process.env.OPENAI_ALLOW_LEGACY_ENV = '1';
    const r = resolveApiKeyForProvider({ provider: 'openai' });
    expect(r).toEqual({ outcome: 'ok', key: 'legacy-key' });
  });

  it('blocks legacy ANTHROPIC_API_KEY without gate', () => {
    process.env.ANTHROPIC_API_KEY = 'legacy-ant';
    const r = resolveApiKeyForProvider({ provider: 'anthropic' });
    expect(r.outcome).toBe('legacy_blocked');
  });

  it('allows legacy ANTHROPIC_API_KEY with ALLOW_LEGACY_ENV=1', () => {
    process.env.ANTHROPIC_API_KEY = 'legacy-ant';
    process.env.ALLOW_LEGACY_ENV = '1';
    const r = resolveApiKeyForProvider({ provider: 'anthropic' });
    expect(r).toEqual({ outcome: 'ok', key: 'legacy-ant' });
  });

  // --- Missing key ---

  it('returns missing when no key configured for openai', () => {
    const r = resolveApiKeyForProvider({ provider: 'openai' });
    expect(r).toEqual({ outcome: 'missing' });
  });

  it('returns missing when no key configured for anthropic', () => {
    const r = resolveApiKeyForProvider({ provider: 'anthropic' });
    expect(r).toEqual({ outcome: 'missing' });
  });
});

describe('apiKeyResultToOutcome', () => {
  it('maps ok result', () => {
    expect(apiKeyResultToOutcome({ outcome: 'ok', key: 'k' })).toEqual({ kind: 'ok', key: 'k' });
  });

  it('maps not_required to ok with no key', () => {
    expect(apiKeyResultToOutcome({ outcome: 'not_required' })).toEqual({ kind: 'ok' });
  });

  it('maps legacy_blocked to error', () => {
    const result = apiKeyResultToOutcome({ outcome: 'legacy_blocked', message: 'msg' });
    expect(result).toEqual({ kind: 'error', code: 'LEGACY_ENV_BLOCKED', message: 'msg' });
  });

  it('maps missing to error', () => {
    const result = apiKeyResultToOutcome({ outcome: 'missing' });
    expect(result).toEqual({
      kind: 'error',
      code: 'MISSING_KEY',
      message: 'API key not configured for provider',
    });
  });
});
