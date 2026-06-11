import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
  desktopResetConfirmationText,
  getDesktopLocalDataDeletionTargets,
  resetDesktopLocalData,
  validateDesktopLocalDataResetRequest,
} from '../src/main/localDataReset.js';
import type { DesktopRuntimePaths } from '../src/main/runtimePaths.js';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'agent-platform-local-data-reset-test-'));
  tempDirs.push(dir);
  return dir;
}

function makeRuntimePaths(root: string): DesktopRuntimePaths {
  return {
    appDataDir: root,
    configDir: join(root, 'config'),
    dataDir: join(root, 'data'),
    logDir: join(root, 'logs'),
    resourcesDir: join(root, 'resources'),
    tempDir: join(root, 'tmp'),
    sqlitePath: join(root, 'data/agent.sqlite'),
    configPath: join(root, 'config/runtime.json'),
    secretsMasterKeyPath: join(root, 'config/secrets-master-key.json'),
    macosVmPackagedAssetsDir: join(root, 'resources/macos-vm/images'),
    macosVmPackagedHelperPath: join(root, 'resources/macos-vm/macos-vm-runner'),
  };
}

function writeRuntimeFiles(paths: DesktopRuntimePaths): void {
  mkdirSync(paths.configDir, { recursive: true });
  mkdirSync(paths.dataDir, { recursive: true });
  mkdirSync(paths.logDir, { recursive: true });
  mkdirSync(paths.tempDir, { recursive: true });
  writeFileSync(paths.configPath, '{}');
  writeFileSync(paths.secretsMasterKeyPath, '{"ciphertextB64":"encrypted"}');
  writeFileSync(paths.sqlitePath, 'sqlite');
  writeFileSync(join(paths.logDir, 'backend.stdout.log'), 'log');
  writeFileSync(join(paths.tempDir, 'scratch.tmp'), 'tmp');
}

describe('desktop local data reset', () => {
  it('validates reset request payloads', () => {
    expect(
      validateDesktopLocalDataResetRequest({ confirmation: desktopResetConfirmationText }),
    ).toEqual({
      ok: true,
      value: { confirmation: desktopResetConfirmationText },
    });
    expect(validateDesktopLocalDataResetRequest(null)).toEqual({
      ok: false,
      error: 'Expected reset request payload.',
    });
    expect(validateDesktopLocalDataResetRequest('delete')).toEqual({
      ok: false,
      error: 'Expected reset request payload.',
    });
    expect(validateDesktopLocalDataResetRequest({})).toEqual({
      ok: false,
      error: 'Expected reset confirmation text.',
    });
    expect(validateDesktopLocalDataResetRequest({ confirmation: 1 })).toEqual({
      ok: false,
      error: 'Expected reset confirmation text.',
    });
  });

  it('deletes app-owned data and preserves user project folders', () => {
    const root = makeTempDir();
    const projectRoot = join(makeTempDir(), 'user-project');
    const projectFile = join(projectRoot, 'README.md');
    const paths = makeRuntimePaths(root);
    writeRuntimeFiles(paths);
    mkdirSync(projectRoot, { recursive: true });
    writeFileSync(projectFile, '# Project');

    const result = resetDesktopLocalData({ confirmation: desktopResetConfirmationText, paths });

    expect(result.ok).toBe(true);
    expect(result.preservedProjectFolders).toBe(true);
    expect(result.deletedPaths).toEqual(getDesktopLocalDataDeletionTargets(paths));
    expect(existsSync(paths.configPath)).toBe(false);
    expect(existsSync(paths.secretsMasterKeyPath)).toBe(false);
    expect(existsSync(paths.sqlitePath)).toBe(false);
    expect(existsSync(join(paths.logDir, 'backend.stdout.log'))).toBe(false);
    expect(existsSync(join(paths.tempDir, 'scratch.tmp'))).toBe(false);
    expect(existsSync(projectFile)).toBe(true);
    expect(existsSync(paths.configDir)).toBe(true);
    expect(existsSync(paths.dataDir)).toBe(true);
    expect(existsSync(paths.logDir)).toBe(true);
    expect(existsSync(paths.tempDir)).toBe(true);
  });

  it('deletes the protected credential key file with local app data', () => {
    const root = makeTempDir();
    const paths = makeRuntimePaths(root);
    writeRuntimeFiles(paths);

    const result = resetDesktopLocalData({ confirmation: desktopResetConfirmationText, paths });

    expect(result.deletedPaths).toContain(paths.configDir);
    expect(existsSync(paths.secretsMasterKeyPath)).toBe(false);
  });

  it('records missing app-owned paths without touching project folders', () => {
    const root = makeTempDir();
    const projectRoot = join(makeTempDir(), 'user-project');
    const projectFile = join(projectRoot, 'README.md');
    const paths = makeRuntimePaths(root);
    mkdirSync(projectRoot, { recursive: true });
    writeFileSync(projectFile, '# Project');

    const result = resetDesktopLocalData({ confirmation: desktopResetConfirmationText, paths });

    expect(result.deletedPaths).toEqual([]);
    expect(result.missingPaths).toEqual(getDesktopLocalDataDeletionTargets(paths));
    expect(result.preservedProjectFolders).toBe(true);
    expect(existsSync(projectFile)).toBe(true);
  });

  it('requires the exact confirmation phrase before deleting anything', () => {
    const root = makeTempDir();
    const paths = makeRuntimePaths(root);
    writeRuntimeFiles(paths);

    expect(() => resetDesktopLocalData({ confirmation: 'delete', paths })).toThrow(
      `Reset requires confirmation text: ${desktopResetConfirmationText}`,
    );
    expect(existsSync(paths.sqlitePath)).toBe(true);
  });
});
