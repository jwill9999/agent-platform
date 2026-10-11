import Database from 'better-sqlite3';
import { documentFixture } from './documentFixture.js';
import { executionContractSchema } from '../src/contracts.js';
import { WorkflowStore } from '../src/storage.js';
import { deriveContractMaterialDigest } from '../src/planning.js';
import { WorkflowOrchestrator } from '../src/orchestrator.js';
import { ContentAddressedArtifactStore, JournaledArtifactRecorder } from '../src/artifacts.js';
import { LocalExactHeadIntegrationGate } from '../src/integrationGate.js';
import {
  OfficialBeadsDoltPort,
  JournaledBeadsDoltBroker,
  JournaledBeadsTaskCloser,
} from '../src/reconciliation.js';
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  DockerIsolatedSpecialistLauncher,
  RevocableSpecialistCredentialBroker,
} from '../src/specialistLauncher.js';
import { taskPacketSchema } from '../src/contracts.js';
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
      `#!/usr/bin/env node
const fs = require('node:fs');
const crypto = require('node:crypto');
const root = '/run/approved-documents';
const binding = JSON.parse(fs.readFileSync(root + '/binding.json', 'utf8'));
for (const file of binding.manifest.files) {
  const path = root + '/documents/' + file.path;
  const bytes = fs.readFileSync(path);
  if (bytes.length !== file.sizeBytes || 'sha256:' + crypto.createHash('sha256').update(bytes).digest('hex') !== file.digest) process.exit(20);
  try { fs.writeFileSync(path, 'tampered'); process.exit(21); } catch (error) {
    if (!['EROFS', 'EACCES', 'EPERM'].includes(error.code)) throw error;
  }
}
if(fs.readFileSync('/workspace/probe.txt', 'utf8') === 'wait') setInterval(() => {}, 1000);
else process.stdout.write(JSON.stringify({type:'offline_active_probe'}) + '\\n');
`,
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

  it.each(['fixture-spec.md', 'fixture-tests.md'])(
    'runs public publication/approval/coordinator/launcher/result/restart and rejects changed %s',
    async (changedPath) => {
      const root = await mkdtemp(join(tmpdir(), 'document-workflow-'));
      const sourceRoot = join(root, 'source');
      await mkdir(sourceRoot);
      await writeFile(join(sourceRoot, 'probe.txt'), 'success');
      const contract = executionContractSchema.parse(
        JSON.parse(
          await readFile(
            new URL('./fixtures/documentBindingLegacyContract.json', import.meta.url),
            'utf8',
          ),
        ),
      );
      contract.tasks = [
        {
          id: 'task',
          dependsOn: [],
          risk: 'standard',
          assignedRole: 'code_reviewer',
          branchParent: 'feature/test',
          allowedPaths: ['probe.txt'],
          allowedOperations: ['workspace.read'],
        },
      ];
      contract.constraints.allowedPaths = ['probe.txt'];
      contract.authority.allowedActions = ['workspace.read', 'beads.mutate'];
      const publish = await documentFixture(contract, root, sourceRoot);
      const databasePath = join(root, 'workflow.sqlite');
      let store = new WorkflowStore(databasePath);
      let revoked = false;
      let issued = 0;
      let claims = 0;
      let taskStatus: 'open' | 'in_progress' = 'open';
      const artifacts = new ContentAddressedArtifactStore(join(root, 'artifacts'));
      const createCoordinator = () => {
        const port = OfficialBeadsDoltPort.createForTest(sourceRoot, {
          async readIssue() {
            return { status: taskStatus, blockingDependencies: [] };
          },
          async claimIssue() {
            claims++;
            taskStatus = 'in_progress';
          },
          async closeIssue() {
            throw new Error('unexpected close');
          },
          async readDoltSync() {
            return 'synced';
          },
          async pushDolt() {
            throw new Error('unexpected push');
          },
        });
        const broker = RevocableSpecialistCredentialBroker.createForTest({
          store,
          async issue(root, _id, leaseId, generation) {
            issued++;
            revoked = false;
            const authFile = join(root, 'fixture-auth.json');
            await writeFile(authFile, '{}');
            return { authFile, leaseId, generation };
          },
          async revoke() {
            revoked = true;
          },
          async observe() {
            return revoked ? 'revoked' : 'active';
          },
          async conformance() {
            return 'offline-fixture';
          },
        });
        const launcher = DockerIsolatedSpecialistLauncher.create({
          store,
          ownerId: 'owner',
          sourceRoot,
          image: imageId!,
          credentialBroker: broker,
          egressNetwork: 'none',
          containerUser: `${process.getuid!()}:${process.getgid!()}`,
        });
        return new WorkflowOrchestrator({
          store,
          contract,
          ownerId: 'owner',
          launcher,
          closer: new JournaledBeadsTaskCloser(
            JournaledBeadsDoltBroker.createForTest(store, port),
            port,
          ),
          integrationGate: LocalExactHeadIntegrationGate.create({
            workspaceRoot: sourceRoot,
            artifacts: new JournaledArtifactRecorder(artifacts, store),
            checkCommands: {},
          }),
        });
      };
      try {
        // Synthetic initial scheduling state and identities, real publication and approval APIs.
        store.createRun(store.createContract(contract), 'scheduling', 'run');
        publish(store, 'run');
        const storedEvidence = await new JournaledArtifactRecorder(artifacts, store).record(
          Buffer.from('fixture planning evidence'),
          {
            mediaType: 'text/plain',
            kind: 'review',
            producer: 'fixture-critic',
            producerRole: 'plan_critic',
            workspaceId: contract.workspaceId,
            runId: 'run',
            contractVersion: 1,
            policyDigest: contract.policyDigest,
          },
        );
        const evidence = {
          digest: storedEvidence.digest,
          sizeBytes: storedEvidence.sizeBytes,
          kind: 'review' as const,
          mediaType: 'text/plain',
        };
        store.recordCriticReview({
          reviewId: 'review',
          runId: 'run',
          plannerId: 'fixture-planner',
          criticId: 'fixture-critic',
          contractVersion: 1,
          policyDigest: contract.policyDigest,
          materialDigest: deriveContractMaterialDigest(contract),
          verdict: 'approved',
          summary: 'fixture reviewed exact documents',
          evidence: [evidence],
          findings: [],
          humanDecision: null,
        });
        store.createPlanApproval({
          approvalId: 'owner-approval',
          runId: 'run',
          approverId: 'fixture-owner',
          contract,
          evidence: [evidence],
        });
        const workspaceLeaseEpoch = store.acquireLease(
          'workspace',
          contract.workspaceId,
          'owner',
          120000,
        ).epoch;
        const runLeaseEpoch = store.acquireLease('run', 'run', 'owner', 120000).epoch;
        let coordinator = createCoordinator();
        const packet = coordinator.createTaskPacket({
          runId: 'run',
          taskId: 'task',
          evidence: [evidence],
        });
        const result = await coordinator.launchTask({
          packet,
          workspaceLeaseEpoch,
          runLeaseEpoch,
          claimTransitionId: 'claim',
          deadlineMs: Date.now() + 30000,
        });
        expect(result).toMatchObject({ events: [{ type: 'offline_active_probe' }] });
        expect(issued).toBe(1);
        expect(claims).toBe(1);
        expect(revoked).toBe(true);
        const raw = new Database(databasePath);
        const execution = raw
          .prepare('SELECT id,status,credential_status FROM scheduler_executions')
          .get() as { id: string; status: string; credential_status: string };
        expect(execution).toMatchObject({ status: 'completed', credential_status: 'revoked' });
        const container = store.getSchedulerContainer(execution.id)!;
        expect(container.status).toBe('removal_confirmed');
        await confirmAbsent(container.containerId!);
        raw.close();
        const retained = await new JournaledArtifactRecorder(artifacts, store).record(
          Buffer.from(JSON.stringify(result)),
          {
            mediaType: 'application/json',
            kind: 'test',
            producer: 'offline-consumer',
            producerRole: 'test_runner',
            workspaceId: contract.workspaceId,
            runId: 'run',
            taskId: 'task',
            contractVersion: 1,
            policyDigest: contract.policyDigest,
          },
        );
        store.close();
        store = new WorkflowStore(databasePath);
        coordinator = createCoordinator();
        expect(
          coordinator.createTaskPacket({ runId: 'run', taskId: 'task', evidence: [evidence] })
            .documentBinding,
        ).toEqual(packet.documentBinding);
        expect(JSON.parse((await artifacts.get(retained.digest)).toString())).toEqual(result);
        await writeFile(join(sourceRoot, changedPath), 'changed after restart');
        await expect(
          coordinator.launchTask({
            packet,
            workspaceLeaseEpoch,
            runLeaseEpoch,
            claimTransitionId: 'replay',
            deadlineMs: Date.now() + 30000,
          }),
        ).rejects.toThrow('planning_documents_changed');
        expect(issued).toBe(1);
        expect(claims).toBe(1);
        expect(store.getSchedulerExecution(execution.id)?.status).toBe('completed');
      } finally {
        store.close();
        await rm(root, { recursive: true, force: true });
      }
    },
    65000,
  );

  it.each(['success', 'cancel'])(
    'confirms durable %s settlement and independent daemon absence',
    async (mode) => {
      const f = await continuationFixture();
      const executionId = randomUUID();
      const original = f.store.getSchedulerExecution('child')!;
      const deadlineMs = Date.now() + 30000;
      const sourceRoot = join(f.root, 'source');
      await mkdir(sourceRoot, { recursive: true });
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
      const packet = taskPacketSchema.parse({
        documentBinding: f.store.verifyPlanningDocuments({
          runId: 'run',
          taskId: 'task',
          ownerId: 'owner',
          runLeaseEpoch: original.runLeaseEpoch,
          boundary: 'fixture.packet',
        }),
        runId: 'run',
        taskId: 'task',
        contractVersion: 1,
        policyDigest: `sha256:${'a'.repeat(64)}`,
        assignedRole: 'code_reviewer',
        objective: 'offline fixture',
        acceptanceCriteria: ['settled'],
        allowedPaths: ['probe.txt'],
        allowedOperations: ['workspace.read'],
        retryBudget: {
          implementationAttempts: 1,
          findingAttempts: 1,
          infrastructureAttempts: 1,
          waitDeadlineSeconds: 60,
        },
        evidence: [],
      });
      const execution = f.store.createSchedulerExecution({
        ...original,
        packet,
        id: executionId,
        processIdentity: `docker:workflow-specialist-${executionId}`,
        credentialLeaseId: `specialist:${executionId}`,
        deadlineMs,
      });
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
