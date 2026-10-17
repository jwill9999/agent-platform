import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  closeDatabase,
  createSession,
  DEFAULT_AGENT_ID,
  openDatabase,
  runSeed,
} from '@agent-platform/db';
import { afterEach, describe, expect, it } from 'vitest';
import { RunControlService } from '../src/application/runControl/service.js';

const cleanup: Array<() => void> = [];
afterEach(() => {
  for (const close of cleanup.splice(0).reverse()) close();
});
function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'monitoring-counters-'));
  const { db, sqlite } = openDatabase(join(dir, 'app.sqlite'));
  cleanup.push(() => {
    closeDatabase(sqlite);
    rmSync(dir, { recursive: true, force: true });
  });
  runSeed(db);
  const service = new RunControlService(db);
  const session = createSession(db, { agentId: DEFAULT_AGENT_ID });
  const execution = service.open(session, randomUUID());
  return { service, session, execution };
}

describe('process-owned monitoring counters', () => {
  it('keeps an admitted effect unknown after the transport promise settles and its HTTP owner ends', async () => {
    const f = fixture();
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const tool = f.execution.invoke('tool', async () => {
      await held;
      return { status: 'outcome_unknown', code: 'COMMAND_OUTCOME_UNKNOWN' };
    });
    const sensor = f.execution.invoke('sensor', async () => {
      await held;
      return { status: 'outcome_unknown', code: 'COMMAND_OUTCOME_UNKNOWN' };
    });
    f.service.stop(f.session.id, f.execution.runId);
    release();
    await Promise.all([tool, sensor]);
    expect(f.service.require(f.session.id, f.execution.runId).inFlight).toBe(2);
    f.execution.finish('outcome_unknown', 'execution_failed');
    expect(f.service.monitoringMetrics()).toEqual({ activeRuns: 0, admittedUnresolvedAttempts: 2 });
  });

  it('distinguishes ended HTTP ownership from a still-running original promise, then clears only known settlement', async () => {
    const f = fixture();
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const actual = f.execution.invoke('tool', () => held);
    expect(f.service.monitoringMetrics()).toEqual({ activeRuns: 1, admittedUnresolvedAttempts: 1 });
    f.service.stop(f.session.id, f.execution.runId);
    f.execution.finish('outcome_unknown', 'user_stop');
    expect(f.service.monitoringMetrics()).toEqual({ activeRuns: 0, admittedUnresolvedAttempts: 1 });
    release();
    await actual;
    expect(f.service.monitoringMetrics()).toEqual({ activeRuns: 0, admittedUnresolvedAttempts: 0 });
  });

  it('counts genuine failed invocations as settled rather than unknown', async () => {
    const f = fixture();
    await expect(
      f.execution.invoke('model', async () => {
        throw new Error('known provider failure');
      }),
    ).rejects.toThrow('known provider failure');
    expect(f.service.monitoringMetrics()).toEqual({ activeRuns: 1, admittedUnresolvedAttempts: 0 });
    f.execution.finish('failed', 'execution_failed');
  });
});
