#!/usr/bin/env node
/* global console, fetch, process */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { resolveWorkspaceConfig } from './workspace-config.mjs';

const FILE_NAME = 'compose-persistence-check.txt';
const RELATIVE_PATH = `generated/${FILE_NAME}`;
const CONTENT = 'workspace persistence verified by compose-backed check\n';

function resolveComposeWorkspaceHostPath(env = process.env) {
  if (env.AGENT_WORKSPACE_HOST_PATH?.trim()) {
    return resolve(env.AGENT_WORKSPACE_HOST_PATH);
  }
  if (env.AGENT_PLATFORM_HOME?.trim()) {
    return resolveWorkspaceConfig(env).workspaceHostPath;
  }
  return resolve('.agent-platform', 'workspaces', 'default');
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Expected ${url} to succeed, got ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

async function expectDenied(url) {
  const res = await fetch(url);
  if (res.status !== 403) {
    throw new Error(`Expected ${url} to return 403, got ${res.status}: ${await res.text()}`);
  }
  const body = await res.json();
  if (!body.error?.message || body.error.message.includes('PATH_ACCESS_DENIED')) {
    throw new Error(`Expected a human-readable denial message, got ${JSON.stringify(body)}`);
  }
}

async function verifyApi(apiUrl) {
  const list = await fetchJson(`${apiUrl}/v1/workspace/files?area=generated`);
  const files = list.data?.areas?.[0]?.files ?? [];
  if (!files.some((file) => file.path === RELATIVE_PATH && file.kind === 'file')) {
    throw new Error(`Expected ${RELATIVE_PATH} in workspace listing, got ${JSON.stringify(files)}`);
  }

  const download = await fetch(
    `${apiUrl}/v1/workspace/files/download?path=${encodeURIComponent(RELATIVE_PATH)}`,
  );
  if (!download.ok) {
    throw new Error(
      `Expected download to succeed, got ${download.status}: ${await download.text()}`,
    );
  }
  const text = await download.text();
  if (text !== CONTENT) {
    throw new Error(
      `Expected downloaded content ${JSON.stringify(CONTENT)}, got ${JSON.stringify(text)}`,
    );
  }

  await expectDenied(
    `${apiUrl}/v1/workspace/files/download?path=${encodeURIComponent('../secret.txt')}`,
  );
  await expectDenied(
    `${apiUrl}/v1/workspace/files/download?path=${encodeURIComponent('/etc/passwd')}`,
  );
}

async function main(argv = process.argv.slice(2), env = process.env) {
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(`Usage: node scripts/workspace-compose-verify.mjs [--write]

Verifies compose-backed workspace listing, download, denial, and persistence.
Run --write before restarting the API container, then run without --write after restart.`);
    return;
  }

  const apiUrl = env.API_URL ?? 'http://127.0.0.1:3000';
  const workspaceHostPath = resolveComposeWorkspaceHostPath(env);
  const generatedDir = join(workspaceHostPath, 'generated');

  if (argv.includes('--write')) {
    mkdirSync(generatedDir, { recursive: true });
    writeFileSync(join(generatedDir, FILE_NAME), CONTENT, 'utf8');
    console.log(`Wrote ${join(generatedDir, FILE_NAME)}`);
  }

  await verifyApi(apiUrl);
  console.log(`Verified workspace listing, download, and denial behavior for ${RELATIVE_PATH}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
