import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir, userInfo } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { buildBootstrapAdapters } from '../src/bootstrapAdapterBundle.js';
import {
  validateBootstrapAdapterConfig,
  type BootstrapAdapterConfig,
} from '../src/bootstrapAdapterRuntime.js';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});
const hostNode = realpathSync(process.execPath);
const hostNodeMode = statSync(hostNode).mode;
let node = hostNode;
let interpreterRoot: string | undefined;
beforeAll(() => {
  // Hosted toolcache binaries need not satisfy deployment ownership/mode rules.
  // Pin an owner-only fixture copy; never chmod the runner's shared installation.
  interpreterRoot = realpathSync(mkdtempSync(join(tmpdir(), 'bootstrap-interpreter-test-')));
  node = join(interpreterRoot, 'node');
  copyFileSync(hostNode, node);
  chmodSync(node, 0o700);
});
afterAll(() => {
  if (interpreterRoot !== undefined) rmSync(interpreterRoot, { recursive: true, force: true });
});
const execPath = realpathSync(
  execFileSync('/usr/bin/git', ['--exec-path'], { encoding: 'utf8' }).trim(),
);
const gitBinary = realpathSync(join(execPath, 'git'));
const pin = (path: string) => ({
  path,
  digest: `sha256:${createHash('sha256').update(readFileSync(path)).digest('hex')}`,
});

function git(root: string, args: string[]) {
  return execFileSync(gitBinary, ['-C', root, ...args], {
    encoding: 'utf8',
    env: {
      PATH: '/usr/bin:/bin',
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_CONFIG_GLOBAL: '/dev/null',
      GIT_AUTHOR_NAME: 'Adapter Fixture',
      GIT_AUTHOR_EMAIL: 'fixture@example.com',
      GIT_COMMITTER_NAME: 'Adapter Fixture',
      GIT_COMMITTER_EMAIL: 'fixture@example.com',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function fixture(expectedRemote = false) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'bootstrap-adapter-test-')));
  roots.push(root);
  const workspace = join(root, 'workspace');
  const remote = join(root, 'remote.git');
  mkdirSync(workspace);
  mkdirSync(remote);
  git(workspace, ['init', '-q']);
  git(remote, ['init', '--bare', '-q']);
  git(workspace, ['switch', '-qc', 'task/adapter.task']);
  writeFileSync(join(workspace, 'value.txt'), 'initial\n');
  git(workspace, ['add', '.']);
  git(workspace, ['commit', '-qm', 'initial']);
  const initial = git(workspace, ['rev-parse', 'HEAD']);
  if (expectedRemote) git(workspace, ['push', '-q', remote, 'HEAD:refs/heads/task/adapter.task']);
  writeFileSync(join(workspace, 'value.txt'), 'next\n');
  git(workspace, ['commit', '-qam', 'next']);
  const head = git(workspace, ['rev-parse', 'HEAD']);
  const log = join(root, 'beads-calls.jsonl');
  const behavior = join(root, 'behavior.txt');
  writeFileSync(behavior, 'normal');
  const beads = join(root, 'beads.mjs');
  const snapshot = {
    id: 'adapter.task',
    status: 'in_progress',
    notes: 'keep all fields',
    extra: { nested: true },
    parent: 'epic',
    dependencies: [{ id: 'epic' }],
  };
  writeFileSync(
    beads,
    `#!${node}\nimport {readFileSync,appendFileSync} from 'node:fs';
const args=process.argv.slice(2);appendFileSync(${JSON.stringify(log)},JSON.stringify({args,env:process.env,cwd:process.cwd()})+'\\n');
const behavior=readFileSync(${JSON.stringify(behavior)},'utf8');if(behavior==='failure'){process.stderr.write('sensitive fixture credential');process.exit(1);}
if(args.at(-1)==='context')process.stdout.write(JSON.stringify({repo_root:${JSON.stringify(workspace)},cwd_repo_root:${JSON.stringify(workspace)},beads_dir:${JSON.stringify(join(workspace, '.beads'))},is_redirected:behavior==='redirect',is_worktree:false,backend:'dolt',dolt_mode:'embedded',project_id:behavior==='wrong-project'?'wrong':'11111111-1111-1111-1111-111111111111',database:'fixture'}));
else process.stdout.write(JSON.stringify(behavior==='wrong-task'?[{id:'other',status:'in_progress'}]:[${JSON.stringify(snapshot)}]));\n`,
    { mode: 0o700 },
  );
  const config: BootstrapAdapterConfig = {
    version: 1,
    workspaceRoot: workspace,
    gitCommonDirectory: realpathSync(join(workspace, '.git')),
    repository: 'owner/repository',
    taskId: 'adapter.task',
    ref: 'refs/heads/task/adapter.task',
    remoteName: 'origin',
    remoteUrl: remote,
    expectedRemoteSha: expectedRemote ? initial : null,
    homeDirectory: realpathSync(userInfo().homedir),
    node: pin(node),
    git: pin(gitBinary),
    beads: pin(beads),
    beadsProjectId: '11111111-1111-1111-1111-111111111111',
    beadsDatabase: 'fixture',
    gitExecPath: execPath,
    https: null,
  };
  const adapters = buildBootstrapAdapters(config, join(root, 'deployment'));
  const binding = {
    workspaceRoot: workspace,
    repository: config.repository,
    remoteName: config.remoteName,
    remoteUrl: remote,
    ref: config.ref,
  };
  const invoke = (channel: 'beads' | 'remote', request: unknown, args: string[] = []) =>
    spawnSync(channel === 'beads' ? adapters.beadsReadBinary : adapters.remoteBinary, args, {
      input: typeof request === 'string' ? request : JSON.stringify(request),
      encoding: 'utf8',
      timeout: 10_000,
      env: {
        PATH: '/hostile',
        GIT_CONFIG_COUNT: '1',
        GIT_CONFIG_KEY_0: 'url.fake.insteadOf',
        GIT_CONFIG_VALUE_0: remote,
        GH_TOKEN: 'sensitive-env',
        BEADS_DIR: '/hostile',
      },
    });
  return {
    root,
    workspace,
    remote,
    initial,
    head,
    log,
    behavior,
    beads,
    snapshot,
    config,
    adapters,
    binding,
    invoke,
  };
}

