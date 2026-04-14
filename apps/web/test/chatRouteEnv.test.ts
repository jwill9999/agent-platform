import { afterEach, describe, expect, it } from 'vitest';

const envKeys = ['NEXT_OPENAI_API_KEY', 'OPENAI_API_KEY', 'OPENAI_ALLOW_LEGACY_ENV'] as const;
const snapshot = new Map<string, string | undefined>();

function restoreEnv() {
  for (const key of envKeys) {
    const prev = snapshot.get(key);
    if (prev === undefined) delete process.env[key];
    else process.env[key] = prev;
  }
  snapshot.clear();
}

async function postChat() {
  const mod = await import('../app/api/chat/route');
  const req = new Request('http://localhost/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ messages: [{ role: 'user', content: 'hello' }], model: 'gpt-4o-mini' }),
  });
  return mod.POST(req);
}

describe('POST /api/chat env resolution', () => {
  afterEach(() => {
    restoreEnv();
  });

  it('returns 400 when only OPENAI_API_KEY is set', async () => {
    for (const key of envKeys) snapshot.set(key, process.env[key]);
    delete process.env.NEXT_OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = 'sk-legacy';
    delete process.env.OPENAI_ALLOW_LEGACY_ENV;

    const res = await postChat();
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toContain('OPENAI_API_KEY is set but blocked');
  });
});
