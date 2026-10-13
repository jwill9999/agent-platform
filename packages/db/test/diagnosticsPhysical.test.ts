import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, rmSync, statSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { createDiagnosticStore } from '../src/diagnostics/store.js';

const mib = 1024 * 1024;
describe('diagnostic physical storage and crash boundaries', () => {
  it('enforces the actual worker database ceiling and disables on SQLITE_FULL without application-thread stalls', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'diagnostic-limit-'));
    const path = join(directory, 'diagnostics.sqlite');
    const store = createDiagnosticStore({ path, maxEvents: 100000 });
    let largestDatabase = 0;
    let largestCombined = 0;
    const monitor = setInterval(() => {
      const size = statSync(path, { throwIfNoEntry: false })?.size ?? 0;
      const journalSize = statSync(`${path}-journal`, { throwIfNoEntry: false })?.size ?? 0;
      largestDatabase = Math.max(largestDatabase, size);
      largestCombined = Math.max(largestCombined, size + journalSize);
    }, 2);
    try {
      await store.ready;
      const requestId = randomUUID();
      const sessionId = randomUUID();
      const runId = randomUUID();
      for (let batch = 0; batch < 400 && store.health().state !== 'disabled'; batch++) {
        for (let i = 0; i < 256; i++)
          store.record({
            schemaVersion: 1,
            eventId: randomUUID(),
            processInstanceId: store.health().processInstanceId,
            requestId,
            bffRequestId: randomUUID(),
            sessionId,
            runId,
            operationId: randomUUID(),
            parentOperationId: randomUUID(),
            toolExecutionId: randomUUID(),
            approvalRequestId: randomUUID(),
            modelConfigId: randomUUID(),
            phase: 'tool',
            outcome: 'succeeded',
            observedAtMs: Date.now(),
            durationMs: 1,
            attempt: 1,
            provider: 'other',
            toolId: 'other',
            inputTokens: 100,
            outputTokens: 100,
          });
        await store.flush();
      }
      expect(store.health()).toMatchObject({ state: 'disabled', reason: 'storage_limited' });
      expect(store.health().dropped).toBeGreaterThan(0);
      expect(largestDatabase).toBeGreaterThan(60 * mib);
      expect(largestDatabase).toBeLessThanOrEqual(64 * mib);
      expect(largestCombined).toBeLessThanOrEqual(130 * mib);
      expect(store.record({})).toBe(false);
    } finally {
      clearInterval(monitor);
      await store.close();
      rmSync(directory, { recursive: true, force: true });
    }
  }, 60000);

  it('recovers a real hot rollback journal before accepting new observations', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'diagnostic-journal-'));
    const path = join(directory, 'diagnostics.sqlite');
    const initial = createDiagnosticStore({ path });
    await initial.ready;
    await initial.close();
    const setup = new Database(path);
    setup.exec('CREATE TABLE crash_probe(id INTEGER PRIMARY KEY, content BLOB)');
    const insert = setup.prepare('INSERT INTO crash_probe(content) VALUES (zeroblob(4096))');
    setup.transaction(() => {
      for (let i = 0; i < 1000; i++) insert.run();
    })();
    setup.prepare("UPDATE diagnostic_meta SET value='1' WHERE key='open'").run();
    setup.close();
    const source = `import Database from 'better-sqlite3';
      const db = new Database(process.env.DIAGNOSTIC_CRASH_PATH);
      db.pragma('cache_size = 10'); db.exec('BEGIN IMMEDIATE');
      db.exec("UPDATE crash_probe SET content=randomblob(4096)");
      process.stdout.write('held\\n'); setInterval(()=>{},1000);`;
    const child = spawn(process.execPath, ['--input-type=module', '-e', source], {
      env: { ...process.env, DIAGNOSTIC_CRASH_PATH: path },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let restored: ReturnType<typeof createDiagnosticStore> | undefined;
    try {
      await Promise.race([
        once(child.stdout, 'data'),
        once(child, 'exit').then(() => {
          throw new Error('crash fixture exited early');
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('crash fixture timeout')), 5000).unref(),
        ),
      ]);
      expect(statSync(`${path}-journal`).size).toBeGreaterThan(0);
      expect(statSync(path).size + statSync(`${path}-journal`).size).toBeLessThan(130 * mib);
      child.kill('SIGKILL');
      await once(child, 'exit');
      restored = createDiagnosticStore({ path });
      await restored.ready;
      expect(restored.health()).toMatchObject({ state: 'ready', previousShutdownUnclean: true });
      const inspect = new Database(path);
      expect(
        (
          inspect
            .prepare('SELECT hex(substr(content,1,4)) AS value FROM crash_probe LIMIT 1')
            .get() as { value: string }
        ).value,
      ).toBe('00000000');
      inspect.close();
      expect(existsSync(`${path}-journal`)).toBe(false);
    } finally {
      child.kill('SIGKILL');
      await restored?.close();
      rmSync(directory, { recursive: true, force: true });
    }
  }, 10000);
});
