import type { ScheduledJobRecord, ScheduledJobRunRecord } from '@agent-platform/contracts';

export function formatSchedulerTime(value: number | undefined): string {
  if (value === undefined) return 'Not scheduled';
  return new Date(value).toLocaleString();
}

export function formatSchedule(job: ScheduledJobRecord): string {
  if (job.scheduleType === 'recurring') {
    if (job.intervalMs) return `Every ${formatDuration(job.intervalMs)}`;
    return job.cronExpression ? `Cron ${job.cronExpression}` : 'Recurring';
  }
  return formatSchedulerTime(job.runAtMs);
}

export function formatDuration(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'}`;
}

export function schedulerStatusTone(status: ScheduledJobRecord['status']): string {
  switch (status) {
    case 'enabled':
      return 'border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300';
    case 'paused':
      return 'border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-300';
    case 'archived':
      return 'border-slate-500/40 bg-slate-500/15 text-slate-700 dark:text-slate-300';
  }
}

export function schedulerRunTone(status: ScheduledJobRunRecord['status']): string {
  switch (status) {
    case 'succeeded':
      return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
    case 'running':
    case 'queued':
      return 'border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300';
    case 'failed':
      return 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300';
    case 'cancelled':
      return 'border-slate-500/40 bg-slate-500/10 text-slate-700 dark:text-slate-300';
  }
}

export function titleCaseScheduler(value: string): string {
  return value
    .split('_')
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(' ');
}
