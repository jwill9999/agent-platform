import type { SupportedProvider } from './providers.js';

// ---------------------------------------------------------------------------
// Per-provider environment variable mapping
// ---------------------------------------------------------------------------

/** Maps provider names to their preferred API key env var. */
const PROVIDER_KEY_ENV: Record<SupportedProvider, string> = {
  openai: 'AGENT_OPENAI_API_KEY',
  anthropic: 'AGENT_ANTHROPIC_API_KEY',
  ollama: '', // Ollama doesn't need an API key
};

/** Maps provider names to their legacy/fallback env var (opt-in via ALLOW_LEGACY_ENV=1). */
const PROVIDER_LEGACY_ENV: Record<SupportedProvider, string> = {
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  ollama: '',
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ApiKeyResult =
  | { outcome: 'ok'; key: string }
  | { outcome: 'legacy_blocked'; message: string }
  | { outcome: 'not_required' }
  | { outcome: 'missing' };

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

/**
 * Resolve the API key for a given provider using a precedence chain:
 *
 *   1. Explicit header key (from request)
 *   2. Provider-specific env var (e.g. AGENT_ANTHROPIC_API_KEY)
 *   3. Legacy env var with opt-in gate (e.g. ANTHROPIC_API_KEY + ALLOW_LEGACY_ENV=1)
 *
 * Ollama returns `not_required` since local models don't need authentication.
 */
export function resolveApiKeyForProvider(options: {
  provider: SupportedProvider;
  headerKey?: string | null;
}): ApiKeyResult {
  const { provider, headerKey } = options;

  // Explicit header always wins
  const header = headerKey?.trim();
  if (header) return { outcome: 'ok', key: header };

  // Ollama doesn't need a key
  if (provider === 'ollama') return { outcome: 'not_required' };

  // Provider-specific env var
  const envVar = PROVIDER_KEY_ENV[provider];
  const preferred = envVar ? process.env[envVar]?.trim() : undefined;
  if (preferred) return { outcome: 'ok', key: preferred };

  // Legacy fallback with opt-in gate
  const legacyVar = PROVIDER_LEGACY_ENV[provider];
  const legacy = legacyVar ? process.env[legacyVar]?.trim() : undefined;
  if (!legacy) return { outcome: 'missing' };

  const allowLegacy =
    process.env.OPENAI_ALLOW_LEGACY_ENV === '1' || process.env.ALLOW_LEGACY_ENV === '1';
  if (allowLegacy) return { outcome: 'ok', key: legacy };

  return {
    outcome: 'legacy_blocked',
    message: `${legacyVar} is set but blocked. Set ${envVar} (same key), or set OPENAI_ALLOW_LEGACY_ENV=1 or ALLOW_LEGACY_ENV=1 to allow ${legacyVar}.`,
  };
}

/** Convert ApiKeyResult to the outcome shape used by resolveModelConfig. */
export function apiKeyResultToOutcome(
  result: ApiKeyResult,
): { kind: 'ok'; key?: string } | { kind: 'error'; code: string; message: string } {
  switch (result.outcome) {
    case 'ok':
      return { kind: 'ok', key: result.key };
    case 'not_required':
      return { kind: 'ok' };
    case 'legacy_blocked':
      return { kind: 'error', code: 'LEGACY_ENV_BLOCKED', message: result.message };
    case 'missing':
      return { kind: 'error', code: 'MISSING_KEY', message: 'API key not configured for provider' };
  }
}
