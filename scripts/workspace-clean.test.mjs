import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { buildCleanupPlan, runWorkspaceClean, unsafeRemovalReason } from './workspace-clean.mjs';
import { resolveWorkspaceConfig } from './workspace-config.mjs';

async function withTempDir(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'agent-platform-clean-test-'));
  try {
    return await fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

async function silenceConsole(fn) {
  const originalLog = console.log;
  const originalError = console.error;
  console.log = () => {};
  console.error = () => {};
  try {
    return await fn();
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
}

test('unsafeRemovalReason refuses broad cleanup targets', () => {
  assert.match(unsafeRemovalReason('/'), /filesystem roots/);
  assert.match(unsafeRemovalReason('C:\\'), /drive roots/);
  assert.match(
    unsafeRemovalReason('/Users/example', {
      homeRoot: '/Users/example',
      repoRoot: '/repo/agent-platform',
    }),
    /home directory/,
  );
  assert.match(
    unsafeRemovalReason('/repo/agent-platform', {
      homeRoot: '/Users/example',
      repoRoot: '/repo/agent-platform',
    }),
    /repository root/,
  );
});

test('buildCleanupPlan deduplicates nested default workspace paths', async () =>
  withTempDir((dir) => {
    const config = resolveWorkspaceConfig({
      AGENT_PLATFORM_HOME: join(dir, 'AgentPlatform'),
    });
    const plan = buildCleanupPlan(config, {
      homeRoot: join(dir, 'home'),
      repoRoot: join(dir, 'repo'),
    });

    assert.equal(plan.ok, true);
    assert.deepEqual(plan.roots, [join(dir, 'AgentPlatform')]);
    assert.ok(plan.configuredPaths.includes(join(dir, 'AgentPlatform', 'workspaces', 'default')));
    assert.ok(plan.configuredPaths.includes(join(dir, 'AgentPlatform', 'data')));
  }));

test('dry-run prints targets without deleting data', async () =>
  withTempDir(async (dir) => {
    const home = join(dir, 'AgentPlatform');
    const file = join(home, 'workspaces', 'default', 'exports', 'result.txt');
    mkdirSync(join(home, 'workspaces', 'default', 'exports'), { recursive: true });
    writeFileSync(file, 'keep me');

    const code = await silenceConsole(() =>
      runWorkspaceClean(['--dry-run'], { AGENT_PLATFORM_HOME: home }),
    );

    assert.equal(code, 0);
    assert.equal(existsSync(file), true);
  }));

test('force cleanup removes only resolved safe targets', async () =>
  withTempDir(async (dir) => {
    const home = join(dir, 'AgentPlatform');
    const file = join(home, 'data', 'app.db');
    mkdirSync(join(home, 'data'), { recursive: true });
    writeFileSync(file, 'delete me');

    const code = await silenceConsole(() =>
      runWorkspaceClean(['--force'], { AGENT_PLATFORM_HOME: home }),
    );

    assert.equal(code, 0);
    assert.equal(existsSync(home), false);
    assert.equal(existsSync(dir), true);
  }));
