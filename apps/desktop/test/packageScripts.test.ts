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
});
