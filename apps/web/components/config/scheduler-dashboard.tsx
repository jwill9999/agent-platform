'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  ScheduledJobCreateBody,
  ScheduledJobRecord,
  ScheduledJobRunLogRecord,
  ScheduledJobRunRecord,
  ScheduledJobUpdateBody,
} from '@agent-platform/contracts';
import {
  Ban,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Trash2,
  Loader2,
  Pause,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  RotateCw,
  Save,
  X,
} from 'lucide-react';

import { apiDelete, apiGet, apiPath, apiPost, apiPut, ApiRequestError } from '@/lib/apiClient';
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

type JobFormErrors = Partial<Record<keyof JobFormState | 'general', string>>;
type SidePanelView = 'details' | 'runs' | 'logs';

const defaultForm: JobFormState = {
  name: '',
  instructions: 'Run scheduled background work.',
  scheduleType: 'one_off',
  runAtLocal: '',
  intervalMinutes: '1440',
  status: 'paused',
};

function userTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

function msToLocalDateTime(ms: number | undefined): string {
  if (ms === undefined) return '';
  const date = new Date(ms);
  if (!Number.isFinite(date.getTime())) return '';
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function localDateTimeToMs(value: string): number | undefined {
  if (!value) return undefined;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : undefined;
}

function validateForm(form: JobFormState): JobFormErrors {
  const errors: JobFormErrors = {};
  if (!form.name.trim()) {
    errors.name = 'Add a clear job name.';
  }
  if (!form.instructions.trim()) {
    errors.instructions = 'Add the instructions this job should run.';
  }
  if (form.scheduleType === 'recurring') {
    const interval = Number(form.intervalMinutes);
    if (!Number.isFinite(interval) || interval < 1) {
      errors.intervalMinutes = 'Use an interval of at least 1 minute.';
    }
  } else if (!localDateTimeToMs(form.runAtLocal)) {
    errors.runAtLocal = 'Choose the local date and time for this job.';
  }
  return errors;
}

function hasFormErrors(errors: JobFormErrors): boolean {
  return Object.values(errors).some(Boolean);
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
    timezone: userTimeZone(),
    metadata: {},
  };
}

function buildUpdateBody(form: JobFormState): ScheduledJobUpdateBody {
  const runAtMs = localDateTimeToMs(form.runAtLocal);
  const intervalMs = Math.max(1, Number(form.intervalMinutes || '1440')) * 60_000;
  return {
    name: form.name.trim(),
    instructions: form.instructions.trim(),
    targetKind: 'built_in_task',
    targetPayload: { task: 'scheduler.noop' },
    scheduleType: form.scheduleType,
    ...(form.scheduleType === 'recurring'
      ? { intervalMs, runAtMs: null, nextRunAtMs: Date.now() + intervalMs }
      : {
          runAtMs: runAtMs ?? Date.now() + 60_000,
          intervalMs: null,
          nextRunAtMs: runAtMs ?? Date.now() + 60_000,
        }),
    timezone: userTimeZone(),
    retryPolicy: { maxAttempts: 1, backoffMs: 0 },
    timeoutMs: 300_000,
    metadata: {},
  };
}

function formFromJob(job: ScheduledJobRecord): JobFormState {
  return {
    name: job.name,
    instructions: job.instructions,
    scheduleType: job.scheduleType,
    runAtLocal: msToLocalDateTime(job.runAtMs ?? job.nextRunAtMs),
    intervalMinutes: String(Math.max(1, Math.round((job.intervalMs ?? 86_400_000) / 60_000))),
    status: job.status === 'enabled' ? 'enabled' : 'paused',
  };
}

