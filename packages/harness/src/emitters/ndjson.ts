import type { Writable } from 'node:stream';
import type { Output } from '@agent-platform/contracts';
import type { OutputEmitter } from '../types.js';

/**
 * Creates an OutputEmitter that writes NDJSON (newline-delimited JSON)
 * to a writable stream. Each Output event becomes one JSON line.
 *
 * Content-Type should be set to `application/x-ndjson` by the caller.
 */
export function createNdjsonEmitter(stream: Writable): OutputEmitter {
  return {
    emit(event: Output): void {
      if (!stream.writable) return;
      stream.write(JSON.stringify(event) + '\n');
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
