import { execFileSync } from 'node:child_process';
import type { ExecFileSyncOptionsWithBufferEncoding } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const desktopDir = dirname(dirname(fileURLToPath(import.meta.url)));
const verifyScript = join(desktopDir, 'scripts/verify-macos-vm-signing.mjs');
const tempDirs: string[] = [];

interface VerifyModule {
  readonly hasTrueEntitlement: (plist: string, entitlement: string) => boolean;
  readonly parseArgs: (argv: string[]) => {
    readonly runtimeDir?: string;
    readonly helper?: string;
    readonly app?: string;
    readonly requireHardenedRuntime: boolean;
    readonly json: boolean;
  };
  readonly resolveHelperPath: (options: {
    readonly runtimeDir?: string;
    readonly helper?: string;
    readonly app?: string;
  }) => string;
}

async function loadVerifyModule(): Promise<VerifyModule> {
  return (await import(pathToFileURL(verifyScript).href)) as VerifyModule;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'agent-platform-macos-vm-signing-test-'));
  tempDirs.push(dir);
  return dir;
}

describe('macOS VM signing verification', () => {
  const quietExecOptions: ExecFileSyncOptionsWithBufferEncoding = {
    encoding: 'buffer',
    stdio: 'pipe',
  };

  it('parses the required Virtualization.framework entitlement', async () => {
    const { hasTrueEntitlement } = await loadVerifyModule();

    expect(
      hasTrueEntitlement(
        [
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<plist version="1.0">',
          '<dict>',
          '  <key>com.apple.security.virtualization</key>',
          '  <true/>',
          '</dict>',
          '</plist>',
        ].join('\n'),
        'com.apple.security.virtualization',
      ),
    ).toBe(true);
    expect(
      hasTrueEntitlement(
        '<plist><dict><key>com.apple.security.virtualization</key><false/></dict></plist>',
        'com.apple.security.virtualization',
      ),
    ).toBe(false);
  });

  it('accepts compact codesign entitlement XML with spaced true tags', async () => {
    const { hasTrueEntitlement } = await loadVerifyModule();

    expect(
      hasTrueEntitlement(
        [
          'Executable=/tmp/macos-vm-runner',
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<plist version="1.0"><dict><key>com.apple.security.virtualization</key><true /></dict></plist>',
        ].join('\n'),
        'com.apple.security.virtualization',
      ),
    ).toBe(true);
  });

  it('resolves helper paths for resource directories and packaged apps', async () => {
    const { parseArgs, resolveHelperPath } = await loadVerifyModule();
    const root = makeTempDir();
    const runtimeDir = join(root, 'resources/macos-vm');
    const appPath = join(root, 'Agent Platform.app');

    expect(resolveHelperPath(parseArgs(['--runtime-dir', runtimeDir]))).toBe(
      join(runtimeDir, 'macos-vm-runner'),
    );
    expect(resolveHelperPath(parseArgs(['--', '--runtime-dir', runtimeDir]))).toBe(
      join(runtimeDir, 'macos-vm-runner'),
    );
    expect(resolveHelperPath(parseArgs(['--app', appPath]))).toBe(
      join(appPath, 'Contents/Resources/macos-vm/macos-vm-runner'),
    );
  });

  it('fails closed before codesign when the helper is not executable', () => {
    const root = makeTempDir();
    const runtimeDir = join(root, 'macos-vm');
    const helper = join(runtimeDir, 'macos-vm-runner');
    mkdirSync(runtimeDir, { recursive: true });
    writeFileSync(helper, '#!/bin/sh\n');
    chmodSync(helper, 0o644);

    expect(() => {
      execFileSync(process.execPath, [verifyScript, '--runtime-dir', runtimeDir], quietExecOptions);
    }).toThrow(/macOS VM helper is not executable/);
  });
});
