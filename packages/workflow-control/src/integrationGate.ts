import { executeCoordinatorProcess } from './coordinatorProcess.js';
import { TrustedSourceGit } from './sourceGit.js';
import { execFile } from 'node:child_process';
import { realpath } from 'node:fs/promises';
import { promisify } from 'node:util';

import { JournaledArtifactRecorder } from './artifacts.js';
import type { EvidenceReference, ExecutionContract } from './contracts.js';

export type GateCommandExecutor = (
  executable: string,
  args: readonly string[],
  options: { cwd: string; timeout: number; maxBuffer: number },
) => Promise<{ stdout: string; stderr: string }>;

const defaultExecutor: GateCommandExecutor = async (executable, args, options) => {
  const result = await promisify(execFile)(executable, [...args], options);
  return { stdout: result.stdout, stderr: result.stderr };
};

export interface VerifiedIntegrationGate {
  headSha: string;
  baseSha: string;
  passedChecks: string[];
  changedFiles: string[];
  evidence: EvidenceReference[];
}

export class LocalExactHeadIntegrationGate {
  readonly #workspaceRoot: string;
  readonly #artifacts: JournaledArtifactRecorder;
  readonly #checkCommands: Readonly<Record<string, readonly [string, ...string[]]>>;
  readonly #executor: GateCommandExecutor;
  readonly #approvedParentShas?: Readonly<Record<string, string>>;

  private constructor(input: {
    workspaceRoot: string;
    approvedParentShas?: Readonly<Record<string, string>>;
    artifacts: JournaledArtifactRecorder;
    checkCommands: Readonly<Record<string, readonly [string, ...string[]]>>;
    executor?: GateCommandExecutor;
    gitPin?: { path: string; digest: string };
    admission?: { assertAuthority: () => void; signal: AbortSignal };
  }) {
    if (!(input.artifacts instanceof JournaledArtifactRecorder)) {
      throw new Error('exact-head gate requires the journaled artifact recorder');
    }
    this.#workspaceRoot = input.workspaceRoot;
    this.#approvedParentShas = input.approvedParentShas;
    this.#artifacts = input.artifacts;
    this.#checkCommands = input.checkCommands;
    const trustedGit = input.gitPin
      ? new TrustedSourceGit(input.workspaceRoot, input.gitPin.path, input.gitPin.digest)
      : undefined;
    this.#executor =
      input.executor ??
      (async (executable, args, options) => {
        input.admission?.assertAuthority();
        if (input.admission?.signal.aborted) throw new Error('coordinator_service_stopped');
        if (executable === 'git' && trustedGit) {
          trustedGit.assertSafeIndex();
          return { stdout: trustedGit.run([...args]).toString('utf8'), stderr: '' };
        }
        if (input.admission) {
          const result = await executeCoordinatorProcess({
            executable,
            args,
            ...options,
            env: { PATH: process.env.PATH },
            signal: input.admission.signal,
          });
          input.admission.assertAuthority();
          return result;
        }
        return defaultExecutor(executable, args, options);
      });
  }

  static create(input: {
    gitPin?: { path: string; digest: string };
    admission?: { assertAuthority: () => void; signal: AbortSignal };
    workspaceRoot: string;
    approvedParentShas?: Readonly<Record<string, string>>;
    artifacts: JournaledArtifactRecorder;
    checkCommands: Readonly<Record<string, readonly [string, ...string[]]>>;
  }): LocalExactHeadIntegrationGate {
    return new LocalExactHeadIntegrationGate(input);
  }

