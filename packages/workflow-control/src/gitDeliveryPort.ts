import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';

import type { ExternalObservation } from './reconciliation.js';
import { registerProductionDeliveryPort } from './deliveryPortCapability.js';
import type {
  DeliveryMutationPort,
  DeliveryRequest,
  ProductionDeliveryMutationPort,
} from './deliveryBrokers.js';
import type { GitHubDeliveryPort } from './githubDeliveryPort.js';

type GitDeliveryRequest = Extract<DeliveryRequest, { kind: `git.${string}` }>;

export interface BrokeredRemoteRefClient {
  observeRef(input: {
    workspaceRoot: string;
    repository: string;
    remoteName: string;
    ref: string;
  }): Promise<string | null>;
  pushCas(input: {
    workspaceRoot: string;
    repository: string;
    remoteName: string;
    ref: string;
    expectedOldSha: string | null;
    newSha: string;
  }): Promise<void>;
}

function sameSet(actual: readonly string[], expected: readonly string[]): boolean {
  return (
    actual.length === expected.length &&
    [...actual].sort().every((value, index) => value === [...expected].sort()[index])
  );
}

function parseChangedPaths(output: Buffer): string[] {
  const tokens = output.toString('utf8').split('\0');
  if (tokens.at(-1) === '') tokens.pop();
  const paths: string[] = [];
  for (let index = 0; index < tokens.length; ) {
    const status = tokens[index++];
    if (status === undefined || !/^(?:[ACDMRTUXB]|[RC]\d{1,3})$/u.test(status)) {
      throw new Error('Git returned malformed name-status output');
    }
    const count = status.startsWith('R') || status.startsWith('C') ? 2 : 1;
    for (let pathIndex = 0; pathIndex < count; pathIndex += 1) {
      const path = tokens[index++];
      if (
        path === undefined ||
        path === '' ||
        path.startsWith('/') ||
        path.split('/').includes('..')
      ) {
        throw new Error('Git returned an invalid changed path');
      }
      paths.push(path);
    }
  }
  if (new Set(paths).size !== paths.length) throw new Error('Git returned duplicate changed paths');
  return paths;
}

export class LocalGitDeliveryPort implements DeliveryMutationPort {
  readonly #workspaceRoot: string;
  readonly #remoteName: string;
  readonly #observeRemoteRef: BrokeredRemoteRefClient['observeRef'];
  readonly #pushRemoteRef: BrokeredRemoteRefClient['pushCas'];
  readonly #gitBinary: string;
  readonly #gitCommonDir: string;

