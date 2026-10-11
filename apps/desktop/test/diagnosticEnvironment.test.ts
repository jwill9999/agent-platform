import { describe, expect, it } from 'vitest';
import {
  diagnosticChildEnvironment,
  takeDiagnosticCapability,
} from '../src/main/diagnosticEnvironment.js';
describe('private diagnostic environment', () => {
  it('removes the capability from main environment and only explicitly scoped server copies receive it', () => {
    const sentinel = 'f'.repeat(64);
    const env = { DIAGNOSTICS_LOCAL_CAPABILITY: sentinel, PATH: '/bin' };
    const privateValue = takeDiagnosticCapability(env);
    expect(privateValue).toBe(sentinel);
    expect(env).toEqual({ PATH: '/bin' });
    expect(diagnosticChildEnvironment(env, privateValue)).toEqual({
      PATH: '/bin',
      DIAGNOSTICS_LOCAL_CAPABILITY: sentinel,
    });
    expect(diagnosticChildEnvironment({ ...env, DIAGNOSTICS_LOCAL_CAPABILITY: sentinel })).toEqual({
      PATH: '/bin',
    });
  });
});
