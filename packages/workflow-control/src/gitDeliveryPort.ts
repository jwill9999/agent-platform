import type { DeliveryDocumentSource } from './documentApproval.js';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';

import type { ExternalObservation } from './reconciliation.js';
import { registerProductionDeliveryPort } from './deliveryPortCapability.js';
import { assertBootstrapCandidate, type BootstrapPolicy } from './bootstrapPolicy.js';
import type {
  DeliveryMutationPort,
  DeliveryRequest,
  ProductionDeliveryMutationPort,
} from './deliveryBrokers.js';
import type { GitHubDeliveryPort } from './githubDeliveryPort.js';

type GitDeliveryRequest = Extract<DeliveryRequest, { kind: `git.${string}` }>;
const bootstrapGitCapability = Symbol('bootstrapGitCapability');

function compareCodeUnits(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

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
  const sortedActual = [...actual].sort((left, right) => left.localeCompare(right));
  const sortedExpected = [...expected].sort((left, right) => left.localeCompare(right));
  return (
    actual.length === expected.length &&
    sortedActual.every((value, index) => value === sortedExpected[index])
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
  readonly #sourceRoot: string;
  readonly #documents: (DeliveryDocumentSource & { assertDispatch?: () => void }) | undefined;
  readonly #bootstrap:
    | {
        policy: BootstrapPolicy;
        assertAuthority: () => void;
        withMutation: <T>(operation: () => T) => T;
      }
    | undefined;
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
    documents?: DeliveryDocumentSource & { assertDispatch?: () => void };
    bootstrap?: {
      policy: BootstrapPolicy;
      assertAuthority: () => void;
      withMutation: <T>(operation: () => T) => T;
    };
  }) {
    this.#workspaceRoot = realpathSync(input.workspaceRoot);
    this.#bootstrap = input.bootstrap;
    this.#documents = input.documents;
    this.#sourceRoot =
      input.documents?.sourceRoot ?? input.bootstrap?.policy.sourceRoot ?? this.#workspaceRoot;
    if (
      input.bootstrap &&
      input.documents &&
      realpathSync(input.bootstrap.policy.sourceRoot) !== this.#sourceRoot
    )
      throw new Error('bootstrap document source differs from approved policy');
    this.#remoteName = input.remoteName;
    this.#observeRemoteRef = input.remote.observeRef.bind(input.remote);
    this.#pushRemoteRef = input.remote.pushCas.bind(input.remote);
    this.#gitBinary = input.gitBinary ?? (process.platform === 'win32' ? 'git' : '/usr/bin/git');
    const topLevel = realpathSync(this.#git(['rev-parse', '--show-toplevel']).trim());
    if (topLevel !== this.#sourceRoot) {
      throw new Error('Git delivery workspace is not the canonical repository top-level');
    }
    const commonDir = this.#git(['rev-parse', '--git-common-dir']).trim();
    this.#gitCommonDir = isAbsolute(commonDir)
      ? realpathSync(commonDir)
      : realpathSync(resolve(this.#sourceRoot, commonDir));
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

  /** Internal bootstrap composition: no GitHub client or authority is introduced. */
  static createBootstrap(
    input: {
      policy: BootstrapPolicy;
      remote: BrokeredRemoteRefClient;
      assertAuthority: () => void;
      withMutation: <T>(operation: () => T) => T;
    },
    capability: symbol,
  ): ProductionDeliveryMutationPort {
    if (capability !== bootstrapGitCapability)
      throw new Error('bootstrap Git composition capability required');
    const git = new LocalGitDeliveryPort({
      workspaceRoot: input.policy.canonicalRoot,
      remoteName: input.policy.remoteName,
      remote: input.remote,
      bootstrap: {
        policy: input.policy,
        assertAuthority: input.assertAuthority,
        withMutation: input.withMutation,
      },
    });
    return registerProductionDeliveryPort({
      workspaceRoot: input.policy.canonicalRoot,
      repository: input.policy.repository,
      observe: git.observe.bind(git),
      mutate: git.mutate.bind(git),
    });
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

  #forDocuments(
    documents: DeliveryDocumentSource & { assertDispatch?: () => void },
  ): LocalGitDeliveryPort {
    const port = new LocalGitDeliveryPort({
      workspaceRoot: this.#workspaceRoot,
      remoteName: this.#remoteName,
      remote: { observeRef: this.#observeRemoteRef, pushCas: this.#pushRemoteRef },
      gitBinary: this.#gitBinary,
      bootstrap: this.#bootstrap,
      documents,
    });
    if (port.#gitCommonDir !== this.#gitCommonDir)
      throw new Error('delivery document source belongs to another repository');
    return port;
  }

  #assertDocumentTree(tree: string): void {
    for (const file of this.#documents?.manifest.files ?? []) {
      const mode = this.#git(['ls-tree', tree, '--', file.path]);
      if (!/^100(?:644|755) blob /u.test(mode))
        throw new Error('delivery tree document is missing or not a regular file');
      const bytes = this.#gitBuffer(['show', `${tree}:${file.path}`]);
      if (
        bytes.length !== file.sizeBytes ||
        `sha256:${createHash('sha256').update(bytes).digest('hex')}` !== file.digest
      )
        throw new Error('delivery tree differs from approved document bytes');
    }
  }

  async observe(
    request: DeliveryRequest,
    documents?: DeliveryDocumentSource,
  ): Promise<ExternalObservation> {
    if (documents) return this.#forDocuments(documents).observe(request);
    this.#assertBootstrap(request);
    this.#assertNoReplacementMetadata();
    if (!request.kind.startsWith('git.'))
      throw new Error('local Git port received a GitHub request');
    const gitRequest = request as GitDeliveryRequest;
    if (gitRequest.kind !== 'git.commit')
      this.#assertDocumentTree(
        gitRequest.kind === 'git.push' ? gitRequest.newSha : gitRequest.parentSha,
      );
    if (gitRequest.kind === 'git.push') return this.#observePush(gitRequest);
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

  async #observePush(
    request: Extract<GitDeliveryRequest, { kind: 'git.push' }>,
  ): Promise<ExternalObservation> {
    this.#assertSafeLocalConfig();
    const remoteSha = await this.#observeRemoteRef({
      workspaceRoot: this.#workspaceRoot,
      repository: request.repository,
      remoteName: this.#remoteName,
      ref: request.ref,
    });
    if (remoteSha === request.newSha) {
      return { kind: 'expected', result: { ref: request.ref, sha: remoteSha } };
    }
    if (remoteSha === request.expectedRemoteSha) {
      return { kind: 'unchanged', result: { ref: request.ref, sha: remoteSha } };
    }
    return { kind: 'conflict', result: { ref: request.ref, sha: remoteSha } };
  }

  async mutate(
    request: DeliveryRequest,
    _merge?: Parameters<DeliveryMutationPort['mutate']>[1],
    documents?: DeliveryDocumentSource & { assertDispatch: () => void },
  ): Promise<unknown> {
    if (documents) return this.#forDocuments(documents).mutate(request);
    this.#assertBootstrap(request);
    this.#assertNoReplacementMetadata();
    if (!request.kind.startsWith('git.'))
      throw new Error('local Git port received a GitHub request');
    const gitRequest = request as GitDeliveryRequest;
    if (gitRequest.kind !== 'git.commit')
      this.#assertDocumentTree(
        gitRequest.kind === 'git.push' ? gitRequest.newSha : gitRequest.parentSha,
      );
    if (gitRequest.kind === 'git.create_ref') {
      this.#documents?.assertDispatch?.();
      this.#git(['update-ref', gitRequest.ref, gitRequest.parentSha, '0'.repeat(40)]);
      return { ref: gitRequest.ref, sha: gitRequest.parentSha };
    }
    if (gitRequest.kind === 'git.push') {
      const localSha = this.#readRef(gitRequest.ref);
      if (localSha !== gitRequest.newSha) throw new Error('local task ref changed before CAS push');
      if (gitRequest.expectedRemoteSha !== null) {
        this.#git(['merge-base', '--is-ancestor', gitRequest.expectedRemoteSha, gitRequest.newSha]);
      }
      this.#documents?.assertDispatch?.();
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
    return this.#bootstrap === undefined
      ? this.#createExactCommitLocked(request)
      : this.#bootstrap.withMutation(() => this.#createExactCommitLocked(request));
  }

  #createExactCommitLocked(request: Extract<GitDeliveryRequest, { kind: 'git.commit' }>): unknown {
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
      this.#assertDocumentTree(treeSha);
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
      this.#assertBootstrap(request);
      this.#documents?.assertDispatch?.();
      const commitSha = this.#git(
        ['commit-tree', treeSha, '-p', request.parentSha],
        identityEnvironment,
        `${request.message}\n`,
      ).trim();
      this.#assertBootstrap(request);
      this.#documents?.assertDispatch?.();
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
    this.#assertDocumentTree(request.treeSha);
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
      ...(this.#bootstrap === undefined ? ['--find-renames', '--find-copies'] : ['--no-renames']),
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

  #assertBootstrap(request: DeliveryRequest): void {
    if (this.#bootstrap === undefined) return;
    const { policy, assertAuthority } = this.#bootstrap;
    assertAuthority();
    if (
      !['git.commit', 'git.push'].includes(request.kind) ||
      request.repository !== policy.repository ||
      !('ref' in request) ||
      request.ref !== policy.ref
    )
      throw new Error('bootstrap Git-only request rejected');
    if (
      request.kind === 'git.commit' &&
      (request.parentSha !== policy.initialHeadSha ||
        request.treeSha !== policy.treeSha ||
        request.diffDigest !== policy.diffDigest ||
        JSON.stringify([...request.changedFiles].sort(compareCodeUnits)) !==
          JSON.stringify(policy.manifest.map((item) => item.path)) ||
        request.authorName !== policy.author.name ||
        request.authorEmail !== policy.author.email ||
        request.authoredAtUnix !== policy.author.authoredAtUnix ||
        request.message !== policy.author.message)
    )
      throw new Error('bootstrap commit differs from approved policy');
    if (request.kind === 'git.push' && request.expectedRemoteSha !== policy.expectedRemoteSha)
      throw new Error('bootstrap push differs from approved remote precondition');
    const head = this.#readRef(policy.ref);
    if (head === null) throw new Error('bootstrap task ref is absent');
    if (request.kind === 'git.commit' && head !== policy.initialHeadSha)
      this.#assertExactCommit(request, head);
    if (request.kind === 'git.push' && head !== request.newSha)
      throw new Error('bootstrap push head changed');
    assertBootstrapCandidate(policy, head);
    // Authority may expire while candidate/Git/Beads observations block.
    // The supplied authority check ends with a fresh fence read.
    assertAuthority();
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
        cwd: this.#sourceRoot,
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

/** Package-internal construction; not exported from the public package index. */
export function createProductionBootstrapGitPort(input: {
  policy: BootstrapPolicy;
  remote: BrokeredRemoteRefClient;
  assertAuthority: () => void;
  withMutation: <T>(operation: () => T) => T;
}): ProductionDeliveryMutationPort {
  return LocalGitDeliveryPort.createBootstrap(input, bootstrapGitCapability);
}

export class CompositeDeliveryMutationPort implements ProductionDeliveryMutationPort {
  readonly workspaceRoot: string;
  readonly repository: string;
  readonly observe: DeliveryMutationPort['observe'];
  readonly mutate: DeliveryMutationPort['mutate'];

  private constructor(git: LocalGitDeliveryPort, github: GitHubDeliveryPort) {
    this.workspaceRoot = git.workspaceRoot;
    this.repository = github.repository;
    const observeGit = git.observe.bind(git);
    const mutateGit = git.mutate.bind(git);
    const observeGitHub = github.observe.bind(github);
    const mutateGitHub = github.mutate.bind(github);
    this.observe = (request, documents) =>
      request.kind.startsWith('git.') ? observeGit(request, documents) : observeGitHub(request);
    this.mutate = (request, merge, documents) =>
      request.kind.startsWith('git.')
        ? mutateGit(request, merge, documents)
        : mutateGitHub(request, merge);
  }

  static create(
    git: LocalGitDeliveryPort,
    github: GitHubDeliveryPort,
  ): CompositeDeliveryMutationPort {
    return registerProductionDeliveryPort(new CompositeDeliveryMutationPort(git, github));
  }
}
