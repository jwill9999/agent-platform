import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { PathJail, PathJailError } from '../src/security/pathJail.js';
import type { Mount } from '../src/security/pathJail.js';

function makeTmpDir(): string {
  const dir = join(tmpdir(), `pathjail-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe('PathJail', () => {
  let workspace: string;
  let uploads: string;
  let jail: PathJail;

  beforeEach(() => {
    workspace = makeTmpDir();
    uploads = makeTmpDir();
    const mounts: Mount[] = [
      { label: 'workspace', hostPath: workspace, permission: 'read_write' },
      { label: 'uploads', hostPath: uploads, permission: 'read_only' },
    ];
    jail = new PathJail(mounts);
  });

  afterEach(() => {
    rmSync(workspace, { recursive: true, force: true });
    rmSync(uploads, { recursive: true, force: true });
  });

  it('allows read inside workspace', async () => {
    const filePath = join(workspace, 'test.txt');
    writeFileSync(filePath, 'hello');
    const result = await jail.validate(filePath, 'read');
    expect(result.allowed).toBe(true);
    expect(result.mount?.label).toBe('workspace');
  });

  it('allows write inside workspace', async () => {
    const filePath = join(workspace, 'new-file.txt');
    const result = await jail.validate(filePath, 'write');
    expect(result.allowed).toBe(true);
    expect(result.mount?.label).toBe('workspace');
  });

  it('allows read inside read-only mount', async () => {
    const filePath = join(uploads, 'data.csv');
    writeFileSync(filePath, 'a,b,c');
    const result = await jail.validate(filePath, 'read');
    expect(result.allowed).toBe(true);
    expect(result.mount?.label).toBe('uploads');
  });

  it('denies write to read-only mount', async () => {
    const filePath = join(uploads, 'data.csv');
    writeFileSync(filePath, 'a,b,c');
    const result = await jail.validate(filePath, 'write');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('read-only');
  });

  it('denies path outside all mounts', async () => {
    const result = await jail.validate('/usr/local/bin/something', 'read');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('outside all allowed mounts');
  });

  it('blocks always-blocked system directories', async () => {
    const blocked = ['/etc/passwd', '/proc/1/status', '/sys/class', '/root/.ssh/id_rsa'];
    for (const p of blocked) {
      const result = await jail.validate(p, 'read');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('protected system directory');
    }
  });

  it('blocks symlink escape to outside workspace', async () => {
    const outsideDir = makeTmpDir();
    const secretFile = join(outsideDir, 'secret.txt');
    writeFileSync(secretFile, 'sensitive data');

    const linkPath = join(workspace, 'sneaky-link');
    symlinkSync(secretFile, linkPath);

    const result = await jail.validate(linkPath, 'read');
    expect(result.allowed).toBe(false);

    rmSync(outsideDir, { recursive: true, force: true });
  });

  it('blocks traversal via ../', async () => {
    const result = await jail.validate(join(workspace, '..', '..', 'etc', 'passwd'), 'read');
    expect(result.allowed).toBe(false);
  });

  it('resolves relative paths against workspace', async () => {
    const filePath = 'subdir/file.txt';
    mkdirSync(join(workspace, 'subdir'), { recursive: true });
    writeFileSync(join(workspace, 'subdir', 'file.txt'), 'content');
    const result = await jail.validate(filePath, 'read');
    expect(result.allowed).toBe(true);
    expect(result.resolvedPath).toContain(workspace);
  });

  it('enforce throws PathJailError on denial', async () => {
    await expect(jail.enforce('/etc/shadow', 'read')).rejects.toThrow(PathJailError);
  });

  it('enforce returns resolved path on success', async () => {
    const filePath = join(workspace, 'ok.txt');
    const resolved = await jail.enforce(filePath, 'write');
    expect(resolved).toContain(workspace);
  });

  describe('extractPaths', () => {
    it('extracts known path-like keys', () => {
      const args = {
        path: '/some/file',
        content: 'not a path',
        destination: '/other/file',
        count: 42,
      };
      const paths = PathJail.extractPaths(args);
      expect(paths).toEqual(['/some/file', '/other/file']);
    });

    it('returns empty for no path-like keys', () => {
      const paths = PathJail.extractPaths({ command: 'ls -la', timeout: 5000 });
      expect(paths).toEqual([]);
    });
  });
});
