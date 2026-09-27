import { mkdtempSync, rmSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { DevelopmentHostJournal } from '../src/developmentHostJournal.js';
import { classifyDevelopmentError, developmentHostConfigSchema } from '../src/developmentHost.js';
const cleanup: Array<() => void> = [];
afterEach(() => {
  for (const dispose of cleanup.splice(0).reverse()) dispose();
});
function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'development-journal-'));
  cleanup.push(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, 'state.sqlite');
  const journal = new DevelopmentHostJournal(path);
  cleanup.push(() => journal.close());
  return { journal, path };
}
it('fences concurrent owners even after lease expiry while the old process is alive', () => {
  const { journal } = fixture();
  const owner = journal.claim('one');
  expect(() => journal.claim('one', Date.now() + 20000)).toThrow('service_owner_active');
  expect(() => journal.claim('two')).toThrow('service_identity_mismatch');
  journal.release(owner);
  const replacement = journal.claim('one');
  expect(replacement.epoch).toBe(owner.epoch + 1);
  expect(() => journal.observe(owner, 'ready')).toThrow('service_owner_lost');
});
it('retains lost probe issuance intent across reopening until revocation is confirmed', () => {
  const { journal, path } = fixture();
  const owner = journal.claim('one');
  const id = journal.probeIntent(owner, 'generation');
  const observer = new DevelopmentHostJournal(path, true);
  try {
    expect(observer.pendingProbes()).toEqual([{ id, generation: 'generation' }]);
  } finally {
    observer.close();
  }
  journal.settleProbe(owner, id);
  expect(journal.pendingProbes()).toEqual([]);
});
it('persists operator recovery and original failure after owner release', () => {
  const { journal } = fixture();
  const owner = journal.claim('one');
  journal.observe(owner, 'control_unavailable');
  journal.request('recover');
  journal.request('stop');
  journal.release(owner);
  expect(journal.state()).toMatchObject({
    code: 'control_unavailable',
    pid: null,
    recovery_requested: 1,
    stop_requested: 1,
  });
});
it('rejects a publicly readable journal', () => {
  const { path } = fixture();
  chmodSync(path, 0o644);
  expect(() => new DevelopmentHostJournal(path, true)).toThrow(
    'private_lifecycle_journal_required',
  );
});
it('redacts arbitrary transport exceptions and rejects inherited settings', () => {
  expect(classifyDevelopmentError(new Error('secret token in transport stderr'))).toBe(
    'cleanup_pending',
  );
  expect(classifyDevelopmentError(new Error('control_unavailable'))).toBe('control_unavailable');
  expect(developmentHostConfigSchema.safeParse({ mcpServers: { host: 'inherited' } }).success).toBe(
    false,
  );
});
