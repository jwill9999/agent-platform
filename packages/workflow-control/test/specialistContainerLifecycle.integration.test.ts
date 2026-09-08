import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { promisify } from 'node:util';

import { beforeAll, describe, expect, it, vi } from 'vitest';

import {
  executeSpecialistContainerLifecycle,
  type DockerSpecialistLaunch,
  type SpecialistContainerLifecycleResult,
} from '../src/index.js';

// Only UUID generation is controlled so observations target this test's exact identity.
// Every Docker subprocess still uses the real production executor and real daemon.
vi.mock('node:crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:crypto')>();
  return { ...actual, randomUUID: vi.fn(actual.randomUUID) };
});
const actualCrypto = await vi.importActual<typeof import('node:crypto')>('node:crypto');

const run = promisify(execFile);
const docker = '/usr/local/bin/docker';
const integration = process.env.WORKFLOW_DOCKER_LIFECYCLE === '1' ? describe : describe.skip;
let image: string;
const ownerLabel = 'io.agent-platform.specialist-lifecycle';
const observationFormat = `{"id":{{json .Id}},"name":{{json .Name}},"owner":{{json (index .Config.Labels "${ownerLabel}")}},"running":{{json .State.Running}}}`;
interface ProbeIdentity {
  name: string;
  owner: string;
}
interface ObservedContainer {
  id: string;
  running: boolean;
}

async function boundedDocker(
  args: string[],
  deadline: number,
): Promise<{ stdout: string; stderr: string }> {
  const timeout = deadline - Date.now();
  if (timeout <= 0) throw new Error('independent Docker observation budget exhausted');
  return run(docker, args, { env: {}, timeout, maxBuffer: 4096, killSignal: 'SIGKILL' });
}

function absent(error: unknown, identity: string): boolean {
  const failure = error as { code?: number; stderr?: string };
  return (
    failure.code === 1 &&
    failure.stderr?.trim() === `Error response from daemon: No such container: ${identity}`
  );
}

async function observeOwned(
  identity: ProbeIdentity,
  deadline: number,
): Promise<ObservedContainer | undefined> {
  let output: string;
  try {
    output = (
      await boundedDocker(
        ['container', 'inspect', '--format', observationFormat, identity.name],
        deadline,
      )
    ).stdout;
  } catch (error) {
    if (absent(error, identity.name)) return undefined;
    throw error;
  }
  const observed = JSON.parse(output) as {
    id: string;
    name: string;
    owner: string;
    running: boolean;
  };
  if (
    !/^[a-f0-9]{64}$/u.test(observed.id) ||
    observed.name !== `/${identity.name}` ||
    observed.owner !== identity.owner ||
    typeof observed.running !== 'boolean'
  )
    throw new Error('independent probe ownership mismatch; container was not removed');
  return observed;
}

async function observeRunning(identity: ProbeIdentity): Promise<string> {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const observed = await observeOwned(identity, deadline);
    if (observed?.running) return observed.id;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error('probe prerequisite failed: running container was not independently observed');
}

async function confirmAbsentId(id: string, deadline: number): Promise<void> {
  try {
    await boundedDocker(['container', 'inspect', id], deadline);
  } catch (error) {
    if (absent(error, id)) return;
    throw error;
  }
  throw new Error('container still exists after lifecycle completion');
}

async function fallbackRecovery(
  identity: ProbeIdentity,
  result?: SpecialistContainerLifecycleResult,
): Promise<void> {
  const deadline = Date.now() + 10000;
  const observed = await observeOwned(identity, deadline);
  if (observed !== undefined) {
    if (result?.recovery.containerId !== undefined && observed.id !== result.recovery.containerId)
      throw new Error('independent recovery ID mismatch; container was not removed');
    await boundedDocker(['container', 'rm', '--force', observed.id], deadline);
    await confirmAbsentId(observed.id, deadline);
  }
  // A fallback observation cannot establish that an ambiguous create will never arrive late.
  if (result?.cleanupConfirmed !== true)
    throw new Error(
      `probe cleanup remains unconfirmed; retain recovery identity ${identity.name} ${ownerLabel}=${identity.owner}`,
    );
}

