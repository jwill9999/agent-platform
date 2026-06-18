#!/usr/bin/env node
/**
 * Force-compile native packages after hardened `pnpm install --ignore-scripts`.
 * `pnpm rebuild` can no-op when install scripts were skipped; this runs the
 * package scripts in their real directories under node_modules/.pnpm.
 */
import { execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dbRequire = createRequire(join(root, 'packages/db/package.json'));
const desktopRequire = createRequire(join(root, 'apps/desktop/package.json'));

runPackageScript(dbRequire, 'better-sqlite3/package.json', 'npm run build-release');
runPackageScript(desktopRequire, 'node-pty/package.json', 'npm run install');

execSync('node scripts/fix-node-pty-helpers.mjs', {
  cwd: root,
  stdio: 'inherit',
  env: process.env,
});

function runPackageScript(requireFromPackage, packageJsonSpecifier, command) {
  const pkgJson = requireFromPackage.resolve(packageJsonSpecifier);
  const pkgDir = dirname(pkgJson);
  execSync(command, {
    cwd: pkgDir,
    stdio: 'inherit',
    env: process.env,
  });
}
