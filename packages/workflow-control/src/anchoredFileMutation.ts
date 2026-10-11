import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, realpathSync, statSync } from 'node:fs';
import { assertBootstrapExecutablePin } from './bootstrapAdapterRuntime.js';

// A child process provides a kernel-held directory anchor on both macOS and Linux. Each descent
// checks the directory inode before and after chdir; subsequent operations use a single basename.
// No parent-component lookup is performed at the point of writing the file. Source code is data.
const program = String.raw`
const fs = require('node:fs');
const crypto = require('node:crypto');
const input = JSON.parse(fs.readFileSync(0, 'utf8'));
const same = (a,b) => a.dev === b.dev && a.ino === b.ino;
const root = fs.statSync('.');
if (!root.isDirectory() || !same(root, input.rootIdentity)) throw Error('root changed');
const deadline = () => { if (input.deadlineMs !== null && Date.now() >= input.deadlineMs) throw Error('authority expired'); };
const parts = input.path.split('/');
if (parts.some(p => !p || p === '.' || p === '..' || p.includes('\\'))) throw Error('path');
for (const part of parts.slice(0, -1)) {
  let before;
  try { before = fs.lstatSync(part); }
  catch (error) {
    if (error.code !== 'ENOENT' || input.content === null) throw error;
    deadline();
    fs.mkdirSync(part, {mode: 0o755});
    before = fs.lstatSync(part);
  }
  if (!before.isDirectory() || before.isSymbolicLink()) throw Error('parent');
  process.chdir(part);
  if (!same(before, fs.statSync('.'))) throw Error('parent changed');
}
const name = parts.at(-1);
let before;
if (input.beforeDigest !== null) {
  before = fs.lstatSync(name);
  if (!before.isFile() || before.nlink !== 1) throw Error('file');
  const fd = fs.openSync(name, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try {
    const opened = fs.fstatSync(fd);
    if (!opened.isFile() || opened.nlink !== 1 || !same(before, opened)) throw Error('file changed');
    const bytes = fs.readFileSync(fd);
    if ('sha256:' + crypto.createHash('sha256').update(bytes).digest('hex') !== input.beforeDigest) throw Error('content changed');
    if (!same(opened, fs.lstatSync(name))) throw Error('destination changed');
  } finally { fs.closeSync(fd); }
}
deadline();
if (input.content === null) fs.unlinkSync(name);
else {
  const temporary = '.workflow-import-' + crypto.randomUUID();
  const fd = fs.openSync(temporary, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600);
  try {
    fs.writeFileSync(fd, input.content, 'utf8');
    fs.fchmodSync(fd, before ? before.mode & 0o777 : 0o644);
    fs.fsyncSync(fd);
    deadline();
    if (before) {
      if (!same(before, fs.lstatSync(name))) throw Error('destination changed');
      fs.renameSync(temporary, name);
    } else {
      // Atomic no-replace publication for additions.
      fs.linkSync(temporary, name);
      fs.unlinkSync(temporary);
    }
  } finally {
    fs.closeSync(fd);
    try { fs.unlinkSync(temporary); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
}
`;

export class AnchoredFileMutation {
  readonly #pin;
  readonly #rootIdentity;
  constructor(readonly root: string) {
    const path = realpathSync(process.execPath);
    this.#pin = {
      path,
      digest: `sha256:${createHash('sha256').update(readFileSync(path)).digest('hex')}`,
    };
    assertBootstrapExecutablePin(this.#pin);
    const stat = statSync(root);
    this.#rootIdentity = { dev: stat.dev, ino: stat.ino };
  }
  apply(
    file: { path: string; beforeDigest: string | null; content: string | null },
    deadlineMs: number | null,
  ): void {
    assertBootstrapExecutablePin(this.#pin);
    try {
      execFileSync(this.#pin.path, ['-e', program], {
        cwd: this.root,
        env: {},
        input: JSON.stringify({ ...file, deadlineMs, rootIdentity: this.#rootIdentity }),
        timeout: 10000,
        maxBuffer: 1024,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch {
      throw new Error('anchored import file mutation rejected');
    }
  }
}
