import type { Writable } from 'node:stream';
import { once } from 'node:events';
import type { Output } from '@agent-platform/contracts';
import type { OutputEmitter } from '../types.js';

/**
 * Creates an OutputEmitter that writes NDJSON (newline-delimited JSON)
 * to a writable stream. Each Output event becomes one JSON line.
 *
 * Backpressure-aware: when the stream's internal buffer is full,
 * waits for a `drain` event before continuing.
 *
 * Content-Type should be set to `application/x-ndjson` by the caller.
 */
export function createNdjsonEmitter(stream: Writable): OutputEmitter {
  return {
    async emit(event: Output): Promise<void> {
      if (!stream.writable) return;
      const data = JSON.stringify(event) + '\n';
      const canWrite = stream.write(data);
      if (!canWrite && stream.writable) {
        await once(stream, 'drain');
      }
    },
    end(): void {
      if (!stream.writable) return;
      stream.end();
    },
  };
}

/** No-op emitter for testing or when streaming is not needed. */
export function createNoopEmitter(): OutputEmitter {
  return {
    emit(): void {},
    end(): void {},
  };
}
