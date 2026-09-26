import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LocalCredentialLeases } from '../src/localCredentialLeases.js';
import {
  createCredentialControlServer,
  createLocalCredentialGateway,
} from '../src/localCredentialGateway.js';
import { runLocalBrokerCli } from '../src/localCredentialBrokerCli.js';

const cleanups: Array<() => void | Promise<void>> = [];
afterEach(async () => {
  vi.restoreAllMocks();
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});
function fixture(ttl = 300_000, now = Date.now) {
  const dir = mkdtempSync(join(tmpdir(), 'local-credential-test-'));
  cleanups.push(() => rmSync(dir, { recursive: true, force: true }));
  const leases = new LocalCredentialLeases(join(dir, 'leases.sqlite'), ttl, now);
  cleanups.push(() => leases.close());
  return { dir, leases };
}
async function listen(server: ReturnType<typeof createServer>) {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  cleanups.push(
    () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
        server.closeAllConnections();
      }),
  );
  const a = server.address();
  if (!a || typeof a === 'string') throw Error('port');
  return a.port;
}
describe('durable credential authority', () => {
  it('idempotently issues one opaque credential and cannot issue after revoke', () => {
    const { leases } = fixture();
    const g = leases.generation;
    const first = leases.issue('lease', g, 'execution');
    expect(leases.issue('lease', g, 'execution')).toEqual(first);
    expect(leases.authorize(first.token)?.leaseId).toBe('lease');
    leases.revoke('lease', g);
    leases.revoke('lease', g);
    expect(leases.authorize(first.token)).toBeUndefined();
    expect(() => leases.issue('lease', g, 'execution')).toThrow();
  });
  it('revocation before delayed issuance creates a durable tombstone', async () => {
    const { leases } = fixture();
    const g = leases.generation;
    const issue = Promise.resolve().then(() => leases.issue('delayed', g, 'execution'));
    leases.revoke('delayed', g);
    await expect(issue).rejects.toThrow();
    expect(leases.status('delayed', g)).toBe('revoked');
  });
  it('expiry is not renewed by idempotent issue', () => {
    let clock = 100;
    const { leases } = fixture(1000, () => clock);
    const x = leases.issue('lease', leases.generation, 'execution');
    clock = 1100;
    expect(leases.authorize(x.token)).toBeUndefined();
    expect(() => leases.issue('lease', leases.generation, 'execution')).toThrow();
  });
  it('restart fences prior active tokens and retains revoked lease identities', () => {
    const { leases, dir } = fixture();
    const g = leases.generation;
    const x = leases.issue('lease', g, 'execution');
    leases.revoke('other', g);
    const restarted = new LocalCredentialLeases(join(dir, 'leases.sqlite'));
    cleanups.push(() => restarted.close());
    expect(restarted.authorize(x.token)).toBeUndefined();
    expect(restarted.status('lease', g)).toBe('revoked');
    expect(restarted.status('other', g)).toBe('revoked');
    expect(() => leases.issue('late', g, 'execution')).toThrow('superseded');
    expect(() => restarted.issue('lease', restarted.generation, 'execution')).toThrow();
  });
  it('rejects mismatched generations/executions and unknown status', () => {
    const { leases } = fixture();
    leases.issue('lease', leases.generation, 'execution');
    expect(() => leases.issue('lease', leases.generation, 'different')).toThrow();
    expect(() => leases.revoke('lease', 'fake')).toThrow();
    expect(() => leases.status('missing', leases.generation)).toThrow();
    expect(leases.authorize('malformed')).toBeUndefined();
  });
  it('actually probes revoke-before-delayed-issue and leaves no valid probe token', () => {
    const { leases } = fixture();
    expect(leases.conformance()).toMatchObject({
      protocol: 'revoke-wins-v1',
      passed: true,
      cleanup: 'broker_owned_ttl',
      probeTtlSeconds: 30,
    });
  });
});

it('denies unleased model access and independently denies worker control access', async () => {
  const { leases, dir } = fixture();
  const gateway = createLocalCredentialGateway(leases, join(dir, 'absent-account'));
  const port = await listen(gateway.gateway);
  const control = await listen(createCredentialControlServer(leases, gateway, 'a'.repeat(64)));
  expect((await fetch(`http://127.0.0.1:${port}/models`)).status).toBe(403);
  const issued = leases.issue('lease', leases.generation, 'execution');
  expect(
    (
      await fetch(`http://127.0.0.1:${control}/control`, {
        method: 'POST',
        headers: { authorization: `Bearer ${issued.token}` },
        body: '{}',
      })
    ).status,
  ).toBe(403);
  expect(
    (
      await fetch(`http://127.0.0.1:${port}/responses/../other`, {
        headers: { authorization: `Bearer ${issued.token}` },
      })
    ).status,
  ).toBe(403);
  expect(
    (
      await fetch(`http://127.0.0.1:${port}/models`, {
        headers: { authorization: `Bearer ${issued.token}` },
      })
    ).status,
  ).toBe(503);
});

