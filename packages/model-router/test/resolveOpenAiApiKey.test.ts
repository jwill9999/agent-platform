import { afterEach, describe, expect, it } from 'vitest';

import {
  OpenAiLegacyEnvBlockedError,
  resolveOpenAiApiKeyFromEnv,
} from '../src/resolveOpenAiApiKey.js';

const keys = [
  'AGENT_OPENAI_API_KEY',
  'NEXT_OPENAI_API_KEY',
  'OPENAI_API_KEY',
  'OPENAI_ALLOW_LEGACY_ENV',
] as const;

function snapshotEnv() {
  const snap = new Map<string, string | undefined>();
  for (const k of keys) snap.set(k, process.env[k]);
  return snap;
}

function restoreEnv(snap: Map<string, string | undefined>) {
  for (const k of keys) {
    const v = snap.get(k);
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

describe('resolveOpenAiApiKeyFromEnv', () => {
  afterEach(() => {
    for (const k of keys) delete process.env[k];
  });

  it('returns preferred AGENT_OPENAI_API_KEY when set', () => {
    process.env.AGENT_OPENAI_API_KEY = ' sk-agent ';
    process.env.OPENAI_API_KEY = 'sk-legacy';
    expect(resolveOpenAiApiKeyFromEnv('AGENT_OPENAI_API_KEY')).toBe('sk-agent');
  });

  it('returns preferred NEXT_OPENAI_API_KEY when set', () => {
    process.env.NEXT_OPENAI_API_KEY = 'sk-next';
    process.env.OPENAI_API_KEY = 'sk-legacy';
    expect(resolveOpenAiApiKeyFromEnv('NEXT_OPENAI_API_KEY')).toBe('sk-next');
  });

  it('returns null when no keys are set', () => {
    expect(resolveOpenAiApiKeyFromEnv('AGENT_OPENAI_API_KEY')).toBeNull();
  });

  it('throws OpenAiLegacyEnvBlockedError when only OPENAI_API_KEY is set', () => {
    const snap = snapshotEnv();
    try {
      process.env.OPENAI_API_KEY = 'sk-legacy';
      delete process.env.AGENT_OPENAI_API_KEY;
      delete process.env.OPENAI_ALLOW_LEGACY_ENV;
      expect(() => resolveOpenAiApiKeyFromEnv('AGENT_OPENAI_API_KEY')).toThrow(OpenAiLegacyEnvBlockedError);
    } finally {
      restoreEnv(snap);
    }
  });

  it('uses OPENAI_API_KEY when OPENAI_ALLOW_LEGACY_ENV=1', () => {
    process.env.OPENAI_API_KEY = 'sk-legacy';
    process.env.OPENAI_ALLOW_LEGACY_ENV = '1';
    expect(resolveOpenAiApiKeyFromEnv('NEXT_OPENAI_API_KEY')).toBe('sk-legacy');
  });
});
