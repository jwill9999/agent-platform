import { createHash } from 'node:crypto';
import {
  closeSync,
  constants,
  fstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  bootstrapAdapterDependencies,
  validateBootstrapAdapterConfig,
} from './bootstrapAdapterRuntime.js';

function assertCanonicalBuildPath(path: string): void {
  if (!isAbsolute(path) || /[\r\n\0]/u.test(path) || resolve(path) !== path)
    throw new Error('bootstrap adapter build requires canonical paths');
  const parent = dirname(path);
  if (realpathSync(parent) !== parent || !statSync(parent).isDirectory())
    throw new Error('bootstrap adapter build parent directory is not canonical');
}

function readBuildConfig(inputPath: string): unknown {
  const root = realpathSync(process.cwd());
  const path = isAbsolute(inputPath) ? inputPath : resolve(root, inputPath);
  const fromRoot = relative(root, path);
  if (!isAbsolute(inputPath) && (fromRoot === '..' || fromRoot.startsWith(`..${sep}`)))
    throw new Error('relative bootstrap config must remain inside the working directory');
  assertCanonicalBuildPath(path);
  if (realpathSync(path) !== path)
    throw new Error('bootstrap adapter config must not be a symlink');
  const descriptor = openSync(
    path,
    constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
  );
  try {
    if (!fstatSync(descriptor).isFile())
      throw new Error('bootstrap adapter config must be a regular file');
    return JSON.parse(readFileSync(descriptor, 'utf8')) as unknown;
  } finally {
    closeSync(descriptor);
  }
}

/** Build only: writes a new deployment directory, never executes Beads/Git or changes a journal. */
export function buildBootstrapAdapters(configInput: unknown, outputDirectory: string) {
  const config = validateBootstrapAdapterConfig(configInput);
  if (!isAbsolute(outputDirectory) || /\s/u.test(config.node.path))
    throw new Error('bootstrap adapter deployment requires absolute paths');
  const runtime = readFileSync(
    new URL('../dist/bootstrapAdapterRuntime.js', import.meta.url),
    'utf8',
  );
  // The distributable runtime may import only Node builtins; copied code has no mutable npm closure.
  if (
    /\b(?:import\s*\(|require\s*\()/u.test(runtime) ||
    [...runtime.matchAll(/from\s+['"]([^'"]+)['"]/gu)].some(
      (match) => !match[1]!.startsWith('node:'),
    )
  )
    throw new Error('bootstrap runtime contains an unpinned module dependency');
  assertCanonicalBuildPath(outputDirectory);
  mkdirSync(outputDirectory, { mode: 0o700 }); // Existing destinations fail; never overwrite a reviewed bundle.
  const directory = realpathSync(outputDirectory);
  if (directory !== outputDirectory)
    throw new Error('bootstrap adapter deployment directory changed');
  const files = Object.fromEntries(
    (['beads', 'remote'] as const).map((channel) => {
      const path = join(directory, `bootstrap-${channel}.mjs`);
      assertCanonicalBuildPath(path);
      if (dirname(path) !== directory)
        throw new Error('bootstrap adapter file escaped its deployment directory');
      const content = `#!${config.node.path}\n${runtime}\nbootstrapAdapterMain(${JSON.stringify(config)},${JSON.stringify(channel)});\n`;
      writeFileSync(path, content, { flag: 'wx', mode: 0o700 });
      return [
        channel,
        { path, digest: `sha256:${createHash('sha256').update(content).digest('hex')}` },
      ];
    }),
  );
  const dependencies = [
    ...new Map(bootstrapAdapterDependencies(config).map((pin) => [pin.path, pin])).values(),
  ];
  return {
    remoteBinary: files.remote!.path,
    remoteBinaryDigest: files.remote!.digest,
    beadsReadBinary: files.beads!.path,
    beadsReadBinaryDigest: files.beads!.digest,
    dependencies,
  };
}

if (
  process.argv[1] !== undefined &&
  realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    if (process.argv.length !== 4) throw new Error('invalid arguments');
    const result = buildBootstrapAdapters(readBuildConfig(process.argv[2]!), process.argv[3]!);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch {
    process.stderr.write(
      'bootstrap adapter build failed; expected CONFIG_JSON NEW_ABSOLUTE_DIRECTORY\n',
    );
    process.exitCode = 1;
  }
}
