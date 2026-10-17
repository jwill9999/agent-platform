import { randomUUID } from 'node:crypto';
import { appendFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  approveApprovalRequest,
  claimApprovalRequestForResume,
  createApprovalRequest,
  createControlledRun,
  createSession,
  DEFAULT_AGENT_ID,
  getApprovalRequest,
  getRunForExecution,
  openDatabase,
  runSeed,
} from '@agent-platform/db';
import {
  GitDeliveryReceiptSchema,
  type GitDeliveryPort,
  type GitDeliveryReceipt,
} from '@agent-platform/contracts';
import { executeGitDeliveryTool } from '../../../packages/harness/src/tools/gitTools.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  RunControlService,
  type ControlObservation,
} from '../src/application/runControl/service.js';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((accept, deny) => {
    resolve = accept;
    reject = deny;
  });
  return { promise, resolve, reject };
}
let directory: string;
let context: ReturnType<typeof openDatabase>;
let observations: ControlObservation[];
let service: RunControlService;
function session() {
  return createSession(context.db, { agentId: DEFAULT_AGENT_ID });
}
function open() {
  const selected = session();
  return { selected, execution: service.open(selected, randomUUID()) };
}
function approval(sessionId: string, runId: string) {
  return createApprovalRequest(context.db, {
    id: randomUUID(),
    sessionId,
    runId,
    agentId: DEFAULT_AGENT_ID,
    toolName: 'sys_write_file',
    args: { path: 'private-fixture', content: 'not-in-control-metadata' },
    riskTier: 'high',
    executionPayloadJson: JSON.stringify({
      toolCallId: 'fixture-call',
      toolName: 'sys_write_file',
      args: { path: 'private-fixture', content: 'fixture' },
    }),
    createdAtMs: Date.now(),
  });
}
function gitMutationFixture(
  sessionId: string,
  mode: 'unknown' | 'executing' | 'unavailable' | 'succeeded',
) {
  const action = { kind: 'commit' as const, message: 'fixture commit', paths: ['README.md'] };
  const approvalRequestId = randomUUID();
  const entered = deferred<void>();
  const release = deferred<void>();
  const effectFile = path.join(directory, 'git-mutation-effects.txt');
  const receiptFile = path.join(directory, 'git-mutation-receipt.json');
  let receipt = GitDeliveryReceiptSchema.parse({
    id: randomUUID(),
    projectId: randomUUID(),
    sessionId,
    source: 'chat',
    action,
    state: 'prepared',
    createdAtMs: 100,
    updatedAtMs: 100,
    expiresAtMs: Date.now() + 60_000,
    review: {
      branch: 'feature/fixture',
      head: 'a'.repeat(40),
      indexTree: 'b'.repeat(40),
      paths: ['README.md'],
    },
  });
  const save = (next: GitDeliveryReceipt) => {
    receipt = GitDeliveryReceiptSchema.parse(next);
    writeFileSync(receiptFile, JSON.stringify(receipt));
  };
  save(receipt);
  const port: GitDeliveryPort = {
    prepare: async () => {
      throw new Error('Unexpected mutation preparation/replay');
    },
    get: async (id) => {
      expect(id).toBe(receipt.id);
      return GitDeliveryReceiptSchema.parse(receipt);
    },
    execute: async (id, authority) => {
      expect(id).toBe(receipt.id);
      expect(authority.approvalRequestId).toBe(approvalRequestId);
      save({ ...receipt, state: 'executing', updatedAtMs: 105 });
      // The trusted port is a boundary fixture, but its admitted effect and receipt are real disposable files.
      appendFileSync(effectFile, 'mutation-started\n');
      entered.resolve();
      await release.promise;
      save({ ...receipt, state: mode === 'unavailable' ? 'unknown' : mode, updatedAtMs: 110 });
      if (mode === 'unavailable') throw new Error('Lost response after the mutation entered');
      return GitDeliveryReceiptSchema.parse(receipt);
    },
    cancel: async () => {
      throw new Error('Stop must not fabricate rollback or another mutation');
    },
  };
  return {
    action,
    port,
    entered,
    release,
    approvalRequestId,
    effectFile,
    receiptFile,
    get receipt() {
      return receipt;
    },
  };
}

