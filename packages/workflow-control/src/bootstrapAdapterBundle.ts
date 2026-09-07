import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  bootstrapAdapterDependencies,
  validateBootstrapAdapterConfig,
} from './bootstrapAdapterRuntime.js';

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
  mkdirSync(outputDirectory, { mode: 0o700 }); // Existing destinations fail; never overwrite a reviewed bundle.
  const directory = realpathSync(outputDirectory);
  const files = Object.fromEntries(
    (['beads', 'remote'] as const).map((channel) => {
      const path = join(directory, `bootstrap-${channel}.mjs`);
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
    const result = buildBootstrapAdapters(
      JSON.parse(readFileSync(process.argv[2]!, 'utf8')),
      process.argv[3]!,
    );
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch {
    process.stderr.write(
      'bootstrap adapter build failed; expected CONFIG_JSON NEW_ABSOLUTE_DIRECTORY\n',
    );
    process.exitCode = 1;
  }
}
