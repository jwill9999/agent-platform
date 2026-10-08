import Database from 'better-sqlite3';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { executionContractSchema, executionLimitsSchema } from '../src/contracts.js';
import { deriveContractMaterialDigest } from '../src/planning.js';
import { assertContractRevisionIsNotAuthorityExpansion } from '../src/lifecycle.js';
import {
  initializeRunExecutionBudget,
  reserveRunBudget,
  readRunBudget,
  readRunReservation,
  assertRunBudgetWork,
  settleRunBudget,
  type RunBudgetBinding,
} from '../src/runExecutionBudget.js';

const roots: string[] = [],
  databases: Database.Database[] = [];
afterEach(() => {
  for (const db of databases.splice(0)) db.close();
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});
function fixture(aggregate = 32) {
  const root = mkdtempSync(join(tmpdir(), 'run-budget-'));
  roots.push(root);
  const path = join(root, 'journal.sqlite');
  const db = new Database(path);
  databases.push(db);
  db.pragma('journal_mode=WAL');
  db.exec('CREATE TABLE runs (id TEXT PRIMARY KEY)');
  db.prepare('INSERT INTO runs VALUES (?)').run('run');
  initializeRunExecutionBudget(db);
  const contract = executionContractSchema.parse(
    JSON.parse(
      readFileSync(
        new URL(
          '../../../docs/planning/pilot-active-budget/execution-contract.v1.json',
          import.meta.url,
        ),
        'utf8',
      ),
    ),
  );
  contract.executionLimits = {
    aggregateActiveSeconds: aggregate,
    attemptSeconds: 1,
    cleanupSeconds: 15,
  };
  const binding: RunBudgetBinding = {
    dispatchId: 'dispatch',
    executionId: 'execution',
    runId: 'run',
    taskId: 'agent-platform-pilot-active-budget',
    role: 'test_runner',
    ownerId: 'owner',
    workspaceLeaseEpoch: 1,
    runLeaseEpoch: 1,
    taskLeaseEpoch: 1,
    phaseLeaseEpoch: 1,
  };
  return {
    db,
    path,
    contract,
    binding,
    reserve: (id = 'dispatch', now = 1000) =>
      reserveRunBudget(
        db,
        contract,
        { ...binding, dispatchId: id, executionId: id },
        now,
        () => {},
      ),
  };
}
describe('durable charged execution allocations', () => {
  it('rejects invalid or excessive limits and binds revisions to approval material', () => {
    for (const value of [
      { aggregateActiveSeconds: 3600, attemptSeconds: 3600, cleanupSeconds: 15 },
      { aggregateActiveSeconds: 3600, attemptSeconds: 300, cleanupSeconds: 0 },
      { aggregateActiveSeconds: Infinity, attemptSeconds: 300, cleanupSeconds: 15 },
    ])
      expect(() => executionLimitsSchema.parse(value)).toThrow();
    const { contract } = fixture();
    const legacy = { ...contract, executionLimits: undefined };
    expect(deriveContractMaterialDigest(legacy)).not.toBe(deriveContractMaterialDigest(contract));
    expect(() => assertContractRevisionIsNotAuthorityExpansion(contract, legacy)).toThrow(
      'execution limits',
    );
    expect(() =>
      assertContractRevisionIsNotAuthorityExpansion(contract, {
        ...contract,
        executionLimits: { ...contract.executionLimits!, aggregateActiveSeconds: 60 },
      }),
    ).toThrow('execution limits');
    expect(() =>
      assertContractRevisionIsNotAuthorityExpansion(contract, {
        ...contract,
        executionLimits: { ...contract.executionLimits!, aggregateActiveSeconds: 16 },
      }),
    ).not.toThrow();
  });
  it('serializes two SQLite writers, retains charges and persists exhaustion', () => {
    const f = fixture();
    const second = new Database(f.path);
    databases.push(second);
    f.reserve('one');
    reserveRunBudget(
      second,
      f.contract,
      { ...f.binding, dispatchId: 'two', executionId: 'two' },
      1001,
      () => {},
    );
    expect(readRunBudget(f.db, 'run')?.charged_ms).toBe(32000);
    expect(() => f.reserve('three', 1002)).toThrow('exhausted');
    expect(readRunBudget(second, 'run')).toMatchObject({ status: 'exhausted', charged_ms: 32000 });
    settleRunBudget(f.db, 'run', 'one', 1003, true);
    expect(readRunBudget(second, 'run')?.charged_ms).toBe(32000);
    expect(() => assertRunBudgetWork(second, 'run', 'two', 1004)).toThrow('exhausted');
  });
  it('charges a shorter final attempt while reserving its complete cleanup allowance', () => {
    const f = fixture(41);
    f.contract.executionLimits!.attemptSeconds = 10;
    const first = f.reserve();
    settleRunBudget(f.db, 'run', first.dispatch_id, 1100, true);
    const last = f.reserve('next', 1101);
    expect(last.work_deadline_ms - last.reserved_at_ms).toBe(1000);
    expect(last.cleanup_deadline_ms - last.work_deadline_ms).toBe(15000);
    expect(readRunBudget(f.db, 'run')?.charged_ms).toBe(41000);
  });
  it('keeps absolute reservation-time deadlines on replay, startup delay and restart', () => {
    const f = fixture();
    const original = f.reserve();
    expect(original).toMatchObject({
      reserved_at_ms: 1000,
      work_deadline_ms: 2000,
      cleanup_deadline_ms: 17000,
      charged_ms: 16000,
    });
    const other = new Database(f.path);
    databases.push(other);
    const replay = reserveRunBudget(
      other,
      f.contract,
      { ...f.binding, executionId: 'dispatch' },
      1500,
      () => {},
    );
    expect(replay).toEqual(original);
    expect(readRunBudget(other, 'run')?.charged_ms).toBe(16000);
    expect(() => assertRunBudgetWork(other, 'run', 'dispatch', 2000)).toThrow('work_expired');
    expect(readRunReservation(f.db, 'dispatch')?.work_deadline_ms).toBe(2000);
    expect(() => f.reserve('next', 2001)).toThrow('cleanup_pending');
  });
  it('rejects stale or changed identities before reservation and cannot borrow another run root', () => {
    const f = fixture();
    f.reserve();
    for (const change of [{ role: 'code_reviewer' }, { phaseLeaseEpoch: 2 }, { ownerId: 'other' }])
      expect(() =>
        reserveRunBudget(
          f.db,
          f.contract,
          { ...f.binding, executionId: 'dispatch', ...change },
          1001,
          () => {},
        ),
      ).toThrow('replay_conflict');
    f.db.prepare('INSERT INTO runs VALUES (?)').run('other');
    expect(() =>
      reserveRunBudget(
        f.db,
        f.contract,
        { ...f.binding, executionId: 'dispatch', runId: 'other' },
        1002,
        () => {},
      ),
    ).toThrow('replay_conflict');
    expect(readRunBudget(f.db, 'run')?.charged_ms).toBe(16000);
    expect(() =>
      reserveRunBudget(f.db, f.contract, { ...f.binding, dispatchId: 'stale' }, 1003, () => {
        throw Error('stale fence');
      }),
    ).toThrow('stale fence');
    expect(readRunReservation(f.db, 'stale')).toBeUndefined();
  });
  it('rolls back a failed reservation commit before any external dispatch', () => {
    const f = fixture();
    f.db.exec(
      "CREATE TRIGGER reject_budget BEFORE INSERT ON run_execution_reservations BEGIN SELECT RAISE(ABORT,'journal unavailable'); END",
    );
    expect(() => f.reserve()).toThrow('journal unavailable');
    expect(readRunBudget(f.db, 'run')).toBeUndefined();
    expect(readRunReservation(f.db, 'dispatch')).toBeUndefined();
  });
  it('fences policy changes and clock rollback durably across connections', () => {
    const f = fixture();
    f.reserve();
    expect(() => assertRunBudgetWork(f.db, 'run', 'dispatch', 999)).toThrow('clock_invalid');
    expect(readRunBudget(f.db, 'run')?.status).toBe('blocked');
    const g = fixture();
    g.reserve();
    g.contract.executionLimits!.aggregateActiveSeconds = 60;
    expect(() => g.reserve('changed', 1001)).toThrow('policy_changed');
    expect(readRunBudget(g.db, 'run')?.status).toBe('blocked');
  });
  it('retains uncertain or overdue cleanup, with no replenishment and no fresh work', () => {
    for (const [now, verified] of [
      [1100, false],
      [17001, true],
    ] as const) {
      const f = fixture();
      f.reserve();
      expect(() => settleRunBudget(f.db, 'run', 'dispatch', now, verified)).toThrow(
        'cleanup_unconfirmed',
      );
      expect(readRunBudget(f.db, 'run')).toMatchObject({ charged_ms: 16000, status: 'blocked' });
      expect(readRunReservation(f.db, 'dispatch')?.settled_at_ms).toBeNull();
      expect(() => f.reserve('next', now + 1)).toThrow('cleanup_unconfirmed');
    }
  });
  it('rejects overlapping recovery and never substitutes a newer cleanup deadline for an old attempt', () => {
    const f = fixture(60);
    const first = {
      ...f.binding,
      dispatchId: 'attempt1',
      executionId: 'attempt1',
      phaseExecutionId: 'phase',
    };
    const initial = reserveRunBudget(f.db, f.contract, first, 1000, () => {});
    const recovery = {
      ...first,
      dispatchId: 'attempt2',
      executionId: 'attempt2',
      phaseLeaseEpoch: 2,
    };
    expect(() => reserveRunBudget(f.db, f.contract, recovery, 1100, () => {})).toThrow(
      'previous_attempt_unsettled',
    );
    expect(readRunBudget(f.db, 'run')?.charged_ms).toBe(16000);
    settleRunBudget(f.db, 'run', 'attempt1', 1200, true);
    const next = reserveRunBudget(f.db, f.contract, recovery, 1300, () => {});
    expect(next.cleanup_deadline_ms).toBe(17300);
    expect(readRunReservation(f.db, 'attempt1')?.cleanup_deadline_ms).toBe(
      initial.cleanup_deadline_ms,
    );
    expect(() =>
      reserveRunBudget(f.db, f.contract, { ...recovery, dispatchId: 'attempt3' }, 1400, () => {}),
    ).toThrow('identity_reused');
  });
});
