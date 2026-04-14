/**
 * Resolves the OpenAI API key from process env with a scoped preferred var and
 * a guarded legacy `OPENAI_API_KEY` fallback (opt-in via OPENAI_ALLOW_LEGACY_ENV=1).
 * Never logs key material.
 */
export type PreferredOpenAiEnvVar = 'AGENT_OPENAI_API_KEY' | 'NEXT_OPENAI_API_KEY';

export type OpenAiKeyResolveResult =
  | { status: 'ok'; key: string }
  | { status: 'missing' }
  | { status: 'legacy_blocked' };

export function openAiLegacyBlockedMessage(preferredEnvVar: PreferredOpenAiEnvVar): string {
  const hint =
    preferredEnvVar === 'NEXT_OPENAI_API_KEY'
      ? 'Use NEXT_OPENAI_API_KEY, or set OPENAI_ALLOW_LEGACY_ENV=1 to allow legacy env fallback.'
      : 'Use AGENT_OPENAI_API_KEY, or set OPENAI_ALLOW_LEGACY_ENV=1 to allow legacy env fallback.';
  return `OPENAI_API_KEY is set but blocked. ${hint}`;
}

export function resolveOpenAiApiKeyFromEnv(
  preferredEnvVar: PreferredOpenAiEnvVar,
): OpenAiKeyResolveResult {
  const preferred = process.env[preferredEnvVar]?.trim();
  if (preferred) return { status: 'ok', key: preferred };

  const legacy = process.env.OPENAI_API_KEY?.trim();
  if (!legacy) return { status: 'missing' };

  if (process.env.OPENAI_ALLOW_LEGACY_ENV === '1') {
    return { status: 'ok', key: legacy };
  }
  return { status: 'legacy_blocked' };
}

/**
 * Prefer an explicit header key (e.g. `x-openai-key`) when present, otherwise resolve from env.
 */
export function resolveOpenAiKeyForRequest(options: {
  preferredEnvVar: PreferredOpenAiEnvVar;
  headerKey?: string | null;
}): OpenAiKeyResolveResult {
  const header = options.headerKey?.trim();
  if (header) return { status: 'ok', key: header };
  return resolveOpenAiApiKeyFromEnv(options.preferredEnvVar);
}

/** Normalizes resolution into a single branch tree (reduces duplicated handlers in apps). */
export type OpenAiKeyGateResult =
  | { outcome: 'ok'; key: string }
  | { outcome: 'legacy_blocked'; message: string }
  | { outcome: 'missing' };

export function gateOpenAiKeyResolution(
  resolved: OpenAiKeyResolveResult,
  preferredEnvVar: PreferredOpenAiEnvVar,
): OpenAiKeyGateResult {
  if (resolved.status === 'legacy_blocked') {
    return { outcome: 'legacy_blocked', message: openAiLegacyBlockedMessage(preferredEnvVar) };
  }
  if (resolved.status === 'ok') {
    return { outcome: 'ok', key: resolved.key };
  }
  return { outcome: 'missing' };
}

/** Single entry point: resolve from header/env and apply legacy guard (for callers that should not duplicate gate logic). */
export function resolveGatedOpenAiKeyForRequest(options: {
  preferredEnvVar: PreferredOpenAiEnvVar;
  headerKey?: string | null;
}): OpenAiKeyGateResult {
  return gateOpenAiKeyResolution(resolveOpenAiKeyForRequest(options), options.preferredEnvVar);
}

const JSON_HEADERS = { 'Content-Type': 'application/json' } as const;

/** Next.js `/api/chat`: returns a JSON error Response or the resolved key (no duplicated branch trees in the route). */
export function getOpenAiKeyOrNextJsonResponse(gated: OpenAiKeyGateResult): Response | string {
  if (gated.outcome === 'legacy_blocked') {
    return new Response(JSON.stringify({ error: gated.message }), {
      status: 400,
      headers: JSON_HEADERS,
    });
  }
  if (gated.outcome === 'missing') {
    return new Response(JSON.stringify({ error: 'NEXT_OPENAI_API_KEY is not set' }), {
      status: 500,
      headers: JSON_HEADERS,
    });
  }
  return gated.key;
}

export type ApiOpenAiKeyOutcome =
  | { kind: 'ok'; key: string }
  | { kind: 'error'; code: 'LEGACY_ENV_BLOCKED' | 'MISSING_KEY'; message: string };

/** Express `/v1/chat/stream`: map gated result to HTTP error codes or key (no duplicated outcome branches in the router). */
export function openAiKeyGateToApiOutcome(gated: OpenAiKeyGateResult): ApiOpenAiKeyOutcome {
  if (gated.outcome === 'legacy_blocked') {
    return { kind: 'error', code: 'LEGACY_ENV_BLOCKED', message: gated.message };
  }
  if (gated.outcome === 'missing') {
    return {
      kind: 'error',
      code: 'MISSING_KEY',
      message: 'Set AGENT_OPENAI_API_KEY or x-openai-key header',
    };
  }
  return { kind: 'ok', key: gated.key };
}
