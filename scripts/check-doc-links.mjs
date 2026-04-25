#!/usr/bin/env node
/**
 * Local relative-link checker for markdown docs.
 *
 * Why: the CI workflow uses `lycheeverse/lychee-action` for full HTTP+anchor
 * link validation. Lychee is a Rust binary that isn't trivially installable
 * via npm, so for the `pnpm docs:lint` pre-commit experience we run this
 * lightweight Node-based checker instead. It validates that every relative
 * `[text](path)` link in our markdown files resolves to a file on disk.
 *
 * External (http/https/mailto) links are skipped here and validated by
 * lychee in CI. Run `pnpm docs:lint` to chain markdownlint + this checker.
 */

import { readFile, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const IGNORED_DIRS = new Set([
  'node_modules',
  'dist',
  'build',
  '.next',
  '.turbo',
  'coverage',
  'test-results',
  'data',
  '.git',
  '.beads',
]);

const IGNORED_FILE_GLOBS = [
  /\/CHANGELOG\.md$/,
  /\/docs\/tasks\//,
  /\/docs\/reviews\//,
  /\/docs\/planning\//,
  /\/packages\/[^/]+\/README\.md$/,
  /\/apps\/[^/]+\/README\.md$/,
  /\/agent_architecture_detailed_adr\.md$/,
  /\/agent_architecture_full_with_frontend\.md$/,
  /\/agent_platform_mvp_be346e14\.plan\.md$/,
  /\/\.github\/instructions\//,
  /\/docs\/architecture\/chat-model-ui\.md$/,
];

async function listMarkdownFiles(dir) {
  const out = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      out.push(...(await listMarkdownFiles(path.join(dir, entry.name))));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      const full = path.join(dir, entry.name);
      const rel = path.relative(repoRoot, full).replaceAll('\\', '/');
      if (IGNORED_FILE_GLOBS.some((rx) => rx.test('/' + rel))) continue;
      out.push(full);
    }
  }
  return out;
}

const LINK_RE = /\[(?:[^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

function shouldSkipLink(target) {
  if (!target) return true;
  if (target.startsWith('http://') || target.startsWith('https://')) return true;
  if (target.startsWith('mailto:') || target.startsWith('tel:')) return true;
  if (target.startsWith('#')) return true; // intra-doc anchor — out of scope
  return false;
}

async function checkFile(file) {
  const text = await readFile(file, 'utf8');
  const failures = [];
  for (const match of text.matchAll(LINK_RE)) {
    const raw = match[1];
    if (shouldSkipLink(raw)) continue;
    const [pathPart] = raw.split('#');
    if (!pathPart) continue;
    const resolved = path.resolve(path.dirname(file), pathPart);
    if (!existsSync(resolved)) {
      failures.push({ link: raw, resolved });
      continue;
    }
    try {
      const s = await stat(resolved);
      if (!s.isFile() && !s.isDirectory()) {
        failures.push({ link: raw, resolved });
      }
    } catch {
      failures.push({ link: raw, resolved });
    }
  }
  return failures;
}

async function main() {
  const files = await listMarkdownFiles(repoRoot);
  let total = 0;
  let broken = 0;
  for (const file of files) {
    const fails = await checkFile(file);
    total += 1;
    if (fails.length === 0) continue;
    broken += fails.length;
    const rel = path.relative(repoRoot, file);
    for (const f of fails) {
      console.error(`${rel}: broken relative link → ${f.link}`);
    }
  }
  if (broken > 0) {
    console.error(`\n${broken} broken relative link(s) across ${total} markdown file(s).`);
    process.exit(1);
  }
  console.log(`Relative-link check passed across ${total} markdown file(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
