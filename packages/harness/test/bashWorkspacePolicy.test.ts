import { describe, expect, it, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { PathJail } from '../src/security/pathJail.js';
import {
  extractBashPathAccesses,
  validateBashWorkspacePolicy,
} from '../src/security/bashWorkspacePolicy.js';

function makeTmpDir(): string {
  const dir = join(
    tmpdir(),
    `bash-workspace-policy-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe('bash workspace policy', () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const dir of dirs) {
      rmSync(dir, { recursive: true, force: true });
    }
    dirs.length = 0;
  });

  function makeJail() {
    const workspace = makeTmpDir();
    dirs.push(workspace);
    return {
      workspace,
      jail: new PathJail([{ label: 'workspace', hostPath: workspace, permission: 'read_write' }]),
    };
  }

  it('extracts shell write targets from redirects and file commands', () => {
    expect(extractBashPathAccesses('echo hi > reports/out.txt')).toContainEqual({
      path: 'reports/out.txt',
      operation: 'write',
    });
    expect(extractBashPathAccesses('echo hi >reports/no-space.txt')).toContainEqual({
      path: 'reports/no-space.txt',
      operation: 'write',
    });
    expect(extractBashPathAccesses('echo hi 2> "reports/error log.txt"')).toContainEqual({
      path: 'reports/error log.txt',
      operation: 'write',
    });
    expect(extractBashPathAccesses('cp input.txt generated/output.txt')).toEqual([
      { path: 'generated/output.txt', operation: 'write' },
    ]);
    expect(extractBashPathAccesses('touch /tmp/out.txt')).toEqual([
      { path: '/tmp/out.txt', operation: 'write' },
    ]);
  });

  it('splits shell segments without treating quoted separators as operators', () => {
    expect(
      extractBashPathAccesses(
        'echo "a | b && c" > generated/output.txt && cat generated/input.txt',
      ),
    ).toEqual([
      { path: 'generated/output.txt', operation: 'write' },
      { path: 'generated/input.txt', operation: 'read' },
    ]);
  });

  it('allows workspace-relative shell file access', async () => {
    const { workspace, jail } = makeJail();
    mkdirSync(join(workspace, 'generated'), { recursive: true });
    writeFileSync(join(workspace, 'generated', 'input.txt'), 'ok');

    await expect(
      validateBashWorkspacePolicy(
        'cat generated/input.txt && echo done > generated/output.txt',
        jail,
      ),
    ).resolves.toMatchObject({ allowed: true });
  });

  it('denies shell writes outside the workspace before execution', async () => {
    const { jail } = makeJail();

    await expect(
      validateBashWorkspacePolicy('touch /tmp/outside.txt', jail),
    ).resolves.toMatchObject({
      allowed: false,
      path: '/tmp/outside.txt',
    });
  });

  it('denies shell reads outside the workspace for path-bearing file commands', async () => {
    const { jail } = makeJail();

    await expect(validateBashWorkspacePolicy('cat /tmp/secret.txt', jail)).resolves.toMatchObject({
      allowed: false,
      path: '/tmp/secret.txt',
    });
  });
});
