import { randomUUID } from 'node:crypto';
import { statfs } from 'node:fs/promises';
import { monitorEventLoopDelay, performance } from 'node:perf_hooks';
import type {
  MonitoringPreference,
  MonitoringSample,
  MonitoringStore,
} from '@agent-platform/contracts';

export type OwnedMonitoringMetrics = {
  activeRuns: number | null;
  admittedUnresolvedAttempts: number | null;
  sessionLockKeys: number | null;
  sessionLockWaiters: number | null;
};
type LoopHistogram = Pick<
  ReturnType<typeof monitorEventLoopDelay>,
  'enable' | 'disable' | 'reset' | 'percentile' | 'max' | 'count'
>;
type RuntimeSources = {
  now: () => number;
  monotonicNow: () => number;
  cpu: () => NodeJS.CpuUsage;
  rss: () => number;
  disk: (path: string) => Promise<number>;
  histogram: () => LoopHistogram;
};
const sources: RuntimeSources = {
  now: Date.now,
  monotonicNow: () => performance.now(),
  cpu: () => process.cpuUsage(),
  rss: () => process.memoryUsage.rss(),
  disk: async (path) => {
    const fs = await statfs(path, { bigint: true });
    const bytes = fs.bavail * fs.bsize;
    return bytes <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(bytes) : Number.NaN;
  },
  histogram: () => monitorEventLoopDelay({ resolution: 20 }),
};

function finite(value: number): number | null {
  return Number.isFinite(value) && value >= 0 ? value : null;
}
function readNumber(read: () => number): number | null {
  try {
    return finite(read());
  } catch {
    return null;
  }
}
function readCpu(read: RuntimeSources['cpu']): NodeJS.CpuUsage | undefined {
  try {
    return read();
  } catch {
    return undefined;
  }
}

