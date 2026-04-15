import { describe, it, expect, vi } from 'vitest';
import { PassThrough } from 'node:stream';
import { createNdjsonEmitter, createNoopEmitter } from '../src/emitters/ndjson.js';
import type { Output } from '@agent-platform/contracts';

describe('createNdjsonEmitter', () => {
  it('writes each event as a JSON line', () => {
    const stream = new PassThrough();
    const chunks: string[] = [];
    stream.on('data', (chunk) => chunks.push(chunk.toString()));

    const emitter = createNdjsonEmitter(stream);

    const event1: Output = { type: 'text', content: 'Hello' };
    const event2: Output = { type: 'text', content: 'World' };

    emitter.emit(event1);
    emitter.emit(event2);

    expect(chunks).toEqual([JSON.stringify(event1) + '\n', JSON.stringify(event2) + '\n']);
  });

  it('calls stream.end() on end()', () => {
    const stream = new PassThrough();
    const endSpy = vi.spyOn(stream, 'end');

    const emitter = createNdjsonEmitter(stream);
    emitter.end();

    expect(endSpy).toHaveBeenCalled();
  });

  it('writes tool_result events correctly', () => {
    const stream = new PassThrough();
    const chunks: string[] = [];
    stream.on('data', (chunk) => chunks.push(chunk.toString()));

    const emitter = createNdjsonEmitter(stream);
    const event: Output = {
      type: 'tool_result',
      toolId: 'mcp-fs:read',
      data: { content: 'file data' },
    };
    emitter.emit(event);

    const parsed = JSON.parse(chunks[0]!.trim());
    expect(parsed).toEqual(event);
  });

  it('writes error events correctly', () => {
    const stream = new PassThrough();
    const chunks: string[] = [];
    stream.on('data', (chunk) => chunks.push(chunk.toString()));

    const emitter = createNdjsonEmitter(stream);
    const event: Output = { type: 'error', message: 'Something went wrong', code: 'ERR_TEST' };
    emitter.emit(event);

    const parsed = JSON.parse(chunks[0]!.trim());
    expect(parsed).toEqual(event);
  });

  it('does not write to closed stream', () => {
    const stream = new PassThrough();
    stream.end();

    const emitter = createNdjsonEmitter(stream);
    // Should not throw
    emitter.emit({ type: 'text', content: 'after end' });
    emitter.end();
  });
});

describe('createNoopEmitter', () => {
  it('does not throw on emit or end', () => {
    const emitter = createNoopEmitter();
    emitter.emit({ type: 'text', content: 'ignored' });
    emitter.end();
  });
});