  private constructor(input: {
    workspaceRoot: string;
    remoteName: string;
    remote: BrokeredRemoteRefClient;
    gitBinary?: string;
  }) {
    this.#workspaceRoot = realpathSync(input.workspaceRoot);
    this.#remoteName = input.remoteName;
    this.#observeRemoteRef = input.remote.observeRef.bind(input.remote);
    this.#pushRemoteRef = input.remote.pushCas.bind(input.remote);
    this.#gitBinary = input.gitBinary ?? (process.platform === 'win32' ? 'git' : '/usr/bin/git');
    const topLevel = realpathSync(this.#git(['rev-parse', '--show-toplevel']).trim());
    if (topLevel !== this.#workspaceRoot) {
      throw new Error('Git delivery workspace is not the canonical repository top-level');
    }
    const commonDir = this.#git(['rev-parse', '--git-common-dir']).trim();
    this.#gitCommonDir = isAbsolute(commonDir)
      ? realpathSync(commonDir)
      : realpathSync(resolve(this.#workspaceRoot, commonDir));
  }

  static create(input: {
    workspaceRoot: string;
    remoteName: string;
    remote: BrokeredRemoteRefClient;
  }): LocalGitDeliveryPort {
    return new LocalGitDeliveryPort(input);
  }

  static createForTest(input: {
    workspaceRoot: string;
    remoteName: string;
    remote: BrokeredRemoteRefClient;
    gitBinary?: string;
  }): LocalGitDeliveryPort {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('test Git delivery configuration is unavailable outside the test runtime');
    }
    return new LocalGitDeliveryPort(input);
  }

  get workspaceRoot(): string {
    return this.#workspaceRoot;
  }

  readLocalTaskRef(ref: string): string | null {
    if (!/^refs\/heads\/task\/[A-Za-z0-9._-]+$/u.test(ref)) {
      throw new Error('repair-child ref is not a task ref');
    }
    return this.#readRef(ref);
  }

  createLocalTaskRefCas(ref: string, expectedOldSha: null, newSha: string): unknown {
    if (
      expectedOldSha !== null ||
      !/^refs\/heads\/task\/[A-Za-z0-9._-]+$/u.test(ref) ||
      !/^[a-f0-9]{40}$/u.test(newSha)
    ) {
      throw new Error('repair-child ref creation is not a create-only task-ref CAS');
    }
    this.#git(['update-ref', ref, newSha, '0'.repeat(40)]);
    return { ref, sha: newSha };
  }

  async observe(request: DeliveryRequest): Promise<ExternalObservation> {
    this.#assertNoReplacementMetadata();
    if (!request.kind.startsWith('git.'))
      throw new Error('local Git port received a GitHub request');
    const gitRequest = request as GitDeliveryRequest;
    if (gitRequest.kind === 'git.push') {
      this.#assertSafeLocalConfig();
      const remoteSha = await this.#observeRemoteRef({
        workspaceRoot: this.#workspaceRoot,
        repository: gitRequest.repository,
        remoteName: this.#remoteName,
        ref: gitRequest.ref,
      });
      if (remoteSha === gitRequest.newSha) {
        return { kind: 'expected', result: { ref: gitRequest.ref, sha: remoteSha } };
      }
      if (remoteSha === gitRequest.expectedRemoteSha) {
        return { kind: 'unchanged', result: { ref: gitRequest.ref, sha: remoteSha } };
      }
      return { kind: 'conflict', result: { ref: gitRequest.ref, sha: remoteSha } };
    }
    const refSha = this.#readRef(gitRequest.ref);
    if (gitRequest.kind === 'git.create_ref') {
      if (refSha === gitRequest.parentSha) {
        return { kind: 'expected', result: { ref: gitRequest.ref, sha: refSha } };
      }
      return refSha === null
        ? { kind: 'unchanged', result: { ref: gitRequest.ref, sha: null } }
        : { kind: 'conflict', result: { ref: gitRequest.ref, sha: refSha } };
    }
    if (refSha === gitRequest.parentSha) {
      return { kind: 'unchanged', result: { ref: gitRequest.ref, sha: refSha } };
    }
    if (refSha === null) {
      return { kind: 'conflict', result: { ref: gitRequest.ref, sha: null } };
    }
    try {
      this.#assertExactCommit(gitRequest, refSha);
      return { kind: 'expected', result: { ref: gitRequest.ref, sha: refSha } };
    } catch (error) {
      return {
        kind: 'conflict',
        result: { ref: gitRequest.ref, sha: refSha, reason: String(error) },
      };
    }
  }

