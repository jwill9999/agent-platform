import process from 'node:process';
import { Buffer } from 'node:buffer';
import { createRequire, syncBuiltinESMExports } from 'node:module';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { performance, PerformanceObserver } from 'node:perf_hooks';
import { isMainThread, threadId } from 'node:worker_threads';

const require = createRequire(import.meta.url);
const MAX_EVENTS = 4096;
const MAX_BYTES = 1024 * 1024;

// Diagnostic command only. Worker threads never flush ledgers during a measured phase.
if (isMainThread && process.env.DIAGNOSTICS_OBSERVER_DIRECTORY) {
  const directory = process.env.DIAGNOSTICS_OBSERVER_DIRECTORY;
  const events = [];
  const capabilities = { worker: false, statfs: false, gc: false, rawWrite: false };
  let errors = 0;
  let truncated = false;
  let workerSerial = 0;
  let probeSerial = 0;
  const startedAtMs = performance.now();
  const safe = (operation) => {
    try {
      operation();
    } catch {
      errors++;
    }
  };
  const record = (event, fields = {}) => {
    if (events.length === MAX_EVENTS) {
      truncated = true;
      return;
    }
    events.push({ event, atMs: performance.now(), ...fields });
  };
  const ownValue = (input, field) => {
    if (typeof input !== 'object' || input === null) return undefined;
    return Object.getOwnPropertyDescriptor(input, field)?.value;
  };

  safe(() => {
    const threads = require('node:worker_threads');
    const NativeWorker = threads.Worker;
    threads.Worker = class extends NativeWorker {
      constructor(...args) {
        super(...args);
        const ordinal = ++workerSerial;
        const actualThreadId = this.threadId;
        const closeRequests = new Set();
        safe(() => record('worker-create', { ordinal, actualThreadId }));
        this.on('message', (message) => {
          safe(() => {
            const id = ownValue(message, 'id');
            if (closeRequests.delete(id))
              record('worker-close-ack', {
                ordinal,
                actualThreadId,
                success: ownValue(message, 'error') === undefined,
              });
          });
        });
        this.once('exit', (exitCode) => {
          safe(() => record('worker-exit', { ordinal, actualThreadId, exitCode }));
        });
        const post = this.postMessage;
        this.postMessage = (...values) => {
          safe(() => {
            const id = ownValue(values[0], 'id');
            if (ownValue(values[0], 'type') === 'close' && Number.isSafeInteger(id)) {
              if (closeRequests.size < 16) closeRequests.add(id);
              else truncated = true;
              record('worker-close-request', { ordinal, actualThreadId });
            }
          });
          return Reflect.apply(post, this, values);
        };
        const terminate = this.terminate;
        this.terminate = (...values) => {
          safe(() => record('worker-terminate', { ordinal, actualThreadId }));
          return Reflect.apply(terminate, this, values);
        };
      }
    };
    syncBuiltinESMExports();
    capabilities.worker = true;
  });

  safe(() => {
    const filesystem = require('node:fs/promises');
    const statfs = filesystem.statfs;
    filesystem.statfs = function (...args) {
      const ordinal = ++probeSerial;
      safe(() => record('statfs-start', { ordinal }));
      let result;
      try {
        result = Reflect.apply(statfs, this, args);
      } catch (error) {
        safe(() => record('statfs-settle', { ordinal, success: false }));
        throw error;
      }
      // Return the original Promise, not the observation's chained Promise.
      result.then(
        () => safe(() => record('statfs-settle', { ordinal, success: true })),
        () => safe(() => record('statfs-settle', { ordinal, success: false })),
      );
      return result;
    };
    syncBuiltinESMExports();
    capabilities.statfs = true;
  });

  safe(() => {
    const filesystem = require('node:fs');
    const write = filesystem.writeFileSync;
    filesystem.writeFileSync = function (...args) {
      const benchmarkOutput = process.env.DIAGNOSTICS_BENCHMARK_RESULT;
      const ownedOutput = benchmarkOutput !== undefined && args[0] === benchmarkOutput;
      try {
        const result = Reflect.apply(write, this, args);
        if (ownedOutput) safe(() => record('benchmark-raw-write', { success: true }));
        return result;
      } catch (error) {
        if (ownedOutput) safe(() => record('benchmark-raw-write', { success: false }));
        throw error;
      }
    };
    syncBuiltinESMExports();
    capabilities.rawWrite = true;
  });

  let gc;
  const observeGc = (entries) => {
    safe(() => {
      for (const entry of entries) {
        record('gc', {
          startTimeMs: entry.startTime,
          durationMs: entry.duration,
          kind: entry.detail.kind,
          flags: entry.detail.flags,
        });
      }
    });
  };
  safe(() => {
    gc = new PerformanceObserver((list) => observeGc(list.getEntries()));
    gc.observe({ entryTypes: ['gc'] });
    capabilities.gc = true;
  });

  let flushed = false;
  function flush(exitCode, flushReason) {
    if (flushed) return;
    flushed = true;
    safe(() => {
      if (gc) {
        observeGc(gc.takeRecords());
        gc.disconnect();
      }
    });
    if (events.length === 0 && errors === 0) return;
    const receipt = {
      schemaVersion: 1,
      pid: process.pid,
      threadId,
      timeOriginMs: performance.timeOrigin,
      startedAtMs,
      exitedAtMs: performance.now(),
      exitCode,
      flushReason,
      capabilities,
      errors,
      truncated,
      events,
    };
    try {
      const json = JSON.stringify(receipt);
      if (Buffer.byteLength(json) > MAX_BYTES) return;
      // The owning process is exiting; no filesystem write occurs in request windows.
      writeFileSync(join(directory, `${process.pid}.json`), json, { mode: 0o600, flag: 'wx' });
    } catch {
      // The outer wrapper reports missing/invalid observation rather than masking child failure.
    }
  }
  const signalObservers = new Map();
  const foreignListener = (signal, listener) => {
    const own = signalObservers.get(signal);
    if (!own || listener === own) return;
    // A foreign handler owns future delivery, even if it is later consumed or removed.
    signalObservers.delete(signal);
    // Keep Node's native signal watch until the foreign listener is actually installed.
    globalThis.queueMicrotask(() => process.off(signal, own));
  };
  process.on('newListener', foreignListener);
  process.once('exit', (exitCode) => {
    process.off('newListener', foreignListener);
    flush(exitCode, 'exit');
  });
  for (const signal of ['SIGTERM', 'SIGINT']) {
    if (process.listenerCount(signal) !== 0) continue;
    const observer = () => {
      if (signalObservers.get(signal) !== observer) return;
      flush(null, signal);
      // The once-listener is already removed: restore default signal termination unchanged.
      safe(() => process.kill(process.pid, signal));
    };
    signalObservers.set(signal, observer);
    process.once(signal, observer);
  }
}
