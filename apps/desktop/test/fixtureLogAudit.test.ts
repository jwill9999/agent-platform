import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { auditFixtureLogLaunches } from './support/fixtureLogAudit.js';

const desktop = resolve(dirname(fileURLToPath(import.meta.url)), '..');
function sourceFiles(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : entry.name.endsWith('.ts') ? [path] : [];
  });
}
function fixtureProgram(files: string[], overrides = new Map<string, string>()): ts.Program {
  const options: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    skipLibCheck: true,
    types: [],
  };
  const host = ts.createCompilerHost(options);
  const originalRead = host.readFile.bind(host);
  const originalExists = host.fileExists.bind(host);
  host.fileExists = (path) => overrides.has(path) || originalExists(path);
  host.readFile = (path) => overrides.get(path) ?? originalRead(path);
  return ts.createProgram(files, options, host);
}

const e2eFiles = sourceFiles(join(desktop, 'e2e'));
const actual = fixtureProgram(e2eFiles);

describe('managed Electron fixture log ownership inventory', () => {
  it('resolves every actual launch and rejected-profile spawn through shared helper environments', () => {
    const inventory = auditFixtureLogLaunches(actual, e2eFiles);
    expect(inventory.length).toBeGreaterThan(15);
    expect(inventory.filter((entry) => !entry.valid)).toEqual([]);
    expect(inventory.some((entry) => entry.kind === 'spawn')).toBe(true);
    for (const helper of [
      'support/contextTokenFixture.ts',
      'workspace-listing.e2e.ts',
      'diagnostic-export.e2e.ts',
    ]) {
      expect(inventory.some((entry) => entry.file.endsWith(helper))).toBe(true);
    }
  });

  it('rejects each formerly unowned launch when its explicit override is removed', () => {
    const affected = [
      'project-git-workflow.e2e.ts',
      'project-access.e2e.ts',
      'webview-runtime.e2e.ts',
      'workspace-resource-export.e2e.ts',
    ];
    const overrides = new Map(
      affected.map((file) => {
        const path = join(desktop, 'e2e', file);
        return [
          path,
          readFileSync(path, 'utf8').replaceAll(
            /\s*AGENT_PLATFORM_DESKTOP_LOG_DIR: join\(runtimeDir, 'logs'\),/g,
            '',
          ),
        ];
      }),
    );
    const inventory = auditFixtureLogLaunches(fixtureProgram(e2eFiles, overrides), e2eFiles);
    expect(
      inventory
        .filter((entry) => !entry.valid)
        .map((entry) => entry.file.slice(desktop.length + 1)),
    ).toEqual([
      'e2e/project-access.e2e.ts',
      'e2e/project-access.e2e.ts',
      'e2e/project-git-workflow.e2e.ts',
      'e2e/project-git-workflow.e2e.ts',
      'e2e/project-git-workflow.e2e.ts',
      'e2e/webview-runtime.e2e.ts',
      'e2e/workspace-resource-export.e2e.ts',
    ]);
  });

  it.each([
    ['support/contextTokenFixture.ts', 1],
    ['workspace-listing.e2e.ts', 3],
    ['migration-startup.e2e.ts', 3],
  ] as const)(
    'rejects missing ownership in shared %s for all its actual launches',
    (file, count) => {
      const path = join(desktop, 'e2e', file);
      const source = readFileSync(path, 'utf8').replaceAll(
        /\s*AGENT_PLATFORM_DESKTOP_LOG_DIR: join\([^\n]+, 'logs'\),/g,
        '',
      );
      const inventory = auditFixtureLogLaunches(
        fixtureProgram(e2eFiles, new Map([[path, source]])),
        e2eFiles,
      );
      expect(inventory.filter((entry) => !entry.valid)).toHaveLength(count);
      expect(inventory.filter((entry) => !entry.valid).every((entry) => entry.file === path)).toBe(
        true,
      );
    },
  );

  it.each([
    ['missing', '...process.env, AGENT_PLATFORM_DESKTOP_RUNTIME_DIR: runtime'],
    ['inherited', '...process.env, HOME: runtime, AGENT_PLATFORM_DESKTOP_RUNTIME_DIR: runtime'],
    [
      'ambient overwrite',
      "AGENT_PLATFORM_DESKTOP_RUNTIME_DIR: runtime, AGENT_PLATFORM_DESKTOP_LOG_DIR: join(runtime, 'logs'), ...process.env",
    ],
    [
      'foreign root',
      "...process.env, AGENT_PLATFORM_DESKTOP_RUNTIME_DIR: runtime, AGENT_PLATFORM_DESKTOP_LOG_DIR: join(owner, 'logs')",
    ],
  ])('rejects %s log ownership in an actual helper-returned launch', (_name, properties) => {
    const path = join(desktop, 'e2e', '__audit_fixture__.ts');
    const source = `import { _electron as desktopElectron } from 'playwright'; import {join} from 'node:path';
      const runtime = '/owned/runtime'; const owner = '/unrelated';
      function helper() { return { options: {env: { ${properties} }} }; }
      const fixture = helper(); desktopElectron.launch(fixture.options);`;
    const inventory = auditFixtureLogLaunches(fixtureProgram([path], new Map([[path, source]])), [
      path,
    ]);
    expect(inventory).toHaveLength(1);
    expect(inventory[0]?.valid).toBe(false);
  });

  it('accepts explicit ownership after ambient overrides and follows imported helper parameters', () => {
    const helper = join(desktop, 'e2e', '__audit_helper__.ts');
    const launch = join(desktop, 'e2e', '__audit_launch__.ts');
    const overrides = new Map([
      [
        helper,
        "import {join} from 'node:path'; export function helper() { const runtime = '/owned/runtime'; return {env: {...process.env, AGENT_PLATFORM_DESKTOP_RUNTIME_DIR: runtime, AGENT_PLATFORM_DESKTOP_LOG_DIR: join(runtime, 'logs')}}; }",
      ],
      [
        launch,
        "import {_electron as desktopElectron} from 'playwright'; import {helper} from './__audit_helper__.js'; function launch(f: ReturnType<typeof helper>) { return desktopElectron.launch({...f, env: {...f.env, OWNED: 'yes'}}); }",
      ],
    ]);
    const inventory = auditFixtureLogLaunches(fixtureProgram([helper, launch], overrides), [
      launch,
    ]);
    expect(inventory).toHaveLength(1);
    expect(inventory[0]?.valid).toBe(true);
  });
});
