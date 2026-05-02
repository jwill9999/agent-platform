'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  ScheduledJobCreateBody,
  ScheduledJobRecord,
  ScheduledJobRunLogRecord,
  ScheduledJobRunRecord,
} from '@agent-platform/contracts';
import { Ban, CalendarClock, Loader2, Pause, Play, Plus, RefreshCw, RotateCw } from 'lucide-react';

import { apiGet, apiPath, apiPost, ApiRequestError } from '@/lib/apiClient';
import { cn } from '@/lib/cn';
import {
  formatSchedule,
  formatSchedulerTime,
  schedulerRunTone,
  schedulerStatusTone,
  titleCaseScheduler,
} from '@/lib/scheduler-format';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

type JobListResponse = {
  items: ScheduledJobRecord[];
  total: number;
};

type RunListResponse = {
  items: ScheduledJobRunRecord[];
  total: number;
};

type LogListResponse = {
  items: ScheduledJobRunLogRecord[];
  total: number;
};

type JobFormState = {
  name: string;
  instructions: string;
  scheduleType: ScheduledJobCreateBody['scheduleType'];
  runAtLocal: string;
  intervalMinutes: string;
  status: ScheduledJobCreateBody['status'];
};

const defaultForm: JobFormState = {
  name: '',
  instructions: 'Run scheduled background work.',
  scheduleType: 'one_off',
  runAtLocal: '',
  intervalMinutes: '1440',
  status: 'paused',
};

function localDateTimeToMs(value: string): number | undefined {
  if (!value) return undefined;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : undefined;
}

function buildCreateBody(form: JobFormState): ScheduledJobCreateBody {
  const runAtMs = localDateTimeToMs(form.runAtLocal) ?? Date.now() + 60_000;
  const intervalMs = Math.max(1, Number(form.intervalMinutes || '1440')) * 60_000;
  return {
    scope: 'global',
    name: form.name.trim(),
    instructions: form.instructions.trim(),
    targetKind: 'built_in_task',
    targetPayload: { task: 'scheduler.noop' },
    scheduleType: form.scheduleType,
    ...(form.scheduleType === 'recurring' ? { intervalMs } : { runAtMs }),
    nextRunAtMs: form.scheduleType === 'recurring' ? Date.now() + intervalMs : runAtMs,
    status: form.status,
    retryPolicy: { maxAttempts: 1, backoffMs: 0 },
    timeoutMs: 300_000,
    timezone: 'UTC',
    metadata: {},
  };
}

