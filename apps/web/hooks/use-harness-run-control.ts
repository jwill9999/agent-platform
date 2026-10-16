'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RunControlRecordSchema, type RunControlRecord } from '@agent-platform/contracts';
import { apiPath } from '@/lib/apiClient';

const ACTIVE = new Set(['running', 'waiting_for_approval', 'stop_requested']);
const STOPPABLE = new Set(['running', 'waiting_for_approval']);
const CONTROL_TIMEOUT_MS = 5_000;
const CONTROL_ERROR =
  'Run status is unavailable. Retry Stop or check the local API; termination is not confirmed.';

type ControlView = {
  owner: symbol;
  record: RunControlRecord | null;
  error: string | null;
  stopPending: boolean;
  ready: boolean;
};

async function readControl(path: string, sessionId: string, runId?: string, stop = false) {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new Error(CONTROL_ERROR));
      }, CONTROL_TIMEOUT_MS);
    });
    return await Promise.race([
      (async () => {
        const response = await fetch(path, {
          cache: 'no-store',
          signal: controller.signal,
          ...(stop
            ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }
            : {}),
        });
        if (!response.ok) throw new Error(CONTROL_ERROR);
        const body: unknown = await response.json();
        const value = body && typeof body === 'object' && 'data' in body ? body.data : undefined;
        if (value === null && !stop && !runId) return null;
        const record = RunControlRecordSchema.parse(value);
        if (record.sessionId !== sessionId || (runId && record.id !== runId))
          throw new Error(CONTROL_ERROR);
        return record;
      })(),
      deadline,
    ]);
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}

export function runControlStatusText(record: RunControlRecord | null): string | undefined {
  if (!record) return undefined;
  switch (record.state) {
    case 'running':
      return 'Run in progress. Stop requests prevent further actions; completed effects remain.';
    case 'waiting_for_approval':
      return 'Waiting for approval. You can Stop this run before approving.';
    case 'stop_requested':
      return 'Stop acknowledged. Waiting for admitted work to settle; completed effects remain.';
    case 'cancelled':
      return 'Run stopped. Completed effects remain; nothing has been rolled back.';
    case 'outcome_unknown':
      return 'Run outcome is unknown. Admitted work may still finish; inspect effects before a new request.';
    case 'interrupted':
      return 'Run interrupted. Inspect earlier effects before starting a new request.';
    default:
      return undefined;
  }
}

/** A view of shared API authority, never a client-side cancellation mechanism. */
export function useHarnessRunControl(
  sessionId: string | null,
  runId: string | null,
  busy: boolean,
  operationEpoch: number,
  precedingRunId: string | null = null,
) {
  const owner = useMemo(() => Symbol('run-control-selection'), [sessionId, operationEpoch]);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const current = useRef(owner);
  current.current = owner;
  const [stored, setStored] = useState<ControlView>({
    owner,
    record: null,
    error: null,
    stopPending: false,
    ready: false,
  });
  const view =
    stored.owner === owner
      ? stored
      : { owner, record: null, error: null, stopPending: false, ready: false };
  const latest = useRef(view);
  latest.current = view;
  const [refresh, setRefresh] = useState(0);
  const stopping = useRef<symbol | null>(null);
  const stopFailure = useRef<symbol | null>(null);

  const accept = useCallback(
    (record: RunControlRecord | null, error: string | null = null) => {
      if (!mounted.current || current.current !== owner) return;
      setStored((prior) => {
        const previous = prior.owner === owner ? prior.record : null;
        // A late poll cannot undo an acknowledged Stop or newer committed version.
        if (previous && !record) return prior;
        if (previous && record?.id === previous.id && record.version < previous.version)
          return prior;
        return {
          owner,
          record,
          error:
            error ??
            (stopFailure.current === owner && record && STOPPABLE.has(record.state)
              ? CONTROL_ERROR
              : null),
          stopPending: stopping.current === owner,
          ready: error ? prior.owner === owner && prior.ready : true,
        };
      });
    },
    [owner],
  );

  useEffect(() => {
    if (!sessionId) return;
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      let active = busy;
      try {
        const path = runId
          ? apiPath('sessions', sessionId, 'runs', runId)
          : apiPath('sessions', sessionId, 'active-run');
        const record = await readControl(path, sessionId, runId ?? undefined);
        if (disposed) return;
        if (busy && !runId && record?.id === precedingRunId) {
          timer = setTimeout(() => void poll(), 1_000);
          return;
        }
        accept(record);
        active = record ? ACTIVE.has(record.state) : busy;
      } catch {
        if (disposed) return;
        accept(latest.current.record, CONTROL_ERROR);
        active ||= Boolean(latest.current.record && ACTIVE.has(latest.current.record.state));
      }
      if (!disposed && active) timer = setTimeout(() => void poll(), 1_000);
    };
    void poll();
    return () => {
      disposed = true;
      clearTimeout(timer);
      // Do not abort the run or stream when this view loses ownership.
    };
  }, [accept, sessionId, runId, busy, refresh, precedingRunId]);

  const stop = useCallback(async () => {
    if (!mounted.current || current.current !== owner || stopping.current === owner || !sessionId)
      return false;
    const target = latest.current.record;
    if (!target || target.sessionId !== sessionId || !STOPPABLE.has(target.state)) return false;
    stopping.current = owner;
    stopFailure.current = null;
    accept(target);
    try {
      const record = await readControl(
        apiPath('sessions', sessionId, 'runs', target.id, 'stop'),
        sessionId,
        target.id,
        true,
      );
      if (!mounted.current || current.current !== owner) return false;
      accept(record);
      setRefresh((value) => value + 1);
      return true;
    } catch {
      if (current.current === owner) stopFailure.current = owner;
      accept(latest.current.record, CONTROL_ERROR);
      return false;
    } finally {
      if (stopping.current === owner) stopping.current = null;
      if (mounted.current && current.current === owner)
        setStored((previous) => ({ ...previous, stopPending: false }));
    }
  }, [accept, owner, sessionId]);

  return {
    runControl: view.record,
    runControlReady: view.ready,
    retryRunControl: () => setRefresh((value) => value + 1),
    runControlError: view.error,
    runControlStatusText: view.error ?? runControlStatusText(view.record),
    stopPending: view.stopPending,
    canStop: Boolean(view.record && STOPPABLE.has(view.record.state)),
    stop,
  };
}
