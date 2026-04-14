import { afterEach, describe, expect, it } from 'vitest';

import {
  gateOpenAiKeyResolution,
  openAiLegacyBlockedMessage,
  resolveOpenAiApiKeyFromEnv,
  resolveOpenAiKeyForRequest,
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

  it('prefers scoped keys over legacy OPENAI_API_KEY', () => {
    process.env.AGENT_OPENAI_API_KEY = ' sk-agent ';
    process.env.OPENAI_API_KEY = 'sk-legacy';
    expect(resolveOpenAiApiKeyFromEnv('AGENT_OPENAI_API_KEY')).toEqual({
      status: 'ok',
      key: 'sk-agent',
    });

    process.env.NEXT_OPENAI_API_KEY = 'sk-next';
    expect(resolveOpenAiApiKeyFromEnv('NEXT_OPENAI_API_KEY')).toEqual({
      status: 'ok',
      key: 'sk-next',
    });
  });

  it('returns missing when no keys are set', () => {
    expect(resolveOpenAiApiKeyFromEnv('AGENT_OPENAI_API_KEY')).toEqual({ status: 'missing' });
  });

  it('returns legacy_blocked when only OPENAI_API_KEY is set', () => {
    const snap = snapshotEnv();
    try {
      process.env.OPENAI_API_KEY = 'sk-legacy';
      delete process.env.AGENT_OPENAI_API_KEY;
      delete process.env.OPENAI_ALLOW_LEGACY_ENV;
      expect(resolveOpenAiApiKeyFromEnv('AGENT_OPENAI_API_KEY')).toEqual({
        status: 'legacy_blocked',
      });
      expect(openAiLegacyBlockedMessage('AGENT_OPENAI_API_KEY')).toContain('AGENT_OPENAI_API_KEY');
    } finally {
      restoreEnv(snap);
    }
  });

  it('allows OPENAI_API_KEY when OPENAI_ALLOW_LEGACY_ENV=1', () => {
    process.env.OPENAI_API_KEY = 'sk-legacy';
    process.env.OPENAI_ALLOW_LEGACY_ENV = '1';
    expect(resolveOpenAiApiKeyFromEnv('NEXT_OPENAI_API_KEY')).toEqual({
      status: 'ok',
      key: 'sk-legacy',
    });
  });

  it('prefers header key over env', () => {
    process.env.AGENT_OPENAI_API_KEY = 'sk-env';
    expect(
      resolveOpenAiKeyForRequest({
        preferredEnvVar: 'AGENT_OPENAI_API_KEY',
        headerKey: ' sk-header ',
      }),
    ).toEqual({ status: 'ok', key: 'sk-header' });
  });
});

describe('gateOpenAiKeyResolution', () => {
  it('maps legacy_blocked to message', () => {
    const g = gateOpenAiKeyResolution({ status: 'legacy_blocked' }, 'NEXT_OPENAI_API_KEY');
    expect(g.outcome).toBe('legacy_blocked');
    if (g.outcome === 'legacy_blocked') {
      expect(g.message).toContain('NEXT_OPENAI_API_KEY');
    }
  });

  it('passes through ok and missing', () => {
    expect(gateOpenAiKeyResolution({ status: 'ok', key: 'k' }, 'AGENT_OPENAI_API_KEY')).toEqual({
      outcome: 'ok',
      key: 'k',
    });
    expect(gateOpenAiKeyResolution({ status: 'missing' }, 'AGENT_OPENAI_API_KEY')).toEqual({
      outcome: 'missing',
    });
  });
});
