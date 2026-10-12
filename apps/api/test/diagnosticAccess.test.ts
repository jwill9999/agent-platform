import { describe, expect, it } from 'vitest';
import type { Request } from 'express';
import {
  diagnosticAccessFromEnvironment,
  consumeDiagnosticAccess,
  hasDiagnosticAccess,
} from '../src/infrastructure/diagnostics/localAccess.js';

const capability = 'a'.repeat(64);
const env = {
  HOST: '127.0.0.1',
  PORT: '3456',
  DIAGNOSTICS_HOST: '127.0.0.1:3456',
  DIAGNOSTICS_LOCAL_CAPABILITY: capability,
};
const access = { host: env.DIAGNOSTICS_HOST, capability };
function req(peer: string, host = access.host, token: unknown = capability): Request {
  return {
    socket: { remoteAddress: peer },
    headers: {
      host,
      'x-diagnostics-capability': token,
      'x-forwarded-for': '127.0.0.1',
      'x-forwarded-host': access.host,
    },
    ip: '127.0.0.1',
  } as unknown as Request;
}

describe('diagnostics private local boundary', () => {
  it('consumes the private capability even for invalid deployments', () => {
    const valid = { ...env };
    expect(consumeDiagnosticAccess(valid)).toEqual(access);
    expect(valid.DIAGNOSTICS_LOCAL_CAPABILITY).toBeUndefined();
    const invalid = { ...env, HOST: '0.0.0.0' };
    expect(consumeDiagnosticAccess(invalid)).toBeUndefined();
    expect(invalid.DIAGNOSTICS_LOCAL_CAPABILITY).toBeUndefined();
  });
  it('requires explicit literal bind, exact port/host and private capability', () => {
    expect(diagnosticAccessFromEnvironment(env)).toEqual(access);
    for (const HOST of ['0.0.0.0', 'localhost', '::', '192.168.1.2', undefined])
      expect(diagnosticAccessFromEnvironment({ ...env, HOST })).toBeUndefined();
    for (const PORT of ['0', '65536', '1e3', '3000/path', ''])
      expect(diagnosticAccessFromEnvironment({ ...env, PORT })).toBeUndefined();
    expect(
      diagnosticAccessFromEnvironment({ ...env, DIAGNOSTICS_HOST: 'attacker.example:3456' }),
    ).toBeUndefined();
    expect(
      diagnosticAccessFromEnvironment({ ...env, DIAGNOSTICS_LOCAL_CAPABILITY: 'short' }),
    ).toBeUndefined();
    expect(
      diagnosticAccessFromEnvironment({ ...env, HOST: '::1', DIAGNOSTICS_HOST: '[::1]:3456' }),
    ).toEqual({ ...access, host: '[::1]:3456' });
  });
  it('ignores forwarded identities and denies foreign or deceptive hosts and tokens', () => {
    for (const peer of ['127.0.0.1', '::1', '::ffff:127.0.0.1'])
      expect(hasDiagnosticAccess(req(peer), access)).toBe(true);
    for (const peer of ['10.0.0.1', '127.0.0.2', '', '::ffff:10.0.0.1'])
      expect(hasDiagnosticAccess(req(peer), access)).toBe(false);
    for (const host of [
      'localhost:3456',
      'attacker.example:3456',
      '127.0.0.1:3457',
      '127.0.0.1:3456@evil',
    ])
      expect(hasDiagnosticAccess(req('127.0.0.1', host), access)).toBe(false);
    for (const token of ['b'.repeat(64), 'a'.repeat(63), [capability], null])
      expect(hasDiagnosticAccess(req('127.0.0.1', access.host, token), access)).toBe(false);
  });
});
