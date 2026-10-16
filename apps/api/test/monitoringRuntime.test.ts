import { randomUUID } from 'node:crypto';
import type {
  MonitoringPreference,
  MonitoringSample,
  MonitoringStore,
} from '@agent-platform/contracts';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMonitoringRuntime } from '../src/infrastructure/diagnostics/monitoringRuntime.js';

afterEach(() => {
  vi.useRealTimers();
});

function fixture(disk = vi.fn(async () => 42_000)) {
  vi.useFakeTimers();
  vi.setSystemTime(1_800_000_000_000);
  let preference: MonitoringPreference = { samplingEnabled: false, retentionDays: 7, version: 1 };
  const rows: MonitoringSample[] = [];
  const processInstanceId = randomUUID();
  const setPreference = vi.fn(
    async (next: Pick<MonitoringPreference, 'samplingEnabled' | 'retentionDays'>) => {
      preference = { ...next, version: preference.version + 1 };
      return preference;
    },
  );
  const store = {
    ready: Promise.resolve(),
    preference: async () => preference,
    setPreference,
    record: (sample: unknown) => {
      rows.push(sample as MonitoringSample);
      return true;
    },
    health: () => ({ processInstanceId }),
  } as unknown as MonitoringStore;
  let cpu = { user: 1000, system: 2000 };
  const histogram = {
    enable: vi.fn(() => true),
    disable: vi.fn(() => true),
    reset: vi.fn(),
    percentile: () => 4_000_000,
    max: 8_000_000,
    count: 2,
  };
  const runtime = createMonitoringRuntime({
    store,
    appDataPath: '/private/path-canary',
    appVersion: '1.2.3',
    metrics: () => ({
      activeRuns: 2,
      admittedUnresolvedAttempts: 3,
      sessionLockKeys: 1,
      sessionLockWaiters: 4,
    }),
    sources: {
      now: Date.now,
      monotonicNow: Date.now,
      cpu: () => cpu,
      rss: () => 1024,
      disk,
      histogram: () => histogram,
    },
  });
  return {
    runtime,
    rows,
    store,
    disk,
    histogram,
    setPreference,
    setCpu: (value: typeof cpu) => {
      cpu = value;
    },
  };
}

describe('durable resource monitoring runtime', () => {
  it('starts disabled, acknowledges preference before probing, then records actual CPU intervals and distinct counters', async () => {
    const f = fixture();
    await f.runtime.start();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(f.rows).toEqual([]);
    expect(f.disk).not.toHaveBeenCalled();
    await f.runtime.setPreference({ samplingEnabled: true, retentionDays: 7 });
    await vi.advanceTimersByTimeAsync(0);
    expect(f.rows[0]).toMatchObject({
      intervalMs: 0,
      cpuUserMicros: null,
      cpuSystemMicros: null,
      unavailableMetrics: ['cpu_baseline'],
    });
    f.setCpu({ user: 1300, system: 2600 });
    await vi.advanceTimersByTimeAsync(30_000);
    expect(f.rows[1]).toMatchObject({
      intervalMs: 30_000,
      cpuUserMicros: 300,
      cpuSystemMicros: 600,
      rssBytes: 1024,
      eventLoopP95Ms: 4,
      eventLoopMaxMs: 8,
      activeRuns: 2,
      admittedUnresolvedAttempts: 3,
      sessionLockKeys: 1,
      sessionLockWaiters: 4,
      appVolumeFreeBytes: 42_000,
      unavailableMetrics: [],
    });
    expect(f.histogram.reset).toHaveBeenCalledTimes(3);
    expect(JSON.stringify(f.rows)).not.toContain('path-canary');
    f.runtime.stop();
  });

  it('does not start sampling from an unacknowledged or failed preference write', async () => {
    const f = fixture();
    let reject!: (error: Error) => void;
    f.setPreference.mockImplementationOnce(
      () =>
        new Promise((_resolve, fail) => {
          reject = fail;
        }),
    );
    await f.runtime.start();
    const pending = f.runtime.setPreference({ samplingEnabled: true, retentionDays: 7 });
    const rejected = expect(pending).rejects.toThrow('storage-canary');
    await vi.advanceTimersByTimeAsync(0);
    expect(f.histogram.enable).not.toHaveBeenCalled();
    reject(new Error('storage-canary'));
    await rejected;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(f.disk).not.toHaveBeenCalled();
    expect(f.rows).toEqual([]);
    f.runtime.stop();
  });

  it('keeps a timed-out filesystem probe owned and never overlaps it or admits a late sample after disable', async () => {
    let release!: (value: number) => void;
    const disk = vi.fn(
      () =>
        new Promise<number>((resolve) => {
          release = resolve;
        }),
    );
    const f = fixture(disk);
    await f.runtime.setPreference({ samplingEnabled: true, retentionDays: 7 });
    await vi.advanceTimersByTimeAsync(1000);
    expect(f.rows[0]).toMatchObject({
      appVolumeFreeBytes: null,
      unavailableMetrics: expect.arrayContaining(['app_volume_disk']),
    });
    await vi.advanceTimersByTimeAsync(30_000);
    expect(disk).toHaveBeenCalledTimes(1);
    await f.runtime.setPreference({ samplingEnabled: false, retentionDays: 7 });
    const count = f.rows.length;
    release(123);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(f.rows).toHaveLength(count);
    expect(disk).toHaveBeenCalledTimes(1);
    f.runtime.stop();
  });

  it('invalidates an outstanding complete sample immediately on Stop/close', async () => {
    let release!: (value: number) => void;
    const f = fixture(
      vi.fn(
        () =>
          new Promise<number>((resolve) => {
            release = resolve;
          }),
      ),
    );
    await f.runtime.setPreference({ samplingEnabled: true, retentionDays: 7 });
    await vi.advanceTimersByTimeAsync(0);
    f.runtime.stop();
    release(123);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(f.rows).toEqual([]);
    expect(f.disk).toHaveBeenCalledTimes(1);
    expect(f.histogram.disable).toHaveBeenCalled();
  });

  it('projects unavailable/nonfinite metrics as explicit gaps rather than healthy zero', async () => {
    const f = fixture(vi.fn(async () => Number.NaN));
    f.runtime.setMetrics(() => {
      throw new Error('/private/metric-canary');
    });
    f.setCpu({ user: Number.NaN, system: Number.NaN });
    await f.runtime.setPreference({ samplingEnabled: true, retentionDays: 7 });
    await vi.advanceTimersByTimeAsync(30_000);
    expect(f.rows[1]).toMatchObject({
      cpuUserMicros: null,
      cpuSystemMicros: null,
      activeRuns: null,
      admittedUnresolvedAttempts: null,
      sessionLockKeys: null,
      sessionLockWaiters: null,
      appVolumeFreeBytes: null,
      unavailableMetrics: expect.arrayContaining(['cpu', 'active_runs', 'app_volume_disk']),
    });
    expect(JSON.stringify(f.rows)).not.toContain('canary');
    f.runtime.stop();
  });
});
