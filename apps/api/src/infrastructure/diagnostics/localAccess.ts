import { timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';

export type DiagnosticAccess = { capability: string; host: string };

/** No URL/proxy inference: the process must explicitly bind a literal loopback address. */
export function diagnosticAccessFromEnvironment(
  env: NodeJS.ProcessEnv,
): DiagnosticAccess | undefined {
  if (env.HOST !== '127.0.0.1' && env.HOST !== '::1') return undefined;
  const port = env.PORT ?? '3000';
  if (!/^\d{1,5}$/.test(port) || Number(port) < 1 || Number(port) > 65535) return undefined;
  const expectedHost = `${env.HOST === '::1' ? '[::1]' : env.HOST}:${port}`;
  if (env.DIAGNOSTICS_HOST !== expectedHost) return undefined;
  const capability = env.DIAGNOSTICS_LOCAL_CAPABILITY;
  if (!capability || !/^[a-f0-9]{64}$/.test(capability)) return undefined;
  return { capability, host: expectedHost };
}

export function hasDiagnosticAccess(req: Request, access: DiagnosticAccess): boolean {
  // Never use req.ip/hostname: createApp deliberately trusts a proxy for unrelated routes.
  const peer = req.socket.remoteAddress;
  if (peer !== '127.0.0.1' && peer !== '::1' && peer !== '::ffff:127.0.0.1') return false;
  if (req.headers.host !== access.host) return false;
  const supplied = req.headers['x-diagnostics-capability'];
  if (typeof supplied !== 'string' || !/^[a-f0-9]{64}$/.test(supplied)) return false;
  return timingSafeEqual(Buffer.from(supplied, 'hex'), Buffer.from(access.capability, 'hex'));
}

/** Consume once at bootstrap; task subprocesses must not inherit the read capability. */
export function consumeDiagnosticAccess(env: NodeJS.ProcessEnv): DiagnosticAccess | undefined {
  try {
    return diagnosticAccessFromEnvironment(env);
  } finally {
    delete env.DIAGNOSTICS_LOCAL_CAPABILITY;
  }
}
