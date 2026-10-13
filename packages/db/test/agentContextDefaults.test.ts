import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { closeDatabase, openDatabase } from '../src/database.js';
import { getAgent } from '../src/repositories/registry.js';
import { runSeed } from '../src/seed/runSeed.js';
import { CODING_AGENT_ID, DEFAULT_AGENT_ID } from '../src/seed/constants.js';

it('reads absent defaults and saved limits across reopen/reseed without migrating stored context JSON', () => {
  const directory = mkdtempSync(join(tmpdir(), 'context-default-'));
  const path = join(directory, 'db.sqlite');
  let connection = openDatabase(path);
  const raw = (id: string) =>
    (
      connection.sqlite
        .prepare('SELECT context_window_json AS value FROM agents WHERE id = ?')
        .get(id) as { value: string | null }
    ).value;
  try {
    runSeed(connection.db);
    expect(raw(DEFAULT_AGENT_ID)).toBeNull();
    expect(getAgent(connection.db, DEFAULT_AGENT_ID)?.contextWindow).toEqual({
      maxInputTokens: 16000,
      maxOutputTokens: 2048,
      strategy: 'truncate',
    });
    expect(getAgent(connection.db, CODING_AGENT_ID)?.contextWindow?.maxInputTokens).toBe(16000);
    const explicit = '{ "maxInputTokens":8000, "maxOutputTokens":777, "strategy":"summarize" }';
    const partial = '{ "maxOutputTokens":123 }';
    connection.sqlite
      .prepare('UPDATE agents SET context_window_json = ? WHERE id = ?')
      .run(explicit, DEFAULT_AGENT_ID);
    connection.sqlite
      .prepare('UPDATE agents SET context_window_json = ? WHERE id = ?')
      .run(partial, CODING_AGENT_ID);
    closeDatabase(connection.sqlite);
    connection = openDatabase(path);
    runSeed(connection.db);
    expect(getAgent(connection.db, DEFAULT_AGENT_ID)?.contextWindow).toEqual({
      maxInputTokens: 8000,
      maxOutputTokens: 777,
      strategy: 'summarize',
    });
    expect(getAgent(connection.db, CODING_AGENT_ID)?.contextWindow).toEqual({
      maxInputTokens: 16000,
      maxOutputTokens: 123,
      strategy: 'truncate',
    });
    expect(raw(DEFAULT_AGENT_ID)).toBe(explicit);
    expect(raw(CODING_AGENT_ID)).toBe(partial);
  } finally {
    closeDatabase(connection.sqlite);
    rmSync(directory, { recursive: true, force: true });
  }
});
