import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync, cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDatabase } from '../src/database.js';
import * as schema from '../src/schema.js';
import {
  attachRunExecution,
  beginRunAttempt,
  createControlledRun,
  finishControlledRun,
  getControlledRun,
  getRunForExecution,
  getSessionActiveRun,
  getSessionLatestRun,
  markPreviousProcessRunsUnknown,
  requestRunStop,
  settleRunAttempt,
} from '../src/repositories/runControl.js';
const processId = randomUUID();
const folder = path.join(path.dirname(fileURLToPath(import.meta.url)), '../drizzle');
let dir: string;
let ctx: ReturnType<typeof openDatabase>;
function create(sessionId = 'session-1', nowMs = 100, extra = {}) {
  const id = randomUUID();
  const executionId = randomUUID();
  return {
    ...createControlledRun(ctx.db, {
      id,
      sessionId,
      processInstanceId: processId,
      executionId,
      nowMs,
      ...extra,
    }),
    executionId,
  };
}
function stop(run: { id: string; sessionId: string }, nowMs = 110) {
  return requestRunStop(ctx.db, { runId: run.id, sessionId: run.sessionId, nowMs });
}
function finish(
  run: { id: string; sessionId: string },
  state: 'completed' | 'waiting_for_approval' | 'outcome_unknown' = 'completed',
  nowMs = 120,
) {
  return finishControlledRun(ctx.db, { runId: run.id, sessionId: run.sessionId, state, nowMs });
}
function begin(run: { id: string; executionId: string }) {
  const id = randomUUID();
  beginRunAttempt(ctx.db, {
    id,
    runId: run.id,
    executionId: run.executionId,
    kind: 'tool',
    nowMs: 105,
  });
  return id;
}
describe('durable shared run control', () => {
  beforeEach(() => {
    dir = mkdtempSync(path.join(os.tmpdir(), 'run-control-'));
    ctx = openDatabase(path.join(dir, 'db.sqlite'));
  });
  afterEach(() => {
    ctx.sqlite.close();
    rmSync(dir, { recursive: true, force: true });
  });
  it('commits a scoped idempotent fence before any next admission', () => {
    const run = create();
    expect(getSessionActiveRun(ctx.db, run.sessionId)?.id).toBe(run.id);
    const ack = stop(run);
    expect(ack).toMatchObject({
      state: 'stop_requested',
      reason: 'user_stop',
      stopAcknowledgedAtMs: 110,
      version: 2,
    });
    expect(stop(run, 130)).toEqual(ack);
    expect(() => begin(run)).toThrow('run_not_running');
    expect(() => requestRunStop(ctx.db, { runId: run.id, sessionId: 'wrong', nowMs: 140 })).toThrow(
      'run_not_found',
    );
    expect(finish(run).state).toBe('cancelled');
  });
  it('serializes completion and Stop, preserving old run versus new session identity', () => {
    const old = create();
    finish(old);
    const next = create('session-1', 130);
    expect(stop(old, 140).state).toBe('completed');
    expect(getSessionLatestRun(ctx.db, 'session-1')?.id).toBe(next.id);
    expect(getSessionActiveRun(ctx.db, 'session-1')?.id).toBe(next.id);
    expect(() => create()).toThrow('run_conflict');
    expect(getControlledRun(ctx.db, 'wrong', old.id)).toBeUndefined();
  });
  it('retains unknown admitted effects until actual settlement and never permits next dispatch', () => {
    const run = create();
    const id = begin(run);
    stop(run);
    expect(finish(run).state).toBe('outcome_unknown');
    expect(
      settleRunAttempt(ctx.db, { id, runId: run.id, outcome: 'unknown', nowMs: 125 }).inFlight,
    ).toBe(1);
    expect(finish(run).state).toBe('outcome_unknown');
    expect(() => begin(run)).toThrow('run_not_running');
    expect(
      settleRunAttempt(ctx.db, { id, runId: run.id, outcome: 'succeeded', nowMs: 150 }).inFlight,
    ).toBe(0);
    expect(finish(run, 'completed', 155)).toMatchObject({
      state: 'cancelled',
      settledAtMs: 155,
      reason: 'user_stop',
    });
    // A late duplicate cannot rewrite a confirmed effect or the terminal run.
    expect(
      settleRunAttempt(ctx.db, { id, runId: run.id, outcome: 'unknown', nowMs: 160 }).inFlight,
    ).toBe(0);
    expect(finish(run, 'completed', 170).settledAtMs).toBe(155);
  });
  it('preserves an established uncertainty reason when an ordinary completion supplies none', () => {
    const run = create();
    const id = begin(run);
    settleRunAttempt(ctx.db, { id, runId: run.id, outcome: 'unknown', nowMs: 110 });
    finishControlledRun(ctx.db, {
      runId: run.id,
      sessionId: run.sessionId,
      state: 'outcome_unknown',
      reason: 'execution_failed',
      nowMs: 115,
    });
    expect(
      finishControlledRun(ctx.db, {
        runId: run.id,
        sessionId: run.sessionId,
        state: 'completed',
        reason: 'none',
        nowMs: 120,
      }),
    ).toMatchObject({ state: 'outcome_unknown', reason: 'execution_failed', inFlight: 1 });
    expect(() => begin(run)).toThrow('run_not_running');
  });
  it('keeps genuine failure distinct and refuses false cancellation without user Stop', () => {
    const run = create();
    expect(() =>
      finishControlledRun(ctx.db, {
        runId: run.id,
        sessionId: run.sessionId,
        state: 'cancelled',
        nowMs: 110,
      }),
    ).toThrow('run_invalid_transition');
    expect(
      finishControlledRun(ctx.db, {
        runId: run.id,
        sessionId: run.sessionId,
        state: 'failed',
        reason: 'execution_failed',
        nowMs: 120,
      }),
    ).toMatchObject({ state: 'failed', reason: 'execution_failed' });
    expect(stop(run).state).toBe('failed');
  });
  it('preserves a genuine settled failure racing with user Stop', () => {
    const run = create();
    const attemptId = begin(run);
    stop(run);
    settleRunAttempt(ctx.db, { id: attemptId, runId: run.id, nowMs: 115, outcome: 'failed' });
    expect(
      finishControlledRun(ctx.db, {
        runId: run.id,
        sessionId: run.sessionId,
        state: 'failed',
        reason: 'execution_failed',
        nowMs: 120,
      }),
    ).toMatchObject({ state: 'failed', reason: 'execution_failed', stopAcknowledgedAtMs: 110 });
  });
  it('rejects attempt metadata content and duplicate attempt admission atomically', () => {
    const run = create();
    expect(() =>
      beginRunAttempt(ctx.db, {
        id: 'secret path /private',
        runId: run.id,
        executionId: run.executionId,
        kind: 'model',
        nowMs: 105,
      }),
    ).toThrow('run_invalid_transition');
    const id = begin(run);
    expect(() =>
      beginRunAttempt(ctx.db, {
        id,
        runId: run.id,
        executionId: run.executionId,
        kind: 'model',
        nowMs: 110,
      }),
    ).toThrow();
    expect(getRunForExecution(ctx.db, run.executionId)?.inFlight).toBe(1);
    expect(() =>
      settleRunAttempt(ctx.db, { id, runId: randomUUID(), nowMs: 115, outcome: 'succeeded' }),
    ).toThrow('run_not_found');
  });
  it('owns continuation execution IDs and refuses legacy, wrong-session and stopped resumes', () => {
    const run = create();
    expect(getRunForExecution(ctx.db, 'legacy')).toBeUndefined();
    expect(() =>
      attachRunExecution(ctx.db, {
        runId: run.id,
        sessionId: run.sessionId,
        executionId: 'early',
        nowMs: 105,
      }),
    ).toThrow('run_not_running');
    finish(run, 'waiting_for_approval');
    expect(() =>
      attachRunExecution(ctx.db, {
        runId: run.id,
        sessionId: 'wrong',
        executionId: 'wrong',
        nowMs: 125,
      }),
    ).toThrow('run_not_found');
    attachRunExecution(ctx.db, {
      runId: run.id,
      sessionId: run.sessionId,
      executionId: 'continuation',
      nowMs: 130,
    });
    expect(getRunForExecution(ctx.db, 'continuation')?.id).toBe(run.id);
    expect(getRunForExecution(ctx.db, run.executionId)?.id).toBe(run.id);
    finish(run, 'waiting_for_approval', 135);
    stop(run, 140);
    expect(() =>
      attachRunExecution(ctx.db, {
        runId: run.id,
        sessionId: run.sessionId,
        executionId: 'stopped',
        nowMs: 145,
      }),
    ).toThrow('run_not_running');
    expect(getRunForExecution(ctx.db, 'stopped')).toBeUndefined();
  });
  it('rolls back partially-created authority on failed execution uniqueness', () => {
    const original = create();
    expect(() => create('other', 130, { executionId: original.executionId })).toThrow();
    expect(getSessionActiveRun(ctx.db, 'other')).toBeUndefined();
    expect(getRunForExecution(ctx.db, original.executionId)?.id).toBe(original.id);
  });
  it('restarts without replay, preserving current-process runs and approval fences', () => {
    const active = create();
    const waiting = create('waiting');
    finish(waiting, 'waiting_for_approval');
    const uncertain = create('effect');
    begin(uncertain);
    stop(uncertain);
    const nextProcess = randomUUID();
    const fresh = create('fresh', 130, { processInstanceId: nextProcess });
    expect(markPreviousProcessRunsUnknown(ctx.db, nextProcess, 150)).toBe(3);
    expect(getControlledRun(ctx.db, active.sessionId, active.id)?.state).toBe('interrupted');
    expect(getControlledRun(ctx.db, waiting.sessionId, waiting.id)?.state).toBe('interrupted');
    expect(getControlledRun(ctx.db, uncertain.sessionId, uncertain.id)).toMatchObject({
      state: 'outcome_unknown',
      reason: 'user_stop',
      inFlight: 1,
    });
    expect(getControlledRun(ctx.db, fresh.sessionId, fresh.id)?.state).toBe('running');
    expect(() =>
      attachRunExecution(ctx.db, {
        runId: waiting.id,
        sessionId: waiting.sessionId,
        executionId: 'after-restart',
        nowMs: 160,
      }),
    ).toThrow('run_not_running');
    expect(markPreviousProcessRunsUnknown(ctx.db, nextProcess, 170)).toBe(0);
    expect(finish(waiting, 'waiting_for_approval').state).toBe('interrupted');
    expect(() => finish(uncertain, 'waiting_for_approval')).toThrow('run_invalid_transition');
  });
  it('fails promptly on a competing DB writer and restores its caller busy policy', () => {
    const run = create();
    ctx.sqlite.pragma('busy_timeout = 1717');
    const other = new Database(path.join(dir, 'db.sqlite'));
    other.exec('BEGIN IMMEDIATE');
    const started = performance.now();
    try {
      expect(() => stop(run)).toThrow(/locked/);
      expect(performance.now() - started).toBeLessThan(1500);
      expect(ctx.sqlite.pragma('busy_timeout', { simple: true })).toBe(1717);
      expect(getControlledRun(ctx.db, run.sessionId, run.id)?.state).toBe('running');
    } finally {
      other.exec('ROLLBACK');
      other.close();
    }
    expect(stop(run).state).toBe('stop_requested');
    expect(ctx.sqlite.pragma('busy_timeout', { simple: true })).toBe(1717);
  });
  it('does not delete unknown or actionable-approval authority while pruning old settled rows', () => {
    const expired = create('expired');
    finish(expired);
    const fenced = create('fenced');
    finish(fenced);
    ctx.sqlite
      .prepare(
        "INSERT INTO approval_requests (id,session_id,run_id,agent_id,tool_name,args_json,risk_tier,status,created_at_ms) VALUES ('approval','fenced',?,'agent','tool','{}','high','approved',100)",
      )
      .run(fenced.executionId);
    const unknown = create('unknown');
    finish(unknown, 'outcome_unknown');
    create('later', 31 * 24 * 60 * 60 * 1000);
    expect(getRunForExecution(ctx.db, expired.executionId)).toBeUndefined();
    expect(getRunForExecution(ctx.db, fenced.executionId)?.id).toBe(fenced.id);
    expect(getRunForExecution(ctx.db, unknown.executionId)?.state).toBe('outcome_unknown');
  });
  it('bounds unresolved authority without dropping fences or admitting another run', () => {
    const insert = ctx.sqlite.prepare(
      "INSERT INTO controlled_runs(id,session_id,process_instance_id,state,version,created_at_ms,updated_at_ms,reason) VALUES (?, ?, ?, 'outcome_unknown',1,100,100,'none')",
    );
    ctx.sqlite.transaction(() => {
      for (let n = 0; n < 1000; n++) insert.run(randomUUID(), `seed-${n}`, processId);
    })();
    expect(() => create()).toThrow('run_capacity');
    expect(ctx.sqlite.prepare('SELECT count(*) AS n FROM controlled_runs').get()).toEqual({
      n: 1000,
    });
  });
  it('prunes excess settled history to 10000 and caps attempts without discarding unsettled work', () => {
    const insert = ctx.sqlite.prepare(
      "INSERT INTO controlled_runs(id,session_id,process_instance_id,state,version,created_at_ms,updated_at_ms,settled_at_ms,reason) VALUES (?, ?, ?, 'completed',1,100,100,120,'none')",
    );
    ctx.sqlite.transaction(() => {
      for (let n = 0; n < 10001; n++) insert.run(randomUUID(), `seed-${n}`, processId);
    })();
    const run = create();
    expect(
      ctx.sqlite
        .prepare('SELECT count(*) AS n FROM controlled_runs WHERE settled_at_ms IS NOT NULL')
        .get(),
    ).toEqual({ n: 10000 });
    const attempt = ctx.sqlite.prepare(
      "INSERT INTO run_attempts(id,run_id,execution_id,kind,outcome,admitted_at_ms) VALUES (?, ?, ?, 'tool','running',105)",
    );
    ctx.sqlite.transaction(() => {
      for (let n = 0; n < 10000; n++) attempt.run(randomUUID(), run.id, run.executionId);
    })();
    expect(() => begin(run)).toThrow('run_capacity');
    expect(stop(run).inFlight).toBe(10000);
  });
  it('migrates legacy approvals without inventing run bindings and rolls back failed additive migration', () => {
    const legacyFolder = path.join(dir, 'legacy');
    mkdirSync(legacyFolder);
    cpSync(folder, legacyFolder, { recursive: true });
    const journalFile = path.join(legacyFolder, 'meta/_journal.json');
    const journal = JSON.parse(readFileSync(journalFile, 'utf8'));
    journal.entries = journal.entries.filter((entry: { idx: number }) => entry.idx < 20);
    writeFileSync(journalFile, JSON.stringify(journal));
    const legacy = new Database(':memory:');
    const db = drizzle(legacy, { schema });
    try {
      migrate(db, { migrationsFolder: legacyFolder });
      legacy.exec(
        "INSERT INTO approval_requests (id,session_id,run_id,agent_id,tool_name,args_json,risk_tier,status,created_at_ms) VALUES ('legacy','s','legacy-run','a','t','{}','high','pending',100)",
      );
      legacy.exec('CREATE TABLE run_attempts (id text)');
      expect(() => migrate(db, { migrationsFolder: folder })).toThrow();
      expect(
        legacy.prepare("SELECT name FROM sqlite_master WHERE name = 'controlled_runs'").get(),
      ).toBeUndefined();
      expect(legacy.prepare('SELECT status FROM approval_requests').get()).toEqual({
        status: 'pending',
      });
      legacy.exec('DROP TABLE run_attempts');
      migrate(db, { migrationsFolder: folder });
      expect(getRunForExecution(db, 'legacy-run')).toBeUndefined();
      expect(legacy.prepare('SELECT status FROM approval_requests').get()).toEqual({
        status: 'pending',
      });
    } finally {
      legacy.close();
    }
  });
});