describe('shared application-owned RunControlService', () => {
  beforeEach(() => {
    directory = mkdtempSync(path.join(os.tmpdir(), 'run-control-service-'));
    context = openDatabase(path.join(directory, 'db.sqlite'));
    runSeed(context.db);
    observations = [];
    service = new RunControlService(context.db, (value) => observations.push(value));
  });
  afterEach(() => {
    if (context.sqlite.open) context.sqlite.close();
    rmSync(directory, { recursive: true, force: true });
  });
  it('publishes a durable logical identity before setup and admits no action after Stop', () => {
    const { selected, execution } = open();
    const first = service.current(selected.id)!;
    expect(first).toMatchObject({
      id: execution.runId,
      sessionId: selected.id,
      state: 'running',
      inFlight: 0,
    });
    expect(getRunForExecution(context.db, execution.executionId)?.id).toBe(execution.runId);
    const started = performance.now();
    const ack = service.stop(selected.id, execution.runId);
    expect(performance.now() - started).toBeLessThan(2000);
    expect(ack).toMatchObject({ state: 'cancelled', reason: 'user_stop', inFlight: 0 });
    expect(ack.stopAcknowledgedAtMs).toBeTypeOf('number');
    let calls = 0;
    expect(() =>
      execution.invoke('setup', async () => {
        calls++;
      }),
    ).toThrow();
    expect(calls).toBe(0);
    expect(service.stop(selected.id, execution.runId)).toEqual(ack);
    expect(observations.map((value) => value.stage)).toEqual(
      expect.arrayContaining(['state', 'requested', 'acknowledged']),
    );
  });
  it('invokes the admitted action synchronously before an observer can acknowledge Stop', async () => {
    const order: string[] = [];
    service = new RunControlService(context.db, (value) => {
      observations.push(value);
      if (value.stage === 'admitted') {
        order.push('admitted-observer');
        service.stop(value.record.sessionId, value.record.id);
      }
    });
    const { selected, execution } = open();
    const gate = deferred<string>();
    const pending = execution.invoke('tool', () => {
      expect(service.read(selected.id, execution.runId)?.inFlight).toBe(1);
      order.push('actual-action');
      return gate.promise;
    });
    expect(order).toEqual(['actual-action', 'admitted-observer']);
    expect(service.read(selected.id, execution.runId)).toMatchObject({
      state: 'stop_requested',
      inFlight: 1,
    });
    gate.resolve('actual-late-result');
    await expect(pending).resolves.toBe('actual-late-result');
    expect(service.read(selected.id, execution.runId)).toMatchObject({
      state: 'cancelled',
      inFlight: 0,
    });
    expect(
      context.sqlite
        .prepare('select kind, outcome from run_attempts where run_id = ?')
        .all(execution.runId),
    ).toEqual([{ kind: 'tool', outcome: 'succeeded' }]);
  });
  it.each(['synchronous', 'asynchronous'] as const)(
    'tracks one durable failed attempt for a genuine %s action rejection',
    async (mode) => {
      const { selected, execution } = open();
      const failure = new Error('genuine-action-failure');
      let calls = 0;
      const pending = execution.invoke('model', () => {
        calls++;
        if (mode === 'synchronous') throw failure;
        return Promise.reject(failure);
      });
      expect(calls).toBe(1);
      await expect(pending).rejects.toBe(failure);
      expect(service.read(selected.id, execution.runId)?.inFlight).toBe(0);
      expect(
        context.sqlite
          .prepare('select kind, outcome from run_attempts where run_id = ?')
          .all(execution.runId),
      ).toEqual([{ kind: 'model', outcome: 'failed' }]);
      expect(observations.filter((value) => value.stage === 'settled')).toHaveLength(1);
      expect(execution.finish('failed', 'execution_failed')).toMatchObject({
        state: 'failed',
        reason: 'execution_failed',
      });
    },
  );
  it('acknowledges while an admitted model is blocked, then tracks actual late settlement', async () => {
    const { selected, execution } = open();
    const gate = deferred<string>();
    const effects: string[] = [];
    const underlying = execution.invoke('model', async () => {
      effects.push('admitted');
      const value = await gate.promise;
      effects.push('late-result');
      return value;
    });
    const response = execution.waitFor(underlying);
    const rejected = expect(response).rejects.toMatchObject({ code: 'USER_STOP' });
    expect(service.stop(selected.id, execution.runId)).toMatchObject({
      state: 'stop_requested',
      inFlight: 1,
    });
    await rejected;
    expect(execution.finish('completed', 'user_stop')).toMatchObject({
      state: 'outcome_unknown',
      inFlight: 1,
    });
    expect(effects).toEqual(['admitted']);
    expect(() => execution.invoke('tool', async () => effects.push('forbidden'))).toThrow();
    gate.resolve('actual-result');
    await expect(underlying).resolves.toBe('actual-result');
    expect(effects).toEqual(['admitted', 'late-result']);
    expect(service.read(selected.id, execution.runId)).toMatchObject({
      state: 'cancelled',
      inFlight: 0,
      reason: 'user_stop',
    });
    expect(
      observations.some(
        (value) =>
          value.stage === 'settled' && value.kind === 'model' && value.durationMs !== undefined,
      ),
    ).toBe(true);
  });
  it('preserves genuine failure and completion when a stale Stop targets an old run', async () => {
    const { selected, execution } = open();
    const failed = execution.invoke('model', async () => {
      throw new Error('fixture provider failure');
    });
    await expect(failed).rejects.toThrow('fixture provider failure');
    expect(execution.finish('failed', 'execution_failed')).toMatchObject({
      state: 'failed',
      reason: 'execution_failed',
    });
    const next = service.open(selected, randomUUID());
    expect(service.stop(selected.id, execution.runId).state).toBe('failed');
    expect(next.signal.aborted).toBe(false);
    await expect(next.invoke('model', async () => 'healthy')).resolves.toBe('healthy');
    expect(next.finish('completed').state).toBe('completed');
    expect(service.stop(selected.id, next.runId).state).toBe('completed');
  });
  it('keeps a genuine model rejection distinct when it races with acknowledged Stop', async () => {
    const { selected, execution } = open();
    const gate = deferred<string>();
    const pending = execution.invoke('model', () => gate.promise);
    service.stop(selected.id, execution.runId);
    gate.reject(new Error('genuine-provider-failure'));
    await expect(pending).rejects.toThrow('genuine-provider-failure');
    expect(execution.finish('failed', 'execution_failed')).toMatchObject({
      state: 'failed',
      reason: 'execution_failed',
    });
  });
  it('does not mistake a resolved timeout wrapper for underlying effect termination', async () => {
    const { selected, execution } = open();
    await execution.invoke('tool', async () => ({ code: 'TOOL_TIMEOUT' }));
    const uncertain = service.current(selected.id)!;
    expect(uncertain).toMatchObject({
      state: 'outcome_unknown',
      reason: 'execution_failed',
      inFlight: 1,
    });
    expect(uncertain.stopAcknowledgedAtMs).toBeUndefined();
    expect(service.stop(selected.id, execution.runId)).toEqual(uncertain);
    expect(execution.finish('completed', 'execution_failed').state).toBe('outcome_unknown');
    let extraEffects = 0;
    expect(() =>
      execution.invoke('tool', async () => {
        extraEffects++;
      }),
    ).toThrow('run_not_running');
    expect(extraEffects).toBe(0);
  });
  it.each([
    { code: 'HTTP_OUTCOME_UNKNOWN' },
    { output: { type: 'error', code: 'DOWNLOAD_OUTCOME_UNKNOWN', message: 'fixture failure' } },
    { status: 'outcome_unknown', exitCode: null, stdout: '', stderr: '' },
  ])(
    'immediately fences uncertain network, download and command results %j without inventing user Stop',
    async (result) => {
      const { selected, execution } = open();
      const effects: string[] = [];
      await execution.invoke('tool', async () => {
        effects.push('admitted-uncertain-effect');
        return result;
      });
      expect(service.current(selected.id)).toMatchObject({
        state: 'outcome_unknown',
        reason: 'execution_failed',
        inFlight: 1,
      });
      expect(service.current(selected.id)?.stopAcknowledgedAtMs).toBeUndefined();
      expect(() =>
        execution.invoke('tool', async () => {
          effects.push('forbidden-next-effect');
        }),
      ).toThrow('run_not_running');
      expect(effects).toEqual(['admitted-uncertain-effect']);
      expect(execution.finish('completed', 'none')).toMatchObject({
        state: 'outcome_unknown',
        reason: 'execution_failed',
        inFlight: 1,
      });
    },
  );
  it.each(['tool', 'sensor'] as const)(
    'does not treat a resolved generic %s error after Stop as proof of termination',
    async (kind) => {
      const { selected, execution } = open();
      const gate = deferred<{ type: 'error'; code: string; message: string }>();
      let invoked = 0;
      const pending = execution.invoke(kind, () => {
        invoked++;
        return gate.promise;
      });
      service.stop(selected.id, execution.runId);
      gate.resolve({
        type: 'error',
        code: 'GENERIC_FAILURE',
        message: 'fixture transport error after abort',
      });
      await pending;
      expect(service.current(selected.id)).toMatchObject({
        state: 'outcome_unknown',
        reason: 'user_stop',
        inFlight: 1,
      });
      expect(execution.finish('failed', 'execution_failed')).toMatchObject({
        state: 'outcome_unknown',
        reason: 'user_stop',
        inFlight: 1,
      });
      expect(() =>
        execution.invoke(kind, async () => {
          invoked++;
        }),
      ).toThrow();
      expect(invoked).toBe(1);
    },
  );
  it.each(['tool', 'sensor'] as const)(
    'does not infer settled %s effects from a generic rejection after Stop',
    async (kind) => {
      const { selected, execution } = open();
      const gate = deferred<string>();
      const effects = ['earlier-confirmed-effect'];
      const pending = execution.invoke(kind, () => gate.promise);
      service.stop(selected.id, execution.runId);
      gate.reject(new Error('Generic remote closure without termination evidence'));
      await expect(pending).rejects.toThrow('Generic remote closure');
      expect(service.current(selected.id)).toMatchObject({
        state: 'outcome_unknown',
        reason: 'user_stop',
        inFlight: 1,
      });
      expect(() => execution.invoke(kind, async () => effects.push('forbidden-effect'))).toThrow();
      expect(effects).toEqual(['earlier-confirmed-effect']);
    },
  );
  it('keeps a genuine resolved pre-Stop tool failure distinct from uncertainty and user cancellation', async () => {
    const { selected, execution } = open();
    await execution.invoke('tool', async () => ({
      type: 'error',
      code: 'FIXTURE_FAILURE',
      message: 'confirmed settled failure',
    }));
    expect(service.current(selected.id)?.inFlight).toBe(0);
    expect(execution.finish('failed', 'execution_failed')).toMatchObject({
      state: 'failed',
      reason: 'execution_failed',
      inFlight: 0,
    });
    expect(service.stop(selected.id, execution.runId)).toMatchObject({
      state: 'failed',
      reason: 'execution_failed',
    });
    expect(service.current(selected.id)?.stopAcknowledgedAtMs).toBeUndefined();
  });
  it.each(['unknown', 'executing'] as const)(
    'fences the actual Git tool output for a valid %s receipt after its mutation enters',
    async (state) => {
      const { selected, execution } = open();
      const fixture = gitMutationFixture(selected.id, state);
      const result = execution.invoke('tool', () =>
        executeGitDeliveryTool('sys_git_commit', fixture.action, fixture.port, {
          operationId: fixture.receipt.id,
          approvalRequestId: fixture.approvalRequestId,
        }),
      );
      try {
        await fixture.entered.promise;
        expect(readFileSync(fixture.effectFile, 'utf8')).toBe('mutation-started\n');
        fixture.release.resolve();
        const output = await result;
        expect(output.type).toBe('tool_result');
        if (output.type !== 'tool_result')
          throw new Error('Expected the actual Git tool receipt envelope');
        const receipt = GitDeliveryReceiptSchema.parse(output.data.gitDeliveryReceipt);
        expect(receipt.state).toBe(state);
        expect(service.current(selected.id)).toMatchObject({
          state: 'outcome_unknown',
          reason: 'execution_failed',
          inFlight: 1,
        });
        expect(service.current(selected.id)?.stopAcknowledgedAtMs).toBeUndefined();
        const persisted = readFileSync(fixture.receiptFile, 'utf8');
        expect(() =>
          execution.invoke('tool', () =>
            executeGitDeliveryTool('sys_git_commit', fixture.action, fixture.port, {
              operationId: fixture.receipt.id,
              approvalRequestId: fixture.approvalRequestId,
            }),
          ),
        ).toThrow('run_not_running');
        expect(readFileSync(fixture.effectFile, 'utf8')).toBe('mutation-started\n');
        expect(readFileSync(fixture.receiptFile, 'utf8')).toBe(persisted);
        expect(execution.finish('completed', 'none')).toMatchObject({
          state: 'outcome_unknown',
          reason: 'execution_failed',
          inFlight: 1,
        });
      } finally {
        fixture.release.resolve();
        await result;
      }
    },
  );
  it('preserves a real serialized unknown Git receipt when Stop races with its admitted mutation', async () => {
    const { selected, execution } = open();
    const fixture = gitMutationFixture(selected.id, 'unknown');
    const pending = execution.invoke('tool', () =>
      executeGitDeliveryTool('sys_git_commit', fixture.action, fixture.port, {
        operationId: fixture.receipt.id,
        approvalRequestId: fixture.approvalRequestId,
        signal: execution.signal,
      }),
    );
    try {
      await fixture.entered.promise;
      expect(service.stop(selected.id, execution.runId)).toMatchObject({
        state: 'stop_requested',
        inFlight: 1,
      });
      fixture.release.resolve();
      const output = await pending;
      expect(output.type).toBe('tool_result');
      const retained = GitDeliveryReceiptSchema.parse(
        JSON.parse(readFileSync(fixture.receiptFile, 'utf8')),
      );
      expect(retained).toMatchObject({
        id: fixture.receipt.id,
        state: 'unknown',
        action: fixture.action,
      });
      expect(service.current(selected.id)).toMatchObject({
        state: 'outcome_unknown',
        reason: 'user_stop',
        inFlight: 1,
      });
      expect(execution.finish('completed', 'user_stop').state).toBe('outcome_unknown');
      expect(() =>
        execution.invoke('tool', async () => appendFileSync(fixture.effectFile, 'forbidden\n')),
      ).toThrow();
      expect(readFileSync(fixture.effectFile, 'utf8')).toBe('mutation-started\n');
      expect(
        GitDeliveryReceiptSchema.parse(JSON.parse(readFileSync(fixture.receiptFile, 'utf8'))),
      ).toEqual(retained);
    } finally {
      fixture.release.resolve();
      await pending;
    }
  });
  it('recognizes the actual Git catch branch when mutation response retrieval fails after entry', async () => {
    const { selected, execution } = open();
    const fixture = gitMutationFixture(selected.id, 'unavailable');
    const pending = execution.invoke('tool', () =>
      executeGitDeliveryTool('sys_git_commit', fixture.action, fixture.port, {
        operationId: fixture.receipt.id,
        approvalRequestId: fixture.approvalRequestId,
      }),
    );
    try {
      await fixture.entered.promise;
      fixture.release.resolve();
      await expect(pending).resolves.toMatchObject({
        type: 'error',
        code: 'GIT_DELIVERY_OUTCOME_UNAVAILABLE',
      });
      expect(service.current(selected.id)).toMatchObject({
        state: 'outcome_unknown',
        reason: 'execution_failed',
        inFlight: 1,
      });
      expect(() =>
        execution.invoke('tool', async () => appendFileSync(fixture.effectFile, 'forbidden\n')),
      ).toThrow('run_not_running');
      expect(readFileSync(fixture.effectFile, 'utf8')).toBe('mutation-started\n');
      expect(
        GitDeliveryReceiptSchema.parse(JSON.parse(readFileSync(fixture.receiptFile, 'utf8'))).state,
      ).toBe('unknown');
    } finally {
      fixture.release.resolve();
      await pending;
    }
  });
  it('accepts an actual strictly valid settled Git receipt without treating every Git mutation as unknown', async () => {
    const { selected, execution } = open();
    const fixture = gitMutationFixture(selected.id, 'succeeded');
    const pending = execution.invoke('tool', () =>
      executeGitDeliveryTool('sys_git_commit', fixture.action, fixture.port, {
        operationId: fixture.receipt.id,
        approvalRequestId: fixture.approvalRequestId,
      }),
    );
    try {
      await fixture.entered.promise;
      fixture.release.resolve();
      const output = await pending;
      expect(output.type).toBe('tool_result');
      if (output.type !== 'tool_result')
        throw new Error('Expected the actual Git tool receipt envelope');
      expect(output.data.ok).toBe(true);
      expect(GitDeliveryReceiptSchema.parse(output.data.gitDeliveryReceipt).state).toBe(
        'succeeded',
      );
      expect(service.current(selected.id)).toMatchObject({
        state: 'running',
        reason: 'none',
        inFlight: 0,
      });
      const receipt = readFileSync(fixture.receiptFile, 'utf8');
      expect(service.stop(selected.id, execution.runId)).toMatchObject({
        state: 'cancelled',
        reason: 'user_stop',
        inFlight: 0,
      });
      expect(readFileSync(fixture.effectFile, 'utf8')).toBe('mutation-started\n');
      expect(readFileSync(fixture.receiptFile, 'utf8')).toBe(receipt);
    } finally {
      fixture.release.resolve();
      await pending;
    }
  });
  it('does not accept a malformed Git receipt as mutation settlement proof', async () => {
    const { selected, execution } = open();
    const fixture = gitMutationFixture(selected.id, 'unknown');
    const malformed = { ...fixture.receipt, state: 'unknown', unreviewedField: 'invalid shape' };
    expect(GitDeliveryReceiptSchema.safeParse(malformed).success).toBe(false);
    await execution.invoke('tool', async () => {
      appendFileSync(fixture.effectFile, 'mutation-started\n');
      return {
        type: 'tool_result',
        toolId: 'sys_git_commit',
        data: { ok: false, gitDeliveryReceipt: malformed },
      };
    });
    expect(service.current(selected.id)).toMatchObject({
      state: 'outcome_unknown',
      reason: 'execution_failed',
      inFlight: 1,
    });
    expect(() =>
      execution.invoke('tool', async () => appendFileSync(fixture.effectFile, 'forbidden\n')),
    ).toThrow('run_not_running');
    expect(readFileSync(fixture.effectFile, 'utf8')).toBe('mutation-started\n');
  });
  it('refuses cross-session authority, conflicting starts and unbound legacy approval continuations', () => {
    const { selected, execution } = open();
    const other = session();
    expect(() => service.open(selected, randomUUID())).toThrow('run_conflict');
    expect(() => service.stop(other.id, execution.runId)).toThrow('run_not_found');
    expect(() => service.open(other, randomUUID(), execution.executionId)).toThrow('run_not_found');
    expect(() => service.open(other, randomUUID(), 'legacy-unbound-run')).toThrow('run_not_found');
    expect(service.read(selected.id, execution.runId)?.state).toBe('running');
  });
  it('fences a pending approval but retains its record and permits a fresh independent request', () => {
    const { selected, execution } = open();
    const saved = approval(selected.id, execution.executionId);
    execution.finish('waiting_for_approval');
    expect(service.stop(selected.id, execution.runId).state).toBe('cancelled');
    approveApprovalRequest(context.db, saved.id, Date.now());
    claimApprovalRequestForResume(context.db, saved.id, Date.now());
    expect(() => service.open(selected, randomUUID(), execution.executionId)).toThrow(
      'run_not_running',
    );
    expect(getApprovalRequest(context.db, saved.id).runId).toBe(execution.executionId);
    const next = service.open(selected, randomUUID());
    expect(next.runId).not.toBe(execution.runId);
    expect(next.signal.aborted).toBe(false);
  });
  it('stops a claimed approval continuation before its actual effect admission', () => {
    const { selected, execution } = open();
    const saved = approval(selected.id, execution.executionId);
    execution.finish('waiting_for_approval');
    approveApprovalRequest(context.db, saved.id, Date.now());
    claimApprovalRequestForResume(context.db, saved.id, Date.now());
    const resumed = service.open(selected, randomUUID(), execution.executionId);
    expect(resumed.runId).toBe(execution.runId);
    service.stop(selected.id, resumed.runId);
    let actualEffects = 0;
    expect(() =>
      resumed.invoke('tool', async () => {
        actualEffects++;
      }),
    ).toThrow();
    expect(actualEffects).toBe(0);
    expect(getApprovalRequest(context.db, saved.id).resumedAtMs).toBeTypeOf('number');
  });
  it('cannot let a fast approval continuation be overwritten by the previous HTTP owner finishing', async () => {
    const { selected, execution } = open();
    const saved = approval(selected.id, execution.executionId);
    // The frame callback publishes approval eligibility before the original stream's cleanup finishes.
    expect(service.pause(execution.executionId).state).toBe('waiting_for_approval');
    approveApprovalRequest(context.db, saved.id, Date.now());
    claimApprovalRequestForResume(context.db, saved.id, Date.now());
    const resumed = service.open(selected, randomUUID(), execution.executionId);
    expect(execution.finish('waiting_for_approval')).toMatchObject({
      id: resumed.runId,
      state: 'running',
    });
    const effects: string[] = [];
    await resumed.invoke('tool', async () => {
      effects.push('approved-once');
    });
    expect(resumed.finish('completed').state).toBe('completed');
    expect(execution.finish('waiting_for_approval').state).toBe('completed');
    expect(effects).toEqual(['approved-once']);
    expect(service.current(selected.id)?.state).toBe('completed');
  });
  it('does not allow optional diagnostic failures to affect committed Stop or settlement', async () => {
    const degraded = new RunControlService(context.db, () => {
      throw new Error('diagnostic store unavailable');
    });
    const selected = session();
    const execution = degraded.open(selected, randomUUID());
    await expect(execution.invoke('model', async () => 'observed')).resolves.toBe('observed');
    expect(degraded.stop(selected.id, execution.runId)).toMatchObject({
      state: 'cancelled',
      inFlight: 0,
    });
  });
  it('returns no successful acknowledgement or abort when mandatory DB commit is blocked', () => {
    const { selected, execution } = open();
    const other = openDatabase(path.join(directory, 'db.sqlite')).sqlite;
    other.exec('BEGIN IMMEDIATE');
    const started = performance.now();
    try {
      expect(() => service.stop(selected.id, execution.runId)).toThrow(/locked/);
      expect(performance.now() - started).toBeLessThan(1500);
      expect(execution.signal.aborted).toBe(false);
      expect(observations.filter((value) => value.stage === 'acknowledged')).toHaveLength(0);
      expect(service.current(selected.id)?.state).toBe('running');
    } finally {
      other.exec('ROLLBACK');
      other.close();
    }
    expect(service.stop(selected.id, execution.runId).state).toBe('cancelled');
  });
  it('marks foreign-process unfinished authority interrupted without running it', () => {
    const selected = session();
    const id = randomUUID();
    createControlledRun(context.db, {
      id,
      sessionId: selected.id,
      processInstanceId: randomUUID(),
      executionId: randomUUID(),
      nowMs: Date.now(),
    });
    const restarted = new RunControlService(context.db);
    expect(restarted.current(selected.id)).toMatchObject({
      id,
      state: 'interrupted',
      reason: 'process_interrupted',
    });
    expect(() => restarted.open(selected, randomUUID(), 'missing-source')).toThrow('run_not_found');
    expect(restarted.open(selected, randomUUID()).runId).not.toBe(id);
  });
});