it('satisfies CLI protocol without returning a worker token on stdout', async () => {
  const { leases, dir } = fixture();
  const accountFile = join(dir, 'account.json');
  writeFileSync(
    accountFile,
    '{"tokens":{"access_token":"HOST_SECRET","account_id":"HOST_ACCOUNT"}}',
    { mode: 0o600 },
  );
  const gateway = createLocalCredentialGateway(leases, accountFile);
  const gatewayPort = await listen(gateway.gateway);
  const controlPort = await listen(createCredentialControlServer(leases, gateway, 'b'.repeat(64)));
  const controlKeyFile = join(dir, 'key');
  writeFileSync(controlKeyFile, 'b'.repeat(64), { mode: 0o600 });
  const config = join(dir, 'config.json');
  writeFileSync(
    config,
    JSON.stringify({
      database: join(dir, 'leases.sqlite'),
      accountFile,
      controlKeyFile,
      controlPort,
      gatewayPort,
    }),
    { mode: 0o600 },
  );
  expect(
    await runLocalBrokerCli([
      config,
      'conformance',
      '--protocol',
      'revoke-wins-v1',
      '--max-probe-ttl-seconds',
      '30',
    ]),
  ).toMatchObject({ passed: true });
  const adapter = join(dir, 'broker.mjs');
  const execute = promisify(execFile);
  await execute(process.execPath, [
    fileURLToPath(new URL('../dist/localCredentialBrokerCli.js', import.meta.url)),
    config,
    'create-adapter',
    '--output',
    adapter,
  ]);
  const { WorkflowStore } = await import('../src/index.js');
  const { RevocableSpecialistCredentialBroker } = await import('../src/specialistLauncher.js');
  const store = new WorkflowStore(join(dir, 'workflow.sqlite'));
  cleanups.push(() => store.close());
  const productionBroker = RevocableSpecialistCredentialBroker.create({ binary: adapter, store });
  expect(await productionBroker.assertConformant()).toBe(leases.generation);
  const invoke = async (args: string[]) =>
    JSON.parse((await execute(adapter, args, { env: {} })).stdout);
  expect(
    await invoke(['conformance', '--protocol', 'revoke-wins-v1', '--max-probe-ttl-seconds', '30']),
  ).toMatchObject({ passed: true });
  const output = join(dir, 'worker.json');
  const result = await invoke([
    'issue',
    '--execution-id',
    'execution',
    '--lease-id',
    'lease',
    '--generation',
    leases.generation,
    '--output',
    output,
  ]);
  expect(result).toEqual({ leaseId: 'lease', generation: leases.generation });
  const worker = readFileSync(output, 'utf8');
  expect(worker).not.toContain('HOST_');
  const token = JSON.parse(worker).OPENAI_API_KEY as string;
  expect(leases.authorize(token)).toBeDefined();
  expect(
    await invoke(['revoke', '--lease-id', 'lease', '--generation', leases.generation]),
  ).toMatchObject({ status: 'revoked' });
  expect(
    (
      await fetch(`http://127.0.0.1:${gatewayPort}/models`, {
        headers: { authorization: `Bearer ${token}` },
      })
    ).status,
  ).toBe(403);
});

it('writes only validated operator gateway/model configuration', async () => {
  const { configureModelGateway, modelGatewayConfigSchema } =
    await import('../src/modelGatewayConfig.js');
  const { dir } = fixture();
  writeFileSync(join(dir, 'config.toml'), 'approval_policy = "never"\n');
  await configureModelGateway(dir, {
    url: 'http://model-gateway:8080',
    model: 'operator-selected-model',
  });
  const config = readFileSync(join(dir, 'config.toml'), 'utf8');
  expect(config).toContain('requires_openai_auth=true');
  expect(config).toContain('operator-selected-model');
  expect(config).toContain('approval_policy = "never"');
  for (const url of [
    'https://remote.example',
    'http://user:secret@model-gateway',
    'http://model-gateway/other',
    'http://model-gateway?token=secret',
  ])
    expect(modelGatewayConfigSchema.safeParse({ url, model: 'chosen' }).success).toBe(false);
  expect(
    modelGatewayConfigSchema.safeParse({ url: 'http://model-gateway', model: 'bad\nmodel' })
      .success,
  ).toBe(false);
});
