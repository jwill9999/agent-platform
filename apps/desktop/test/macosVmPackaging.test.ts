import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import type { ExecFileSyncOptionsWithBufferEncoding } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const desktopDir = dirname(dirname(fileURLToPath(import.meta.url)));
const packageScript = join(desktopDir, 'scripts/package-macos-vm-runtime.mjs');
const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'agent-platform-macos-vm-package-test-'));
  tempDirs.push(dir);
  return dir;
}

function sha256(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

function writePreparedAssets(dir: string): void {
  mkdirSync(dir, { recursive: true });
  const image = 'image';
  const kernel = 'kernel';
  const initrd = 'initrd';
  const bootstrap = '#!/bin/sh\n';

  writeFileSync(join(dir, 'base-linux.img'), image);
  writeFileSync(join(dir, 'vmlinuz'), kernel);
  writeFileSync(join(dir, 'initrd.img'), initrd);
  writeFileSync(join(dir, 'guest-bootstrap.sh'), bootstrap);
  writeFileSync(
    join(dir, 'manifest.json'),
    `${JSON.stringify(
      {
        schemaVersion: 2,
        architecture: 'arm64',
        imageFormat: 'raw',
        image: 'base-linux.img',
        imageSha256: sha256(image),
        boot: {
          loader: 'linux',
          kernel: 'vmlinuz',
          kernelSha256: sha256(kernel),
          initrd: 'initrd.img',
          initrdSha256: sha256(initrd),
          commandLine: 'console=hvc0 root=/dev/vda rw systemd.unit=multi-user.target',
        },
        bootstrap: 'guest-bootstrap.sh',
        bootstrapSha256: sha256(bootstrap),
      },
      null,
      2,
    )}\n`,
  );
}

function writeHelper(path: string): void {
  writeFileSync(path, '#!/bin/sh\n');
}

describe('macOS VM runtime packaging', () => {
  const quietExecOptions: ExecFileSyncOptionsWithBufferEncoding = {
    encoding: 'buffer',
    stdio: 'pipe',
  };

  it('copies the helper and verified VM assets into the resources layout', () => {
    const root = makeTempDir();
    const assetsDir = join(root, 'assets');
    const outDir = join(root, 'resources/macos-vm');
    const helper = join(root, 'macos-vm-runner');
    writePreparedAssets(assetsDir);
    writeHelper(helper);

    execFileSync(
      process.execPath,
      [
        packageScript,
        '--skip-build',
        '--assets-dir',
        assetsDir,
        '--helper',
        helper,
        '--out-dir',
        outDir,
      ],
      quietExecOptions,
    );

    expect(existsSync(join(outDir, 'macos-vm-runner'))).toBe(true);
    expect(statSync(join(outDir, 'macos-vm-runner')).mode & 0o111).toBeGreaterThan(0);
    expect(existsSync(join(outDir, 'images/manifest.json'))).toBe(true);
    expect(existsSync(join(outDir, 'images/base-linux.img'))).toBe(true);
    expect(existsSync(join(outDir, 'images/vmlinuz'))).toBe(true);
    expect(existsSync(join(outDir, 'images/initrd.img'))).toBe(true);
    expect(existsSync(join(outDir, 'images/guest-bootstrap.sh'))).toBe(true);
    const packageManifest = JSON.parse(
      readFileSync(join(outDir, 'package-manifest.json'), 'utf8'),
    ) as { helperSha256?: string; assets?: { imageSha256?: string } };
    expect(packageManifest.helperSha256).toBe(sha256('#!/bin/sh\n'));
    expect(packageManifest.assets?.imageSha256).toBe(sha256('image'));
  });

  it('fails when a prepared asset checksum does not match the manifest', () => {
    const root = makeTempDir();
    const assetsDir = join(root, 'assets');
    const outDir = join(root, 'resources/macos-vm');
    const helper = join(root, 'macos-vm-runner');
    writePreparedAssets(assetsDir);
    writeHelper(helper);
    writeFileSync(join(assetsDir, 'vmlinuz'), 'modified-kernel');

    expect(() => {
      execFileSync(
        process.execPath,
        [
          packageScript,
          '--skip-build',
          '--assets-dir',
          assetsDir,
          '--helper',
          helper,
          '--out-dir',
          outDir,
        ],
        quietExecOptions,
      );
    }).toThrow(/macOS VM kernel checksum mismatch/);
  });
});
