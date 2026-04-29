#!/usr/bin/env node
import { chmodSync, mkdirSync } from 'node:fs';

import { WORKSPACE_CHILD_DIRECTORIES, resolveWorkspaceConfig } from './workspace-config.mjs';

const config = resolveWorkspaceConfig();

for (const directory of config.directories) {
  mkdirSync(directory, { recursive: true });
}

for (const directory of [
  config.dataHostPath,
  config.workspaceHostPath,
  ...WORKSPACE_CHILD_DIRECTORIES.map((dir) => join(config.workspaceHostPath, dir)),
]) {
  chmodSync(directory, 0o777);
}

console.log('Workspace storage ready');
console.log(`  platform home: ${config.platformHome}`);
console.log(`  workspace host path: ${config.workspaceHostPath}`);
console.log(`  workspace container path: ${config.workspaceContainerPath}`);
console.log(`  data host path: ${config.dataHostPath}`);
