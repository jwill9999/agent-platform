import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';
import { assertBootstrapExecutablePin } from './bootstrapAdapterRuntime.js';

/** Pinned local Git only. No inherited Git configuration, hooks, filters or shell commands. */
export class TrustedSourceGit {
  readonly pin: { path: string; digest: string };
  constructor(
    readonly root: string,
    binary: string,
    digest?: string,
    private readonly beforeCommand?: () => void,
  ) {
    if (!isAbsolute(binary) || !isAbsolute(root) || realpathSync(root) !== root)
      throw new Error('source Git requires canonical root and absolute executable');
    this.pin = {
      path: realpathSync(binary),
      digest: digest ?? `sha256:${createHash('sha256').update(readFileSync(binary)).digest('hex')}`,
    };
    assertBootstrapExecutablePin(this.pin);
  }
  run(args: string[], input?: Uint8Array, index?: string, deadlineMs?: number | null): Buffer {
    this.beforeCommand?.();
    assertBootstrapExecutablePin(this.pin);
    const remaining = deadlineMs == null ? 10000 : Math.min(10000, deadlineMs - Date.now());
    if (remaining <= 0) throw new Error('source Git authority expired');
    return execFileSync(
      this.pin.path,
      [
        '--no-replace-objects',
        '-c',
        'core.hooksPath=/dev/null',
        '-c',
        'core.fsmonitor=false',
        '-c',
        'core.untrackedCache=false',
        '-c',
        'core.filesRefLockTimeout=0',
        ...args,
      ],
      {
        cwd: this.root,
        env: {
          PATH: `${dirname(this.pin.path)}:/usr/bin:/bin`,
          GIT_CONFIG_NOSYSTEM: '1',
          GIT_CONFIG_GLOBAL: '/dev/null',
          GIT_TERMINAL_PROMPT: '0',
          GIT_AUTHOR_NAME: 'Workflow importer',
          GIT_AUTHOR_EMAIL: 'workflow@localhost',
          GIT_COMMITTER_NAME: 'Workflow importer',
          GIT_COMMITTER_EMAIL: 'workflow@localhost',
          GIT_AUTHOR_DATE: '2000-01-01T00:00:00Z',
          GIT_COMMITTER_DATE: '2000-01-01T00:00:00Z',
          ...(index ? { GIT_INDEX_FILE: index } : {}),
        },
        input,
        timeout: remaining,
        maxBuffer: 20 * 1024 * 1024,
        stdio: ['pipe', 'pipe', 'pipe'],
      },
    );
  }
  updateRef(ref: string, result: string, base: string, deadlineMs: number | null): void {
    if (
      !/^refs\/heads\/[A-Za-z0-9/._-]+$/u.test(ref) ||
      !/^[a-f0-9]{40,64}$/u.test(result) ||
      !/^[a-f0-9]{40,64}$/u.test(base)
    )
      throw new Error('invalid import ref transaction');
    assertBootstrapExecutablePin(this.pin);
    const nodePath = realpathSync(process.execPath);
    const nodePin = {
      path: nodePath,
      digest: `sha256:${createHash('sha256').update(readFileSync(nodePath)).digest('hex')}`,
    };
    assertBootstrapExecutablePin(nodePin);
    const remaining = deadlineMs === null ? 10000 : Math.min(10000, deadlineMs - Date.now());
    if (remaining <= 0) throw new Error('source Git authority expired');
    try {
      execFileSync(nodePath, ['-e', refTransactionProgram], {
        cwd: this.root,
        env: {},
        input: JSON.stringify({ pin: this.pin, ref, result, base, deadlineMs }),
        timeout: remaining + 1000,
        maxBuffer: 4096,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch {
      throw new Error('import ref transaction rejected or uncertain');
    }
  }
  assertSafeIndex(): void {
    if (this.run(['for-each-ref', '--format=%(refname)', 'refs/replace']).toString().trim())
      throw new Error('source Git replacement refs are denied');
    const common = this.run(['rev-parse', '--path-format=absolute', '--git-common-dir'])
      .toString()
      .trim();
    const grafts = join(common, 'info', 'grafts');
    if (existsSync(grafts) && readFileSync(grafts, 'utf8').trim())
      throw new Error('source Git grafts are denied');
    const configuration = this.run(['config', '--null', '--list']).toString();
    if (configuration.split('\0').some((entry) => /^filter\./iu.test(entry)))
      throw new Error('import repository filters are unsupported');
    if (
      this.run(['ls-files', '-v', '-z'])
        .toString()
        .split('\0')
        .some((entry) => entry !== '' && !entry.startsWith('H '))
    )
      throw new Error('source index flags conceal working tree changes');
  }
  assertClean(paths: string[] = []): void {
    this.assertSafeIndex();
    if (
      this.run([
        'status',
        '--porcelain=v1',
        '--untracked-files=all',
        '--ignore-submodules=all',
        ...(paths.length ? ['--', ...paths] : []),
      ]).length
    )
      throw new Error('import source drift or uncertain partial application');
  }
}

// Git prepare acquires the ref locks without publishing. Check authority after acquisition,
// before issuing commit; a timeout before that decision aborts rather than retrying later.
const refTransactionProgram = String.raw`
const fs = require('node:fs');
const crypto = require('node:crypto');
const {spawn} = require('node:child_process');
const input = JSON.parse(fs.readFileSync(0, 'utf8'));
if ('sha256:' + crypto.createHash('sha256').update(fs.readFileSync(input.pin.path)).digest('hex') !== input.pin.digest) throw Error('pin changed');
const remaining = input.deadlineMs === null ? 10000 : Math.min(10000, input.deadlineMs - Date.now());
if (remaining <= 0) throw Error('authority expired');
const git = spawn(input.pin.path, ['-c','core.hooksPath=/dev/null','-c','core.filesRefLockTimeout=0','update-ref','--stdin'], {
  env: {GIT_CONFIG_NOSYSTEM:'1', GIT_CONFIG_GLOBAL:'/dev/null', GIT_TERMINAL_PROMPT:'0'},
  stdio: ['pipe','pipe','pipe']
});
let committed = false;
let buffer = '';
const timer = setTimeout(() => git.kill('SIGKILL'), remaining);
git.on('error', () => { clearTimeout(timer); process.exitCode = 1; });
git.stdin.on('error', () => {});
git.stderr.resume();
git.stdout.on('data', chunk => {
  buffer += chunk.toString();
  let end;
  while ((end = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0,end); buffer = buffer.slice(end+1);
    if (line === 'prepare: ok') {
      if (input.deadlineMs !== null && Date.now() >= input.deadlineMs) git.stdin.end('abort\n');
      else git.stdin.end('commit\n');
    }
    if (line === 'commit: ok') committed = true;
  }
});
git.on('close', code => { clearTimeout(timer); process.exitCode = code === 0 && committed ? 0 : 1; });
git.stdin.write('start\nupdate ' + input.ref + ' ' + input.result + ' ' + input.base + '\nprepare\n');
`;