export function SchedulerDashboard() {
  const [jobs, setJobs] = useState<ScheduledJobRecord[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [selectedJobIds, setSelectedJobIds] = useState<Set<string>>(() => new Set());
  const [runs, setRuns] = useState<ScheduledJobRunRecord[]>([]);
  const [logs, setLogs] = useState<ScheduledJobRunLogRecord[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [form, setForm] = useState<JobFormState>(defaultForm);
  const [formErrors, setFormErrors] = useState<JobFormErrors>({});
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [sidePanelView, setSidePanelView] = useState<SidePanelView>('details');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const currentTimeZone = useMemo(() => userTimeZone(), []);

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
      setSelectedJobId((current) =>
        current && items.some((item) => item.id === current) ? current : (items[0]?.id ?? null),
      );
      setSelectedJobIds((current) => {
        const availableIds = new Set(items.map((item) => item.id));
        return new Set([...current].filter((id) => availableIds.has(id)));
      });
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
    setFormErrors((current) => ({ ...current, [key]: undefined, general: undefined }));
  }, []);

  const toggleJobSelection = useCallback((jobId: string, checked: boolean) => {
    setSelectedJobIds((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(jobId);
      } else {
        next.delete(jobId);
      }
      return next;
    });
  }, []);

  const createJob = useCallback(async () => {
    const errors = validateForm(form);
    if (hasFormErrors(errors)) {
      setFormErrors(errors);
      return;
    }
    setCreating(true);
    setError(null);
    setFormErrors({});
    try {
      const created = await apiPost<ScheduledJobRecord>(
        apiPath('scheduler'),
        buildCreateBody(form),
      );
      setForm(defaultForm);
      await loadJobs();
      setSelectedJobId(created?.id ?? null);
    } catch (e) {
      setFormErrors({
        general: e instanceof ApiRequestError ? e.message : String(e),
      });
    } finally {
      setCreating(false);
    }
  }, [form, loadJobs]);

  const startCreate = useCallback(() => {
    setForm(defaultForm);
    setFormErrors({});
    setFormMode('create');
  }, []);

  const startEdit = useCallback((job: ScheduledJobRecord) => {
    setForm(formFromJob(job));
    setFormErrors({});
    setFormMode('edit');
  }, []);

  const saveJob = useCallback(async () => {
    if (!selectedJob) return;
    const errors = validateForm(form);
    if (hasFormErrors(errors)) {
      setFormErrors(errors);
      return;
    }
    setSaving(true);
    setError(null);
    setFormErrors({});
    try {
      await apiPut<ScheduledJobRecord>(apiPath('scheduler', selectedJob.id), buildUpdateBody(form));
      await loadJobs();
      setSelectedJobId(selectedJob.id);
    } catch (e) {
      setFormErrors({
        general: e instanceof ApiRequestError ? e.message : String(e),
      });
    } finally {
      setSaving(false);
    }
  }, [form, loadJobs, selectedJob]);

  const deleteJobs = useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) return;
      const label = ids.length === 1 ? 'this scheduled job' : `${ids.length} scheduled jobs`;
      if (!confirm(`Delete ${label}? This also removes their run history and logs.`)) return;
      setDeleting(true);
      setError(null);
      try {
        for (const id of ids) {
          await apiDelete(apiPath('scheduler', id));
        }
        setSelectedJobIds(new Set());
        setSelectedRunId(null);
        await loadJobs();
      } catch (e) {
        setError(e instanceof ApiRequestError ? e.message : String(e));
      } finally {
        setDeleting(false);
      }
    },
    [loadJobs],
  );

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
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Scheduler</h2>
          <p className="text-sm text-muted-foreground">
            Create, run, pause, and inspect scheduled background work.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground sm:block">
            <span className="font-medium text-foreground">{jobs.length}</span> jobs
          </div>
          <Button variant="outline" onClick={refresh} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </header>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_430px] xl:items-start">
        <aside className="order-2 rounded-md border border-border bg-card xl:col-start-1 xl:row-start-2 xl:order-2">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Scheduled jobs
            </h3>
            <div className="flex items-center gap-2">
              {selectedJobIds.size > 0 && (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => deleteJobs([...selectedJobIds])}
                  disabled={deleting}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete {selectedJobIds.size}
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={startCreate}>
                <Plus className="mr-2 h-4 w-4" />
                New
              </Button>
            </div>
          </div>
          <div className="grid gap-3 p-3 md:grid-cols-2 2xl:grid-cols-3">
            {loading && jobs.length === 0 && (
              <div className="flex items-center gap-2 px-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading jobs...
              </div>
            )}

            {!loading && jobs.length === 0 && (
              <div className="rounded-md border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                No scheduled jobs yet.
              </div>
            )}

            {jobs.map((job) => {
              const selected = selectedJob?.id === job.id;
              return (
                <div
                  key={job.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setSelectedJobId(job.id);
                    setSelectedRunId(null);
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter' && event.key !== ' ') return;
                    event.preventDefault();
                    setSelectedJobId(job.id);
                    setSelectedRunId(null);
                  }}
                  className={cn(
                    'w-full cursor-pointer rounded-md border px-3 py-3 text-left transition',
                    selected
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-transparent bg-background hover:border-border hover:bg-muted/40',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 gap-3">
                      <input
                        type="checkbox"
                        aria-label={`Select ${job.name}`}
                        checked={selectedJobIds.has(job.id)}
                        onChange={(event) =>
                          toggleJobSelection(job.id, event.currentTarget.checked)
                        }
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => event.stopPropagation()}
                        className="mt-0.5 h-4 w-4 rounded border-border"
                      />
                      <div className="min-w-0">
                        <h4 className="truncate text-sm font-semibold text-foreground">
                          {job.name}
                        </h4>
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          {formatSchedule(job)}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className={schedulerStatusTone(job.status)}>
                      {titleCaseScheduler(job.status)}
                    </Badge>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <span>Next: {formatSchedulerTime(job.nextRunAtMs)}</span>
                    <span>Last: {formatSchedulerTime(job.lastRunAtMs)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        <main className="order-3 space-y-4 xl:sticky xl:top-6 xl:col-start-2 xl:row-span-2 xl:row-start-1 xl:order-3">
          <section className="rounded-md border border-border bg-card p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Side panel</h3>
                <p className="text-xs text-muted-foreground">Selected job context</p>
              </div>
              <div className="grid grid-cols-3 rounded-md border border-border bg-muted/30 p-1 text-xs">
                {(['details', 'runs', 'logs'] as const).map((view) => (
                  <button
                    key={view}
                    type="button"
                    onClick={() => setSidePanelView(view)}
                    className={cn(
                      'rounded px-3 py-1.5 font-medium transition',
                      sidePanelView === view
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {titleCaseScheduler(view)}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {sidePanelView === 'details' && selectedJob ? (
            <section className="rounded-md border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-lg font-semibold text-foreground">
                      {selectedJob.name}
                    </h3>
                    <Badge variant="outline" className={schedulerStatusTone(selectedJob.status)}>
                      {titleCaseScheduler(selectedJob.status)}
                    </Badge>
                  </div>
                  <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                    {selectedJob.instructions}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => startEdit(selectedJob)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => deleteJobs([selectedJob.id])}
                    disabled={deleting}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => jobAction(selectedJob, 'run')}
                    disabled={busyId === `${selectedJob.id}:run`}
                  >
                    <RotateCw className="mr-2 h-4 w-4" />
                    Run now
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
              </div>

              <dl className="mt-5 grid gap-3 text-sm md:grid-cols-4">
                <div className="rounded-md bg-muted/35 px-3 py-2">
                  <dt className="text-xs font-medium text-muted-foreground">Schedule</dt>
                  <dd className="mt-1 font-medium text-foreground">
                    {formatSchedule(selectedJob)}
                  </dd>
                </div>
                <div className="rounded-md bg-muted/35 px-3 py-2">
                  <dt className="text-xs font-medium text-muted-foreground">Next run</dt>
                  <dd className="mt-1 font-medium text-foreground">
                    {formatSchedulerTime(selectedJob.nextRunAtMs)}
                  </dd>
                </div>
                <div className="rounded-md bg-muted/35 px-3 py-2">
                  <dt className="text-xs font-medium text-muted-foreground">Retry</dt>
                  <dd className="mt-1 font-medium text-foreground">
                    {selectedJob.retryPolicy.maxAttempts} attempts
                  </dd>
                </div>
                <div className="rounded-md bg-muted/35 px-3 py-2">
                  <dt className="text-xs font-medium text-muted-foreground">Target</dt>
                  <dd className="mt-1 font-medium text-foreground">
                    {titleCaseScheduler(selectedJob.targetKind)}
                  </dd>
                </div>
              </dl>
            </section>
          ) : sidePanelView === 'details' ? (
            <section className="rounded-md border border-dashed border-border bg-card px-4 py-12 text-center text-sm text-muted-foreground">
              Select or create a scheduled job.
            </section>
          ) : null}

          {sidePanelView !== 'details' && (
            <section className="rounded-md border border-border bg-card p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <CalendarClock className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">
                    {sidePanelView === 'runs' ? 'Runs' : 'Logs'}
                  </h3>
                </div>
                <span className="text-xs text-muted-foreground">
                  {sidePanelView === 'runs' ? `${runs.length} runs` : `${logs.length} entries`}
                </span>
              </div>
              {sidePanelView === 'runs' ? (
                <div className="max-h-[430px] space-y-2 overflow-y-auto">
                  {runs.length === 0 && (
                    <p className="text-sm text-muted-foreground">No runs yet.</p>
                  )}
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
              ) : (
                <div className="max-h-[360px] overflow-y-auto rounded-md border border-border bg-background p-3">
                  {logs.length === 0 && (
                    <p className="text-sm text-muted-foreground">No logs captured.</p>
                  )}
                  <div className="space-y-2">
                    {logs.map((log) => (
                      <div
                        key={log.id}
                        className="rounded-md border border-border px-3 py-2 text-xs"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="flex items-center gap-2 font-medium text-foreground">
                            {log.level === 'error' ? (
                              <X className="h-3.5 w-3.5 text-destructive" />
                            ) : log.message.startsWith('Notification:') ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                            ) : (
                              <Clock3 className="h-3.5 w-3.5 text-primary" />
                            )}
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
              )}
            </section>
          )}
        </main>

        <aside className="order-1 rounded-md border border-border bg-card p-4 xl:col-start-1 xl:row-start-1 xl:order-1">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {formMode === 'edit' ? (
                <Pencil className="h-4 w-4 text-primary" />
              ) : (
                <Plus className="h-4 w-4 text-primary" />
              )}
              <h3 className="text-sm font-semibold text-foreground">
                {formMode === 'edit' ? 'Edit job' : 'Create job'}
              </h3>
            </div>
            {formMode === 'edit' && (
              <Button size="sm" variant="ghost" onClick={startCreate}>
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Button>
            )}
          </div>
          <div className="space-y-3">
            {formErrors.general && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {formErrors.general}
              </div>
            )}
            <div className="space-y-1">
              <Label htmlFor="scheduler-name">Name</Label>
              <Input
                id="scheduler-name"
                value={form.name}
                onChange={(e) => updateForm('name', e.target.value)}
                placeholder="Nightly quality check"
                aria-invalid={Boolean(formErrors.name)}
              />
              {formErrors.name && (
                <p className="text-xs font-medium text-destructive">{formErrors.name}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="scheduler-instructions">Instructions</Label>
              <Textarea
                id="scheduler-instructions"
                value={form.instructions}
                onChange={(e) => updateForm('instructions', e.target.value)}
                rows={3}
                aria-invalid={Boolean(formErrors.instructions)}
              />
              {formErrors.instructions && (
                <p className="text-xs font-medium text-destructive">{formErrors.instructions}</p>
              )}
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
              {formMode === 'create' ? (
                <label className="space-y-1">
                  <span className="text-xs font-medium text-muted-foreground">Start job</span>
                  <select
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={form.status}
                    onChange={(e) => updateForm('status', e.target.value)}
                  >
                    <option value="paused">Paused - review first</option>
                    <option value="enabled">Enabled - run automatically</option>
                  </select>
                </label>
              ) : (
                <div className="space-y-1">
                  <span className="text-xs font-medium text-muted-foreground">Current status</span>
                  <div className="flex h-10 items-center rounded-md border border-border bg-muted/30 px-3">
                    <Badge
                      variant="outline"
                      className={schedulerStatusTone(selectedJob?.status ?? 'paused')}
                    >
                      {titleCaseScheduler(selectedJob?.status ?? 'paused')}
                    </Badge>
                  </div>
                </div>
              )}
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
                  aria-invalid={Boolean(formErrors.intervalMinutes)}
                />
                {formErrors.intervalMinutes && (
                  <p className="text-xs font-medium text-destructive">
                    {formErrors.intervalMinutes}
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-1">
                <Label htmlFor="scheduler-run-at">Run at ({currentTimeZone})</Label>
                <Input
                  id="scheduler-run-at"
                  type="datetime-local"
                  value={form.runAtLocal}
                  onChange={(e) => updateForm('runAtLocal', e.target.value)}
                  aria-invalid={Boolean(formErrors.runAtLocal)}
                />
                {formErrors.runAtLocal && (
                  <p className="text-xs font-medium text-destructive">{formErrors.runAtLocal}</p>
                )}
              </div>
            )}
            {formMode === 'create' ? (
              <Button onClick={createJob} disabled={creating} className="w-full">
                {creating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-2 h-4 w-4" />
                )}
                Create
              </Button>
            ) : (
              <Button onClick={saveJob} disabled={saving} className="w-full">
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save changes
              </Button>
            )}
          </div>
        </aside>
      </section>
    </div>
  );
}
