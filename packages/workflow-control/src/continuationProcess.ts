import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { ContinuationJournal, type ContinuationAction } from './continuationJournal.js';
import { delegateCallbackSchema } from './governedOperations.js';
import { specialistTerminalResult } from './specialistTerminalResult.js';
import { phaseActionForCallback } from './phaseJobs.js';

/** Executed in a real parent continuation process; no conversation message is injected. */
export function runParentContinuation(args: readonly string[]): void {
  const [path, id, executionId, epochText] = args;
  const epoch = Number(epochText);
  if (!path || !id || !executionId || !Number.isSafeInteger(epoch) || epoch <= 0) {
    throw new Error('invalid parent continuation invocation');
  }
  const journal = new ContinuationJournal(path);
  try {
    if (!journal.start(id, executionId, epoch, Date.now())) return;
    const job = journal.get(id)!;
    let action: ContinuationAction = {
      kind: 'blocked',
      reason: 'specialist_callback_authority_unavailable',
    };
    const specialist = journal.specialistResult(job.execution_id);
    if (specialist.status !== 'completed') {
      action = { kind: 'blocked', reason: 'specialist_execution_not_completed' };
    } else if (specialistTerminalResult(specialist.result) === undefined) {
      action = { kind: 'blocked', reason: 'invalid_specialist_terminal_result' };
    } else if (job.callback_json !== null) {
      const callback = delegateCallbackSchema.parse(JSON.parse(job.callback_json));
      if (callback.approvalIntent !== undefined) {
        action = { kind: 'approval_required', eventId: callback.approvalIntent.eventId };
      } else if (callback.terminalStatus === 'blocked') {
        action = { kind: 'blocked', reason: 'specialist_reported_blocker' };
      } else {
        action = phaseActionForCallback(callback);
      }
    }
    try {
      journal.consume(id, executionId, epoch, action, Date.now());
    } catch (error) {
      if (action.kind !== 'execute_phase') throw error;
      journal.consume(
        id,
        executionId,
        epoch,
        {
          kind: 'blocked',
          reason: `phase_authority_unavailable: ${error instanceof Error ? error.message : String(error)}`,
        },
        Date.now(),
      );
    }
  } finally {
    journal.close();
  }
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    runParentContinuation(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
