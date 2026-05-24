import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

interface DesktopPackageJson {
  readonly scripts: Record<string, string>;
}

const desktopDir = dirname(dirname(fileURLToPath(import.meta.url)));
const packageJson = JSON.parse(
  readFileSync(join(desktopDir, 'package.json'), 'utf8'),
) as DesktopPackageJson;

describe('desktop package scripts', () => {
  it('launches the production-like renderer with the managed local backend', () => {
    const startRenderer = packageJson.scripts['start:renderer'];

    expect(startRenderer).toContain('build:backend');
    expect(startRenderer).toContain('AGENT_PLATFORM_DESKTOP_BACKEND=managed');
    expect(startRenderer).toContain('AGENT_PLATFORM_DESKTOP_RENDERER=standalone');
  });

  it('builds and tests the native macOS VM runner helper', () => {
    expect(packageJson.scripts['native:vm:assets:prepare']).toBe(
      'node scripts/prepare-macos-vm-assets.mjs',
    );
    expect(packageJson.scripts['native:vm:build']).toBe(
      'swift build --package-path native/macos-vm-runner',
    );
    expect(packageJson.scripts['native:vm:test']).toBe(
      'swift test --package-path native/macos-vm-runner',
    );
  });
});
