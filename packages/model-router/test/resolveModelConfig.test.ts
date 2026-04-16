import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resolveModelConfig } from '../src/resolveModelConfig.js';

const ENV_KEYS = [
  'OPENAI_API_KEY',
  'AGENT_OPENAI_API_KEY',
  'OPENAI_ALLOW_LEGACY_ENV',
  'DEFAULT_MODEL_PROVIDER',
  'DEFAULT_MODEL',
] as const;

function snapshotEnv(): Map<string, string | undefined> {
  const snap = new Map<string, string | undefined>();
  for (const k of ENV_KEYS) snap.set(k, process.env[k]);
  return snap;
}

function restoreEnv(snap: Map<string, string | undefined>) {
  for (const k of ENV_KEYS) {
    const v = snap.get(k);
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

describe('resolveModelConfig', () => {
  let envSnap: Map<string, string | undefined>;

  beforeEach(() => {
    envSnap = snapshotEnv();
    // Clean slate
    for (const k of ENV_KEYS) delete process.env[k];
  });

  afterEach(() => {
    restoreEnv(envSnap);
  });

  // -------------------------------------------------------------------------
  // Precedence chain: provider + model
  // -------------------------------------------------------------------------

  it('uses system fallback (openai/gpt-4o) when no override or env', () => {
    process.env.AGENT_OPENAI_API_KEY = 'sk-test';
    const result = resolveModelConfig();
    expect(result).toEqual({
      kind: 'ok',
      config: { provider: 'openai', model: 'gpt-4o', apiKey: 'sk-test' },
    });
  });

  it('uses env DEFAULT_MODEL_PROVIDER and DEFAULT_MODEL when set', () => {
    process.env.AGENT_ANTHROPIC_API_KEY = 'sk-ant-test';
    process.env.DEFAULT_MODEL_PROVIDER = 'anthropic';
    process.env.DEFAULT_MODEL = 'claude-3-sonnet';
    const result = resolveModelConfig();
    expect(result).toEqual({
      kind: 'ok',
      config: { provider: 'anthropic', model: 'claude-3-sonnet', apiKey: 'sk-ant-test' },
    });
  });

  it('agent override takes precedence over env defaults', () => {
    process.env.AGENT_OPENAI_API_KEY = 'sk-test';
    process.env.AGENT_ANTHROPIC_API_KEY = 'sk-ant-test';
    process.env.DEFAULT_MODEL_PROVIDER = 'anthropic';
    process.env.DEFAULT_MODEL = 'claude-3-sonnet';
    const result = resolveModelConfig({
      agentOverride: { provider: 'openai', model: 'gpt-4o-mini' },
    });
    expect(result).toEqual({
      kind: 'ok',
      config: { provider: 'openai', model: 'gpt-4o-mini', apiKey: 'sk-test' },
    });
  });

  it('agent override with null falls through to env/system', () => {
    process.env.AGENT_OPENAI_API_KEY = 'sk-test';
    const result = resolveModelConfig({ agentOverride: null });
    expect(result).toEqual({
      kind: 'ok',
      config: { provider: 'openai', model: 'gpt-4o', apiKey: 'sk-test' },
    });
  });

  // -------------------------------------------------------------------------
  // API key resolution
  // -------------------------------------------------------------------------

  it('uses header key when provided', () => {
    const result = resolveModelConfig({ headerKey: 'sk-header' });
    expect(result).toEqual({
      kind: 'ok',
      config: { provider: 'openai', model: 'gpt-4o', apiKey: 'sk-header' },
    });
  });

  it('returns error when no API key available', () => {
    const result = resolveModelConfig();
    expect(result.kind).toBe('error');
    if (result.kind === 'error') {
      expect(result.code).toBe('MISSING_KEY');
    }
  });

  it('returns error when only legacy OPENAI_API_KEY is set', () => {
    process.env.OPENAI_API_KEY = 'sk-legacy';
    const result = resolveModelConfig();
    expect(result.kind).toBe('error');
    if (result.kind === 'error') {
      expect(result.code).toBe('LEGACY_ENV_BLOCKED');
    }
  });

  it('allows legacy key when OPENAI_ALLOW_LEGACY_ENV=1', () => {
    process.env.OPENAI_API_KEY = 'sk-legacy';
    process.env.OPENAI_ALLOW_LEGACY_ENV = '1';
    const result = resolveModelConfig();
    expect(result).toEqual({
      kind: 'ok',
      config: { provider: 'openai', model: 'gpt-4o', apiKey: 'sk-legacy' },
    });
  });

  it('header key takes precedence over env', () => {
    process.env.AGENT_OPENAI_API_KEY = 'sk-env';
    const result = resolveModelConfig({ headerKey: 'sk-header' });
    expect(result).toEqual({
      kind: 'ok',
      config: { provider: 'openai', model: 'gpt-4o', apiKey: 'sk-header' },
    });
  });

  // -------------------------------------------------------------------------
  // Combined agent override + API key
  // -------------------------------------------------------------------------

  it('combines agent model override with header key', () => {
    const result = resolveModelConfig({
      agentOverride: { provider: 'anthropic', model: 'claude-3-haiku' },
      headerKey: 'sk-custom',
    });
    expect(result).toEqual({
      kind: 'ok',
      config: { provider: 'anthropic', model: 'claude-3-haiku', apiKey: 'sk-custom' },
    });
  });
});
