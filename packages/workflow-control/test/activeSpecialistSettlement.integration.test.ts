import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  DockerIsolatedSpecialistLauncher,
  RevocableSpecialistCredentialBroker,
} from '../src/specialistLauncher.js';
import type { TaskPacket } from '../src/contracts.js';
import { continuationFixture } from './continuationFixture.js';

const run = promisify(execFile);
const docker = (args: string[], timeout = 10000) =>
  run('/usr/local/bin/docker', args, { env: {}, timeout, maxBuffer: 1024 * 1024 });
const integration = process.env.WORKFLOW_DOCKER_LIFECYCLE === '1' ? describe : describe.skip;
const fixtureOwner = randomUUID();
const baseTag = `workflow-active-fixture-base:${fixtureOwner}`;
let baseTagged = false;
let imageId: string | undefined;
let imageContext: string | undefined;

async function confirmAbsent(id: string) {
  try {
    await docker(['container', 'inspect', id]);
  } catch (error) {
    expect(error).toMatchObject({
      code: 1,
      stderr: `Error response from daemon: No such container: ${id}\n`,
    });
    return;
  }
  throw new Error('offline active probe container remains present');
}

integration('active launcher with real offline Docker and fixture credential protocol', () => {
  beforeAll(async () => {
    const base = (
      await docker(['image', 'inspect', 'agent-platform-api:latest', '--format', '{{.Id}}'])
    ).stdout.trim();
    expect(base).toMatch(/^sha256:[a-f0-9]{64}$/u);
    await docker(['image', 'tag', base, baseTag]);
    baseTagged = true;
    imageContext = await mkdtemp(join(tmpdir(), 'active-image-fixture-'));
    await writeFile(
      join(imageContext, 'Dockerfile'),
      `FROM ${baseTag}\nCOPY --chmod=0555 codex /usr/local/bin/codex\nLABEL io.agent-platform.offline-fixture="${fixtureOwner}"\n`,
    );
    await writeFile(
      join(imageContext, 'codex'),
      '#!/usr/bin/env node\nconst fs = require("node:fs");\nif(fs.readFileSync("/workspace/probe.txt", "utf8") === "wait") setInterval(() => {}, 1000);\nelse process.stdout.write(JSON.stringify({type:"offline_active_probe"}) + "\\n");\n',
    );
    await docker(
      [
        'build',
        '--network',
        'none',
        '--pull=false',
        '--tag',
        `workflow-active-fixture:${fixtureOwner}`,
        imageContext,
      ],
      60000,
    );
    imageId = (
      await docker([
        'image',
        'inspect',
        `workflow-active-fixture:${fixtureOwner}`,
        '--format',
        '{{.Id}}',
      ])
    ).stdout.trim();
    expect(imageId).toMatch(/^sha256:[a-f0-9]{64}$/u);
  }, 90000);

  afterAll(async () => {
    if (imageId !== undefined) {
      const owner = (
        await docker([
          'image',
          'inspect',
          imageId,
          '--format',
          '{{index .Config.Labels "io.agent-platform.offline-fixture"}}',
        ])
      ).stdout.trim();
      if (owner !== fixtureOwner) throw new Error('offline fixture image ownership mismatch');
      await docker(['image', 'rm', imageId]);
    }
    if (imageContext !== undefined) await rm(imageContext, { recursive: true, force: true });
    if (baseTagged) await docker(['image', 'rm', baseTag]);
  });

  it.each(['success', 'cancel'])(
    'confirms durable %s settlement and independent daemon absence',
    async (mode) => {
      const f = await continuationFixture();
      const executionId = randomUUID();
      const original = f.store.getSchedulerExecution('child')!;
      const deadlineMs = Date.now() + 30000;
      const execution = f.store.createSchedulerExecution({
        ...original,
        id: executionId,
        processIdentity: `docker:workflow-specialist-${executionId}`,
        credentialLeaseId: `specialist:${executionId}`,
        deadlineMs,
      });
      const sourceRoot = join(f.root, 'source');
      await mkdir(sourceRoot);
      await writeFile(join(sourceRoot, 'probe.txt'), mode === 'cancel' ? 'wait' : 'success');
      let stagingRoot: string | undefined;
      let revoked = false;
      // This protocol is an offline fixture, not a claim about production credential conformance.
      const broker = RevocableSpecialistCredentialBroker.createForTest({
        store: f.store,
        issue: async (root, _id, leaseId, generation) => {
          stagingRoot = root;
          const authFile = join(root, 'fixture-auth.json');
          await writeFile(authFile, '{}');
          return { authFile, leaseId, generation };
        },
        revoke: async () => {
          revoked = true;
        },
        observe: async () => (revoked ? 'revoked' : 'active'),
        conformance: async () => 'offline-fixture',
      });
      const uid = process.getuid!();
      expect(uid).toBeGreaterThan(0);
      const launcher = DockerIsolatedSpecialistLauncher.create({
        store: f.store,
        ownerId: 'owner',
        sourceRoot,
        image: imageId!,
        credentialBroker: broker,
        egressNetwork: 'none',
        containerUser: `${uid}:${process.getgid!()}`,
      });
      const reservation = { id: executionId, role: 'code_reviewer', deadlineMs };
      const packet: TaskPacket = {
        runId: 'run',
        taskId: 'task',
        contractVersion: 1,
        policyDigest: `sha256:${'a'.repeat(64)}`,
        assignedRole: 'code_reviewer',
        objective: 'offline fixture',
        acceptanceCriteria: ['settled'],
        allowedPaths: ['probe.txt'],
        allowedOperations: ['workspace.read'],
        retryBudget: { implementationAttempts: 1, findingAttempts: 1, infrastructureAttempts: 1 },
        evidence: [],
      };
      const pending = launcher.launch(packet, reservation);
      const observed = pending.then(
        (result) => ({ result, error: undefined }),
        (error) => ({ result: undefined, error }),
      );
      let settled = false;
      try {
        if (mode === 'cancel') {
          const observeDeadline = Date.now() + 10000;
          let running = false;
          while (Date.now() < observeDeadline && !running) {
            const state = f.store.getSchedulerContainer(executionId);
            if (state?.containerId) {
              const observation = JSON.parse(
                (
                  await docker([
                    'inspect',
                    '--format',
                    '{"running":{{json .State.Running}},"owner":{{json (index .Config.Labels "io.agent-platform.specialist-execution")}}}',
                    state.containerId,
                  ])
                ).stdout,
              ) as { running: boolean; owner: string };
              expect(observation.owner).toBe(executionId);
              running = observation.running;
            }
            if (!running) await new Promise((resolve) => setTimeout(resolve, 50));
          }
          expect(running).toBe(true);
          await launcher.cancel(reservation);
        }
        const output = await observed;
        if (mode === 'success') {
          expect(output.error).toBeUndefined();
          expect(output.result).toMatchObject({ events: [{ type: 'offline_active_probe' }] });
        } else expect(output.error).toBeDefined();
        expect(revoked).toBe(true);
        expect(await launcher.waitForSettlement(reservation)).toBe(true);
        const state = f.store.getSchedulerContainer(executionId)!;
        expect(state.status).toBe('removal_confirmed');
        await confirmAbsent(state.containerId!);
        expect(
          f.store.finishSchedulerExecution({
            ...execution,
            status: mode === 'success' ? 'completed' : 'cancelled',
            result: null,
          }).status,
        ).toBe(mode === 'success' ? 'completed' : 'cancelled');
        settled = true;
      } finally {
        if (!settled) {
          await launcher.cancel(reservation).catch(() => undefined);
          await observed;
          settled = await launcher.waitForSettlement(reservation);
        }
        f.store.close();
        // Retain journal and mounts for recovery on uncertainty; never discard its evidence.
        if (settled) {
          if (stagingRoot !== undefined) await rm(stagingRoot, { recursive: true, force: true });
          await rm(f.root, { recursive: true, force: true });
        }
      }
    },
    60000,
  );
});