  static createForTest(input: {
    workspaceRoot: string;
    approvedParentShas?: Readonly<Record<string, string>>;
    artifacts: JournaledArtifactRecorder;
    checkCommands: Readonly<Record<string, readonly [string, ...string[]]>>;
    executor: GateCommandExecutor;
  }): LocalExactHeadIntegrationGate {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('test integration-gate executor is unavailable outside the test runtime');
    }
    return new LocalExactHeadIntegrationGate(input);
  }

  async verify(input: {
    contract: ExecutionContract;
    runId: string;
    taskId: string;
  }): Promise<VerifiedIntegrationGate> {
    const workspaceRoot = await realpath(this.#workspaceRoot);
    await this.#assertCleanWorkspace(workspaceRoot);
    const head = await this.#executor('git', ['rev-parse', 'HEAD'], {
      cwd: workspaceRoot,
      timeout: 10_000,
      maxBuffer: 64 * 1024,
    });
    const headSha = head.stdout.trim();
    if (!/^[a-f0-9]{40,64}$/u.test(headSha)) throw new Error('Git returned an invalid head SHA');
    const task = input.contract.tasks.find((candidate) => candidate.id === input.taskId);
    if (task === undefined) throw new Error('integration gate task is outside the contract');
    const parent = await this.#executor('git', ['rev-parse', task.branchParent], {
      cwd: workspaceRoot,
      timeout: 10_000,
      maxBuffer: 64 * 1024,
    });
    const baseSha = parent.stdout.trim();
    if (this.#approvedParentShas && this.#approvedParentShas[input.taskId] !== baseSha)
      throw new Error('integration parent differs from approved SHA');
    if (!/^[a-f0-9]{40,64}$/u.test(baseSha)) {
      throw new Error('Git returned an invalid branch-parent SHA');
    }
    await this.#executor('git', ['merge-base', '--is-ancestor', baseSha, headSha], {
      cwd: workspaceRoot,
      timeout: 10_000,
      maxBuffer: 64 * 1024,
    });
    const diff = await this.#executor(
      'git',
      ['diff', '--name-only', '-z', `${baseSha}...${headSha}`],
      {
        cwd: workspaceRoot,
        timeout: 10_000,
        maxBuffer: 1024 * 1024,
      },
    );
    const changedFiles = diff.stdout.split('\0').filter((path) => path !== '');
    const requiredChecks = [
      ...new Set([
        ...input.contract.qualityGates,
        ...input.contract.authority.github.requiredChecks,
      ]),
    ];
    const evidence: EvidenceReference[] = [];
    for (const check of requiredChecks) {
      const command = this.#checkCommands[check];
      if (command === undefined)
        throw new Error(`no trusted command is configured for check ${check}`);
      const [executable, ...args] = command;
      const result = await this.#executor(executable, args, {
        cwd: workspaceRoot,
        timeout: 30 * 60 * 1000,
        maxBuffer: 4 * 1024 * 1024,
      });
      const body = JSON.stringify({
        check,
        baseSha,
        headSha,
        stdout: result.stdout,
        stderr: result.stderr,
      });
      const artifact = await this.#artifacts.record(Buffer.from(body), {
        mediaType: 'application/json',
        kind: 'test' as const,
        producer: 'local-exact-head-integration-gate',
        producerRole: 'test_runner',
        workspaceId: input.contract.workspaceId,
        runId: input.runId,
        taskId: input.taskId,
        contractVersion: input.contract.contractVersion,
        policyDigest: input.contract.policyDigest,
        headSha,
      });
      const reference = {
        digest: artifact.digest,
        mediaType: 'application/json',
        sizeBytes: artifact.sizeBytes,
        kind: 'test' as const,
      } satisfies EvidenceReference;
      evidence.push(reference);
    }
    const finalHead = await this.#executor('git', ['rev-parse', 'HEAD'], {
      cwd: workspaceRoot,
      timeout: 10_000,
      maxBuffer: 64 * 1024,
    });
    if (finalHead.stdout.trim() !== headSha) {
      throw new Error('Git head changed while integration checks were running');
    }
    await this.#assertCleanWorkspace(workspaceRoot);
    return { headSha, baseSha, passedChecks: requiredChecks, changedFiles, evidence };
  }

  async #assertCleanWorkspace(workspaceRoot: string): Promise<void> {
    const status = await this.#executor(
      'git',
      ['status', '--porcelain=v1', '--untracked-files=all'],
      {
        cwd: workspaceRoot,
        timeout: 10_000,
        maxBuffer: 1024 * 1024,
      },
    );
    if (status.stdout.trim() !== '') {
      throw new Error('integration gate requires a clean Git index and worktree');
    }
  }
}