async function withProbe(
  script: string,
  timeoutMs: number,
  check: (context: {
    pending: Promise<SpecialistContainerLifecycleResult>;
    identity: ProbeIdentity;
    controller: AbortController;
    startedAt: number;
  }) => Promise<void>,
): Promise<void> {
  const owner = actualCrypto.randomUUID();
  vi.mocked(randomUUID).mockReturnValueOnce(owner);
  const identity = { name: `workflow-lifecycle-${owner}`, owner };
  const controller = new AbortController();
  const startedAt = Date.now();
  const pending = executeSpecialistContainerLifecycle(probe(script), {
    timeoutMs,
    createTimeoutMs: 5000,
    cleanupTimeoutMs: 5000,
    signal: controller.signal,
  });
  let originalFailure: unknown;
  let cleanupFailure: unknown;
  try {
    await check({ pending, identity, controller, startedAt });
  } catch (error) {
    originalFailure = error;
    throw error;
  } finally {
    controller.abort();
    const result = await pending.catch(() => undefined);
    try {
      await fallbackRecovery(identity, result);
    } catch (error) {
      // Preserve the original assertion failure, rather than replacing it with fallback diagnostics.
      cleanupFailure = error;
      if (originalFailure instanceof Error && originalFailure.cause === undefined)
        originalFailure.cause = error;
    }
  }
  if (cleanupFailure !== undefined) throw cleanupFailure;
}

function probe(script: string): DockerSpecialistLaunch {
  return {
    dockerBinary: docker,
    environment: {},
    args: [
      'run',
      '--rm',
      '--read-only',
      '--network',
      'none',
      '--cap-drop',
      'ALL',
      '--security-opt',
      'no-new-privileges',
      '--pids-limit',
      '32',
      '--memory',
      '128m',
      '--cpus',
      '1',
      image,
      'node',
      '-e',
      script,
    ],
  };
}

async function independentlyConfirmAbsence(
  result: SpecialistContainerLifecycleResult,
): Promise<void> {
  expect(result.cleanupConfirmed).toBe(true);
  const id = result.recovery.containerId;
  expect(id).toMatch(/^[a-f0-9]{64}$/u);
  await confirmAbsentId(id!, Date.now() + 5000);
}

integration(
  'production specialist container lifecycle with offline network-none Node probes',
  () => {
    beforeAll(async () => {
      const result = await run(
        docker,
        ['image', 'inspect', 'agent-platform-api:latest', '--format', '{{.Id}}'],
        { env: {}, timeout: 5000, maxBuffer: 4096 },
      );
      image = result.stdout.trim();
      expect(image).toMatch(/^sha256:[a-f0-9]{64}$/u);
    });

    it('observes successful exit and independently verifies daemon removal', async () => {
      await withProbe(
        'process.stdout.write("offline lifecycle probe")',
        10000,
        async ({ pending }) => {
          const result = await pending;
          expect(result.status).toBe('completed');
          expect(result.exitCode).toBe(0);
          expect(result.stdout).toBe('offline lifecycle probe');
          await independentlyConfirmAbsence(result);
        },
      );
    }, 45000);

    it('removes an executing container after killing the timed-out Docker client', async () => {
      await withProbe(
        'setInterval(() => {}, 1000)',
        12000,
        async ({ pending, identity, startedAt }) => {
          const observedId = await observeRunning(identity);
          // Failure here is a startup prerequisite failure, not proof of runtime timeout cleanup.
          expect(Date.now() - startedAt).toBeLessThan(10000);
          const result = await pending;
          expect(result.recovery.containerId).toBe(observedId);
          expect(result.status).toBe('timed_out');
          expect(result.stdout).toBeUndefined();
          await independentlyConfirmAbsence(result);
        },
      );
    }, 45000);

    it('removes an executing container after cancellation', async () => {
      await withProbe(
        'setInterval(() => {}, 1000)',
        15000,
        async ({ pending, identity, controller }) => {
          const observedId = await observeRunning(identity);
          controller.abort();
          const result = await pending;
          expect(result.recovery.containerId).toBe(observedId);
          expect(result.status).toBe('cancelled');
          await independentlyConfirmAbsence(result);
        },
      );
    }, 45000);
  },
);
