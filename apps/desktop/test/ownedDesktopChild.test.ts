import { EventEmitter } from 'node:events';
import type { ChildProcess } from 'node:child_process';
import { Writable } from 'node:stream';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ownDesktopChild } from '../src/main/ownedDesktopChild.js';

function fakeChild(pid: number | undefined = 123) {
  return Object.assign(new EventEmitter(), {
    pid,
    exitCode: null as number | null,
    signalCode: null as NodeJS.Signals | null,
    killed: false,
    kill: vi.fn(() => true),
  });
}
afterEach(() => vi.useRealTimers());

describe('owned desktop child completion', () => {
  it('does not confuse killed or exit with close, and joins delayed log finish', async () => {
    const child = fakeChild();
    child.killed = true;
    let finish!: () => void;
    const log = new Writable({
      write(_chunk, _encoding, done) {
        done();
      },
      final(done) {
        finish = done;
      },
    });
    const owned = ownDesktopChild(child as unknown as ChildProcess, [log]);
    const stopped = owned.stop();
    const done = vi.fn();
    void stopped.then(done);
    expect(owned.stop()).toBe(stopped);
    child.exitCode = 0;
    child.emit('exit', 0);
    await Promise.resolve();
    expect(done).not.toHaveBeenCalled();
    child.emit('close', 0);
    await Promise.resolve();
    expect(done).not.toHaveBeenCalled();
    finish();
    await stopped;
    expect(done).toHaveBeenCalledOnce();
  });

  it('awaits actual close after SIGKILL instead of reporting signal delivery as completion', async () => {
    vi.useFakeTimers();
    const child = fakeChild();
    const owned = ownDesktopChild(child as unknown as ChildProcess);
    const done = vi.fn();
    const stopped = owned.stop().then(done);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(child.kill.mock.calls).toEqual([['SIGTERM'], ['SIGKILL']]);
    expect(done).not.toHaveBeenCalled();
    child.signalCode = 'SIGKILL';
    child.emit('exit', null, 'SIGKILL');
    await vi.advanceTimersByTimeAsync(200);
    expect(done).not.toHaveBeenCalled();
    child.emit('close', null, 'SIGKILL');
    await stopped;
    expect(done).toHaveBeenCalledOnce();
  });

  it('fails boundedly when terminal close cannot be confirmed', async () => {
    vi.useFakeTimers();
    const child = fakeChild();
    const owned = ownDesktopChild(child as unknown as ChildProcess);
    const assertion = expect(owned.stop()).rejects.toThrow('could not be confirmed');
    await vi.advanceTimersByTimeAsync(4_000);
    await assertion;
    expect(vi.getTimerCount()).toBe(0);
  });

  it('handles spawn error without a PID and an already closed signal exit', async () => {
    const failed = fakeChild(undefined);
    failed.pid = undefined;
    const owned = ownDesktopChild(failed as unknown as ChildProcess);
    const error = new Error('spawn failed');
    failed.emit('error', error);
    failed.emit('close', -2);
    await owned.stop();
    expect(owned.processError()).toBe(error);
    expect(failed.kill).not.toHaveBeenCalled();
    const signalled = fakeChild();
    const signalledOwned = ownDesktopChild(signalled as unknown as ChildProcess);
    signalled.signalCode = 'SIGTERM';
    signalled.emit('close', null, 'SIGTERM');
    await signalledOwned.stop();
    expect(signalled.kill).not.toHaveBeenCalled();
  });

  it('reports a log stream error instead of hanging or claiming success', async () => {
    const child = fakeChild();
    const log = new Writable({
      write(_chunk, _encoding, done) {
        done();
      },
    });
    const owned = ownDesktopChild(child as unknown as ChildProcess, [log]);
    log.emit('error', new Error('disk failed'));
    child.emit('close', 0);
    await expect(owned.stop()).rejects.toThrow('log completion failed');
  });
});
