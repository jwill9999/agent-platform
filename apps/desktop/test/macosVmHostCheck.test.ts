import { dirname, join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const desktopDir = dirname(dirname(fileURLToPath(import.meta.url)));
const hostCheckScript = join(desktopDir, 'scripts/check-macos-vm-runner-host.mjs');

interface HostCheckModule {
  readonly parseArgs: (argv: string[]) => { readonly json: boolean };
  readonly parseMacosMajor: (version: string) => number | undefined;
  readonly formatReport: (report: {
    readonly ok: boolean;
    readonly checks: ReadonlyArray<{
      readonly name: string;
      readonly ok: boolean;
      readonly actual: string;
      readonly expected: string;
    }>;
  }) => string;
}

async function loadHostCheckModule(): Promise<HostCheckModule> {
  return (await import(pathToFileURL(hostCheckScript).href)) as HostCheckModule;
}

describe('macOS VM runner host preflight', () => {
  it('parses JSON output mode', async () => {
    const { parseArgs } = await loadHostCheckModule();

    expect(parseArgs(['--json'])).toEqual({ json: true });
    expect(parseArgs(['--', '--json'])).toEqual({ json: true });
    expect(parseArgs([])).toEqual({ json: false });
  });

  it('parses macOS major versions conservatively', async () => {
    const { parseMacosMajor } = await loadHostCheckModule();

    expect(parseMacosMajor('15.7.1')).toBe(15);
    expect(parseMacosMajor('26.5')).toBe(26);
    expect(parseMacosMajor('not-a-version')).toBeUndefined();
  });

  it('formats failed checks with actual and expected values', async () => {
    const { formatReport } = await loadHostCheckModule();

    expect(
      formatReport({
        ok: false,
        checks: [
          {
            name: 'architecture',
            ok: false,
            actual: 'x86_64',
            expected: 'arm64',
          },
        ],
      }),
    ).toContain('FAIL architecture: actual=x86_64; expected=arm64');
  });
});