  async mutate(request: DeliveryRequest): Promise<unknown> {
    this.#assertNoReplacementMetadata();
    if (!request.kind.startsWith('git.'))
      throw new Error('local Git port received a GitHub request');
    const gitRequest = request as GitDeliveryRequest;
    if (gitRequest.kind === 'git.create_ref') {
      this.#git(['update-ref', gitRequest.ref, gitRequest.parentSha, '0'.repeat(40)]);
      return { ref: gitRequest.ref, sha: gitRequest.parentSha };
    }
    if (gitRequest.kind === 'git.push') {
      const localSha = this.#readRef(gitRequest.ref);
      if (localSha !== gitRequest.newSha) throw new Error('local task ref changed before CAS push');
      if (gitRequest.expectedRemoteSha !== null) {
        this.#git(['merge-base', '--is-ancestor', gitRequest.expectedRemoteSha, gitRequest.newSha]);
      }
      await this.#pushRemoteRef({
        workspaceRoot: this.#workspaceRoot,
        repository: gitRequest.repository,
        remoteName: this.#remoteName,
        ref: gitRequest.ref,
        expectedOldSha: gitRequest.expectedRemoteSha,
        newSha: gitRequest.newSha,
      });
      return { ref: gitRequest.ref, sha: gitRequest.newSha };
    }
    return this.#createExactCommit(gitRequest);
  }

  #createExactCommit(request: Extract<GitDeliveryRequest, { kind: 'git.commit' }>): unknown {
    if (this.#readRef(request.ref) !== request.parentSha) {
      throw new Error('task ref changed before exact-tree commit');
    }
    this.#assertSafeLocalConfig();
    this.#assertNoActiveFilters();
    const temporaryRoot = mkdtempSync(join(tmpdir(), 'workflow-git-index-'));
    try {
      const indexFile = join(temporaryRoot, 'index');
      const indexEnvironment = { GIT_INDEX_FILE: indexFile };
      this.#git(['read-tree', request.parentSha], indexEnvironment);
      this.#git(['add', '-A', '--', '.'], indexEnvironment);
      const treeSha = this.#git(['write-tree'], indexEnvironment).trim();
      if (treeSha !== request.treeSha) throw new Error('workspace tree differs from approved tree');
      this.#assertTreeSafety(treeSha, request.changedFiles);
      this.#assertDiff(request.parentSha, treeSha, request.diffDigest, request.changedFiles);
      const identityEnvironment = {
        GIT_AUTHOR_NAME: request.authorName,
        GIT_AUTHOR_EMAIL: request.authorEmail,
        GIT_AUTHOR_DATE: `${request.authoredAtUnix} +0000`,
        GIT_COMMITTER_NAME: request.authorName,
        GIT_COMMITTER_EMAIL: request.authorEmail,
        GIT_COMMITTER_DATE: `${request.authoredAtUnix} +0000`,
      };
      const commitSha = this.#git(
        ['commit-tree', treeSha, '-p', request.parentSha],
        identityEnvironment,
        `${request.message}\n`,
      ).trim();
      this.#git(['update-ref', request.ref, commitSha, request.parentSha]);
      this.#assertExactCommit(request, commitSha);
      return { ref: request.ref, sha: commitSha, treeSha };
    } finally {
      rmSync(temporaryRoot, { recursive: true, force: true });
    }
  }

  #assertExactCommit(
    request: Extract<GitDeliveryRequest, { kind: 'git.commit' }>,
    commitSha: string,
  ): void {
    const format = '%T%x00%P%x00%an%x00%ae%x00%at%x00%B';
    const fields = this.#git(['show', '-s', `--format=${format}`, commitSha]).split('\0');
    if (
      fields[0] !== request.treeSha ||
      fields[1] !== request.parentSha ||
      fields[2] !== request.authorName ||
      fields[3] !== request.authorEmail ||
      fields[4] !== String(request.authoredAtUnix) ||
      fields.slice(5).join('\0').trimEnd() !== request.message
    ) {
      throw new Error('task ref does not contain the approved exact commit');
    }
    this.#assertTreeSafety(request.treeSha, request.changedFiles);
    this.#assertDiff(request.parentSha, request.treeSha, request.diffDigest, request.changedFiles);
  }

  #assertTreeSafety(treeSha: string, changedFiles: readonly string[]): void {
    const modes = this.#git(['ls-tree', '-r', treeSha]);
    if (modes.split('\n').some((line) => line.startsWith('160000 '))) {
      throw new Error('exact tree contains a submodule gitlink');
    }
    for (const path of changedFiles) {
      const filter = this.#git(['check-attr', 'filter', '--', path]).trim();
      if (!filter.endsWith(': unspecified') && !filter.endsWith(': unset')) {
        throw new Error(`Git filter is not allowed for changed path ${path}`);
      }
    }
  }

  #assertSafeLocalConfig(): void {
    try {
      const unsafe = this.#git([
        'config',
        '--local',
        '--name-only',
        '--get-regexp',
        '^(filter\\.|core\\.(hooksPath|sshCommand|fsmonitor)|url\\.|credential\\.|http\\.)',
      ]).trim();
      if (unsafe !== '') throw new Error(`unsafe local Git config is denied: ${unsafe}`);
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'status' in error &&
        (error as { status?: number }).status === 1
      ) {
        return;
      }
      throw error;
    }
  }

  #assertNoActiveFilters(): void {
    const paths = this.#gitBuffer(['ls-files', '-z', '--cached', '--others', '--exclude-standard'])
      .toString('utf8')
      .split('\0')
      .filter((path) => path !== '');
    for (const path of paths) {
      const filter = this.#git(['check-attr', 'filter', '--', path]).trim();
      if (!filter.endsWith(': unspecified') && !filter.endsWith(': unset')) {
        throw new Error(`Git filter is not allowed for workspace path ${path}`);
      }
    }
  }

  #assertNoReplacementMetadata(): void {
    const replacements = this.#git(['for-each-ref', '--format=%(refname)', 'refs/replace']).trim();
    if (replacements !== '') throw new Error('Git replacement refs are denied');
    const grafts = join(this.#gitCommonDir, 'info', 'grafts');
    if (existsSync(grafts) && readFileSync(grafts).toString('utf8').trim() !== '') {
      throw new Error('Git graft metadata is denied');
    }
  }

  #assertDiff(
    parentSha: string,
    treeSha: string,
    expectedDigest: string,
    expectedPaths: readonly string[],
  ): void {
    const raw = this.#gitBuffer([
      'diff-tree',
      '--no-commit-id',
      '--name-status',
      '-z',
      '-r',
      '--find-renames',
      '--find-copies',
      parentSha,
      treeSha,
    ]);
    const digest = `sha256:${createHash('sha256').update(raw).digest('hex')}`;
    if (digest !== expectedDigest) throw new Error('exact tree diff digest changed');
    const paths = parseChangedPaths(raw);
    if (!sameSet(paths, expectedPaths)) throw new Error('exact tree changed path set differs');
  }

  #readRef(ref: string): string | null {
    try {
      this.#git(['show-ref', '--verify', '--quiet', ref]);
      return this.#git(['rev-parse', '--verify', `${ref}^{commit}`]).trim();
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'status' in error &&
        (error as { status?: number }).status === 1
      ) {
        return null;
      }
      throw error;
    }
  }

  #git(args: readonly string[], extraEnvironment: NodeJS.ProcessEnv = {}, input?: string): string {
    return this.#gitBuffer(args, extraEnvironment, input).toString('utf8');
  }

  #gitBuffer(
    args: readonly string[],
    extraEnvironment: NodeJS.ProcessEnv = {},
    input?: string,
  ): Buffer {
    return execFileSync(
      this.#gitBinary,
      [
        '--no-replace-objects',
        '-c',
        'core.hooksPath=/dev/null',
        '-c',
        'commit.gpgSign=false',
        '-c',
        'tag.gpgSign=false',
        '-c',
        'credential.helper=',
        '-c',
        'core.attributesFile=/dev/null',
        ...args,
      ],
      {
        cwd: this.#workspaceRoot,
        env: {
          PATH: process.env.PATH,
          LANG: 'C',
          LC_ALL: 'C',
          GIT_CONFIG_NOSYSTEM: '1',
          GIT_NO_REPLACE_OBJECTS: '1',
          GIT_CONFIG_GLOBAL: '/dev/null',
          GIT_TERMINAL_PROMPT: '0',
          GIT_ASKPASS: '/usr/bin/false',
          GIT_SSH_COMMAND: '/usr/bin/false',
          ...extraEnvironment,
        },
        input,
        timeout: 5000,
        maxBuffer: 1024 * 1024,
        stdio: ['pipe', 'pipe', 'pipe'],
      },
    );
  }
}

export class CompositeDeliveryMutationPort implements ProductionDeliveryMutationPort {
  readonly workspaceRoot: string;
  readonly repository: string;
  readonly observe: (request: DeliveryRequest) => Promise<ExternalObservation>;
  readonly mutate: (request: DeliveryRequest) => Promise<unknown>;

  private constructor(git: LocalGitDeliveryPort, github: GitHubDeliveryPort) {
    this.workspaceRoot = git.workspaceRoot;
    this.repository = github.repository;
    const observeGit = git.observe.bind(git);
    const mutateGit = git.mutate.bind(git);
    const observeGitHub = github.observe.bind(github);
    const mutateGitHub = github.mutate.bind(github);
    this.observe = (request) =>
      request.kind.startsWith('git.') ? observeGit(request) : observeGitHub(request);
    this.mutate = (request) =>
      request.kind.startsWith('git.') ? mutateGit(request) : mutateGitHub(request);
  }

  static create(
    git: LocalGitDeliveryPort,
    github: GitHubDeliveryPort,
  ): CompositeDeliveryMutationPort {
    return registerProductionDeliveryPort(new CompositeDeliveryMutationPort(git, github));
  }
}