/** Optional resource observations. It never participates in admission, permissions or V1 capture. */
export function createMonitoringRuntime(options: {
  store: MonitoringStore;
  appDataPath: string;
  appVersion?: string;
  metrics?: () => OwnedMonitoringMetrics;
  /** Deterministic clocks/probes for focused tests; production uses only fixed local process probes. */
  sources?: Partial<RuntimeSources>;
}) {
  const probe = { ...sources, ...options.sources };
  const loop = probe.histogram();
  let timer: ReturnType<typeof setInterval> | undefined;
  let generation = 0;
  let stopped = false;
  let sampling = false;
  let cpuBaseline: NodeJS.CpuUsage | undefined;
  let monotonicBaseline: number | undefined;
  let diskPending: Promise<number | null> | undefined;
  let metrics = options.metrics;
  let ready: Promise<void> | undefined;
  let configuredVersion = -1;

  async function diskBytes(): Promise<number | null> {
    // A timed-out statfs is still owned until it actually settles: never overlap or queue calls.
    if (diskPending) return null;
    const pending = Promise.resolve()
      .then(() => probe.disk(options.appDataPath))
      .then(finite, () => null);
    diskPending = pending;
    void pending.finally(() => {
      if (diskPending === pending) diskPending = undefined;
    });
    let deadline: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        pending,
        new Promise<null>((resolve) => {
          deadline = setTimeout(() => resolve(null), 1000);
          deadline.unref();
        }),
      ]);
    } finally {
      if (deadline) clearTimeout(deadline);
    }
  }

  function ownedMetrics(): OwnedMonitoringMetrics {
    try {
      const result = metrics?.();
      if (result) return result;
    } catch {
      /* Observation failure cannot affect execution. */
    }
    return {
      activeRuns: null,
      admittedUnresolvedAttempts: null,
      sessionLockKeys: null,
      sessionLockWaiters: null,
    };
  }

  async function sample(epoch: number): Promise<void> {
    if (sampling || stopped || epoch !== generation) return;
    sampling = true;
    try {
      const observedAtMs = probe.now();
      const now = probe.monotonicNow();
      const cpu = readCpu(probe.cpu);
      const intervalMs =
        monotonicBaseline === undefined ? 0 : (finite(now - monotonicBaseline) ?? 0);
      const cpuUserMicros =
        cpu && cpuBaseline && intervalMs > 0 ? finite(cpu.user - cpuBaseline.user) : null;
      const cpuSystemMicros =
        cpu && cpuBaseline && intervalMs > 0 ? finite(cpu.system - cpuBaseline.system) : null;
      cpuBaseline = cpu;
      monotonicBaseline = now;
      const eventLoopP95Ms = loop.count ? readNumber(() => loop.percentile(95) / 1e6) : null;
      const eventLoopMaxMs = loop.count ? readNumber(() => loop.max / 1e6) : null;
      loop.reset();
      const owned = ownedMetrics();
      const values = {
        cpuUserMicros,
        cpuSystemMicros,
        rssBytes: readNumber(probe.rss),
        eventLoopP95Ms,
        eventLoopMaxMs,
        activeRuns: owned.activeRuns === null ? null : finite(owned.activeRuns),
        admittedUnresolvedAttempts:
          owned.admittedUnresolvedAttempts === null
            ? null
            : finite(owned.admittedUnresolvedAttempts),
        sessionLockKeys: owned.sessionLockKeys === null ? null : finite(owned.sessionLockKeys),
        sessionLockWaiters:
          owned.sessionLockWaiters === null ? null : finite(owned.sessionLockWaiters),
        appVolumeFreeBytes: await diskBytes(),
      };
      // Disable/close invalidates the complete async sample, including callbacks already in flight.
      if (stopped || epoch !== generation) return;
      const sample: MonitoringSample = {
        schemaVersion: 1,
        sampleId: randomUUID(),
        processInstanceId: options.store.health().processInstanceId,
        observedAtMs,
        intervalMs,
        source: 'api_process_app_volume',
        ...(options.appVersion &&
        /^\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/.test(options.appVersion) &&
        options.appVersion.length <= 64
          ? { appVersion: options.appVersion }
          : {}),
        ...values,
        unavailableMetrics: unavailableMetrics(values, intervalMs),
      };
      options.store.record(sample);
    } finally {
      sampling = false;
    }
  }

  function configure(preference: MonitoringPreference): void {
    if (preference.version < configuredVersion) return;
    configuredVersion = preference.version;
    generation++;
    if (timer) clearInterval(timer);
    timer = undefined;
    loop.disable();
    cpuBaseline = undefined;
    monotonicBaseline = undefined;
    if (!preference.samplingEnabled || stopped) return;
    loop.reset();
    loop.enable();
    const epoch = generation;
    void sample(epoch).catch(() => undefined);
    timer = setInterval(() => {
      void sample(epoch).catch(() => undefined);
    }, 30_000);
    timer.unref();
  }

  function start(): Promise<void> {
    ready ??= options.store.ready.then(async () => {
      const preference = await options.store.preference();
      if (!stopped) configure(preference);
    });
    return ready;
  }
  return {
    start,
    setMetrics(provider: () => OwnedMonitoringMetrics): void {
      metrics = provider;
    },
    async setPreference(
      preference: Pick<MonitoringPreference, 'samplingEnabled' | 'retentionDays'>,
    ): Promise<MonitoringPreference> {
      await start();
      const durable = await options.store.setPreference(preference);
      if (!stopped) configure(durable);
      return durable;
    },
    stop(): void {
      stopped = true;
      generation++;
      if (timer) clearInterval(timer);
      timer = undefined;
      loop.disable();
    },
  };
}
export type MonitoringRuntime = ReturnType<typeof createMonitoringRuntime>;

function unavailableMetrics(
  values: Pick<
    MonitoringSample,
    | 'cpuUserMicros'
    | 'cpuSystemMicros'
    | 'rssBytes'
    | 'eventLoopP95Ms'
    | 'eventLoopMaxMs'
    | 'activeRuns'
    | 'admittedUnresolvedAttempts'
    | 'sessionLockKeys'
    | 'sessionLockWaiters'
    | 'appVolumeFreeBytes'
  >,
  intervalMs: number,
): MonitoringSample['unavailableMetrics'] {
  const unavailable: MonitoringSample['unavailableMetrics'] = [];
  if (intervalMs === 0) unavailable.push('cpu_baseline');
  else if (values.cpuUserMicros === null || values.cpuSystemMicros === null)
    unavailable.push('cpu');
  if (values.rssBytes === null) unavailable.push('rss');
  if (values.eventLoopP95Ms === null || values.eventLoopMaxMs === null)
    unavailable.push('event_loop');
  if (values.activeRuns === null) unavailable.push('active_runs');
  if (values.admittedUnresolvedAttempts === null) unavailable.push('admitted_unresolved_attempts');
  if (values.sessionLockKeys === null) unavailable.push('session_lock_keys');
  if (values.sessionLockWaiters === null) unavailable.push('session_lock_waiters');
  if (values.appVolumeFreeBytes === null) unavailable.push('app_volume_disk');
  return unavailable;
}