describe('pinned production bootstrap subprocess adapters', () => {
  it('uses a private owner-only interpreter without changing the runner installation', () => {
    expect(node).not.toBe(hostNode);
    expect(pin(node).digest).toBe(pin(hostNode).digest);
    expect(statSync(node).mode & 0o777).toBe(0o700);
    expect(statSync(node).uid).toBe(process.getuid?.());
    expect(statSync(hostNode).mode).toBe(hostNodeMode);
  });

  it.each([0o775, 0o707])('rejects a writable pinned dependency (mode=%s)', (mode) => {
    const f = fixture();
    chmodSync(f.beads, mode);
    expect(() => validateBootstrapAdapterConfig(f.config)).toThrow();
    expect(
      f.invoke('beads', { kind: 'beads.read', workspaceRoot: f.workspace, taskId: 'adapter.task' })
        .status,
    ).toBe(1);
    expect(existsSync(f.log)).toBe(false);
  });

  it('reads one complete official snapshot using only readonly sandbox CLI commands and allowlisted environment', () => {
    const f = fixture();
    const result = f.invoke('beads', {
      kind: 'beads.read',
      workspaceRoot: f.workspace,
      taskId: 'adapter.task',
    });
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual(f.snapshot);
    const calls = readFileSync(f.log, 'utf8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    expect(calls.map((call) => call.args)).toEqual([
      ['--readonly', '--sandbox', '--dolt-auto-commit=off', '--json', 'context'],
      [
        '--readonly',
        '--sandbox',
        '--dolt-auto-commit=off',
        '--json',
        'show',
        '--long',
        '--id=adapter.task',
      ],
    ]);
    expect(
      calls.every(
        (call) =>
          call.cwd === f.workspace &&
          call.env.GH_TOKEN === undefined &&
          call.env.BEADS_DIR === undefined &&
          call.env.GIT_CONFIG_COUNT === undefined,
      ),
    ).toBe(true);
  });

  it.each([false, true])(
    'observes and CAS-pushes the exact task ref through a real bare remote (existing=%s)',
    (existing) => {
      const f = fixture(existing);
      expect(
        JSON.parse(f.invoke('remote', { kind: 'git.observe_ref', ...f.binding }).stdout),
      ).toEqual({ sha: existing ? f.initial : null });
      const result = f.invoke('remote', {
        kind: 'git.push',
        ...f.binding,
        expectedOldSha: f.config.expectedRemoteSha,
        newSha: f.head,
      });
      expect(result.stderr).toBe('');
      expect(result.status).toBe(0);
      expect(JSON.parse(result.stdout)).toEqual({ sha: f.head });
      expect(git(f.remote, ['rev-parse', f.config.ref])).toBe(f.head);
      expect(() => git(f.remote, ['fsck', '--full', '--no-reflogs'])).not.toThrow();
      const replay = f.invoke('remote', {
        kind: 'git.push',
        ...f.binding,
        expectedOldSha: f.config.expectedRemoteSha,
        newSha: f.head,
      });
      expect(replay.status).toBe(1); // Recovery observes first; the adapter never weakens the old-SHA CAS.
      expect(
        JSON.parse(f.invoke('remote', { kind: 'git.observe_ref', ...f.binding }).stdout),
      ).toEqual({ sha: f.head });
      expect(git(f.remote, ['for-each-ref', '--format=%(refname)'])).toBe(f.config.ref);
    },
  );

  it('ignores hostile repository config, URL rewrites and local pre-push hooks', () => {
    const f = fixture();
    const wrong = join(f.root, 'wrong.git');
    mkdirSync(wrong);
    git(wrong, ['init', '--bare', '-q']);
    const marker = join(f.root, 'hook-ran');
    writeFileSync(
      join(f.config.gitCommonDirectory, 'hooks/pre-push'),
      `#!/bin/sh\ntouch '${marker}'\nexit 1\n`,
      { mode: 0o700 },
    );
    git(f.workspace, ['config', `url.${wrong}.insteadOf`, f.remote]);
    git(f.workspace, ['config', 'push.followTags', 'true']);
    const result = f.invoke('remote', {
      kind: 'git.push',
      ...f.binding,
      expectedOldSha: null,
      newSha: f.head,
    });
    expect(result.status).toBe(0);
    expect(existsSync(marker)).toBe(false);
    expect(git(wrong, ['for-each-ref', '--format=%(refname)'])).toBe('');
    expect(git(f.remote, ['rev-parse', f.config.ref])).toBe(f.head);
  });

  it('rejects a valid but unapproved local commit and a provider-side CAS race', () => {
    const f = fixture();
    expect(
      f.invoke('remote', {
        kind: 'git.push',
        ...f.binding,
        expectedOldSha: null,
        newSha: f.initial,
      }).status,
    ).toBe(1);
    git(f.workspace, ['push', '-q', f.remote, `${f.initial}:refs/heads/provider-existing`]);
    // Simulate a different writer winning after ls-remote, inside the real receiver boundary.
    writeFileSync(
      join(f.remote, 'hooks/pre-receive'),
      `#!/bin/sh\n/usr/bin/env -u GIT_QUARANTINE_PATH -u GIT_OBJECT_DIRECTORY '${gitBinary}' --git-dir='${f.remote}' update-ref '${f.config.ref}' '${f.initial}'\n`,
      { mode: 0o700 },
    );
    const result = f.invoke('remote', {
      kind: 'git.push',
      ...f.binding,
      expectedOldSha: null,
      newSha: f.head,
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toBe('bootstrap adapter rejected request or dependency\n');
    expect(git(f.remote, ['rev-parse', f.config.ref])).toBe(f.initial);
  });

  it.each([
    'kind',
    'workspaceRoot',
    'repository',
    'remoteName',
    'remoteUrl',
    'ref',
    'expectedOldSha',
    'newSha',
    'extra',
  ])('rejects remote request substitution: %s', (field) => {
    const f = fixture();
    const request = {
      kind: 'git.push',
      ...f.binding,
      expectedOldSha: null,
      newSha: f.head,
      [field]: field === 'expectedOldSha' ? f.initial : 'not-authorized',
    };
    const result = f.invoke('remote', request);
    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe('bootstrap adapter rejected request or dependency\n');
    expect(git(f.remote, ['for-each-ref', '--format=%(refname)'])).toBe('');
  });

  it.each(['kind', 'workspaceRoot', 'taskId', 'extra'])(
    'rejects Beads request substitution before launching CLI: %s',
    (field) => {
      const f = fixture();
      const result = f.invoke('beads', {
        kind: 'beads.read',
        workspaceRoot: f.workspace,
        taskId: 'adapter.task',
        [field]: 'unauthorized',
      });
      expect(result.status).toBe(1);
      expect(existsSync(f.log)).toBe(false);
    },
  );

  it.each(['redirect', 'wrong-task', 'wrong-project', 'failure'])(
    'fails closed and redacts a %s Beads subprocess response',
    (behavior) => {
      const f = fixture();
      writeFileSync(f.behavior, behavior);
      const result = f.invoke('beads', {
        kind: 'beads.read',
        workspaceRoot: f.workspace,
        taskId: 'adapter.task',
      });
      expect(result.status).toBe(1);
      expect(result.stdout).toBe('');
      expect(result.stderr).toBe('bootstrap adapter rejected request or dependency\n');
    },
  );

  it('rejects modified dependencies, oversized input, malformed JSON and CLI arguments', () => {
    const f = fixture();
    for (const [input, args] of [
      ['x'.repeat(65_537), []],
      ['{', []],
      ['{}', ['git.push']],
    ] as const)
      expect(f.invoke('remote', input, [...args]).status).toBe(1);
    writeFileSync(f.beads, `${readFileSync(f.beads, 'utf8')}\n// tampered\n`);
    expect(
      f.invoke('beads', { kind: 'beads.read', workspaceRoot: f.workspace, taskId: 'adapter.task' })
        .status,
    ).toBe(1);
    expect(existsSync(f.log)).toBe(false);
    expect(() => buildBootstrapAdapters(f.config, join(f.root, 'another'))).toThrow();
  });

  it('binds deployment dependency pins and never overwrites an existing reviewed directory', () => {
    const f = fixture();
    expect(f.adapters.dependencies).toEqual([f.config.node, f.config.git, f.config.beads]);
    expect(pin(f.adapters.remoteBinary).digest).toBe(f.adapters.remoteBinaryDigest);
    expect(() => buildBootstrapAdapters(f.config, join(f.root, 'deployment'))).toThrow();
    expect(() =>
      validateBootstrapAdapterConfig({ ...f.config, remoteUrl: 'ext::sh arbitrary' }),
    ).toThrow();
    expect(() => validateBootstrapAdapterConfig({ ...f.config, ref: 'refs/heads/main' })).toThrow();
  });

  it('rejects traversal and symlinked deployment parents before creating a bundle', () => {
    const f = fixture();
    const alias = join(f.root, 'alias');
    symlinkSync(f.workspace, alias);
    const target = join(f.workspace, 'escaped');
    for (const path of [
      `${f.workspace}/../escaped`,
      join(alias, 'escaped'),
      `${f.root}/bad\nname`,
      'relative-deployment',
    ]) {
      expect(() => buildBootstrapAdapters(f.config, path)).toThrow();
    }
    expect(existsSync(target)).toBe(false);
    expect(existsSync(join(f.root, 'escaped'))).toBe(false);
  });

  it('validates CLI config files and rejects symlinks and relative escapes', () => {
    const f = fixture();
    const config = join(f.root, 'config.json');
    writeFileSync(config, JSON.stringify(f.config));
    const alias = join(f.root, 'config-alias.json');
    symlinkSync(config, alias);
    const output = join(f.root, 'cli-deployment');
    const script = realpathSync(new URL('../dist/bootstrapAdapterBundle.js', import.meta.url));
    for (const input of [alias, '../config.json', f.workspace]) {
      const result = spawnSync(node, [script, input, output], {
        cwd: f.workspace,
        encoding: 'utf8',
        timeout: 10_000,
      });
      expect(result.status).toBe(1);
      expect(result.stdout).toBe('');
      expect(existsSync(output)).toBe(false);
    }
    const result = spawnSync(node, [script, 'config.json', output], {
      cwd: f.root,
      encoding: 'utf8',
      timeout: 10_000,
    });
    expect(result.status).toBe(0);
    const adapters = JSON.parse(result.stdout);
    expect(adapters.remoteBinary).toBe(join(output, 'bootstrap-remote.mjs'));
    expect(pin(adapters.remoteBinary).digest).toBe(adapters.remoteBinaryDigest);
  });
});
