#!/usr/bin/env node
/**
 * Force-compile better-sqlite3 for the current Node (node-gyp --release).
 * `pnpm rebuild better-sqlite3` can no-op when install scripts were skipped; this runs
 * the package's build-release in its real directory under node_modules/.pnpm.
 */
import { execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(root, 'packages/db/package.json'));
const pkgJson = require.resolve('better-sqlite3/package.json');
const pkgDir = dirname(pkgJson);

execSync('npm run build-release', {
  cwd: pkgDir,
  stdio: 'inherit',
  env: process.env,
});
