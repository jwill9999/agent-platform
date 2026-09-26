#!/usr/bin/env node
import { lstatSync, readFileSync, writeFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';
import { LocalCredentialLeases } from './localCredentialLeases.js';
import {
  createCredentialControlServer,
  createLocalCredentialGateway,
} from './localCredentialGateway.js';

const absolute = z.string().refine(isAbsolute);
export const localBrokerConfigSchema = z
  .object({
    database: absolute,
    accountFile: absolute,
    controlKeyFile: absolute,
    controlPort: z.number().int().min(1024).max(65535),
    gatewayPort: z.number().int().min(1024).max(65535),
    listenHost: z.enum(['127.0.0.1', '0.0.0.0']).default('127.0.0.1'),
    leaseTtlMs: z.number().int().min(1000).max(3_600_000).default(300_000),
  })
  .strict()
  .refine((c) => c.controlPort !== c.gatewayPort, 'separate ports required');

function privateFile(path: string): string {
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.isSymbolicLink() || (stat.mode & 0o077) !== 0)
    throw new Error('private regular configuration file required');
  return readFileSync(path, 'utf8');
}

function createAdapter(configFile: string, rest: string[]) {
  const output = rest[1];
  if (
    rest.length !== 2 ||
    rest[0] !== '--output' ||
    !output ||
    !isAbsolute(output) ||
    !output.endsWith('.mjs') ||
    /[\r\n]/u.test(process.execPath)
  )
    throw new Error('absolute .mjs adapter output required');
  const script =
    '#!' +
    process.execPath +
    '\n' +
    'import { runLocalBrokerCli } from ' +
    JSON.stringify(import.meta.url) +
    ';\n' +
    'runLocalBrokerCli([' +
    JSON.stringify(configFile) +
    ', ...process.argv.slice(2)]).then(result => { if (result !== undefined) process.stdout.write(JSON.stringify(result) + "\\n"); }).catch(() => { process.stderr.write("local credential broker operation failed\\n"); process.exitCode = 1; });\n';
  writeFileSync(output, script, { mode: 0o700, flag: 'wx' });
  return { adapter: output };
}

export async function runLocalBrokerCli(args: string[]) {
  const [configFile, command, ...rest] = args;
  if (!configFile || !isAbsolute(configFile)) throw new Error('absolute trusted config required');
  const config = localBrokerConfigSchema.parse(JSON.parse(privateFile(configFile)));
  const key = privateFile(config.controlKeyFile).trim();
  if (!/^[a-f0-9]{64}$/u.test(key)) throw new Error('invalid control key');
  if (command === 'create-adapter') return createAdapter(configFile, rest);
  if (command === 'serve') {
    if (rest.length) throw new Error('unexpected serve arguments');
    privateFile(config.accountFile);
    const leases = new LocalCredentialLeases(config.database, config.leaseTtlMs);
    const gateway = createLocalCredentialGateway(leases, config.accountFile);
    const control = createCredentialControlServer(leases, gateway, key);
    gateway.gateway.listen(config.gatewayPort, config.listenHost);
    control.listen(config.controlPort, config.listenHost);
    const stop = () => {
      control.close();
      control.closeAllConnections();
      gateway.gateway.close(() => {
        leases.close();
      });
      gateway.gateway.closeAllConnections();
    };
    process.once('SIGTERM', stop);
    process.once('SIGINT', stop);
    return;
  }
  const values = new Map<string, string>();
  for (let i = 0; i < rest.length; i += 2) {
    const name = rest[i],
      value = rest[i + 1];
    if (!name || !value || values.has(name)) throw new Error('invalid broker arguments');
    values.set(name, value);
  }
  const allowed: Record<string, string[]> = {
    issue: ['--execution-id', '--lease-id', '--generation', '--output'],
    revoke: ['--lease-id', '--generation'],
    status: ['--lease-id', '--generation'],
    conformance: ['--protocol', '--max-probe-ttl-seconds'],
  };
  if (
    !command ||
    values.size !== allowed[command]?.length ||
    [...values.keys()].some((k) => !allowed[command]!.includes(k))
  )
    throw new Error('invalid broker command');
  if (
    command === 'conformance' &&
    (values.get('--protocol') !== 'revoke-wins-v1' ||
      values.get('--max-probe-ttl-seconds') !== '30')
  )
    throw new Error('unsupported conformance protocol');
  const body =
    command === 'conformance'
      ? { operation: command }
      : {
          operation: command,
          leaseId: values.get('--lease-id'),
          generation: values.get('--generation'),
          ...(command === 'issue' ? { executionId: values.get('--execution-id') } : {}),
        };
  const response = await fetch(`http://127.0.0.1:${config.controlPort}/control`, {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(25_000),
    redirect: 'error',
  });
  if (!response.ok) throw new Error('credential control request rejected');
  const result: unknown = await response.json();
  if (command === 'issue') {
    const issued = z
      .object({
        token: z.string().regex(/^[a-f0-9]{64}$/u),
        leaseId: z.string(),
        generation: z.string(),
      })
      .strict()
      .parse(result);
    const output = values.get('--output')!;
    if (!isAbsolute(output)) throw new Error('absolute private output required');
    writeFileSync(output, JSON.stringify({ OPENAI_API_KEY: issued.token }), {
      mode: 0o600,
      flag: 'wx',
    });
    return { leaseId: issued.leaseId, generation: issued.generation };
  }
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const result = await runLocalBrokerCli(process.argv.slice(2));
    if (result !== undefined) process.stdout.write(JSON.stringify(result) + '\n');
  } catch {
    process.stderr.write('local credential broker operation failed\n');
    process.exitCode = 1;
  }
}