export function SchedulerDashboard() {
  const [jobs, setJobs] = useState<ScheduledJobRecord[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [runs, setRuns] = useState<ScheduledJobRunRecord[]>([]);
  const [logs, setLogs] = useState<ScheduledJobRunLogRecord[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [form, setForm] = useState<JobFormState>(defaultForm);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedJob = useMemo(
    () => jobs.find((job) => job.id === selectedJobId) ?? jobs[0],
    [jobs, selectedJobId],
  );

  const selectedRun = useMemo(
    () => runs.find((run) => run.id === selectedRunId) ?? runs[0],
    [runs, selectedRunId],
  );

  const loadJobs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<JobListResponse>(`${apiPath('scheduler')}?limit=100`);
      const items = data?.items ?? [];
      setJobs(items);
      setSelectedJobId((current) => current ?? items[0]?.id ?? null);
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRuns = useCallback(async (jobId: string | undefined) => {
    if (!jobId) {
      setRuns([]);
      setLogs([]);
      return;
    }
    try {
      const data = await apiGet<RunListResponse>(`${apiPath('scheduler', jobId, 'runs')}?limit=25`);
      const items = data?.items ?? [];
      setRuns(items);
      setSelectedRunId((current) => current ?? items[0]?.id ?? null);
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : String(e));
    }
  }, []);

  const loadLogs = useCallback(async (runId: string | undefined) => {
    if (!runId) {
      setLogs([]);
      return;
    }
    try {
      const data = await apiGet<LogListResponse>(
        `${apiPath('scheduler', 'runs', runId, 'logs')}?limit=100`,
      );
      setLogs(data?.items ?? []);
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    loadJobs().catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, [loadJobs]);

  useEffect(() => {
    loadRuns(selectedJob?.id).catch((e: unknown) =>
      setError(e instanceof Error ? e.message : String(e)),
    );
  }, [loadRuns, selectedJob?.id]);

  useEffect(() => {
    loadLogs(selectedRun?.id).catch((e: unknown) =>
      setError(e instanceof Error ? e.message : String(e)),
    );
  }, [loadLogs, selectedRun?.id]);

  const refresh = useCallback(async () => {
    await loadJobs();
    await loadRuns(selectedJob?.id);
    await loadLogs(selectedRun?.id);
  }, [loadJobs, loadLogs, loadRuns, selectedJob?.id, selectedRun?.id]);

  const updateForm = useCallback((key: keyof JobFormState, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  }, []);

  const createJob = useCallback(async () => {
    setCreating(true);
    setError(null);
    try {
      const created = await apiPost<ScheduledJobRecord>(
        apiPath('scheduler'),
        buildCreateBody(form),
      );
      setForm(defaultForm);
      await loadJobs();
      setSelectedJobId(created?.id ?? null);
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : String(e));
    } finally {
      setCreating(false);
    }
  }, [form, loadJobs]);

  const jobAction = useCallback(
    async (job: ScheduledJobRecord, action: 'pause' | 'resume' | 'run') => {
      setBusyId(`${job.id}:${action}`);
      try {
        await apiPost(apiPath('scheduler', job.id, action), {});
        await refresh();
      } catch (e) {
        setError(e instanceof ApiRequestError ? e.message : String(e));
      } finally {
        setBusyId(null);
      }
    },
    [refresh],
  );

  const cancelRun = useCallback(
    async (run: ScheduledJobRunRecord) => {
      if (!confirm(`Cancel run ${run.id}?`)) return;
      setBusyId(`run:${run.id}`);
      try {
        await apiPost(apiPath('scheduler', 'runs', run.id, 'cancel'), {});
        await refresh();
      } catch (e) {
        setError(e instanceof ApiRequestError ? e.message : String(e));
      } finally {
        setBusyId(null);
      }
    },
    [refresh],
  );

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Scheduler</h2>
          <p className="text-sm text-muted-foreground">
            Manage scheduled jobs, background runs, cancellation, and captured logs.
          </p>
        </div>
        <Button variant="outline" onClick={refresh} disabled={loading}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </header>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Jobs
            </h3>
            <span className="text-xs text-muted-foreground">{jobs.length} total</span>
          </div>

          {loading && jobs.length === 0 && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading jobs...
            </div>
          )}

          {!loading && jobs.length === 0 && (
            <div className="rounded-md border border-border px-4 py-8 text-center text-sm text-muted-foreground">
              No scheduled jobs yet.
            </div>
          )}

          {jobs.map((job) => {
            const selected = selectedJob?.id === job.id;
            return (
              <button
                key={job.id}
                type="button"
                onClick={() => {
                  setSelectedJobId(job.id);
                  setSelectedRunId(null);
                }}
                className={cn(
                  'w-full rounded-md border p-4 text-left transition',
                  selected
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-border bg-card hover:border-primary/40 hover:bg-muted/40',
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h4 className="truncate text-sm font-semibold text-foreground">{job.name}</h4>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {job.instructions}
                    </p>
                  </div>
                  <Badge variant="outline" className={schedulerStatusTone(job.status)}>
                    {titleCaseScheduler(job.status)}
                  </Badge>
                </div>
                <dl className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
                  <div>
                    <dt className="font-medium text-foreground">Schedule</dt>
                    <dd>{formatSchedule(job)}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-foreground">Next run</dt>
                    <dd>{formatSchedulerTime(job.nextRunAtMs)}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-foreground">Last run</dt>
                    <dd>{formatSchedulerTime(job.lastRunAtMs)}</dd>
                  </div>
                </dl>
              </button>
            );
          })}
        </div>

        <div className="rounded-md border border-border bg-card p-4">
          <div className="mb-3 flex items-center gap-2">
            <Plus className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Create job</h3>
          </div>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="scheduler-name">Name</Label>
              <Input
                id="scheduler-name"
                value={form.name}
                onChange={(e) => updateForm('name', e.target.value)}
                placeholder="Nightly quality check"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="scheduler-instructions">Instructions</Label>
              <Textarea
                id="scheduler-instructions"
                value={form.instructions}
                onChange={(e) => updateForm('instructions', e.target.value)}
                rows={3}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Schedule type</span>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={form.scheduleType}
                  onChange={(e) => updateForm('scheduleType', e.target.value)}
                >
                  <option value="one_off">One off</option>
                  <option value="delayed">Delayed</option>
                  <option value="recurring">Recurring</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Initial status</span>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={form.status}
                  onChange={(e) => updateForm('status', e.target.value)}
                >
                  <option value="paused">Paused</option>
                  <option value="enabled">Enabled</option>
                </select>
              </label>
            </div>
            {form.scheduleType === 'recurring' ? (
              <div className="space-y-1">
                <Label htmlFor="scheduler-interval">Interval minutes</Label>
                <Input
                  id="scheduler-interval"
                  type="number"
                  min="1"
                  value={form.intervalMinutes}
                  onChange={(e) => updateForm('intervalMinutes', e.target.value)}
                />
              </div>
            ) : (
              <div className="space-y-1">
                <Label htmlFor="scheduler-run-at">Run at</Label>
                <Input
                  id="scheduler-run-at"
                  type="datetime-local"
                  value={form.runAtLocal}
                  onChange={(e) => updateForm('runAtLocal', e.target.value)}
                />
              </div>
            )}
            <Button onClick={createJob} disabled={creating || !form.name.trim()} className="w-full">
              {creating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              Create
            </Button>
          </div>
        </div>
      </section>

      {selectedJob && (
        <section className="grid gap-4 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
          <div className="rounded-md border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">{selectedJob.name}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{selectedJob.id}</p>
              </div>
              <Badge variant="outline" className={schedulerStatusTone(selectedJob.status)}>
                {titleCaseScheduler(selectedJob.status)}
              </Badge>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                onClick={() => jobAction(selectedJob, 'run')}
                disabled={busyId === `${selectedJob.id}:run`}
              >
                <RotateCw className="mr-2 h-4 w-4" />
                Run Now
              </Button>
              {selectedJob.status === 'enabled' ? (
                <Button
                  variant="outline"
                  onClick={() => jobAction(selectedJob, 'pause')}
                  disabled={busyId === `${selectedJob.id}:pause`}
                >
                  <Pause className="mr-2 h-4 w-4" />
                  Pause
                </Button>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => jobAction(selectedJob, 'resume')}
                  disabled={busyId === `${selectedJob.id}:resume`}
                >
                  <Play className="mr-2 h-4 w-4" />
                  Resume
                </Button>
              )}
            </div>
            <dl className="mt-4 space-y-3 text-xs">
              <div>
                <dt className="font-medium text-muted-foreground">Target</dt>
                <dd className="mt-1 text-foreground">
                  {titleCaseScheduler(selectedJob.targetKind)}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-muted-foreground">Retry policy</dt>
                <dd className="mt-1 text-foreground">
                  {selectedJob.retryPolicy.maxAttempts} attempts,{' '}
                  {selectedJob.retryPolicy.backoffMs}ms backoff
                </dd>
              </div>
              <div>
                <dt className="font-medium text-muted-foreground">Timeout</dt>
                <dd className="mt-1 text-foreground">{selectedJob.timeoutMs}ms</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-md border border-border bg-card p-4">
            <div className="mb-3 flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Runs</h3>
            </div>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
              <div className="space-y-2">
                {runs.length === 0 && <p className="text-sm text-muted-foreground">No runs yet.</p>}
                {runs.map((run) => (
                  <button
                    key={run.id}
                    type="button"
                    onClick={() => setSelectedRunId(run.id)}
                    className={cn(
                      'w-full rounded-md border p-3 text-left transition',
                      selectedRun?.id === run.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/40 hover:bg-muted/40',
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="outline" className={schedulerRunTone(run.status)}>
                        {titleCaseScheduler(run.status)}
                      </Badge>
                      <span className="text-xs text-muted-foreground">Attempt {run.attempt}</span>
                    </div>
                    <p className="mt-2 truncate text-xs text-muted-foreground">{run.id}</p>
                    {run.status === 'running' && (
                      <Button
                        className="mt-3 w-full"
                        variant="destructive"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          cancelRun(run).catch((error: unknown) =>
                            setError(error instanceof Error ? error.message : String(error)),
                          );
                        }}
                        disabled={busyId === `run:${run.id}`}
                      >
                        <Ban className="mr-2 h-4 w-4" />
                        Cancel Run
                      </Button>
                    )}
                  </button>
                ))}
              </div>
              <div className="min-h-48 rounded-md border border-border bg-background p-3">
                <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Logs
                </h4>
                {logs.length === 0 && (
                  <p className="text-sm text-muted-foreground">No logs captured.</p>
                )}
                <div className="space-y-2">
                  {logs.map((log) => (
                    <div key={log.id} className="rounded-md border border-border px-3 py-2 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium text-foreground">
                          {log.sequence}. {titleCaseScheduler(log.level)}
                        </span>
                        <span className="text-muted-foreground">
                          {new Date(log.createdAtMs).toLocaleString()}
                        </span>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-foreground">{log.message}</p>
                      {log.truncated && (
                        <Badge
                          variant="outline"
                          className="mt-2 border-amber-500/40 bg-amber-500/10"
                        >
                          Truncated
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
