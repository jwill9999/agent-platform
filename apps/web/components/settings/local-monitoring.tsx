'use client';

import { useEffect, useId, useRef, useState } from 'react';
import {
  MonitoringStatusSchema,
  MonitoringPreferenceInputSchema,
  MonitoringPreferenceResultSchema,
  MonitoringWindowInputSchema,
  type MonitoringStatus,
  type MonitoringWindowInput,
} from '@agent-platform/contracts';
import { Button } from '@/components/ui/button';

type MonitoringBridge = {
  getMonitoringStatus(): Promise<unknown>;
  setMonitoringPreference(input: {
    samplingEnabled: boolean;
    retentionDays: number;
  }): Promise<unknown>;
  saveMonitoringReport(input: MonitoringWindowInput): Promise<unknown>;
};
function desktopBridge(): MonitoringBridge | undefined {
  const candidate = (
    globalThis as typeof globalThis & {
      agentPlatformDesktop?: { diagnostics?: Partial<MonitoringBridge> };
    }
  ).agentPlatformDesktop?.diagnostics;
  return candidate &&
    typeof candidate.getMonitoringStatus === 'function' &&
    typeof candidate.setMonitoringPreference === 'function' &&
    typeof candidate.saveMonitoringReport === 'function'
    ? (candidate as MonitoringBridge)
    : undefined;
}
function timestamp(value: number | null | undefined): string {
  return value === null || value === undefined ? 'Unknown' : new Date(value).toISOString();
}
function utcMilliseconds(value: string): number {
  const iso = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
  if (!iso.test(value)) throw new Error('invalid');
  const milliseconds = Date.parse(value);
  const canonical = value.includes('.') ? value : value.replace('Z', '.000Z');
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== canonical)
    throw new Error('invalid');
  return milliseconds;
}
function utcWindow(from: string, to: string): MonitoringWindowInput {
  return MonitoringWindowInputSchema.parse({
    window: { fromMs: utcMilliseconds(from), toMs: utcMilliseconds(to) },
    limit: 1000,
  });
}
function savedOutcome(value: unknown, request: MonitoringWindowInput) {
  if (
    !value ||
    typeof value !== 'object' ||
    !('ok' in value) ||
    value.ok !== true ||
    !('status' in value)
  )
    throw new Error('invalid');
  if (value.status === 'cancelled')
    return { message: 'Export cancelled. No history file was saved.' };
  if (
    value.status !== 'saved' ||
    !('summary' in value) ||
    typeof value.summary !== 'string' ||
    value.summary.length > 512 ||
    !('incomplete' in value) ||
    typeof value.incomplete !== 'boolean'
  )
    throw new Error('invalid');
  const continuation =
    'continuation' in value ? MonitoringWindowInputSchema.parse(value.continuation) : undefined;
  if (
    continuation &&
    (continuation.window.fromMs !== request.window.fromMs ||
      continuation.window.toMs !== request.window.toMs ||
      continuation.sessionId !== request.sessionId)
  )
    throw new Error('invalid');
  return {
    message: `Monitoring history saved locally. ${value.summary}`,
    continuation,
    saved: true,
  };
}

