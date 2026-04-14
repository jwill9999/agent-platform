import { afterEach, describe, expect, it } from 'vitest';

import {
  foldOpenAiKeyGate,
  getOpenAiKeyOrNextJsonResponse,
  openAiKeyGateToApiOutcome,
  openAiLegacyBlockedMessage,
  resolveGatedOpenAiKeyForRequest,
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
      outcome: 'ok',
      key: 'sk-agent',
    });

    process.env.NEXT_OPENAI_API_KEY = 'sk-next';
    expect(resolveOpenAiApiKeyFromEnv('NEXT_OPENAI_API_KEY')).toEqual({
      outcome: 'ok',
      key: 'sk-next',
    });
  });

  it('returns missing when no keys are set', () => {
    expect(resolveOpenAiApiKeyFromEnv('AGENT_OPENAI_API_KEY')).toEqual({ outcome: 'missing' });
  });

  it('returns legacy_blocked when only OPENAI_API_KEY is set', () => {
    const snap = snapshotEnv();
    try {
      process.env.OPENAI_API_KEY = 'sk-legacy';
      delete process.env.AGENT_OPENAI_API_KEY;
      delete process.env.OPENAI_ALLOW_LEGACY_ENV;
      const r = resolveOpenAiApiKeyFromEnv('AGENT_OPENAI_API_KEY');
      expect(r.outcome).toBe('legacy_blocked');
      if (r.outcome === 'legacy_blocked') {
        expect(r.message).toContain('AGENT_OPENAI_API_KEY');
      }
      expect(openAiLegacyBlockedMessage('AGENT_OPENAI_API_KEY')).toContain('AGENT_OPENAI_API_KEY');
    } finally {
      restoreEnv(snap);
    }
  });

  it('allows OPENAI_API_KEY when OPENAI_ALLOW_LEGACY_ENV=1', () => {
    process.env.OPENAI_API_KEY = 'sk-legacy';
    process.env.OPENAI_ALLOW_LEGACY_ENV = '1';
    expect(resolveOpenAiApiKeyFromEnv('NEXT_OPENAI_API_KEY')).toEqual({
      outcome: 'ok',
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
    ).toEqual({ outcome: 'ok', key: 'sk-header' });
  });
});

describe('resolveGatedOpenAiKeyForRequest', () => {
  afterEach(() => {
    for (const k of keys) delete process.env[k];
  });

  it('matches resolveOpenAiKeyForRequest', () => {
    process.env.OPENAI_API_KEY = 'sk-legacy';
    expect(resolveGatedOpenAiKeyForRequest({ preferredEnvVar: 'NEXT_OPENAI_API_KEY' })).toEqual(
      resolveOpenAiKeyForRequest({ preferredEnvVar: 'NEXT_OPENAI_API_KEY' }),
    );
  });
});

describe('getOpenAiKeyOrNextJsonResponse', () => {
  it('returns JSON Response for legacy_blocked and missing', async () => {
    const blocked = getOpenAiKeyOrNextJsonResponse({
      outcome: 'legacy_blocked',
      message: 'msg',
    });
    expect(blocked).toBeInstanceOf(Response);
    expect((blocked as Response).status).toBe(400);
    expect(await (blocked as Response).json()).toEqual({ error: 'msg' });

    const missing = getOpenAiKeyOrNextJsonResponse({ outcome: 'missing' });
    expect(missing).toBeInstanceOf(Response);
    expect((missing as Response).status).toBe(500);
    expect(await (missing as Response).json()).toEqual({ error: 'NEXT_OPENAI_API_KEY is not set' });
  });

  it('returns key string when ok', () => {
    expect(getOpenAiKeyOrNextJsonResponse({ outcome: 'ok', key: 'sk' })).toBe('sk');
  });
});

describe('openAiKeyGateToApiOutcome', () => {
  it('maps outcomes for Express handlers', () => {
    expect(
      openAiKeyGateToApiOutcome({
        outcome: 'legacy_blocked',
        message: 'blocked',
      }),
    ).toEqual({ kind: 'error', code: 'LEGACY_ENV_BLOCKED', message: 'blocked' });
    expect(openAiKeyGateToApiOutcome({ outcome: 'missing' })).toEqual({
      kind: 'error',
      code: 'MISSING_KEY',
      message: 'Set AGENT_OPENAI_API_KEY or x-openai-key header',
    });
    expect(openAiKeyGateToApiOutcome({ outcome: 'ok', key: 'k' })).toEqual({
      kind: 'ok',
      key: 'k',
    });
  });
});

describe('foldOpenAiKeyGate', () => {
  it('dispatches all three outcomes', () => {
    expect(
      foldOpenAiKeyGate(
        { outcome: 'legacy_blocked', message: 'x' },
        {
          legacyBlocked: (m) => m,
          missing: () => 'm',
          ok: () => 'o',
        },
      ),
    ).toBe('x');
    expect(
      foldOpenAiKeyGate(
        { outcome: 'missing' },
        {
          legacyBlocked: () => 'l',
          missing: () => 'm',
          ok: () => 'o',
        },
      ),
    ).toBe('m');
    expect(
      foldOpenAiKeyGate(
        { outcome: 'ok', key: 'k' },
        {
          legacyBlocked: () => 'l',
          missing: () => 'm',
          ok: (k) => k,
        },
      ),
    ).toBe('k');
  });
});
