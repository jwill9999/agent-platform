const CHAT_ENV_KEYS = [
  'OPENAI_API_KEY',
  'AGENT_OPENAI_API_KEY',
  'OPENAI_ALLOW_LEGACY_ENV',
] as const;

export function snapshotChatEnv(): Map<string, string | undefined> {
  const snap = new Map<string, string | undefined>();
  for (const key of CHAT_ENV_KEYS) snap.set(key, process.env[key]);
  return snap;
}

export function restoreChatEnv(snap: Map<string, string | undefined>) {
  for (const key of CHAT_ENV_KEYS) {
    const value = snap.get(key);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}