export function LocalMonitoring() {
  const id = useId();
  const bridge = useRef<MonitoringBridge | undefined>(undefined);
  const mounted = useRef(false);
  const busyRef = useRef(false);
  const epoch = useRef(0);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [status, setStatus] = useState<MonitoringStatus | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [days, setDays] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [continuation, setContinuation] = useState<MonitoringWindowInput>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    mounted.current = true;
    bridge.current = desktopBridge();
    setAvailable(Boolean(bridge.current));
    const now = Date.now();
    setFrom(new Date(now - 3600000).toISOString());
    setTo(new Date(now).toISOString());
    if (bridge.current) void refresh();
    return () => {
      mounted.current = false;
      busyRef.current = false;
      epoch.current += 1;
    };
  }, []);

  async function perform(
    action: (token: number) => Promise<void>,
    failure: string,
    invalidateStatus = false,
  ) {
    if (!bridge.current || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setMessage('');
    const token = ++epoch.current;
    try {
      await action(token);
    } catch {
      if (mounted.current && epoch.current === token) {
        if (invalidateStatus) setStatus(null);
        setMessage(failure);
      }
    } finally {
      if (mounted.current && epoch.current === token) {
        busyRef.current = false;
        setBusy(false);
      }
    }
  }
  function current(token: number) {
    return mounted.current && epoch.current === token;
  }
  function adopt(next: MonitoringStatus) {
    setStatus(next);
    if (next.monitoring.preference) {
      setEnabled(next.monitoring.preference.samplingEnabled);
      setDays(String(next.monitoring.preference.retentionDays));
    }
  }
  async function refresh() {
    await perform(async (token) => {
      try {
        const result = MonitoringStatusSchema.parse(await bridge.current!.getMonitoringStatus());
        if (current(token)) adopt(result);
      } catch {
        if (current(token)) setStatus(null);
        throw new Error('unavailable');
      }
    }, 'Monitoring status is unavailable. Recording state is unknown; refresh to verify.');
  }
  async function savePreference() {
    await perform(
      async (token) => {
        const input = MonitoringPreferenceInputSchema.parse({
          samplingEnabled: enabled,
          retentionDays: Number(days),
        });
        const result = MonitoringPreferenceResultSchema.parse(
          await bridge.current!.setMonitoringPreference(input),
        );
        if (
          result.preference.samplingEnabled !== input.samplingEnabled ||
          result.preference.retentionDays !== input.retentionDays ||
          JSON.stringify(result.health.preference) !== JSON.stringify(result.preference)
        )
          throw new Error('unconfirmed');
        if (current(token)) {
          setStatus((previous) => (previous ? { ...previous, monitoring: result.health } : null));
          setMessage(
            'Monitoring preference saved locally. Existing diagnostic event recording is unchanged.',
          );
        }
      },
      'Monitoring preference was not confirmed. Refresh its status before retrying.',
      true,
    );
  }
  async function saveHistory(nextPage: boolean) {
    await perform(async (token) => {
      const request = nextPage && continuation ? continuation : utcWindow(from, to);
      const outcome = savedOutcome(await bridge.current!.saveMonitoringReport(request), request);
      if (current(token)) {
        setMessage(outcome.message);
        if (outcome.saved) setContinuation(outcome.continuation);
      }
    }, 'History could not be saved. Use a valid UTC range of at most 90 days and check the connection and save location.');
  }
  function editWindow(value: string, kind: 'from' | 'to') {
    if (kind === 'from') setFrom(value);
    else setTo(value);
    setContinuation(undefined);
    setMessage('');
  }
  const preference = status?.monitoring.preference;
  const recording = preference ? (preference.samplingEnabled ? 'Enabled' : 'Off') : 'Unknown';
  return (
    <section className="mx-auto max-w-5xl space-y-4 p-6" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="text-lg font-semibold">
        Local monitoring
      </h2>
      <p className="text-sm text-muted-foreground">
        Retain safe resource samples for later review on this machine. No prompts, credentials or
        automatic uploads. Existing diagnostic events continue independently.
      </p>
      {available === false && (
        <p>
          Recording controls and private history exports are available in the local desktop app.
          This browser does not have access to private monitoring.
        </p>
      )}
      {available === null && <p>Checking desktop monitoring availability…</p>}
      {available && (
        <>
          <div className="text-sm space-y-1">
            <p>
              Resource recording: {recording}. Storage: {status?.monitoring.state ?? 'unknown'}.
            </p>
            <p>Last durable observation: {timestamp(status?.monitoring.lastAcknowledgedAtMs)}.</p>
            <p>
              Pending: {status?.monitoring.pending ?? 'unknown'}; dropped:{' '}
              {status?.monitoring.dropped ?? 'unknown'}; pruned:{' '}
              {status?.monitoring.pruned ?? 'unknown'}.
            </p>
            {status && (
              <p>
                Capture health: {status.monitoring.reason}. Previous shutdown:{' '}
                {status.monitoring.previousShutdownUnclean
                  ? 'unclean; history may have gaps'
                  : 'no unclean shutdown reported'}
                .
              </p>
            )}
          </div>
          <Button type="button" variant="outline" disabled={busy} onClick={() => void refresh()}>
            Refresh monitoring status
          </Button>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void savePreference();
            }}
          >
            <fieldset disabled={busy || !preference} className="space-y-3">
              <legend className="font-medium">Resource recording preference</legend>
              <label htmlFor={`${id}-enabled`} className="flex items-center gap-2">
                <input
                  id={`${id}-enabled`}
                  type="checkbox"
                  checked={enabled}
                  onChange={(event) => setEnabled(event.target.checked)}
                />
                Record local resource samples
              </label>
              <label htmlFor={`${id}-days`} className="block">
                Retention age in whole days (1–90)
              </label>
              <input
                id={`${id}-days`}
                type="number"
                min="1"
                max="90"
                step="1"
                required
                value={days}
                onChange={(event) => setDays(event.target.value)}
                className="rounded border bg-background p-2"
                aria-describedby={`${id}-bounds`}
              />
              <p id={`${id}-bounds`} className="text-sm text-muted-foreground">
                Samples are also limited to 25,000 rows and bounded storage. At 30-second intervals,
                the row cap holds about 8.68 days; choosing 90 days does not guarantee 90 days of
                history.
              </p>
              <Button type="submit">Save monitoring preference</Button>
            </fieldset>
          </form>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void saveHistory(false);
            }}
          >
            <fieldset disabled={busy} className="space-y-3">
              <legend className="font-medium">Export historical window</legend>
              <p className="text-sm text-muted-foreground">
                Enter UTC timestamps ending in Z, for example 2026-10-16T12:00:00Z. Each file
                includes safe JSON and a readable summary with gaps and independent snapshot limits.
              </p>
              <label htmlFor={`${id}-from`} className="block">
                From (UTC, inclusive)
              </label>
              <input
                id={`${id}-from`}
                type="text"
                required
                value={from}
                onChange={(event) => editWindow(event.target.value, 'from')}
                className="w-full rounded border bg-background p-2"
              />
              <label htmlFor={`${id}-to`} className="block">
                To (UTC, exclusive)
              </label>
              <input
                id={`${id}-to`}
                type="text"
                required
                value={to}
                onChange={(event) => editWindow(event.target.value, 'to')}
                className="w-full rounded border bg-background p-2"
              />
              <div className="flex flex-wrap gap-2">
                <Button type="submit" variant="outline">
                  Save monitoring history
                </Button>
                {continuation && (
                  <Button type="button" variant="outline" onClick={() => void saveHistory(true)}>
                    Save next history page
                  </Button>
                )}
              </div>
              {continuation && (
                <p>
                  More recorded data remains. Save the next page to continue the same snapshots.
                </p>
              )}
            </fieldset>
          </form>
        </>
      )}
      <output className="block text-sm" aria-live="polite">
        {message}
      </output>
    </section>
  );
}
