/**
 * Resolves the OpenAI API key from process env with a scoped preferred var and
 * a guarded legacy `OPENAI_API_KEY` fallback (opt-in via OPENAI_ALLOW_LEGACY_ENV=1).
 * Never logs key material.
 */
export class OpenAiLegacyEnvBlockedError extends Error {
  readonly code = 'LEGACY_ENV_BLOCKED' as const;

  constructor(message: string) {
    super(message);
    this.name = 'OpenAiLegacyEnvBlockedError';
  }
}

export type PreferredOpenAiEnvVar = 'AGENT_OPENAI_API_KEY' | 'NEXT_OPENAI_API_KEY';

export function resolveOpenAiApiKeyFromEnv(preferredEnvVar: PreferredOpenAiEnvVar): string | null {
  const preferred = process.env[preferredEnvVar]?.trim();
  if (preferred) return preferred;

  const legacy = process.env.OPENAI_API_KEY?.trim();
  if (!legacy) return null;

  const allowLegacy = process.env.OPENAI_ALLOW_LEGACY_ENV === '1';
  if (!allowLegacy) {
    const hint =
      preferredEnvVar === 'NEXT_OPENAI_API_KEY'
        ? 'Use NEXT_OPENAI_API_KEY, or set OPENAI_ALLOW_LEGACY_ENV=1 to allow legacy env fallback.'
        : 'Use AGENT_OPENAI_API_KEY, or set OPENAI_ALLOW_LEGACY_ENV=1 to allow legacy env fallback.';
    throw new OpenAiLegacyEnvBlockedError(`OPENAI_API_KEY is set but blocked. ${hint}`);
  }
  return legacy;
}
