import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, rmSync, statSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { expect, it } from 'vitest';
import { createMonitoringStore } from '../src/monitoring/store.js';
const mib = 1024 * 1024;
async function allocatedFixture() {
  const directory = mkdtempSync(join(tmpdir(), 'monitoring-physical-')),
    path = join(directory, 'monitoring.sqlite');
  const initial = createMonitoringStore({ path });
  await initial.ready;
  await initial.setPreference({ samplingEnabled: true, retentionDays: 7 });
  await initial.close();
  const db = new Database(path);
  db.exec('CREATE TABLE owned_capacity_probe(id INTEGER PRIMARY KEY, content BLOB NOT NULL)');
  const insert = db.prepare('INSERT INTO owned_capacity_probe(content) VALUES (zeroblob(4096))');
  db.transaction(() => {
    for (let i = 0; i < 6900; i++) insert.run();
  })();
  db.close();
  return { directory, path };
}
it('enforces the actual 32 MiB database and 34 MiB rollback ceilings at real SQLITE_FULL', async () => {
  const { directory, path } = await allocatedFixture();
  const store = createMonitoringStore({ path });
  let maximumDatabase = statSync(path).size,
    maximumJournal = 0;
  const observe = () => {
    maximumDatabase = Math.max(
      maximumDatabase,
      statSync(path, { throwIfNoEntry: false })?.size ?? 0,
    );
    maximumJournal = Math.max(
      maximumJournal,
      statSync(`${path}-journal`, { throwIfNoEntry: false })?.size ?? 0,
    );
  };
  const timer = setInterval(observe, 2);
  try {
    await store.ready;
    for (let batch = 0; batch < 80 && store.health().state !== 'disabled'; batch++) {
      for (let i = 0; i < 256; i++)
        store.record({
          schemaVersion: 1,
          sampleId: randomUUID(),
          processInstanceId: store.health().processInstanceId,
          observedAtMs: Date.now(),
          intervalMs: 30000,
          source: 'api_process_app_volume',
          cpuUserMicros: Number.MAX_SAFE_INTEGER,
          cpuSystemMicros: Number.MAX_SAFE_INTEGER,
          rssBytes: Number.MAX_SAFE_INTEGER,
          eventLoopP95Ms: 10,
          eventLoopMaxMs: 20,
          activeRuns: 100,
          admittedUnresolvedAttempts: 100,
          sessionLockKeys: 100,
          sessionLockWaiters: 100,
          appVolumeFreeBytes: Number.MAX_SAFE_INTEGER,
          unavailableMetrics: [],
        });
      await store.flush();
      observe();
    }
    expect(store.health()).toMatchObject({
      state: 'disabled',
      reason: 'storage_limited',
      preference: null,
    });
    expect(store.health().dropped).toBeGreaterThan(0);
    expect(maximumDatabase).toBeGreaterThan(31 * mib);
    expect(maximumDatabase).toBeLessThanOrEqual(32 * mib);
    expect(maximumJournal).toBeGreaterThan(0);
    expect(maximumJournal).toBeLessThanOrEqual(34 * mib);
    expect(store.record({})).toBe(false);
  } finally {
    clearInterval(timer);
    await store.close();
    rmSync(directory, { recursive: true, force: true });
  }
}, 30000);
it('recovers a real near-capacity hot rollback journal and exposes interrupted coverage', async () => {
  const { directory, path } = await allocatedFixture();
  const db = new Database(path);
  db.prepare("UPDATE monitoring_meta SET value='1' WHERE key='open'").run();
  db.close();
  const child = spawn(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `import Database from 'better-sqlite3';const db=new Database(process.env.MONITORING_CRASH_PATH);db.pragma('cache_size = 10');db.exec('BEGIN IMMEDIATE');db.exec('UPDATE owned_capacity_probe SET content=randomblob(4096)');process.stdout.write('held\\n');setInterval(()=>{},1000);`,
    ],
    { env: { ...process.env, MONITORING_CRASH_PATH: path }, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  let restored: ReturnType<typeof createMonitoringStore> | undefined;
  try {
    await Promise.race([
      once(child.stdout, 'data'),
      once(child, 'exit').then(() => {
        throw new Error('owned crash child exited early');
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('owned crash barrier timeout')), 5000).unref(),
      ),
    ]);
    expect(statSync(path).size).toBeGreaterThan(30 * mib);
    expect(statSync(path).size).toBeLessThanOrEqual(32 * mib);
    expect(statSync(`${path}-journal`).size).toBeGreaterThan(30 * mib);
    expect(statSync(`${path}-journal`).size).toBeLessThanOrEqual(34 * mib);
    child.kill('SIGKILL');
    await once(child, 'exit');
    restored = createMonitoringStore({ path });
    await restored.ready;
    expect(restored.health()).toMatchObject({ state: 'ready', previousShutdownUnclean: true });
    expect(await restored.preference()).toMatchObject({ samplingEnabled: true, retentionDays: 7 });
    const inspect = new Database(path, { readonly: true });
    expect(
      inspect
        .prepare('SELECT hex(substr(content,1,4)) AS value FROM owned_capacity_probe LIMIT 1')
        .get(),
    ).toEqual({ value: '00000000' });
    inspect.close();
    expect(existsSync(`${path}-journal`)).toBe(false);
    expect(
      (await restored.queryWindow({ fromMs: Date.now() - 1000, toMs: Date.now() + 1000 })).coverage
        .historyMayBeMissing,
    ).toBe(true);
  } finally {
    child.kill('SIGKILL');
    await restored?.close();
    rmSync(directory, { recursive: true, force: true });
  }
}, 10000);
