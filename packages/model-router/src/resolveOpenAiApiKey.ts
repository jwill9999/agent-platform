/**
 * Resolves the OpenAI API key from process env with a scoped preferred var and
 * a guarded legacy `OPENAI_API_KEY` fallback (opt-in via OPENAI_ALLOW_LEGACY_ENV=1).
 * Never logs key material.
 */
export type PreferredOpenAiEnvVar = 'AGENT_OPENAI_API_KEY' | 'NEXT_OPENAI_API_KEY';

export type OpenAiKeyGateResult =
  | { outcome: 'ok'; key: string }
  | { outcome: 'legacy_blocked'; message: string }
  | { outcome: 'missing' };

export function openAiLegacyBlockedMessage(preferredEnvVar: PreferredOpenAiEnvVar): string {
  const hint =
    preferredEnvVar === 'NEXT_OPENAI_API_KEY'
      ? 'Use NEXT_OPENAI_API_KEY, or set OPENAI_ALLOW_LEGACY_ENV=1 to allow legacy env fallback.'
      : 'Use AGENT_OPENAI_API_KEY, or set OPENAI_ALLOW_LEGACY_ENV=1 to allow legacy env fallback.';
  return `OPENAI_API_KEY is set but blocked. ${hint}`;
}

export function resolveOpenAiApiKeyFromEnv(
  preferredEnvVar: PreferredOpenAiEnvVar,
): OpenAiKeyGateResult {
  const preferred = process.env[preferredEnvVar]?.trim();
  if (preferred) return { outcome: 'ok', key: preferred };

  const legacy = process.env.OPENAI_API_KEY?.trim();
  if (!legacy) return { outcome: 'missing' };

  if (process.env.OPENAI_ALLOW_LEGACY_ENV === '1') {
    return { outcome: 'ok', key: legacy };
  }
  return { outcome: 'legacy_blocked', message: openAiLegacyBlockedMessage(preferredEnvVar) };
}

/**
 * Prefer an explicit header key (e.g. `x-openai-key`) when present, otherwise resolve from env.
 */
export function resolveOpenAiKeyForRequest(options: {
  preferredEnvVar: PreferredOpenAiEnvVar;
  headerKey?: string | null;
}): OpenAiKeyGateResult {
  const header = options.headerKey?.trim();
  if (header) return { outcome: 'ok', key: header };
  return resolveOpenAiApiKeyFromEnv(options.preferredEnvVar);
}

/** Alias: resolve + legacy guard in one step. */
export function resolveGatedOpenAiKeyForRequest(options: {
  preferredEnvVar: PreferredOpenAiEnvVar;
  headerKey?: string | null;
}): OpenAiKeyGateResult {
  return resolveOpenAiKeyForRequest(options);
}

const JSON_HEADERS = { 'Content-Type': 'application/json' } as const;

/**
 * Single switch over gated outcomes (avoids duplicated if-chains across Next/API callers).
 */
export function foldOpenAiKeyGate<T>(
  gated: OpenAiKeyGateResult,
  handlers: {
    legacyBlocked: (message: string) => T;
    missing: () => T;
    ok: (key: string) => T;
  },
): T {
  if (gated.outcome === 'legacy_blocked') return handlers.legacyBlocked(gated.message);
  if (gated.outcome === 'missing') return handlers.missing();
  return handlers.ok(gated.key);
}

/** Next.js `/api/chat`: JSON error Response or resolved key string. */
export function getOpenAiKeyOrNextJsonResponse(gated: OpenAiKeyGateResult): Response | string {
  return foldOpenAiKeyGate<Response | string>(gated, {
    legacyBlocked: (message) =>
      new Response(JSON.stringify({ error: message }), { status: 400, headers: JSON_HEADERS }),
    missing: () =>
      new Response(JSON.stringify({ error: 'NEXT_OPENAI_API_KEY is not set' }), {
        status: 500,
        headers: JSON_HEADERS,
      }),
    ok: (key) => key,
  });
}

export type ApiOpenAiKeyOutcome =
  | { kind: 'ok'; key: string }
  | { kind: 'error'; code: 'LEGACY_ENV_BLOCKED' | 'MISSING_KEY'; message: string };

/** Express `/v1/chat/stream`: map to HttpError payload shape. */
export function openAiKeyGateToApiOutcome(gated: OpenAiKeyGateResult): ApiOpenAiKeyOutcome {
  return foldOpenAiKeyGate<ApiOpenAiKeyOutcome>(gated, {
    legacyBlocked: (message) => ({ kind: 'error', code: 'LEGACY_ENV_BLOCKED', message }),
    missing: () => ({
      kind: 'error',
      code: 'MISSING_KEY',
      message: 'Set AGENT_OPENAI_API_KEY or x-openai-key header',
    }),
    ok: (key) => ({ kind: 'ok', key }),
  });
}
