'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GitDeliveryAction, GitDeliveryReceipt } from '@agent-platform/contracts';
import { apiDelete, apiGet, apiPath, apiPost, ApiRequestError } from './apiClient';

type DeliveryView = {
  projectId: string | null;
  operations: GitDeliveryReceipt[];
  stagedPaths: string[];
  selectedId: string | null;
  error: string | null;
  unverifiedIds: string[];
};
const emptyView = (projectId: string | null): DeliveryView => ({
  projectId,
  operations: [],
  stagedPaths: [],
  selectedId: null,
  error: null,
  unverifiedIds: [],
});

/** Transport state only. All authority and mutation decisions belong to the shared API service. */
export function useGitDelivery(projectId: string | null) {
  const [view, setView] = useState<DeliveryView>(() => emptyView(projectId));
  const [pending, setPending] = useState(false);
  const identity = useMemo(() => ({ projectId }), [projectId]);
  const activeIdentity = useRef<typeof identity | null>(null);
  const epoch = useRef(0);
  const revision = useRef(0);
  const ownedRequest = useRef<AbortController | null>(null);
  const path = useCallback(
    (...parts: string[]) => apiPath('projects', projectId ?? '', 'git', 'delivery', ...parts),
    [projectId],
  );
  const refresh = useCallback(async () => {
    if (!projectId || activeIdentity.current !== identity) return;
    const current = epoch.current;
    const version = ++revision.current;
    const [history, index] = await Promise.allSettled([
      apiGet<{ operations: GitDeliveryReceipt[] }>(path()),
      apiGet<{ paths: string[] }>(path('index')),
    ]);
    if (
      activeIdentity.current !== identity ||
      current !== epoch.current ||
      version !== revision.current
    )
      return;
    const historyValue = history.status === 'fulfilled' ? history.value : undefined;
    const indexValue = index.status === 'fulfilled' ? index.value : undefined;
    setView((previous) => ({
      ...previous,
      projectId,
      operations: historyValue?.operations ?? previous.operations,
      unverifiedIds: historyValue ? [] : previous.unverifiedIds,
      stagedPaths: indexValue?.paths ?? [],
      error: !historyValue
        ? 'Could not load saved Git outcomes. Refresh before continuing.'
        : !indexValue
          ? 'Could not read the current index. Saved Git outcomes remain available.'
          : null,
    }));
  }, [identity, path, projectId]);
  useEffect(() => {
    activeIdentity.current = identity;
    epoch.current += 1;
    setView(emptyView(projectId));
    setPending(false);
    void refresh();
    return () => {
      activeIdentity.current = null;
      epoch.current += 1;
      ownedRequest.current?.abort();
      ownedRequest.current = null;
    };
  }, [identity, projectId, refresh]);
  const run = useCallback(
    async (
      request: (signal: AbortSignal) => Promise<GitDeliveryReceipt | undefined>,
      affectedId?: string,
    ) => {
      if (!projectId || activeIdentity.current !== identity || ownedRequest.current)
        return undefined;
      const current = epoch.current;
      const controller = new AbortController();
      revision.current += 1;
      ownedRequest.current = controller;
      setPending(true);
      try {
        const receipt = await request(controller.signal);
        if (!receipt) throw new Error('Missing operation response');
        if (current === epoch.current)
          setView((previous) => ({
            ...previous,
            projectId,
            error: null,
            selectedId: receipt.id,
            unverifiedIds: previous.unverifiedIds.filter((id) => id !== receipt.id),
            operations: [receipt, ...previous.operations.filter((item) => item.id !== receipt.id)],
          }));
        return current === epoch.current ? receipt : undefined;
      } catch (cause) {
        if (current === epoch.current)
          setView((previous) => ({
            ...previous,
            unverifiedIds: affectedId
              ? [...new Set([...previous.unverifiedIds, affectedId])]
              : previous.unverifiedIds,
            error:
              cause instanceof ApiRequestError
                ? cause.message
                : 'Connection interrupted. Inspect the saved operation before starting another.',
          }));
        return undefined;
      } finally {
        if (ownedRequest.current === controller) {
          ownedRequest.current = null;
          setPending(false);
        }
      }
    },
    [identity, projectId],
  );
  const prepare = useCallback(
    (action: GitDeliveryAction) =>
      run((signal) => apiPost<GitDeliveryReceipt>(path(), { action }, { signal })),
    [path, run],
  );
  const perform = useCallback(
    (id: string, operation: 'execute' | 'cancel' | 'reconcile' | 'acknowledge') =>
      run(
        (signal) =>
          apiPost<GitDeliveryReceipt>(
            path(id, operation),
            operation === 'execute' || operation === 'acknowledge' ? { confirmed: true } : {},
            { signal },
          ),
        id,
      ),
    [path, run],
  );
  const remove = useCallback(
    async (id: string) => {
      if (!projectId || activeIdentity.current !== identity || ownedRequest.current) return;
      const current = epoch.current;
      const controller = new AbortController();
      revision.current += 1;
      ownedRequest.current = controller;
      setPending(true);
      try {
        await apiDelete(path(id), { confirmed: true });
        if (current === epoch.current)
          setView((previous) => ({
            ...previous,
            operations: previous.operations.filter((item) => item.id !== id),
            selectedId: null,
            error: null,
          }));
      } catch (cause) {
        if (current === epoch.current)
          setView((previous) => ({
            ...previous,
            error:
              cause instanceof ApiRequestError
                ? cause.message
                : 'Could not delete the closed record.',
          }));
      } finally {
        if (ownedRequest.current === controller) {
          ownedRequest.current = null;
          setPending(false);
        }
      }
    },
    [identity, path, projectId],
  );
  const select = useCallback(
    (id: string) => setView((previous) => ({ ...previous, selectedId: id })),
    [],
  );
  const currentView = view.projectId === projectId ? view : emptyView(projectId);
  // Saved history is oldest-first. Surface unresolved uncertainty on reopening;
  // otherwise show the newest operation, while preserving an explicit selection.
  const defaultSelection = [...currentView.operations].sort(
    (a, b) =>
      Number(b.state === 'unknown' && b.acknowledgedAtMs === undefined) -
        Number(a.state === 'unknown' && a.acknowledgedAtMs === undefined) ||
      b.createdAtMs - a.createdAtMs,
  )[0];
  return {
    ...currentView,
    pending,
    prepare,
    perform,
    remove,
    refresh,
    select,
    selected:
      currentView.operations.find((item) => item.id === currentView.selectedId) ??
      defaultSelection ??
      null,
  };
}
