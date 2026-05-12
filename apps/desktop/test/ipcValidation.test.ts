import { describe, expect, it } from 'vitest';

import {
  assertTrustedIpcSender,
  fail,
  ok,
  validateIpcPayload,
  validateNoPayload,
} from '../src/main/ipcValidation.js';

describe('desktop IPC validation helpers', () => {
  it('accepts channels that do not expect a payload', () => {
    expect(validateNoPayload(undefined)).toEqual({ ok: true, value: undefined });
  });

  it('rejects unexpected payloads for no-payload channels', () => {
    expect(validateNoPayload({ unexpected: true })).toEqual({
      ok: false,
      error: 'Unexpected IPC payload.',
    });
  });

  it('returns validated payload values', () => {
    const value = validateIpcPayload('ready', (payload) =>
      payload === 'ready' ? ok(payload) : fail('Expected ready.'),
    );

    expect(value).toBe('ready');
  });

  it('throws for malformed payloads', () => {
    expect(() =>
      validateIpcPayload('not-ready', (payload) =>
        payload === 'ready' ? ok(payload) : fail('Expected ready.'),
      ),
    ).toThrow('Expected ready.');
  });

  it('accepts IPC calls from the trusted web contents', () => {
    const trustedSender = {};

    expect(() =>
      assertTrustedIpcSender(
        { sender: trustedSender } as Parameters<typeof assertTrustedIpcSender>[0],
        trustedSender,
      ),
    ).not.toThrow();
  });

  it('rejects IPC calls from another web contents', () => {
    expect(() =>
      assertTrustedIpcSender(
        { sender: {} } as Parameters<typeof assertTrustedIpcSender>[0],
        {} as Parameters<typeof assertTrustedIpcSender>[1],
      ),
    ).toThrow('Rejected IPC call from untrusted sender.');
  });
});
